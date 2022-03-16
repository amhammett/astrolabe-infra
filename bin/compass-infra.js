#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { CompassInfraStack } = require('../lib/compass-infra-stack');

const app = new cdk.App();
const account = app.node.tryGetContext('account')
const region = app.node.tryGetContext('region')

new CompassInfraStack(app, 'CompassInfraStack', {
  env: {
    account: account,
    region: region,
  },
});
