#!/usr/bin/env bash
# Apply the Supabase migrations to a throwaway database on a plain PostgreSQL
# and run the Row Level Security check (supabase/tests/rls_check.sql).
#
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run db:check
#
# DATABASE_URL must point at a server where the user may create databases; the
# check creates and drops `lf_rls_check`. Never point it at a real project.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?set DATABASE_URL to a local PostgreSQL (never a real project)}"
DB=lf_rls_check
export PGOPTIONS="-c client_min_messages=warning"
CHECK_URL="${DATABASE_URL%/*}/$DB"

case "$DATABASE_URL" in
  *supabase.co*|*supabase.com*|*pooler.supabase*) echo "refusing to run against a Supabase host" >&2; exit 2 ;;
esac

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB"
trap 'psql "$DATABASE_URL" -q -c "drop database if exists $DB" >/dev/null' EXIT

psql "$CHECK_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/auth_shim.sql
for f in $(ls supabase/migrations/*.sql | sort); do
  echo "apply $f"
  psql "$CHECK_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
# Migrations are idempotent: a second run must be a no-op, not an error.
for f in $(ls supabase/migrations/*.sql | sort); do
  psql "$CHECK_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$CHECK_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/rls_check.sql
