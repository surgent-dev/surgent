# Rust

- DO NOT EDIT .sqlx/ by hand. Use `cargo prepare` to generate offline sqlx queries.
- DO NOT run migrations by hand, DO NOT edit database directly.
- Always run `cargo fmt` after rust code changes
- Do not leave comments if the code is easy to understand, leave comments if logic is complicated or the behavior is not immediately obvious.
- Run tests faster with `cargo nextest run`

# Plans

- For plans, write them into docs/plans with the suffix <plan-name>.plan.md, include references to internal/external sources of reference.
- When designing planning documents, challenge the user on design decisions, ask them critical questions and ask for more information if missing.
- When implementing plans, start by asking the user questions to clarify if the design doc isn't specific, also ask the user which are the most important references to read through if plan does not specify.
