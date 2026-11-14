import * as cdk from 'aws-cdk-lib';
import { SiteStack } from '../lib/site-stack';
import { CmsAuthStack } from '../lib/cms-auth-stack';

const app = new cdk.App();
const ctx = (key: string) => app.node.tryGetContext(key) as string | undefined;

new SiteStack(app, 'StereobuyersSite', {
  // CloudFront certificates must live in us-east-1, so the whole stack is deployed there.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  domainName: ctx('domainName') ?? 'stereobuyers.com',
  manageDns: ctx('manageDns') !== 'false',
  certificateArn: ctx('certificateArn'),
  githubOwner: ctx('githubOwner'),
  githubRepo: ctx('githubRepo'),
  githubBranch: ctx('githubBranch') ?? 'main',
  githubOidcProviderArn: ctx('githubOidcProviderArn'),
});

new CmsAuthStack(app, 'StereobuyersCmsAuth', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  allowedOrigins: (ctx('cmsOrigins') ?? 'https://d2rvzx4bkrsjel.cloudfront.net,https://www.stereobuyers.com,https://stereobuyers.com').split(',').map((o) => o.trim()).filter(Boolean),
});
