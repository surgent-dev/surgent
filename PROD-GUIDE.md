# AWS Infrastructure Guide

**Account**: 784713213970 | **Region**: us-east-1 | **CDK**: `/infra`

## Production Path

Production runs on **ECR + ECS only**.

- CI builds Docker images and pushes them to ECR
- ECS Fargate runs the services behind the shared ALB
- PostgreSQL and ClickHouse are cloud-hosted external services configured through SSM
- `docker-compose.dev.yml` is for local development only

## Services

| Service           | Type              | Port | Domain                | ECR Repo          | Health Check     |
| ----------------- | ----------------- | ---- | --------------------- | ----------------- | ---------------- |
| surgent-worker    | ECS Fargate (Bun) | 4000 | api.surgent.dev       | surgent/worker    | `/health`        |
| surgent-analytics | ECS Fargate (Bun) | 3007 | analytics.surgent.dev | surgent/analytics | `/api/heartbeat` |

**Cluster**: `surgent-cluster`

**ALB**: `surgent-alb` with host-based routing for `api.surgent.dev` and public analytics ingest on `analytics.surgent.dev`

**Private analytics DNS**: worker reaches analytics over Cloud Map at `http://analytics.surgent.internal:3007`

**Secrets**:

- Worker secrets: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, etc.
- Analytics secrets: `/surgent/prod/analytics/DATABASE_URL`

## External Data Services

Production databases are not provisioned from this repo.

- Worker uses a cloud-hosted PostgreSQL database
- Analytics uses a cloud-hosted PostgreSQL database
- ClickHouse is optional in the analytics app codepath, but it is not currently injected by the CDK stack
- Connection strings and secrets are injected through SSM at deploy/runtime

## CI/CD

Pushes to `main` trigger image builds and ECS rollouts:

- [`.github/workflows/docker-worker.yml`](/Users/benrov/Projects/surgent/.github/workflows/docker-worker.yml)
- [`.github/workflows/docker-analytics.yml`](/Users/benrov/Projects/surgent/.github/workflows/docker-analytics.yml)

Each workflow:

1. builds the service image with Docker Buildx
2. pushes it to ECR
3. forces a new ECS deployment for the matching service

Auth uses GitHub OIDC with the `github-actions-ecr` IAM role.

## Commands

```bash
# Service status
aws ecs describe-services --cluster surgent-cluster --services surgent-worker surgent-analytics \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount}' --output table

# Latest worker image
aws ecr describe-images --repository-name surgent/worker \
  --query 'imageDetails | sort_by(@, &imagePushedAt) | [-1].{pushed:imagePushedAt,tag:imageTags[0]}' --output json

# Latest analytics image
aws ecr describe-images --repository-name surgent/analytics \
  --query 'imageDetails | sort_by(@, &imagePushedAt) | [-1].{pushed:imagePushedAt,tag:imageTags[0]}' --output json

# Force redeploy
aws ecs update-service --cluster surgent-cluster --service surgent-worker --force-new-deployment
aws ecs update-service --cluster surgent-cluster --service surgent-analytics --force-new-deployment
```

## Troubleshooting

- If worker tasks fail, check `/health`, ECS service events, and CloudWatch logs.
- If analytics tasks fail, check `/api/heartbeat`, ECS service events, and CloudWatch logs.
- If image deploys fail, verify the ECR repo exists in the CDK stack and the workflow pushed the expected tag.
- If worker database connectivity fails, inspect `/surgent/prod/DATABASE_URL`.
- If analytics database connectivity fails, inspect `/surgent/prod/analytics/DATABASE_URL`.
