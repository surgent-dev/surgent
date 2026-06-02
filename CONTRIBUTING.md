# Contributing

Thanks for helping improve Surgent.

## Development

- Keep changes small and focused.
- Prefer clear data flow over defensive layers.
- Add tests for behavior and boundaries.
- Do not commit secrets, customer data, exported production data, or local tool settings.

Run the checks before opening a pull request:

```sh
bun run typecheck
bun run test
```

DB-backed pay tests are separate:

```sh
TEST_DATABASE_URL='<test-database-url>' bun --filter worker test:db
```
