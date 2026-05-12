#!/usr/bin/env bash
# One-time setup: configure OIDC Trusted Publishers for all published packages.
#
# Requirements:
#   - npm >= 11.10.0 (run: npm install -g npm@11.13.0)
#   - Logged in as the adobe-bot npm account (run: npm login, then verify: npm whoami)
#   - Publish rights on all @adobe/* packages listed below
#   - gh CLI installed and authenticated (for GitHub Environment + branch-protection preflight)
#   - The 'npm-publish' GitHub Environment exists on adobe/spacecat-shared with a
#     main-only deployment_branch_policy AND branch protection is enabled on main
#     (otherwise the trust binding's '--environment' filter has no enforceable boundary).
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
# The --environment flag binds the trust to the 'npm-publish' GitHub Environment.
# Configure that environment with a deployment branch policy that allows only `main`,
# so only the main-branch release job can mint a publish-scoped OIDC token.
#
# When adding a new package to the monorepo:
#   1. Do an interactive first publish (new packages cannot use OIDC for first publish):
#      npm publish --access public  (from a developer machine logged in as adobe-bot)
#   2. Add the package name to the PACKAGES array below
#   3. Re-run this script for the new package only (safe to re-run: npm trust is idempotent)
set -uo pipefail

MIN_NPM_MAJOR=11
MIN_NPM_MINOR=10
EXPECTED_NPM_USER="adobe-bot"
REPO="adobe/spacecat-shared"
WORKFLOW="main.yaml"
ENVIRONMENT="npm-publish"

# --- Preflight checks ---

CURRENT_NPM=$(npm --version 2>/dev/null || echo "0.0.0")
CURRENT_MAJOR=$(echo "$CURRENT_NPM" | cut -d. -f1)
CURRENT_MINOR=$(echo "$CURRENT_NPM" | cut -d. -f2)
if [ "$CURRENT_MAJOR" -lt "$MIN_NPM_MAJOR" ] || { [ "$CURRENT_MAJOR" -eq "$MIN_NPM_MAJOR" ] && [ "$CURRENT_MINOR" -lt "$MIN_NPM_MINOR" ]; }; then
  echo "ERROR: npm >= ${MIN_NPM_MAJOR}.${MIN_NPM_MINOR}.0 required (found ${CURRENT_NPM})."
  echo "       Run: npm install -g npm@11.13.0"
  exit 1
fi

CURRENT_REGISTRY=$(npm config get registry 2>/dev/null || echo "")
EXPECTED_REGISTRY="https://registry.npmjs.org/"
if [ "$CURRENT_REGISTRY" != "$EXPECTED_REGISTRY" ]; then
  echo "ERROR: registry must be ${EXPECTED_REGISTRY} (currently: '${CURRENT_REGISTRY}')."
  echo "       Run: npm config set registry ${EXPECTED_REGISTRY}"
  exit 1
fi

CURRENT_USER=$(npm whoami 2>/dev/null || echo "")
if [ "$CURRENT_USER" != "$EXPECTED_NPM_USER" ]; then
  echo "ERROR: Must be logged in as '${EXPECTED_NPM_USER}' (currently: '${CURRENT_USER}')."
  echo "       Run: npm login"
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
if [ ! -f "${REPO_ROOT}/.github/workflows/${WORKFLOW}" ]; then
  echo "ERROR: workflow file not found: .github/workflows/${WORKFLOW}"
  echo "       Update the WORKFLOW constant in this script if main.yaml was renamed."
  exit 1
fi

# --- GitHub-side preflight ---
# Verifies that the security boundary the trust binding claims to enforce actually
# exists on the repo. Without these the '--environment npm-publish' filter on the
# binding is decorative: an OIDC token from any branch can carry the environment
# claim (since the claim is set by the workflow declaration, not validated by env
# policy), and any repo writer can push code to main that mints publish tokens.

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI not installed (required for GitHub Environment + branch-protection preflight)."
  echo "       Install: brew install gh, then gh auth login"
  exit 1
fi

if ! gh api "repos/${REPO}/environments/${ENVIRONMENT}" >/dev/null 2>&1; then
  echo "ERROR: GitHub Environment '${ENVIRONMENT}' does not exist on ${REPO}."
  echo "       Create it (Settings → Environments) with a main-only deployment branch"
  echo "       policy and required reviewers, then re-run."
  exit 1
fi

ENV_POLICIES=$(gh api "repos/${REPO}/environments/${ENVIRONMENT}/deployment-branch-policies" \
  --jq '[.branch_policies[].name] | sort' 2>/dev/null || echo "")
if [ "$ENV_POLICIES" != '["main"]' ]; then
  echo "ERROR: '${ENVIRONMENT}' deployment branch policy is not restricted to 'main' only."
  echo "       Current policies: ${ENV_POLICIES:-<none>}"
  echo "       Without a main-only policy the OIDC token's 'environment' claim has no"
  echo "       server-enforced boundary."
  exit 1
fi

PROTECTION_STATE=$(gh api "repos/${REPO}/branches/main/protection" --jq '
  if   (.required_pull_request_reviews.required_approving_review_count // 0) < 1   then "weak: required_approving_review_count < 1"
  elif (.enforce_admins.enabled // false) != true                                   then "weak: enforce_admins disabled"
  elif (.allow_force_pushes.enabled // false) != false                              then "weak: force-push allowed"
  elif (.allow_deletions.enabled // false) != false                                 then "weak: deletion allowed"
  elif ((.required_status_checks.contexts // []) | any(. == "Test")) | not          then "weak: Test not in required_status_checks"
  else "OK" end
' 2>/dev/null || echo "missing")

if [ "$PROTECTION_STATE" != "OK" ]; then
  echo "ERROR: branch protection on 'main' is missing or weaker than the trust-binding"
  echo "       security model requires (status: ${PROTECTION_STATE})."
  echo ""
  echo "       Required:"
  echo "         required_pull_request_reviews.required_approving_review_count >= 1"
  echo "         enforce_admins.enabled == true"
  echo "         allow_force_pushes.enabled == false"
  echo "         allow_deletions.enabled == false"
  echo "         required_status_checks.contexts contains 'Test'"
  if [ "$PROTECTION_STATE" != "missing" ]; then
    echo ""
    echo "       Current state:"
    gh api "repos/${REPO}/branches/main/protection" --jq '{
      required_approvals: .required_pull_request_reviews.required_approving_review_count,
      enforce_admins: .enforce_admins.enabled,
      allow_force_pushes: .allow_force_pushes.enabled,
      allow_deletions: .allow_deletions.enabled,
      status_checks: .required_status_checks.contexts
    }' 2>/dev/null | sed 's/^/         /'
  fi
  exit 1
fi

echo "npm ${CURRENT_NPM} / user ${CURRENT_USER} / registry ${CURRENT_REGISTRY}"
echo "GitHub Environment '${ENVIRONMENT}' (main-only policy) + branch protection on 'main' — preflight OK"
echo ""

# --- Package list ---
# Keep in sync with packages/ directory. @adobe/spacecat-shared-example is intentionally
# excluded — it is a template package, marked "private": true in its package.json.

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

# --- Drift check: compare PACKAGES against publishable workspace packages ---
# Surfaces a new package directory that was not added to PACKAGES before its first
# release fails silently. Uses node (already required by the repo) — no jq needed.
# Fail-closed: node errors and empty enumeration both abort. Without this, a node
# failure (wrong cwd, malformed package.json, syntax error) silently passes the
# drift check and the script proceeds to trust registration unverified.

if ! WORKSPACE_PACKAGES=$(REPO_ROOT="${REPO_ROOT}" node -e '
  const fs = require("fs");
  const path = require("path");
  const dir = path.join(process.env.REPO_ROOT, "packages");
  const names = fs.readdirSync(dir)
    .map((d) => path.join(dir, d, "package.json"))
    .filter((p) => fs.existsSync(p))
    .map((p) => JSON.parse(fs.readFileSync(p, "utf8")))
    .filter((pkg) => pkg.private !== true)
    .map((pkg) => pkg.name)
    .sort();
  process.stdout.write(names.join("\n"));
'); then
  echo "ERROR: drift check failed to enumerate workspace packages (node exited non-zero)"
  exit 1
fi

if [ -z "$WORKSPACE_PACKAGES" ]; then
  echo "ERROR: workspace package enumeration returned empty — refusing to proceed"
  echo "       (drift check cannot verify PACKAGES against an empty workspace)"
  exit 1
fi

# Forward drift: publishable workspace packages missing from PACKAGES.
# Catches a new package added without updating PACKAGES.
DRIFT=()
while IFS= read -r ws_pkg; do
  [ -z "$ws_pkg" ] && continue
  found=0
  for pkg in "${PACKAGES[@]}"; do
    if [ "$pkg" = "$ws_pkg" ]; then found=1; break; fi
  done
  if [ "$found" -eq 0 ]; then DRIFT+=("$ws_pkg"); fi
done <<< "$WORKSPACE_PACKAGES"

if [ ${#DRIFT[@]} -gt 0 ]; then
  echo "ERROR: PACKAGES array drift — publishable workspace packages missing from PACKAGES:"
  for pkg in "${DRIFT[@]}"; do echo "  - ${pkg}"; done
  echo ""
  echo "Add them to the PACKAGES array (or mark the package private if it should not be"
  echo "published), then re-run."
  exit 1
fi

# Reverse drift: entries in PACKAGES that no longer exist in the workspace
# (deleted, renamed, or flipped to private). These accumulate as orphaned npm
# trust bindings on npmjs.com. Warn but don't block — orphans don't break this run.
ORPHANS=()
for pkg in "${PACKAGES[@]}"; do
  found=0
  while IFS= read -r ws_pkg; do
    [ -z "$ws_pkg" ] && continue
    if [ "$pkg" = "$ws_pkg" ]; then found=1; break; fi
  done <<< "$WORKSPACE_PACKAGES"
  if [ "$found" -eq 0 ]; then ORPHANS+=("$pkg"); fi
done

if [ ${#ORPHANS[@]} -gt 0 ]; then
  echo "WARNING: PACKAGES contains entries no longer in the workspace:"
  for pkg in "${ORPHANS[@]}"; do echo "  - ${pkg}"; done
  echo ""
  echo "Remove them from PACKAGES, and revoke their npm trust bindings with:"
  echo "  npm trust revoke github <pkg> --repository ${REPO} --file ${WORKFLOW}"
  echo ""
  echo "Continuing — orphans are not blocking, but their bindings on npmjs.com are stale."
  echo ""
fi

echo "Configuring npm OIDC Trusted Publishers for ${#PACKAGES[@]} packages..."
echo "Repository: ${REPO}, Workflow: ${WORKFLOW}, Environment: ${ENVIRONMENT}"
echo ""

FAILED=()

for pkg in "${PACKAGES[@]}"; do
  echo "  Configuring: ${pkg}"
  output=$(npm trust github "${pkg}" \
      --repository "${REPO}" \
      --file "${WORKFLOW}" \
      --environment "${ENVIRONMENT}" \
      --yes 2>&1)
  rc=$?
  echo "${output}" | sed 's/^/    /'
  if [ "${rc}" -ne 0 ]; then
    echo "    ERROR: npm trust exited ${rc} for ${pkg}"
    FAILED+=("${pkg}")
  fi
  # Pace requests to avoid registry rate-limit throttling on bulk trust binding.
  sleep 2
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

# --- Audit trail ---
# Capture provenance for the trust-establishment ceremony. Written to both stdout
# and a sibling log file so a piped/redirected run still leaves an artifact on disk.
# Paste either into SITES-42702 to record who registered the bindings, against
# which commit, and when.

GIT_SHA=$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || echo "unknown")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
# PID suffix avoids same-second filename collision if the script is re-run quickly
# (e.g. via a retry wrapper after a transient failure).
AUDIT_FILE="${SCRIPT_DIR}/npm-trust-audit-${TIMESTAMP}-$$.log"

# Build the audit text in a variable so stdout printing is decoupled from file write.
# Operator gets the trail on stdout unconditionally — file write is a non-blocking
# artifact convenience, not a critical path.
AUDIT_CONTENT="--- npm OIDC Trusted Publisher setup audit trail (SITES-42702) ---
  timestamp: ${TIMESTAMP}
  git SHA:   ${GIT_SHA}
  npm user:  ${CURRENT_USER}
  npm ver:   ${CURRENT_NPM}
  registry:  ${CURRENT_REGISTRY}
  repo:      ${REPO}
  workflow:  ${WORKFLOW}
  env:       ${ENVIRONMENT}
  packages:  ${#PACKAGES[@]}
  registered:"
for pkg in "${PACKAGES[@]}"; do
  AUDIT_CONTENT="${AUDIT_CONTENT}
    - ${pkg}"
done

echo "Done. All ${#PACKAGES[@]} packages configured for OIDC publishing."
echo ""
echo "${AUDIT_CONTENT}"
echo ""

if printf '%s\n' "${AUDIT_CONTENT}" > "${AUDIT_FILE}" 2>/dev/null && [ -s "${AUDIT_FILE}" ]; then
  echo "Audit log also written to: ${AUDIT_FILE}"
else
  echo "WARNING: failed to write audit log to ${AUDIT_FILE}"
  echo "         Trust bindings ARE registered. Capture the audit trail above manually"
  echo "         for SITES-42702 — the file artifact could not be persisted."
fi
