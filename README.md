# Surgent

Surgent is a monorepo for building, deploying, and managing AI-generated web projects.

## Apps

- `apps/web` - Next.js product app.
- `apps/worker` - API, background jobs, billing, sandbox, and deployment orchestration.
- `apps/dispatch` - Cloudflare Worker dispatch proxy for deployed projects.
- `apps/analytics` - headless analytics service.
- `packages/db` - shared database schema, types, and migrations.
- `packages/gateway` - Cloudflare AI gateway worker.

## Local Setup

1. Install dependencies:

   ```sh
   bun install
   ```

2. Copy the example env files you need:

   ```sh
   cp apps/web/.env.example apps/web/.env.local
   cp apps/worker/.env.example apps/worker/.env.local
   cp apps/analytics/.env.example apps/analytics/.env.local
   cp apps/dispatch/.env.example apps/dispatch/.env.local
   cp packages/gateway/.env.example packages/gateway/.env.local
   ```

3. Run migrations:

   ```sh
   bun run db:migrate
   ```

4. Start development services:

   ```sh
   bun run dev
   ```

## Checks

```sh
bun run typecheck
bun run test
```

DB-backed pay tests are intentionally separate and require a database name containing `test`:

```sh
TEST_DATABASE_URL='<test-database-url>' bun --filter worker test:db
```

## Deployment

Tracked deployment config is safe-by-default and uses placeholders or local defaults. Configure your own Cloudflare, AWS, database, and provider credentials outside the repository before deploying.

## License

Apache-2.0, with MIT notices for the Umami-derived analytics app. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
