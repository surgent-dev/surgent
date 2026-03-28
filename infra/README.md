# Surgent Infrastructure

Infrastructure for Surgent, managed via AWS CDK.

## Architecture Overview

| Component        | Description                                                                              |
| :--------------- | :--------------------------------------------------------------------------------------- |
| **ECS Fargate**  | Runs both `surgent-worker` and `surgent-analytics`.                                      |
| **ALB**          | Shared HTTPS load balancer for `api.surgent.dev` and the public analytics ingest routes. |
| **ECR**          | Container registries for `surgent/worker` and `surgent/analytics`.                       |
| **SSM**          | Parameter Store for production secrets and connection strings.                           |
| **Auto-scaling** | Request-count-based scaling for both services.                                           |

## Deployment

### CI/CD

Deploys are automated via GitHub Actions on push to the `main` branch.

- [`.github/workflows/docker-worker.yml`](/Users/benrov/Projects/surgent/.github/workflows/docker-worker.yml)
- [`.github/workflows/docker-analytics.yml`](/Users/benrov/Projects/surgent/.github/workflows/docker-analytics.yml)

Production uses **ECR + ECS only**. `docker-compose.dev.yml` is for local development and is not part of the production path.
The analytics deploy now runs a one-off ECS task to apply Postgres migrations before forcing a new service deployment.

### Manual Deploy

To deploy changes manually from the `infra` directory:

```bash
bun install
bun cdk deploy
```

## Managing Environment Variables

Secrets are split by service in AWS SSM Parameter Store:

- Worker: `/surgent/prod/{SECRET_NAME}`
- Analytics: `/surgent/prod/analytics/{SECRET_NAME}`

Analytics-specific production secrets currently include:

- `DATABASE_URL`

### Adding a New Secret

1.  **Add to SSM**:
    ```bash
    aws ssm put-parameter \
      --name "/surgent/prod/NEW_KEY" \
      --value "your-secret-value" \
      --type "SecureString" \
      --overwrite
    ```
    For analytics-only secrets, use `/surgent/prod/analytics/NEW_KEY` instead.
2.  **Register in CDK**: Add `NEW_KEY` to the appropriate secret list in `lib/surgent-stack.ts`.
3.  **Deploy**: Run `bun cdk deploy` to update the ECS Task Definition. Or push
    to prod branch.

Analytics secrets live at `/surgent/prod/analytics/{SECRET_NAME}` and use the plain names above. They are not prefixed with `ANALYTICS_` in SSM.

### Updating an Existing Secret

1.  **Update SSM**:
    ```bash
    aws ssm put-parameter \
      --name "/surgent/prod/EXISTING_KEY" \
      --value "new-value" \
      --type "SecureString" \
      --overwrite
    ```
    For analytics-only secrets, update `/surgent/prod/analytics/EXISTING_KEY` instead.
2.  **Restart Service**: ECS tasks fetch secrets at startup. Force a new deployment to pick up changes:
    ```bash
    aws ecs update-service --cluster surgent-cluster --service surgent-worker --force-new-deployment
    aws ecs update-service --cluster surgent-cluster --service surgent-analytics --force-new-deployment
    ```

### Useful SSM Commands

| Action                     | Command                                                                        |
| :------------------------- | :----------------------------------------------------------------------------- |
| **Get worker value**       | `aws ssm get-parameter --name "/surgent/prod/KEY" --with-decryption`           |
| **Get analytics value**    | `aws ssm get-parameter --name "/surgent/prod/analytics/KEY" --with-decryption` |
| **List worker secrets**    | `aws ssm get-parameters-by-path --path "/surgent/prod/"`                       |
| **List analytics secrets** | `aws ssm get-parameters-by-path --path "/surgent/prod/analytics/"`             |

## Operations

### Check Deployment Status

```bash
aws ecs describe-services --cluster surgent-cluster --services surgent-worker surgent-analytics
```

### View Logs

Tail the logs directly from the terminal:

```bash
aws logs tail $(aws logs describe-log-groups --log-group-name-prefix /ecs/SurgentStack --query "logGroups[0].logGroupName" --output text) --follow
```

### Force Restart (Zero Downtime)

```bash
aws ecs update-service --cluster surgent-cluster --service surgent-worker --force-new-deployment
aws ecs update-service --cluster surgent-cluster --service surgent-analytics --force-new-deployment
```

## Troubleshooting

### Quick Status Check

```bash
# Service status (running/desired/pending)
aws ecs describe-services --cluster surgent-cluster --services surgent-worker surgent-analytics \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount,pending:pendingCount}'

# Recent events (errors show up here)
aws ecs describe-services --cluster surgent-cluster --services surgent-worker surgent-analytics \
  --query 'services[*].{name:serviceName,events:events[0:5]}'

# Deployment status
aws ecs describe-services --cluster surgent-cluster --services surgent-worker surgent-analytics \
  --query 'services[*].{name:serviceName,deployments:deployments[*].{status:status,running:runningCount,desired:desiredCount}}'
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

| Issue                      | Cause                             | Fix                                                              |
| :------------------------- | :-------------------------------- | :--------------------------------------------------------------- |
| `CannotPullContainerError` | Image not in ECR                  | Push image with `latest` tag                                     |
| `ENOTFOUND` in logs        | Bad DATABASE_URL or network issue | Check SSM value, verify no extra quotes                          |
| Health check 404           | Wrong health check path           | Verify worker uses `/health` and analytics uses `/api/heartbeat` |
| Tasks keep restarting      | Container crash                   | Check logs for stack trace                                       |
