#!/usr/bin/env bash
set -euo pipefail

# Phase 3 Validation: Verify secrets in Vault match SM and AppRole isolation works
#
# Prerequisites:
#   - Vault token: run `vldj` (4h TTL)
#   - AWS sessions: run `klam login && klsa`
#
# Usage:
#   ./vault-sm-to-vault-validate.sh           # Full validation
#   ./vault-sm-to-vault-validate.sh dev       # Dev only

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

ALL_ENVS=(dev stage prod)

declare -A AWS_PROFILES=(
  [dev]=spacecat-dev
  [stage]=spacecat-stage
  [prod]=spacecat-prod
)

FILTER_ENV="${1:-}"
ENVS=("${ALL_ENVS[@]}")
if [ -n "$FILTER_ENV" ]; then
  ENVS=("$FILTER_ENV")
fi

pass=0
fail=0

echo "=== Check 1: Key count match (SM vs Vault) ==="
echo ""

for service in "${SERVICES[@]}"; do
  for env in "${ENVS[@]}"; do
    profile="${AWS_PROFILES[$env]}"

    SM_KEYS=$(AWS_PROFILE="${profile}" aws secretsmanager get-secret-value \
      --secret-id "/helix-deploy/spacecat-services/${service}/latest" \
      --query SecretString --output text 2>/dev/null \
      | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

    VAULT_KEYS=$(vault kv get -format=json "${VAULT_MOUNT}/${env}/${service}" 2>/dev/null \
      | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['data']))" 2>/dev/null || echo "0")

    if [ "$SM_KEYS" = "0" ] && [ "$VAULT_KEYS" = "0" ]; then
      echo "  SKIP: ${env}/${service} - no secret in SM or Vault"
    elif [ "$SM_KEYS" = "$VAULT_KEYS" ]; then
      echo "  OK: ${env}/${service} (${SM_KEYS} keys)"
      pass=$((pass + 1))
    else
      echo "  MISMATCH: ${env}/${service} - SM=${SM_KEYS}, Vault=${VAULT_KEYS}"
      fail=$((fail + 1))
    fi
  done
done

echo ""
echo "=== Check 2: AppRole-scoped reads (service can read its own secrets) ==="
echo ""

# Spot-check: first and last service in dev
for svc in api-service task-manager; do
  BOOTSTRAP=$(AWS_PROFILE=spacecat-dev aws secretsmanager get-secret-value \
    --secret-id "/mysticat/bootstrap/${svc}" \
    --query SecretString --output text 2>/dev/null)
  ROLE_ID=$(echo "$BOOTSTRAP" | python3 -c "import sys,json; print(json.load(sys.stdin)['role_id'])")
  SEC_ID=$(echo "$BOOTSTRAP" | python3 -c "import sys,json; print(json.load(sys.stdin)['secret_id'])")
  TOKEN=$(vault write -field=token auth/approle/login role_id="$ROLE_ID" secret_id="$SEC_ID" 2>/dev/null)

  if VAULT_TOKEN=$TOKEN vault kv get "${VAULT_MOUNT}/dev/${svc}" > /dev/null 2>&1; then
    echo "  OK: ${svc} can read its own secrets via AppRole"
    pass=$((pass + 1))
  else
    echo "  FAIL: ${svc} cannot read its own secrets via AppRole"
    fail=$((fail + 1))
  fi
done

echo ""
echo "=== Check 3: Credential isolation (cross-service read must fail) ==="
echo ""

# Login as reporting-worker, try to read api-service (should be denied)
BOOTSTRAP=$(AWS_PROFILE=spacecat-dev aws secretsmanager get-secret-value \
  --secret-id "/mysticat/bootstrap/reporting-worker" \
  --query SecretString --output text 2>/dev/null)
ROLE_ID=$(echo "$BOOTSTRAP" | python3 -c "import sys,json; print(json.load(sys.stdin)['role_id'])")
SEC_ID=$(echo "$BOOTSTRAP" | python3 -c "import sys,json; print(json.load(sys.stdin)['secret_id'])")
TOKEN=$(vault write -field=token auth/approle/login role_id="$ROLE_ID" secret_id="$SEC_ID" 2>/dev/null)

if VAULT_TOKEN=$TOKEN vault kv get "${VAULT_MOUNT}/dev/api-service" > /dev/null 2>&1; then
  echo "  FAIL: isolation broken - reporting-worker CAN read api-service secrets"
  fail=$((fail + 1))
else
  echo "  OK: isolation verified - reporting-worker CANNOT read api-service secrets"
  pass=$((pass + 1))
fi

echo ""
echo "========================================="
echo "Validation: ${pass} passed, ${fail} failed"
echo "========================================="

[ "$fail" -eq 0 ] || exit 1
