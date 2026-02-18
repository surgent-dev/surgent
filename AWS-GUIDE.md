# AWS Infrastructure Guide

## Stack Overview

- **AWS Account**: 784713213970
- **Region**: us-east-1
- **Infrastructure**: AWS CDK (TypeScript) in `/infra`

## Services

| Service        | Type              | Port | Domain          | ECR Repo       |
| -------------- | ----------------- | ---- | --------------- | -------------- |
| surgent-worker | ECS Fargate (Bun) | 4000 | api.surgent.dev | surgent/worker |

## ECS Cluster

- **Cluster**: `surgent-cluster`
- **VPC**: 2 public subnets, no NAT gateway
- **Load Balancer**: `surgent-alb` (shared ALB with host-based routing)

## Quick Commands

### Check Service Status

```bash
aws ecs describe-services --cluster surgent-cluster --services surgent-worker \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount}' --output table
```

### Check Latest Deployed Image

```bash
aws ecr describe-images --repository-name surgent/worker \
  --query 'imageDetails | sort_by(@, &imagePushedAt) | [-1].{pushed:imagePushedAt,tag:imageTags[0]}' --output json
```

### View Recent Logs

```bash
# Worker logs (last 5 minutes)
aws logs filter-log-events \
  --log-group-name "SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK" \
  --start-time $(( $(date +%s) - 300 ))000 --limit 50 \
  --query 'events[*].message' --output text
```

### Live Tail Logs

```bash
# All logs (Ctrl+C to stop)
aws logs tail "SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK" --follow

# Errors only
aws logs tail "SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK" --follow --filter-pattern "error"

# Pay/whop related
aws logs tail "SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK" --follow --filter-pattern "PAY"
```

### Force New Deployment

```bash
aws ecs update-service --cluster surgent-cluster --service surgent-worker --force-new-deployment
```

### Check Stopped Tasks (Debug Crashes)

```bash
# List recently stopped tasks
aws ecs list-tasks --cluster surgent-cluster --service-name surgent-worker --desired-status STOPPED

# Get stop reason for a specific task
aws ecs describe-tasks --cluster surgent-cluster --tasks <TASK_ARN> \
  --query 'tasks[0].{reason:stoppedReason,containers:containers[*].{name:name,exitCode:exitCode,reason:reason}}'
```

## Log Groups

| Service | Log Group                                                     |
| ------- | ------------------------------------------------------------- |
| Worker  | SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK |

## Secrets (SSM Parameter Store)

All secrets stored under `/surgent/prod/` prefix as SecureString parameters.

## CI/CD

- GitHub Actions builds and pushes Docker images to ECR
- Images tagged with commit SHA
- ECS auto-deploys on new image push to `latest` tag

## Common Issues

### Worker Crashes on Startup

1. Check logs for migration errors
2. Verify migration files are in correct order (no duplicates, no renaming after deployment)

### "CryptoKey is not extractable"

- Ensure `generateKeyPair` uses `{ extractable: true }`
- RS256 is preferred for compatibility

### Deployment Stuck (0 running)

1. Check stopped task reasons
2. Look at container logs for startup errors
3. Verify health check endpoint `/health` responds

### Missing Module Errors

If logs show `Cannot find module 'X'`:

1. Package missing from `package.json` - add and redeploy
2. Package in `devDependencies` but needed in prod - move to `dependencies`
3. Docker build cache issue - rebuild with `--no-cache`

## Quick Debug Flow

```bash
# 1. Check if deployment pushed
aws ecr describe-images --repository-name surgent/worker \
  --query 'imageDetails | sort_by(@, &imagePushedAt) | [-1].{pushed:imagePushedAt,tag:imageTags[0]}' --output json

# 2. Check if services running
aws ecs describe-services --cluster surgent-cluster --services surgent-worker \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount}' --output table

# 3. If running < desired, find stopped task
aws ecs list-tasks --cluster surgent-cluster --service-name surgent-worker --desired-status STOPPED --query 'taskArns[0]' --output text

# 4. Get crash reason
aws ecs describe-tasks --cluster surgent-cluster --tasks <TASK_ARN> \
  --query 'tasks[0].{reason:stoppedReason,containers:containers[*].{name:name,exitCode:exitCode,reason:reason}}'

# 5. Check logs for details
aws logs filter-log-events \
  --log-group-name "SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK" \
  --start-time $(( $(date +%s) - 600 ))000 --limit 30 \
  --query 'events[*].message' --output text
```
