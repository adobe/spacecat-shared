#!/usr/bin/env bash
set -euo pipefail

# Phase 3: Sync secrets from AWS Secrets Manager to HashiCorp Vault
#
# Reads service secrets from SM (/helix-deploy/spacecat-services/{service}/latest)
# and writes them to Vault KV (dx_mysticat/{env}/{service}).
#
# This script is idempotent - safe to re-run before the Phase 4 switchover.
# Each run overwrites the Vault KV version, creating a new version in the
# version history.
#
# Prerequisites:
#   - Vault token: run `vldj` (4h TTL)
#   - AWS sessions: run `klam login && klsa`
#
# Usage:
#   ./vault-sm-to-vault-sync.sh                  # All services, all envs
#   ./vault-sm-to-vault-sync.sh dev              # All services, dev only
#   ./vault-sm-to-vault-sync.sh dev api-service  # Single service + env
#   DRY_RUN=1 ./vault-sm-to-vault-sync.sh        # Show what would happen

VAULT_MOUNT="dx_mysticat"

SERVICES=(
  api-service
  audit-worker
  auth-service
  autofix-worker
  content-processor
  content-scraper
  fulfillment-worker
  import-job-manager
  import-worker
  jobs-dispatcher
  reporting-worker
  task-manager
)
# data-service excluded: uses ECS + different secret layout

ALL_ENVS=(dev stage prod)

declare -A AWS_PROFILES=(
  [dev]=spacecat-dev
  [stage]=spacecat-stage
  [prod]=spacecat-prod
)

# Parse optional arguments
FILTER_ENV="${1:-}"
FILTER_SVC="${2:-}"
DRY_RUN="${DRY_RUN:-0}"

if [ -n "$FILTER_ENV" ] && [ "$FILTER_ENV" != "dev" ] && [ "$FILTER_ENV" != "stage" ] && [ "$FILTER_ENV" != "prod" ]; then
  echo "Usage: $0 [dev|stage|prod] [service-name]"
  exit 1
fi

ENVS=("${ALL_ENVS[@]}")
if [ -n "$FILTER_ENV" ]; then
  ENVS=("$FILTER_ENV")
fi

pass=0
fail=0
skip=0
failures=()

for service in "${SERVICES[@]}"; do
  if [ -n "$FILTER_SVC" ] && [ "$service" != "$FILTER_SVC" ]; then
    continue
  fi

  for env in "${ENVS[@]}"; do
    profile="${AWS_PROFILES[$env]}"
    sm_path="/helix-deploy/spacecat-services/${service}/latest"
    vault_path="${VAULT_MOUNT}/${env}/${service}"

    echo "--- ${service} / ${env} ---"

    # Read from SM
    echo "  Reading SM secret: ${sm_path} (${profile})"
    if ! SM_JSON=$(AWS_PROFILE="${profile}" aws secretsmanager get-secret-value \
      --secret-id "${sm_path}" \
      --query SecretString --output text 2>&1); then
      echo "  SKIP: SM secret not found or not accessible: ${SM_JSON}"
      skip=$((skip + 1))
      continue
    fi

    # Count keys for reporting
    KEY_COUNT=$(echo "$SM_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
    echo "  SM has ${KEY_COUNT} keys"

    if [ "$DRY_RUN" = "1" ]; then
      echo "  DRY RUN: would write ${KEY_COUNT} keys to Vault at ${vault_path}"
      pass=$((pass + 1))
      continue
    fi

    # Write to Vault KV
    echo "  Writing to Vault: ${vault_path}"
    if ! VAULT_RESULT=$(echo "$SM_JSON" | vault kv put "${vault_path}" - 2>&1); then
      echo "  FAIL: Vault write failed: ${VAULT_RESULT}"
      fail=$((fail + 1))
      failures+=("${service}/${env}: vault kv put failed - ${VAULT_RESULT}")
      continue
    fi

    # Verify round-trip: read back and compare key count
    VAULT_KEY_COUNT=$(vault kv get -format=json "${vault_path}" 2>/dev/null \
      | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['data']))" 2>/dev/null || echo "0")

    if [ "$KEY_COUNT" = "$VAULT_KEY_COUNT" ]; then
      echo "  PASS: ${KEY_COUNT} keys synced and verified"
      pass=$((pass + 1))
    else
      echo "  FAIL: key count mismatch - SM=${KEY_COUNT}, Vault=${VAULT_KEY_COUNT}"
      fail=$((fail + 1))
      failures+=("${service}/${env}: key count mismatch SM=${KEY_COUNT} Vault=${VAULT_KEY_COUNT}")
    fi
  done
done

echo ""
echo "========================================="
echo "Results: ${pass} passed, ${fail} failed, ${skip} skipped"
echo "========================================="

if [ ${#failures[@]} -gt 0 ]; then
  echo ""
  echo "Failures:"
  for f in "${failures[@]}"; do
    echo "  - ${f}"
  done
  exit 1
fi
