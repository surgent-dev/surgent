import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { Construct } from 'constructs'

const WORKER_SSM_PREFIX = '/surgent/prod'
const ANALYTICS_SSM_PREFIX = '/surgent/prod/analytics'

const WORKER_SECRET_NAMES = [
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'BETTER_AUTH_ADMIN_EMAILS',
  'BETTER_AUTH_ADMIN_USER_IDS',
  'BETTER_AUTH_ADMIN_ROLES',
  'CLIENT_ORIGIN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'CONVEX_HOST',
  'CONVEX_TEAM_ID',
  'CONVEX_TEAM_TOKEN',
  'DATABASE_URL',
  'DAYTONA_API_KEY',
  'DAYTONA_API_URL',
  'DAYTONA_ORG_ID',
  'DAYTONA_SNAPSHOT',
  'DISPATCH_NAMESPACE_NAME',
  'E2B_API_KEY',
  'E2B_TEMPLATE',
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_SLUG',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_STATE_SECRET',
  'GITHUB_WEBHOOK_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OPENAI_API_KEY',
  'POSTGRES_TYPE',
  'TRUSTED_ORIGINS',
  'XAI_API_KEY',
  'OPENCODE_BASE_URL',
  'SURGENT_BASE_URL',
  'S3_TOKEN_VALUE',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_REGION',
  'UPLOADS_PUBLIC_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_MONTHLY_PRICE_ID',
  'STRIPE_PRO_YEARLY_PRICE_ID',
  'STRIPE_TOPUP_MIN_USD',
  'WHOP_TEST_API_KEY',
  'WHOP_TEST_PLATFORM_COMPANY_ID',
  'WHOP_TEST_WEBHOOK_SECRET',
  'WHOP_LIVE_API_KEY',
  'WHOP_LIVE_PLATFORM_COMPANY_ID',
  'WHOP_LIVE_WEBHOOK_SECRET',
  'ENTRI_APP_ID',
  'ENTRI_SECRET',
  'ENTRI_API_KEY',
  'ENTRI_WEBHOOK_SECRET',
  'CLOUDFLARE_ZONE_ID',
  'RESEND_API_KEY',
] as const

const ANALYTICS_SECRET_NAMES = ['DATABASE_URL'] as const

function createRepository(scope: Construct, id: string, repositoryName: string) {
  return new ecr.Repository(scope, id, {
    repositoryName,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    lifecycleRules: [
      {
        maxImageCount: 10,
        description: 'Keep last 10 images',
      },
    ],
  })
}

function loadSecrets(scope: Construct, prefix: string, names: readonly string[]) {
  const secrets: Record<string, ecs.Secret> = {}
  const key = prefix.replace(/[\/-]/g, '')

  for (const name of names) {
    secrets[name] = ecs.Secret.fromSsmParameter(
      ssm.StringParameter.fromSecureStringParameterAttributes(scope, `Param${key}${name}`, {
        parameterName: `${prefix}/${name}`,
      }),
    )
  }

  return secrets
}

export class SurgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // VPC with 2 public subnets, no NAT gateway
    const vpc = new ec2.Vpc(this, 'SurgentVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    })

    const workerRepository = createRepository(this, 'SurgentWorkerRepo', 'surgent/worker')
    const analyticsRepository = createRepository(this, 'SurgentAnalyticsRepo', 'surgent/analytics')

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'SurgentCluster', {
      vpc,
      clusterName: 'surgent-cluster',
      defaultCloudMapNamespace: {
        name: 'surgent.internal',
      },
    })

    // Wildcard ACM Certificate for *.surgent.dev
    const certificate = new acm.Certificate(this, 'SurgentWildcardCert', {
      domainName: '*.surgent.dev',
      validation: acm.CertificateValidation.fromDns(),
    })

    const workerSecrets = loadSecrets(this, WORKER_SSM_PREFIX, WORKER_SECRET_NAMES)
    const analyticsSecrets = loadSecrets(this, ANALYTICS_SSM_PREFIX, ANALYTICS_SECRET_NAMES)

    // ==================== ALB ====================

    const alb = new elbv2.ApplicationLoadBalancer(this, 'SharedAlb', {
      vpc,
      internetFacing: true,
      loadBalancerName: 'surgent-alb',
    })

    alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    })

    const httpsListener = alb.addListener('HttpsListener', {
      port: 443,
      certificates: [certificate],
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Not Found',
      }),
    })

    // ==================== WORKER SERVICE ====================

    const workerTaskDef = new ecs.FargateTaskDefinition(this, 'WorkerTaskDef', {
      cpu: 512,
      memoryLimitMiB: 1024,
    })

    workerTaskDef.addContainer('worker', {
      image: ecs.ContainerImage.fromEcrRepository(workerRepository, 'latest'),
      containerName: 'worker',
      portMappings: [{ containerPort: 4000 }],
      secrets: {
        ...workerSecrets,
      },
      environment: {
        NODE_ENV: 'production',
        PORT: '4000',
        HOST: '0.0.0.0',
        ANALYTICS_URL: 'http://analytics.surgent.internal:3007',
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'surgent-worker' }),
    })

    const workerService = new ecs.FargateService(this, 'SurgentWorkerService', {
      cluster,
      serviceName: 'surgent-worker',
      taskDefinition: workerTaskDef,
      desiredCount: 2,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
    })

    const workerTargetGroup = new elbv2.ApplicationTargetGroup(this, 'WorkerTargetGroup', {
      vpc,
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        port: '4000',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    })

    workerService.attachToApplicationTargetGroup(workerTargetGroup)

    httpsListener.addTargetGroups('WorkerRule', {
      targetGroups: [workerTargetGroup],
      priority: 10,
      conditions: [elbv2.ListenerCondition.hostHeaders(['api.surgent.dev'])],
    })

    const workerScaling = workerService.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 8,
    })

    workerScaling.scaleOnRequestCount('RequestCountScaling', {
      targetGroup: workerTargetGroup,
      requestsPerTarget: 200,
      scaleInCooldown: cdk.Duration.seconds(120),
      scaleOutCooldown: cdk.Duration.seconds(60),
    })

    workerService.connections.allowFrom(alb, ec2.Port.tcp(4000), 'Allow traffic from ALB')

    // ==================== ANALYTICS SERVICE ====================

    const analyticsTaskDef = new ecs.FargateTaskDefinition(this, 'AnalyticsTaskDef', {
      cpu: 512,
      memoryLimitMiB: 1024,
    })

    analyticsTaskDef.addContainer('analytics', {
      image: ecs.ContainerImage.fromEcrRepository(analyticsRepository, 'latest'),
      containerName: 'analytics',
      portMappings: [{ containerPort: 3007 }],
      secrets: {
        DATABASE_URL: analyticsSecrets.DATABASE_URL,
      },
      environment: {
        NODE_ENV: 'production',
        PORT: '3007',
        HOSTNAME: '0.0.0.0',
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'surgent-analytics' }),
    })

    const analyticsService = new ecs.FargateService(this, 'SurgentAnalyticsService', {
      cluster,
      serviceName: 'surgent-analytics',
      taskDefinition: analyticsTaskDef,
      desiredCount: 2,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      cloudMapOptions: {
        name: 'analytics',
      },
    })

    const analyticsTargetGroup = new elbv2.ApplicationTargetGroup(this, 'AnalyticsTargetGroup', {
      vpc,
      port: 3007,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/api/heartbeat',
        port: '3007',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    })

    analyticsService.attachToApplicationTargetGroup(analyticsTargetGroup)

    httpsListener.addTargetGroups('AnalyticsPublicRule', {
      targetGroups: [analyticsTargetGroup],
      priority: 20,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(['analytics.surgent.dev']),
        elbv2.ListenerCondition.pathPatterns([
          '/api/send',
          '/api/batch',
          '/api/heartbeat',
          '/api/config',
        ]),
      ],
    })

    httpsListener.addTargetGroups('AnalyticsTrackingRule', {
      targetGroups: [analyticsTargetGroup],
      priority: 21,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(['analytics.surgent.dev']),
        elbv2.ListenerCondition.pathPatterns(['/', '/script.js', '/p/*', '/q/*']),
      ],
    })

    const analyticsScaling = analyticsService.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 6,
    })

    analyticsScaling.scaleOnRequestCount('AnalyticsRequestCountScaling', {
      targetGroup: analyticsTargetGroup,
      requestsPerTarget: 200,
      scaleInCooldown: cdk.Duration.seconds(120),
      scaleOutCooldown: cdk.Duration.seconds(60),
    })

    analyticsService.connections.allowFrom(alb, ec2.Port.tcp(3007), 'Allow traffic from ALB')
    analyticsService.connections.allowFrom(
      workerService,
      ec2.Port.tcp(3007),
      'Allow private worker traffic to analytics',
    )

    // ==================== OUTPUTS ====================

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS name - point api.surgent.dev and analytics.surgent.dev CNAMEs here',
    })

    new cdk.CfnOutput(this, 'WorkerRepositoryUri', {
      value: workerRepository.repositoryUri,
      description: 'Worker ECR repository URI for docker push',
    })

    new cdk.CfnOutput(this, 'AnalyticsRepositoryUri', {
      value: analyticsRepository.repositoryUri,
      description: 'Analytics ECR repository URI for docker push',
    })

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: certificate.certificateArn,
      description: 'Wildcard ACM certificate ARN - add DNS validation CNAME in Cloudflare',
    })
  }
}
