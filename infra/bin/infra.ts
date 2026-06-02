#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { SurgentStack } from '../lib/surgent-stack'

const app = new cdk.App()

function requiredEnv(...names: string[]) {
  const name = names.find((it) => process.env[it])
  if (!name) throw new Error(`${names.join(' or ')} is required`)
  return process.env[name]!
}

new SurgentStack(app, 'SurgentStack', {
  env: {
    account: requiredEnv('AWS_ACCOUNT_ID', 'CDK_DEFAULT_ACCOUNT'),
    region: requiredEnv('AWS_REGION', 'CDK_DEFAULT_REGION'),
  },
})
