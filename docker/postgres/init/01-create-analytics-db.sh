#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
SELECT 'CREATE DATABASE surgent_analytics OWNER surgent'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = 'surgent_analytics'
)\gexec
SQL
