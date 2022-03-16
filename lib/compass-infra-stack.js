const { Stack, CfnOutput } = require('aws-cdk-lib');
const acm = require('aws-cdk-lib/aws-certificatemanager');
const cf = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const route53 = require('aws-cdk-lib/aws-route53');
const s3 = require('aws-cdk-lib/aws-s3');
const targets = require('aws-cdk-lib/aws-route53-targets');

require('dotenv').config()

class CompassInfraStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // inputs from .env
    const domainName = process.env.SITE_URL

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

    new CfnOutput(this, 'bucketName', { value: appBucket.bucketName });
    new CfnOutput(this, 'distributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'hostedZoneId', { value: hostedZone.zoneName });
  }
}

module.exports = { CompassInfraStack }
