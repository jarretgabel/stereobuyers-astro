import * as cdk from 'aws-cdk-lib';
import { SiteStack } from '../lib/site-stack';

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
