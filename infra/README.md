# Surgent Infrastructure

Infrastructure for Surgent, managed via AWS CDK.

## Architecture Overview

| Component        | Description                                                                |
| :--------------- | :------------------------------------------------------------------------- |
| **ECS Fargate**  | Runs the worker and analytics services.                                    |
| **ALB**          | Shared HTTPS load balancer for the API and public analytics ingest routes. |
| **ECR**          | Container registries for worker and analytics images.                      |
| **SSM**          | Parameter Store for production secrets and connection strings.             |
| **Auto-scaling** | Request-count-based scaling for both services.                             |

## Deployment

### CI/CD

Container, gateway, and dispatch deploys are automated via GitHub Actions on push to the `main` branch. CDK infrastructure changes are deployed manually from this directory.

- [`../.github/workflows/docker.yml`](../.github/workflows/docker.yml)

PRs build changed Docker images without production secrets. Pushes to `main` run deploy jobs through the protected GitHub `production` environment. Configure that environment with required reviewers and branch restrictions in GitHub before enabling public releases.

Production uses **ECR + ECS only**. `docker-compose.dev.yml` is for local development and is not part of the production path.
The analytics deploy now runs a one-off ECS task to apply Postgres migrations before forcing a new service deployment.

### Deployment Targets

The public repo names the deploy surfaces, but the actual account, cluster, routes, and resource IDs come from GitHub environment variables and secrets:

| Surface            | Deploy mechanism                         | Destination source of truth                                       |
| :----------------- | :--------------------------------------- | :---------------------------------------------------------------- |
| Worker API         | Docker image to ECR, then ECS rollout    | `ECR_REGISTRY`, `ECS_CLUSTER`, matrix service `surgent-worker`    |
| Analytics API      | Docker image to ECR, migration task, ECS | `ECR_REGISTRY`, `ECS_CLUSTER`, matrix service `surgent-analytics` |
| Gateway Worker     | `wrangler deploy --config private file`  | `GATEWAY_*` GitHub environment variables plus Cloudflare secrets  |
| Dispatch Worker    | `wrangler deploy --config private file`  | `DISPATCH_*` GitHub environment variables plus Cloudflare secrets |
| AWS infrastructure | Manual CDK deploy                        | CLI env `AWS_ACCOUNT_ID`/`AWS_REGION` and CDK context values      |

If you want to hide concrete account IDs, route patterns, cluster names, and registry names from the checked-in repo, keep them in the GitHub `production` environment. GitHub Actions job names and workflow structure are still visible in a public repository; the normal way to protect deployment details is environment protection plus secrets/variables, not trying to make the workflow invisible.

### Private Production Values

Account IDs, Cloudflare resource IDs, and production routes are intentionally not committed. GitHub Actions reads them from the `production` environment instead:

- Variables: `AWS_REGION`, `ECR_REGISTRY`, `ECS_CLUSTER`, `GATEWAY_ROUTE_PATTERN`, `GATEWAY_ZONE_NAME`, `GATEWAY_KV_NAMESPACE_ID`, `GATEWAY_KV_PREVIEW_NAMESPACE_ID`, `GATEWAY_HYPERDRIVE_ID`, `GATEWAY_R2_BUCKET`, `GATEWAY_R2_PREVIEW_BUCKET`, `GATEWAY_ZEN_MODELS`, `DISPATCH_ROUTE_PATTERN`, `DISPATCH_ZONE_NAME`, `DISPATCH_NAMESPACE`, `DISPATCH_ANALYTICS_UPSTREAM`
- Secrets: `AWS_GITHUB_ACTIONS_ROLE_ARN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `MAXMIND_LICENSE_KEY`

`GATEWAY_ZEN_MODELS` must contain model and provider routing metadata only. Provider API keys live in Cloudflare Worker secrets such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GOOGLE_API_KEY`.

For local production deploys, keep ignored private files such as `packages/gateway/wrangler.private.jsonc`, `apps/dispatch/wrangler.private.jsonc`, and `infra/deploy-prod-private.sh`.

### Manual Deploy

To deploy changes manually from the `infra` directory:

```bash
bun install
AWS_ACCOUNT_ID=<account-id> AWS_REGION=<region> bun cdk deploy \
  -c appName=<app-name> \
  -c publicDomain=<domain> \
  -c apiHostname=<api-hostname> \
  -c analyticsHostname=<analytics-hostname> \
  -c internalNamespace=<service-discovery-namespace> \
  -c workerSsmPrefix=<worker-ssm-prefix> \
  -c analyticsSsmPrefix=<analytics-ssm-prefix>
```

## Managing Environment Variables

Secrets are split by service in AWS SSM Parameter Store. Use the same prefixes passed to CDK:

- Worker: `{workerSsmPrefix}/{SECRET_NAME}`
- Analytics: `{analyticsSsmPrefix}/{SECRET_NAME}`

Analytics-specific production secrets currently include:

- `DATABASE_URL`
- `ANALYTICS_INTERNAL_TOKEN`

### Adding a New Secret

1.  **Add to SSM**:
    ```bash
    aws ssm put-parameter \
      --name "{workerSsmPrefix}/NEW_KEY" \
      --value "your-secret-value" \
      --type "SecureString" \
      --overwrite
    ```
    For analytics-only secrets, use `{analyticsSsmPrefix}/NEW_KEY` instead.
2.  **Register in CDK**: Add `NEW_KEY` to the appropriate secret list in `lib/surgent-stack.ts`.
3.  **Deploy**: Run `bun cdk deploy` to update the ECS task definition.

Analytics secrets use the plain names above. They are not prefixed with `ANALYTICS_` in SSM.

### Updating an Existing Secret

1.  **Update SSM**:
    ```bash
    aws ssm put-parameter \
      --name "{workerSsmPrefix}/EXISTING_KEY" \
      --value "new-value" \
      --type "SecureString" \
      --overwrite
    ```
    For analytics-only secrets, update `{analyticsSsmPrefix}/EXISTING_KEY` instead.
2.  **Restart Service**: ECS tasks fetch secrets at startup. Force a new deployment to pick up changes:
    ```bash
    aws ecs update-service --cluster "{appName}-cluster" --service "{appName}-worker" --force-new-deployment
    aws ecs update-service --cluster "{appName}-cluster" --service "{appName}-analytics" --force-new-deployment
    ```

### Useful SSM Commands

| Action                     | Command                                                                     |
| :------------------------- | :-------------------------------------------------------------------------- |
| **Get worker value**       | `aws ssm get-parameter --name "{workerSsmPrefix}/KEY" --with-decryption`    |
| **Get analytics value**    | `aws ssm get-parameter --name "{analyticsSsmPrefix}/KEY" --with-decryption` |
| **List worker secrets**    | `aws ssm get-parameters-by-path --path "{workerSsmPrefix}/"`                |
| **List analytics secrets** | `aws ssm get-parameters-by-path --path "{analyticsSsmPrefix}/"`             |

## Operations

### Check Deployment Status

```bash
aws ecs describe-services --cluster "{appName}-cluster" --services "{appName}-worker" "{appName}-analytics"
```

### View Logs

Tail the logs directly from the terminal:

```bash
aws logs tail $(aws logs describe-log-groups --log-group-name-prefix "/ecs/{appName}" --query "logGroups[0].logGroupName" --output text) --follow
```

### Force Restart (Zero Downtime)

```bash
aws ecs update-service --cluster "{appName}-cluster" --service "{appName}-worker" --force-new-deployment
aws ecs update-service --cluster "{appName}-cluster" --service "{appName}-analytics" --force-new-deployment
```

## Troubleshooting

### Quick Status Check

```bash
# Service status (running/desired/pending)
aws ecs describe-services --cluster "{appName}-cluster" --services "{appName}-worker" "{appName}-analytics" \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount,pending:pendingCount}'

# Recent events (errors show up here)
aws ecs describe-services --cluster "{appName}-cluster" --services "{appName}-worker" "{appName}-analytics" \
  --query 'services[*].{name:serviceName,events:events[0:5]}'

# Deployment status
aws ecs describe-services --cluster "{appName}-cluster" --services "{appName}-worker" "{appName}-analytics" \
  --query 'services[*].{name:serviceName,deployments:deployments[*].{status:status,running:runningCount,desired:desiredCount}}'
```

### Health Check Issues

```bash
# Check target health in load balancer
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups --query "TargetGroups[?contains(TargetGroupName, '{appName}')].TargetGroupArn" --output text)
```

### Container Crashes

```bash
# Find stopped tasks
aws ecs list-tasks --cluster "{appName}-cluster" --service-name "{appName}-worker" --desired-status STOPPED

# Get stop reason (replace TASK_ID)
aws ecs describe-tasks --cluster "{appName}-cluster" --tasks <TASK_ID> \
  --query 'tasks[0].{stopCode:stopCode,stoppedReason:stoppedReason,exitCode:containers[0].exitCode}'
```

### ECR Image Issues

```bash
# Check latest pushed image
aws ecr describe-images --repository-name "{appName}/worker" \
  --query 'sort_by(imageDetails, &imagePushedAt)[-1].{tags:imageTags,pushed:imagePushedAt}'

# Verify 'latest' tag exists
aws ecr describe-images --repository-name "{appName}/worker" \
  --query 'imageDetails[*].imageTags' | grep latest
```

### Common Issues

| Issue                      | Cause                             | Fix                                                              |
| :------------------------- | :-------------------------------- | :--------------------------------------------------------------- |
| `CannotPullContainerError` | Image not in ECR                  | Push image with `latest` tag                                     |
| `ENOTFOUND` in logs        | Bad DATABASE_URL or network issue | Check SSM value, verify no extra quotes                          |
| Health check 404           | Wrong health check path           | Verify worker uses `/health` and analytics uses `/api/heartbeat` |
| Tasks keep restarting      | Container crash                   | Check logs for stack trace                                       |
