#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { SurgentStack } from '../lib/surgent-stack'

const app = new cdk.App()

new SurgentStack(app, 'SurgentStack', {
  env: {
    account: '784713213970',
    region: 'us-east-1',
  },
})
