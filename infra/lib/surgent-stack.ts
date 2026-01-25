import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { Construct } from 'constructs'

const SSM_PREFIX = '/surgent/prod'

const SECRET_NAMES = [
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
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
      removalPolicy: cdk.RemovalPolicy.RETAIN,
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

    // ACM Certificate for api.surgent.dev
    const certificate = new acm.Certificate(this, 'SurgentCert', {
      domainName: 'api.surgent.dev',
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

    // ALB + Fargate Service
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'SurgentWorkerService', {
      cluster,
      serviceName: 'surgent-worker',
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 2,
      assignPublicIp: true,
      publicLoadBalancer: true,
      certificate,
      redirectHTTP: true,
      listenerPort: 443,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
        containerPort: 4000,
        secrets,
        environment: {
          NODE_ENV: 'production',
          PORT: '4000',
          HOST: '0.0.0.0',
        },
      },
      taskSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
    })

    // Configure health check
    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      port: '4000',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    })

    // Auto-scaling: min 2, max 8, request count target 100/task
    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 8,
    })

    scaling.scaleOnRequestCount('RequestCountScaling', {
      targetGroup: fargateService.targetGroup,
      requestsPerTarget: 200,
      scaleInCooldown: cdk.Duration.seconds(120),
      scaleOutCooldown: cdk.Duration.seconds(60),
    })

    // Security: ECS only allows traffic from ALB on port 4000
    fargateService.service.connections.allowFrom(
      fargateService.loadBalancer,
      ec2.Port.tcp(4000),
      'Allow traffic from ALB',
    )

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'ALB DNS name - point api.surgent.dev CNAME here',
    })

    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: repository.repositoryUri,
      description: 'ECR repository URI for docker push',
    })

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: certificate.certificateArn,
      description: 'ACM certificate ARN - add DNS validation CNAME in Cloudflare',
    })
  }
}
