import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { Construct } from 'constructs'

const SSM_PREFIX = '/surgent/prod'

const SECRET_NAMES = [
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
  'AUTUMN_SECRET_KEY',
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
  'CLOUDFLARE_DOMAIN_KV_NAMESPACE_ID',
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

    // Wildcard ACM Certificate for *.surgent.dev
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

    // ==================== OUTPUTS ====================

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS name - point api.surgent.dev CNAME here',
    })

    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: repository.repositoryUri,
      description: 'ECR repository URI for docker push',
    })

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: certificate.certificateArn,
      description: 'Wildcard ACM certificate ARN - add DNS validation CNAME in Cloudflare',
    })
  }
}
