## Upstream Pulling Rules

- Only cherry-pick updates that are useful to our codebase.
- Respect deleted files and do not recreate or modify them unless absolutely critical.
- Respect Sandbox constraints, especially `path` and `fs` behavior.
- If a file exists but diverged, apply only the minimal upstream changes needed and avoid reintroducing removed sections or unrelated upstream additions.
