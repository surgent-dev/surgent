# Surgent Infrastructure

Infrastructure for Surgent, managed via AWS CDK.

## Architecture Overview

| Component        | Description                                                    |
| :--------------- | :------------------------------------------------------------- |
| **ECS Fargate**  | Serverless container execution for the worker service.         |
| **ALB**          | Application Load Balancer handling HTTPS at `api.surgent.dev`. |
| **ECR**          | Container registry for `surgent/worker` images.                |
| **SSM**          | Parameter Store for secrets and environment variables.         |
| **Auto-scaling** | 1 to 4 tasks based on 70% CPU utilization.                     |

## Deployment

### CI/CD

Deploys are automated via GitHub Actions on push to the `main` branch.

### Manual Deploy

To deploy changes manually from the `infra` directory:

```bash
bun install
bun cdk deploy
```

## Managing Environment Variables

All secrets are stored in AWS SSM Parameter Store under the prefix `/surgent/prod/`.

### Adding a New Secret

1.  **Add to SSM**:
    ```bash
    aws ssm put-parameter \
      --name "/surgent/prod/NEW_KEY" \
      --value "your-secret-value" \
      --type "SecureString" \
      --overwrite
    ```
2.  **Register in CDK**: Add `NEW_KEY` to the `SECRET_NAMES` array in `lib/surgent-stack.ts`.
3.  **Deploy**: Run `bun cdk deploy` to update the ECS Task Definition. Or push
    to prod branch.

### Updating an Existing Secret

1.  **Update SSM**:
    ```bash
    aws ssm put-parameter \
      --name "/surgent/prod/EXISTING_KEY" \
      --value "new-value" \
      --type "SecureString" \
      --overwrite
    ```
2.  **Restart Service**: ECS tasks fetch secrets at startup. Force a new deployment to pick up changes:
    ```bash
    aws ecs update-service --cluster surgent-cluster --service surgent-worker --force-new-deployment
    ```

### Useful SSM Commands

| Action        | Command                                                              |
| :------------ | :------------------------------------------------------------------- |
| **Get Value** | `aws ssm get-parameter --name "/surgent/prod/KEY" --with-decryption` |
| **List All**  | `aws ssm get-parameters-by-path --path "/surgent/prod/"`             |

## Operations

### Check Deployment Status

```bash
aws ecs describe-services --cluster surgent-cluster --services surgent-worker
```

### View Logs

Tail the logs directly from the terminal:

```bash
aws logs tail $(aws logs describe-log-groups --log-group-name-prefix /ecs/SurgentStack --query "logGroups[0].logGroupName" --output text) --follow
```

### Force Restart (Zero Downtime)

```bash
aws ecs update-service --cluster surgent-cluster --service surgent-worker --force-new-deployment
```

## Troubleshooting

### Quick Status Check

```bash
# Service status (running/desired/pending)
aws ecs describe-services --cluster surgent-cluster --services surgent-worker \
  --query 'services[0].{running:runningCount,desired:desiredCount,pending:pendingCount}'

# Recent events (errors show up here)
aws ecs describe-services --cluster surgent-cluster --services surgent-worker \
  --query 'services[0].events[0:5]'

# Deployment status
aws ecs describe-services --cluster surgent-cluster --services surgent-worker \
  --query 'services[0].deployments[*].{status:status,running:runningCount,desired:desiredCount}'
```

### Health Check Issues

```bash
# Check target health in load balancer
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups --query "TargetGroups[?contains(TargetGroupName, 'Surgen')].TargetGroupArn" --output text)
```

### Container Crashes

```bash
# Find stopped tasks
aws ecs list-tasks --cluster surgent-cluster --service-name surgent-worker --desired-status STOPPED

# Get stop reason (replace TASK_ID)
aws ecs describe-tasks --cluster surgent-cluster --tasks <TASK_ID> \
  --query 'tasks[0].{stopCode:stopCode,stoppedReason:stoppedReason,exitCode:containers[0].exitCode}'
```

### ECR Image Issues

```bash
# Check latest pushed image
aws ecr describe-images --repository-name surgent/worker \
  --query 'sort_by(imageDetails, &imagePushedAt)[-1].{tags:imageTags,pushed:imagePushedAt}'

# Verify 'latest' tag exists
aws ecr describe-images --repository-name surgent/worker \
  --query 'imageDetails[*].imageTags' | grep latest
```

### Common Issues

| Issue                      | Cause                             | Fix                                     |
| :------------------------- | :-------------------------------- | :-------------------------------------- |
| `CannotPullContainerError` | Image not in ECR                  | Push image with `latest` tag            |
| `ENOTFOUND` in logs        | Bad DATABASE_URL or network issue | Check SSM value, verify no extra quotes |
| Health check 404           | Wrong health check path           | Verify `/health` endpoint exists        |
| Tasks keep restarting      | Container crash                   | Check logs for stack trace              |
