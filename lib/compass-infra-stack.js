const { CfnOutput, SecretValue, Stack } = require('aws-cdk-lib');
const acm = require('aws-cdk-lib/aws-certificatemanager');
const cf = require('aws-cdk-lib/aws-cloudfront');
const codebuild = require('aws-cdk-lib/aws-codebuild');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const route53 = require('aws-cdk-lib/aws-route53');
const codepipeline = require('aws-cdk-lib/aws-codepipeline');
const codepipeline_actions = require('aws-cdk-lib/aws-codepipeline-actions');
const s3 = require('aws-cdk-lib/aws-s3');
const targets = require('aws-cdk-lib/aws-route53-targets');

require('dotenv').config()

class CompassInfraStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // inputs from .env
    const domainName = process.env.SITE_URL
    const repositoryOwner = process.env.GITHUB_REPOSITORY_OWNER
    const repositoryName = process.env.GITHUB_REPOSITORY_NAME
    const githubOauthToken = process.env.GITHUB_OAUTH_TOKEN
    const googleAnalyticsId = process.env.GOOGLE_ANALYTICS_ID

    const hostedZone = new route53.HostedZone(this, 'hostedZone', {
      zoneName: domainName,
    });

    const appCertificate = new acm.DnsValidatedCertificate(this, 'appCertificate', {
      domainName,
      hostedZone,
      region: 'us-east-1',
    });

    const appBucket = new s3.Bucket(this, 'appBucket', {
      bucketName: `${domainName}-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    })

    const distribution = new cf.Distribution(this, 'appDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(appBucket, {
          originPath: '/dist',
        }),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      defaultRootObject: 'index.html',
      domainNames: [domainName],
      certificate: appCertificate,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        }, {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      httpVersion: cf.HttpVersion.HTTP2,
    });

    new route53.ARecord(this, 'appDistributionRecord', {
      recordName: domainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    })

    // pipeline
    const sourceOutput = new codepipeline.Artifact();
    const webSourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: repositoryOwner,
      repo: repositoryName,
      oauthToken: SecretValue.secretsManager(githubOauthToken),
      output: sourceOutput,
      branch: 'main',
    });

    const webBuildProject = new codebuild.PipelineProject(this, 'webProject', {
      environment: {
        computeType: 'BUILD_GENERAL1_SMALL',
        image: codebuild.LinuxBuildImage.STANDARD_5_0,
        type: 'LINUX_CONTAINER',
      },
      environmentVariables: {
        REACT_APP_PROD_URL: { value: domainName }, // all envs will be prod which is bad. :()
        REACT_APP_GA_ID: { value: googleAnalyticsId },
        S3_BUCKET: { value: appBucket.bucketName },
        DISTRIBUTION_ID: { value: distribution.distributionId },
        REGION: { value: this.region },
        badge: { value: true },
      }
    });
    const webBuild = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: webBuildProject,
      input: sourceOutput,
    });

    const webPipeline = new codepipeline.Pipeline(this, 'webPipeline', {
      pipelineName: `${domainName}-web-deploy`,
      stages: [
        {stageName: 'Source', actions: [webSourceAction]},
        {stageName: 'Build', actions: [webBuild]},
      ],
    });

    new CfnOutput(this, 'bucketName', { value: appBucket.bucketName });
    new CfnOutput(this, 'distributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'hostedZoneId', { value: hostedZone.zoneName });
  }
}

module.exports = { CompassInfraStack }
