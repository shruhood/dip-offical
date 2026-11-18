#!/usr/bin/env bash
set -euo pipefail

# Applies forward additive migrations across all 10 Free-Plan Cloudflare D1 databases.
# Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (or an active `wrangler login` session).

DATABASES=(
  "dip-official"
  "dip-workflow"
  "dip-partners"
  "dip-content"
  "dip-api"
  "dip-billing"
  "dip-audit"
  "dip-services"
  "dip-integrations"
  "dip-analytics"
)

echo "Applying forward D1 migrations across ${#DATABASES[@]} Free-Plan databases..."

for db in "${DATABASES[@]}"; do
  echo "--> Migrating ${db}"
  npx wrangler d1 migrations apply "${db}" --remote
done

echo "All 10 D1 databases are up to date."
