#!/usr/bin/env bash
# يشغّل كل اختبارات الخادم التي لا تحتاج macOS:
#   1) اختبارات محرك الحساب (Deno) على الحالات المشتركة مع Swift
#   2) فحص أنواع TypeScript للـ Edge Functions
#   3) تطبيق كل الـ migrations على قاعدة جديدة + اختبارات SQL
#   4) اختبارات تكامل: Edge Functions + PostgREST + RLS
#
# المتطلبات: deno، psql، خادم PostgreSQL 15+ متاح، وملف PostgREST التنفيذي.
# المتغيرات:
#   PG_ADMIN_URL   اتصال بصلاحية superuser (افتراضي: postgres://postgres@127.0.0.1:5432/postgres)
#   POSTGREST_BIN  مسار PostgREST (افتراضي: postgrest من PATH)
#   DENO           مسار deno (افتراضي: deno من PATH)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_ADMIN_URL="${PG_ADMIN_URL:-postgres://postgres@127.0.0.1:5432/postgres}"
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
DENO="${DENO:-deno}"
DB_NAME="qudra_test"
DB_URL="${PG_ADMIN_URL%/*}/${DB_NAME}"
JWT_SECRET="local-test-secret-not-for-production-0123456789"
POSTGREST_PORT=54331
GATEWAY_PORT=54321
WORK="$(mktemp -d)"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; done
  rm -rf "$WORK"
}
trap cleanup EXIT

step() { printf '\n\033[1;33m== %s\033[0m\n' "$1"; }

cd "$ROOT"

step "1) Engine tests (shared fixtures)"
"$DENO" test --allow-read supabase/functions/_shared/engine.test.ts

step "2) Type-check Edge Functions"
"$DENO" check supabase/functions/calculate-capacity/index.ts supabase/functions/delete-account/index.ts

step "3) Fresh database + migrations + SQL tests"
psql "$PG_ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists ${DB_NAME}" -c "create database ${DB_NAME}"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/local/supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "apply $(basename "$f")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/rules_admin_test.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/app_data_test.sql

step "4) Integration tests (Edge Functions + PostgREST + RLS)"
DB_HOSTPART="${DB_URL#*@}"
cat > "$WORK/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:authenticator@${DB_HOSTPART}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${JWT_SECRET}"
server-host = "127.0.0.1"
server-port = ${POSTGREST_PORT}
CONF
"$POSTGREST_BIN" "$WORK/postgrest.conf" > "$WORK/postgrest.log" 2>&1 &
PIDS+=($!)

GATEWAY_PORT=$GATEWAY_PORT POSTGREST_URL="http://127.0.0.1:${POSTGREST_PORT}" DATABASE_URL="$DB_URL" JWT_SECRET="$JWT_SECRET" \
  "$DENO" run --allow-net --allow-env --allow-read --allow-sys supabase/tests/local/gateway.ts > "$WORK/gateway.log" 2>&1 &
PIDS+=($!)

for _ in $(seq 1 60); do
  if curl -fs "http://127.0.0.1:${POSTGREST_PORT}/" > /dev/null 2>&1 && grep -q "listening" "$WORK/gateway.log"; then break; fi
  sleep 0.5
done
curl -fs "http://127.0.0.1:${POSTGREST_PORT}/" > /dev/null || { cat "$WORK/postgrest.log"; exit 1; }
grep -q "listening" "$WORK/gateway.log" || { cat "$WORK/gateway.log"; exit 1; }

GATEWAY_URL="http://127.0.0.1:${GATEWAY_PORT}" DATABASE_URL="$DB_URL" JWT_SECRET="$JWT_SECRET" \
  "$DENO" test --allow-net --allow-env --allow-read --allow-sys supabase/tests/e2e/backend.e2e.test.ts

step "All backend tests passed"
