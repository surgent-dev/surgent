# Surgent

vibe coding platform

## About

Surgent is an end-to-end platform for vibe coding apps. It handles the entire lifecycle of application development, including development environments, AI agents, deployments, payments, and database management.

## Architecture Overview

Surgent is built as a monorepo with the following core components:

- `@apps/web` — Next.js frontend
- `@apps/worker` — Bun + Hono backend for orchestration
- `@apps/dispatch` — Cloudflare Worker router for customer apps
- `@packages/gateway` — AI gateway for token streaming and usage tracking
- `@packages/db` — Shared database client using Kysely

For a detailed breakdown of the system architecture, refer to [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech Stack

- **Frontend**: Next.js
- **Backend**: Bun, Hono
- **Edge**: Cloudflare Workers
- **Infrastructure**: AWS (ECS, SQS)
- **Database**: Postgres

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/) (for local Postgres)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd surgent
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Set up environment variables:
   Copy the example environment files to `.env` in each relevant directory:
   - `apps/web/.example.env` -> `apps/web/.env`
   - `apps/worker/.example.env` -> `apps/worker/.env`
   - `packages/gateway/.env.example` -> `packages/gateway/.env`

### Local Development

To start all services in development mode:

```bash
bun dev
```

To run database migrations:

```bash
bun db:migrate
```

## Project Structure

```text
.
├── apps/
│   ├── dispatch/    # Cloudflare Worker router
│   ├── web/         # Next.js frontend
│   └── worker/      # Bun + Hono orchestration backend
├── docs/            # Documentation and architecture plans
└── packages/
    ├── db/          # Database schema and migrations
    ├── gateway/     # AI gateway and usage tracking
    └── util/        # Shared utility functions
```
