import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface CmsAuthStackProps extends cdk.StackProps {
  /** Origins allowed to receive the sign-in token (where /admin/ is served). */
  allowedOrigins: string[];
}

/** GitHub OAuth client for the /admin/ CMS. Credentials live in SSM Parameter Store (created by hand, see infra/README.md). */
export class CmsAuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CmsAuthStackProps) {
    super(scope, id, props);

    const clientIdParam = '/stereobuyers/cms/github-client-id';
    const clientSecretParam = '/stereobuyers/cms/github-client-secret';

    const fn = new lambda.Function(this, 'Auth', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../functions/cms-auth')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        CLIENT_ID_PARAM: clientIdParam,
        CLIENT_SECRET_PARAM: clientSecretParam,
        ALLOWED_ORIGINS: props.allowedOrigins.join(','),
      },
    });
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [clientIdParam, clientSecretParam].map((p) => this.formatArn({ service: 'ssm', resource: 'parameter', resourceName: p.slice(1) })),
    }));

    const url = fn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });
    new cdk.CfnOutput(this, 'AuthUrl', { value: url.url, description: 'Use as backend.base_url in public/admin/config.yml' });
    new cdk.CfnOutput(this, 'CallbackUrl', { value: `${url.url}callback`, description: 'Authorization callback URL of the GitHub OAuth app' });
  }
}
