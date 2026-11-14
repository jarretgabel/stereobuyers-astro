import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_s3 as s3, aws_cloudfront as cf, aws_cloudfront_origins as origins } from 'aws-cdk-lib';
import { aws_certificatemanager as acm, aws_route53 as route53, aws_route53_targets as targets } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

export interface SiteStackProps extends cdk.StackProps {
  /** Apex domain; the site is served on `www.<domainName>` and `<domainName>` (apex redirects to www). */
  domainName: string;
  /** true: look up the Route 53 zone, create the ACM cert and alias records. false: DNS lives elsewhere. */
  manageDns: boolean;
  /** Existing us-east-1 certificate (used when manageDns is false). Without a cert, no aliases are attached. */
  certificateArn?: string;
  /** GitHub repo allowed to deploy via OIDC. The deploy role is only created when both are set. */
  githubOwner?: string;
  githubRepo?: string;
  githubBranch: string;
  /** Existing GitHub OIDC provider ARN (only one per account is allowed); created if omitted. */
  githubOidcProviderArn?: string;
}

// Only /_astro/* is content-hashed; /assets/css and /assets/js keep stable names so they use the short HTML cache.
const dist = path.join(__dirname, '../../dist');
const kvsFile = path.join(__dirname, '../generated/redirect-kvs.json');

export class SiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);
    const www = `www.${props.domainName}`;

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ noncurrentVersionExpiration: cdk.Duration.days(30) }],
    });

    // DNS + certificate
    let zone: route53.IHostedZone | undefined;
    let certificate: acm.ICertificate | undefined;
    if (props.manageDns) {
      zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });
      certificate = new acm.Certificate(this, 'Certificate', {
        domainName: www,
        subjectAlternativeNames: [props.domainName],
        validation: acm.CertificateValidation.fromDns(zone),
      });
    } else if (props.certificateArn) {
      certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn);
    }

    // Viewer-request function + KeyValueStore (data from scripts/generate-redirect-data.mjs)
    if (!fs.existsSync(kvsFile)) throw new Error('Missing infra/generated/redirect-kvs.json; run `npm run generate`.');
    const keyValueStore = new cf.KeyValueStore(this, 'RedirectStore', {
      source: cf.ImportSource.fromInline(fs.readFileSync(kvsFile, 'utf8')),
    });
    const viewerRequest = new cf.Function(this, 'ViewerRequest', {
      runtime: cf.FunctionRuntime.JS_2_0,
      code: cf.FunctionCode.fromFile({ filePath: path.join(__dirname, '../functions/viewer-request.js') }),
      keyValueStore,
    });
    const functionAssociations = [{ function: viewerRequest, eventType: cf.FunctionEventType.VIEWER_REQUEST }];

    // Cache + headers policies
    const compression = { enableAcceptEncodingBrotli: true, enableAcceptEncodingGzip: true };
    const htmlCache = new cf.CachePolicy(this, 'ShortCache', {
      defaultTtl: cdk.Duration.minutes(5),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.minutes(5),
      ...compression,
    });
    const assetCache = new cf.CachePolicy(this, 'ImmutableCache', {
      defaultTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.days(365),
      maxTtl: cdk.Duration.days(365),
      ...compression,
    });
    const mediaCache = new cf.CachePolicy(this, 'MediaCache', {
      defaultTtl: cdk.Duration.days(30),
      minTtl: cdk.Duration.days(1),
      maxTtl: cdk.Duration.days(30),
      ...compression,
    });
    // No Content-Security-Policy on purpose: the site relies on many third-party inline scripts.
    const headers = new cf.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        referrerPolicy: { referrerPolicy: cf.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
        frameOptions: { frameOption: cf.HeadersFrameOption.SAMEORIGIN, override: true },
      },
    });

    // Custom 404: only when the site actually ships a 404.html (S3 + OAC answers 403 for missing keys).
    // TODO: the current build has no 404.html; add src/pages/404.astro to enable this automatically.
    const has404 = fs.existsSync(path.join(dist, '404.html'));
    const errorResponses: cf.ErrorResponse[] = has404
      ? [403, 404].map((httpStatus) => ({
          httpStatus,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: cdk.Duration.minutes(1),
        }))
      : [];

    const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
    const common = {
      origin,
      viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cf.AllowedMethods.ALLOW_GET_HEAD,
      compress: true,
      responseHeadersPolicy: headers,
      functionAssociations,
    };

    const distribution = new cf.Distribution(this, 'Distribution', {
      comment: `${www} static site`,
      defaultRootObject: 'index.html',
      httpVersion: cf.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: certificate ? cf.SecurityPolicyProtocol.TLS_V1_2_2021 : undefined,
      domainNames: certificate ? [www, props.domainName] : undefined,
      certificate,
      errorResponses,
      defaultBehavior: { ...common, cachePolicy: htmlCache },
      additionalBehaviors: {
        '/_astro/*': { ...common, cachePolicy: assetCache },
        '/assets/media/*': { ...common, cachePolicy: mediaCache },
      },
    });

    if (zone) {
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
      for (const [name, recordName] of [['Www', www], ['Apex', props.domainName]]) {
        new route53.ARecord(this, `${name}A`, { zone, recordName, target });
        new route53.AaaaRecord(this, `${name}AAAA`, { zone, recordName, target });
      }
    }

    // GitHub Actions deploy role (OIDC)
    if (props.githubOwner && props.githubRepo) {
      const provider = props.githubOidcProviderArn
        ? iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, 'GithubOidc', props.githubOidcProviderArn)
        : new iam.OpenIdConnectProvider(this, 'GithubOidc', {
            url: 'https://token.actions.githubusercontent.com',
            clientIds: ['sts.amazonaws.com'],
          });
      const role = new iam.Role(this, 'DeployRole', {
        description: `GitHub Actions deploy for ${props.githubOwner}/${props.githubRepo}`,
        maxSessionDuration: cdk.Duration.hours(1),
        assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
          StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${props.githubOwner}/${props.githubRepo}:ref:refs/heads/${props.githubBranch}`,
          },
        }),
      });
      role.addToPolicy(new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [bucket.bucketArn],
      }));
      role.addToPolicy(new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:DeleteObject'],
        resources: [bucket.arnForObjects('*')],
      }));
      role.addToPolicy(new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation'],
        resources: [distribution.distributionArn],
      }));
      new cdk.CfnOutput(this, 'DeployRoleArn', { value: role.roleArn });
    }

    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'DistributionDomain', { value: distribution.distributionDomainName });
  }
}
