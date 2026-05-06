#!/usr/bin/env bash
# One-time setup: configure OIDC Trusted Publishers for all published packages.
#
# Requirements:
#   - npm >= 11.10.0 (run: npm install -g npm@11.13.0)
#   - Logged in as the adobe-bot npm account (run: npm login, then verify: npm whoami)
#   - Publish rights on all @adobe/* packages listed below
#
# Run this script BEFORE merging the OIDC workflow changes, then verify that
# at least one release succeeds via OIDC before removing ADOBE_BOT_NPM_TOKEN
# from GitHub secrets.
#
# IMPORTANT: The --file value is the workflow filename only (not the full path).
# npm Trusted Publishers expect the bare filename, not .github/workflows/main.yaml.
# If main.yaml is ever renamed, re-run this script with the updated WORKFLOW value
# and update the warning comment at the top of .github/workflows/main.yaml.
#
# When adding a new package to the monorepo:
#   1. Do a token-based first publish (new packages cannot use OIDC for first publish)
#   2. Add the package name to the PACKAGES array below
#   3. Re-run this script for the new package only (safe to re-run: npm trust is idempotent)
set -uo pipefail

MIN_NPM_MAJOR=11
MIN_NPM_MINOR=10
EXPECTED_NPM_USER="adobe-bot"
REPO="adobe/spacecat-shared"
WORKFLOW="main.yaml"

# --- Preflight checks ---

CURRENT_NPM=$(npm --version 2>/dev/null || echo "0.0.0")
CURRENT_MAJOR=$(echo "$CURRENT_NPM" | cut -d. -f1)
CURRENT_MINOR=$(echo "$CURRENT_NPM" | cut -d. -f2)
if [ "$CURRENT_MAJOR" -lt "$MIN_NPM_MAJOR" ] || { [ "$CURRENT_MAJOR" -eq "$MIN_NPM_MAJOR" ] && [ "$CURRENT_MINOR" -lt "$MIN_NPM_MINOR" ]; }; then
  echo "ERROR: npm >= ${MIN_NPM_MAJOR}.${MIN_NPM_MINOR}.0 required (found ${CURRENT_NPM})."
  echo "       Run: npm install -g npm@11.13.0"
  exit 1
fi

CURRENT_USER=$(npm whoami 2>/dev/null || echo "")
if [ "$CURRENT_USER" != "$EXPECTED_NPM_USER" ]; then
  echo "ERROR: Must be logged in as '${EXPECTED_NPM_USER}' (currently: '${CURRENT_USER}')."
  echo "       Run: npm login"
  exit 1
fi

echo "npm ${CURRENT_NPM} / user ${CURRENT_USER} — preflight OK"
echo ""

# --- Package list ---
# Keep in sync with packages/ directory. @adobe/spacecat-shared-example is intentionally
# excluded — it is a template package not intended for automated publishing.

PACKAGES=(
  "@adobe/mysticat-shared-seo-client"
  "@adobe/spacecat-shared-ahrefs-client"
  "@adobe/spacecat-shared-athena-client"
  "@adobe/spacecat-shared-brand-client"
  "@adobe/spacecat-shared-cloud-manager-client"
  "@adobe/spacecat-shared-content-client"
  "@adobe/spacecat-shared-data-access"
  "@adobe/spacecat-shared-drs-client"
  "@adobe/spacecat-shared-google-client"
  "@adobe/spacecat-shared-gpt-client"
  "@adobe/spacecat-shared-html-analyzer"
  "@adobe/spacecat-shared-http-utils"
  "@adobe/spacecat-shared-ims-client"
  "@adobe/spacecat-shared-launchdarkly-client"
  "@adobe/spacecat-shared-rum-api-client"
  "@adobe/spacecat-shared-scrape-client"
  "@adobe/spacecat-shared-slack-client"
  "@adobe/spacecat-shared-splunk-client"
  "@adobe/spacecat-shared-tier-client"
  "@adobe/spacecat-shared-tokowaka-client"
  "@adobe/spacecat-shared-utils"
  "@adobe/spacecat-shared-vault-secrets"
)

echo "Configuring npm OIDC Trusted Publishers for ${#PACKAGES[@]} packages..."
echo "Repository: ${REPO}, Workflow: ${WORKFLOW}"
echo ""

FAILED=()

for pkg in "${PACKAGES[@]}"; do
  echo "  Configuring: ${pkg}"
  if npm trust github-actions "${pkg}" \
      --repository "${REPO}" \
      --file "${WORKFLOW}" \
      --yes 2>&1; then
    true
  else
    echo "  ERROR: failed to configure ${pkg}"
    FAILED+=("${pkg}")
  fi
done

echo ""
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "FAILED packages (${#FAILED[@]}):"
  for pkg in "${FAILED[@]}"; do
    echo "  - ${pkg}"
  done
  echo ""
  echo "Fix the issues above and re-run — npm trust is idempotent, already-configured"
  echo "packages will be skipped safely."
  exit 1
fi

echo "Done. All ${#PACKAGES[@]} packages configured for OIDC publishing."
