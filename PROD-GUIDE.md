# AWS Infrastructure Guide

**Account**: 784713213970 | **Region**: us-east-1 | **CDK**: `/infra`

## Services

| Service        | Type              | Port | Domain          | ECR Repo       |
| -------------- | ----------------- | ---- | --------------- | -------------- |
| surgent-worker | ECS Fargate (Bun) | 4000 | api.surgent.dev | surgent/worker |

**Cluster**: `surgent-cluster` — 2 public subnets, no NAT, shared ALB (`surgent-alb`) with host-based routing.

**Log Group**: `SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK`

**Secrets**: SSM Parameter Store under `/surgent/prod/` (SecureString)

## Database (Read-Only)

PlanetScale PostgreSQL on `main` branch. Read-only role for debugging/AI queries.

- **Host**: `us-east-4.pg.psdb.cloud`
- **Port**: `5432`
- **DB**: `postgres`
- **Username**: `pscale_api_o5c19gennd5b.xs8wb16ic1uu`
- **Password**: `pscale_pw_90I5P7J9jmFacrhir9BUmyvXKcyCuymE`
- **SSL**: `sslmode=verify-full sslrootcert=system`
- **Role**: `main-2026-03-16-x8je73` (bound to `main` branch)

```bash
# psql
psql 'host=us-east-4.pg.psdb.cloud port=5432 user=pscale_api_o5c19gennd5b.xs8wb16ic1uu password=pscale_pw_90I5P7J9jmFacrhir9BUmyvXKcyCuymE dbname=postgres sslnegotiation=direct sslmode=verify-full sslrootcert=system'

# Connection URI
postgresql://pscale_api_o5c19gennd5b.xs8wb16ic1uu:pscale_pw_90I5P7J9jmFacrhir9BUmyvXKcyCuymE@us-east-4.pg.psdb.cloud:5432/postgres?sslmode=verify-full&sslrootcert=system
```

## Deploy Pipeline

Push to `main` triggers `.github/workflows/docker-worker.yml` **only if** these paths changed:
`apps/worker/**`, `packages/db/**`, `packages/typescript-config/**`, `package.json`, `bun.lock`, `bunfig.toml`

1. **Build** — Docker Buildx builds `apps/worker/Dockerfile` (GHA cache)
2. **Push** — Image pushed to ECR with tags: `latest`, commit SHA, branch, semver (if tagged)
3. **Deploy** — `aws ecs update-service --force-new-deployment` on `surgent-cluster/surgent-worker`

Auth: OIDC → IAM role `github-actions-ecr` (no static keys)

## Commands

```bash
# Service status
aws ecs describe-services --cluster surgent-cluster --services surgent-worker \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount}' --output table

# Latest deployed image
aws ecr describe-images --repository-name surgent/worker \
  --query 'imageDetails | sort_by(@, &imagePushedAt) | [-1].{pushed:imagePushedAt,tag:imageTags[0]}' --output json

# View logs (last 5 min)
aws logs filter-log-events \
  --log-group-name "SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK" \
  --start-time $(( $(date +%s) - 300 ))000 --limit 50 \
  --query 'events[*].message' --output text

# Live tail (all / errors only / payment)
aws logs tail "SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK" --follow
aws logs tail "SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK" --follow --filter-pattern "error"
aws logs tail "SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK" --follow --filter-pattern "PAY"

# Force redeploy
aws ecs update-service --cluster surgent-cluster --service surgent-worker --force-new-deployment

# Stopped tasks (debug crashes)
aws ecs list-tasks --cluster surgent-cluster --service-name surgent-worker --desired-status STOPPED
aws ecs describe-tasks --cluster surgent-cluster --tasks <TASK_ARN> \
  --query 'tasks[0].{reason:stoppedReason,containers:containers[*].{name:name,exitCode:exitCode,reason:reason}}'
```

## Debug Flow

```bash
# 1. Check latest image
aws ecr describe-images --repository-name surgent/worker \
  --query 'imageDetails | sort_by(@, &imagePushedAt) | [-1].{pushed:imagePushedAt,tag:imageTags[0]}' --output json

# 2. Check running count
aws ecs describe-services --cluster surgent-cluster --services surgent-worker \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount}' --output table

# 3. If running < desired, find stopped task
aws ecs list-tasks --cluster surgent-cluster --service-name surgent-worker --desired-status STOPPED --query 'taskArns[0]' --output text

# 4. Get crash reason
aws ecs describe-tasks --cluster surgent-cluster --tasks <TASK_ARN> \
  --query 'tasks[0].{reason:stoppedReason,containers:containers[*].{name:name,exitCode:exitCode,reason:reason}}'

# 5. Check logs
aws logs filter-log-events \
  --log-group-name "SurgentStack-WorkerTaskDefworkerLogGroup76A78CDA-Ea4mF0XO2hkK" \
  --start-time $(( $(date +%s) - 600 ))000 --limit 30 \
  --query 'events[*].message' --output text
```

## Common Issues

| Issue                          | Fix                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Worker crashes on startup      | Check logs for migration errors; verify migration file order                       |
| "CryptoKey is not extractable" | Use `{ extractable: true }` in `generateKeyPair`; prefer RS256                     |
| Deployment stuck (0 running)   | Check stopped task reasons → container logs → verify `/health` endpoint            |
| Missing module errors          | Add to `dependencies` (not `devDependencies`); rebuild with `--no-cache` if cached |
