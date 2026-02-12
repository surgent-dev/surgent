import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import { Construct } from 'constructs'

const SSM_PREFIX = '/surgent/prod'

const SECRET_NAMES = [
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
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
  'INNGEST_SIGNING_KEY',
  'INNGEST_EVENT_KEY',
  'AUTUMN_SECRET_KEY',
] as const

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

    // ECR Repository with lifecycle policy
    const repository = new ecr.Repository(this, 'SurgentWorkerRepo', {
      repositoryName: 'surgent/worker',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep last 10 images',
        },
      ],
    })

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'SurgentCluster', {
      vpc,
      clusterName: 'surgent-cluster',
    })

    // Wildcard ACM Certificate for *.surgent.dev (shared by all services)
    const certificate = new acm.Certificate(this, 'SurgentWildcardCert', {
      domainName: '*.surgent.dev',
      validation: acm.CertificateValidation.fromDns(),
    })

    // Load secrets from SSM Parameter Store
    const secrets: Record<string, ecs.Secret> = {}
    for (const name of SECRET_NAMES) {
      secrets[name] = ecs.Secret.fromSsmParameter(
        ssm.StringParameter.fromSecureStringParameterAttributes(this, `Param${name}`, {
          parameterName: `${SSM_PREFIX}/${name}`,
        }),
      )
    }

    // ==================== SHARED ALB ====================

    const alb = new elbv2.ApplicationLoadBalancer(this, 'SharedAlb', {
      vpc,
      internetFacing: true,
      loadBalancerName: 'surgent-alb',
    })

    // HTTP listener redirects to HTTPS
    alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    })

    // HTTPS listener with default 404 response
    const httpsListener = alb.addListener('HttpsListener', {
      port: 443,
      certificates: [certificate],
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Not Found',
      }),
    })

    // ==================== SURGENT-WORKER SERVICE ====================

    const workerTaskDef = new ecs.FargateTaskDefinition(this, 'WorkerTaskDef', {
      cpu: 512,
      memoryLimitMiB: 1024,
    })

    workerTaskDef.addContainer('worker', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      containerName: 'worker',
      portMappings: [{ containerPort: 4000 }],
      secrets,
      environment: {
        NODE_ENV: 'production',
        PORT: '4000',
        HOST: '0.0.0.0',
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

    // Host-based routing: api.surgent.dev -> worker
    httpsListener.addTargetGroups('WorkerRule', {
      targetGroups: [workerTargetGroup],
      priority: 10,
      conditions: [elbv2.ListenerCondition.hostHeaders(['api.surgent.dev'])],
    })

    // Auto-scaling: min 2, max 8
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

    // Security: ECS only allows traffic from ALB on port 4000
    workerService.connections.allowFrom(alb, ec2.Port.tcp(4000), 'Allow traffic from ALB')

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS name - point api.surgent.dev and pay.surgent.dev CNAME here',
    })

    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: repository.repositoryUri,
      description: 'ECR repository URI for docker push',
    })

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: certificate.certificateArn,
      description: 'Wildcard ACM certificate ARN - add DNS validation CNAME in Cloudflare',
    })

    // ==================== SURPAY SERVICE ====================

    // ECR Repository for surpay
    const surpayRepository = new ecr.Repository(this, 'SurpayRepo', {
      repositoryName: 'surgent/pay',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep last 10 images',
        },
      ],
    })

    // SQS Dead Letter Queue for webhooks
    const webhooksDlq = new sqs.Queue(this, 'WebhooksDlq', {
      queueName: 'surgent-webhooks-dlq',
      retentionPeriod: cdk.Duration.days(14),
    })

    // SQS Queue for webhooks
    const webhooksQueue = new sqs.Queue(this, 'WebhooksQueue', {
      queueName: 'surgent-webhooks',
      visibilityTimeout: cdk.Duration.seconds(30),
      deadLetterQueue: {
        queue: webhooksDlq,
        maxReceiveCount: 3,
      },
    })

    // Load surpay secrets from SSM Parameter Store
    const surpaySecrets: Record<string, ecs.Secret> = {}
    const surpaySecretNames = [
      'DATABASE_URL',
      'STRIPE_SECRET_KEY',
      'STRIPE_CLIENT_ID',
      'STRIPE_WEBHOOK_SECRET',
      'BETTER_AUTH_SECRET',
      'WEB_BASE_URL',
      'TRUSTED_ORIGINS',
      'WHOP_API_KEY',
      'WHOP_PLATFORM_COMPANY_ID',
      'WHOP_WEBHOOK_SECRET',
    ] as const
    for (const name of surpaySecretNames) {
      surpaySecrets[name] = ecs.Secret.fromSsmParameter(
        ssm.StringParameter.fromSecureStringParameterAttributes(this, `SurpayParam${name}`, {
          parameterName: `${SSM_PREFIX}/${name}`,
        }),
      )
    }

    const surpayTaskDef = new ecs.FargateTaskDefinition(this, 'SurpayTaskDef', {
      cpu: 256,
      memoryLimitMiB: 512,
    })

    surpayTaskDef.addContainer('surpay', {
      image: ecs.ContainerImage.fromEcrRepository(surpayRepository, 'latest'),
      containerName: 'surpay',
      portMappings: [{ containerPort: 8090 }],
      secrets: surpaySecrets,
      environment: {
        DATABASE_MAX_CONNECTIONS: '5',
        DATABASE_MIN_CONNECTIONS: '1',
        SERVICE_PORT: '8090',
        SERVICE_HOST: '0.0.0.0',
        SURPAY_BASE_URL: 'https://pay.surgent.dev',
        SQS_WEBHOOKS_QUEUE_URL: webhooksQueue.queueUrl,
        SQS_WEBHOOKS_DLQ_URL: webhooksDlq.queueUrl,
        RUST_LOG: 'warn,surpay=info',
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'surpay' }),
    })

    const surpayService = new ecs.FargateService(this, 'SurpayService', {
      cluster,
      serviceName: 'surpay',
      taskDefinition: surpayTaskDef,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
    })

    // Grant SQS permissions to surpay task role (producer and consumer)
    webhooksQueue.grantSendMessages(surpayTaskDef.taskRole)
    webhooksQueue.grantConsumeMessages(surpayTaskDef.taskRole)
    webhooksDlq.grantSendMessages(surpayTaskDef.taskRole)
    webhooksDlq.grantConsumeMessages(surpayTaskDef.taskRole)

    const surpayTargetGroup = new elbv2.ApplicationTargetGroup(this, 'SurpayTargetGroup', {
      vpc,
      port: 8090,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        port: '8090',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    })

    surpayService.attachToApplicationTargetGroup(surpayTargetGroup)

    // Host-based routing: pay.surgent.dev -> surpay
    httpsListener.addTargetGroups('SurpayRule', {
      targetGroups: [surpayTargetGroup],
      priority: 20,
      conditions: [elbv2.ListenerCondition.hostHeaders(['pay.surgent.dev'])],
    })

    // Security: ECS only allows traffic from ALB on port 8090
    surpayService.connections.allowFrom(alb, ec2.Port.tcp(8090), 'Allow traffic from ALB')

    // Auto-scaling: min 2, max 6
    const surpayScaling = surpayService.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 6,
    })

    surpayScaling.scaleOnRequestCount('SurpayRequestCountScaling', {
      targetGroup: surpayTargetGroup,
      requestsPerTarget: 500,
      scaleInCooldown: cdk.Duration.seconds(120),
      scaleOutCooldown: cdk.Duration.seconds(30),
    })

    // Surpay Outputs
    new cdk.CfnOutput(this, 'SurpayRepositoryUri', {
      value: surpayRepository.repositoryUri,
      description: 'Surpay ECR repository URI for docker push',
    })

    new cdk.CfnOutput(this, 'WebhooksQueueUrl', {
      value: webhooksQueue.queueUrl,
      description: 'SQS webhooks queue URL',
    })

    new cdk.CfnOutput(this, 'WebhooksDlqUrl', {
      value: webhooksDlq.queueUrl,
      description: 'SQS webhooks DLQ URL',
    })
  }
}
