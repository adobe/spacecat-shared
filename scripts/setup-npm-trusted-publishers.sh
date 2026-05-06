#!/usr/bin/env bash
# One-time setup: configure OIDC Trusted Publishers for all published packages.
# Requires npm >= 11.10.0 and an npm account with publish rights on all @adobe/* packages.
# Run once, then OIDC publishing works without any NPM_TOKEN secret.
set -euo pipefail

REPO="adobe/spacecat-shared"
WORKFLOW="main.yaml"

PACKAGES=(
  "@adobe/mysticat-shared-seo-client"
  "@adobe/spacecat-shared-ahrefs-client"
  "@adobe/spacecat-shared-athena-client"
  "@adobe/spacecat-shared-brand-client"
  "@adobe/spacecat-shared-cloud-manager-client"
  "@adobe/spacecat-shared-content-client"
  "@adobe/spacecat-shared-data-access"
  "@adobe/spacecat-shared-drs-client"
  "@adobe/spacecat-shared-example"
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

for pkg in "${PACKAGES[@]}"; do
  echo "  Configuring: ${pkg}"
  npm trust github-actions "${pkg}" \
    --repository "${REPO}" \
    --file "${WORKFLOW}" \
    --yes
done

echo ""
echo "Done. All packages configured for OIDC publishing."
echo "Note: New packages (no prior publish) must use token-based first publish,"
echo "      then run this script to add them."
