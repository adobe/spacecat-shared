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

CURRENT_NPM_RAW=$(npm --version 2>/dev/null || echo "0.0.0")
# Some npm distributions emit a leading 'v' (e.g. 'v11.13.0'); strip it before
# integer comparison. Reject anything that doesn't match X.Y.Z afterwards rather
# than fall through (an unparsed prefix would make `cut` yield 'v11', `[ X -lt N ]`
# would error, and the negated test would evaluate false — preflight bypass).
CURRENT_NPM="${CURRENT_NPM_RAW#v}"
if ! [[ "$CURRENT_NPM" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  echo "ERROR: could not parse npm version (got: '${CURRENT_NPM_RAW}')."
  echo "       Expected semver X.Y.Z. Run: npm install -g npm@11.13.0"
  exit 1
fi
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

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh CLI is not authenticated."
  echo "       Run: gh auth login"
  exit 1
fi

EXPECTED_BYPASS_USER="adobe-bot"
# Validate the constant is shell- and jq-safe before string-interpolating it into
# the protection jq below. gh api does not support --arg (only standalone jq does),
# so we inline-substitute — but only after asserting the value is alphanumeric+hyphen
# so a future edit can't accidentally introduce a quote-injection bug.
if ! [[ "$EXPECTED_BYPASS_USER" =~ ^[a-zA-Z0-9-]+$ ]]; then
  echo "ERROR: EXPECTED_BYPASS_USER must match ^[a-zA-Z0-9-]+\$ (got: '${EXPECTED_BYPASS_USER}')"
  exit 1
fi

# Environment-side checks split into two tiers:
#   - HARD requirements (script aborts): can_admins_bypass=false + the env exists.
#     Without can_admins_bypass=false any admin could approve their own deployment,
#     which would defeat both the branch-policy gate and any future approval gate.
#   - SOFT recommendations (warn only): required_reviewers presence + prevent_self_review.
#     The required_reviewers rule was removed by design to avoid a single-timezone
#     bottleneck on routine releases (see workflow header + RELEASE-RUNBOOK.md
#     "Re-enabling the environment approval gate"). The load-bearing security
#     boundary is the deployment_branch_policy (checked below): no token can mint
#     with the 'environment' claim unless ref==main.
#
# Note: do NOT use jq's `// true` to default can_admins_bypass — `//` treats
# `false` as absent and falls through to the default, so `false // true` is
# `true`. Compare directly with `!= false` instead.
# Single gh api call returning tab-separated yes/no for each check, parsed
# inline in bash. Avoids three node-eval round-trips and keeps the parsing
# in the same jq pipeline that already powers the other env/protection checks.
ENV_FLAGS=$(gh api "repos/${REPO}/environments/${ENVIRONMENT}" --jq '
  [ (if .can_admins_bypass == false then "yes" else "no" end),
    (if ((.protection_rules // []) | map(select(.type == "required_reviewers" and ((.reviewers // []) | length) > 0)) | length) > 0 then "yes" else "no" end),
    (if (((.protection_rules // []) | map(select(.type == "required_reviewers")) | first | .prevent_self_review) == true) then "yes" else "no" end)
  ] | @tsv
' 2>/dev/null || echo "__MISSING__")

if [ "$ENV_FLAGS" = "__MISSING__" ]; then
  echo "ERROR: GitHub Environment '${ENVIRONMENT}' does not exist on ${REPO}."
  echo "       Create it (Settings → Environments) with: can_admins_bypass=false,"
  echo "       main-only deployment branch policy. Required reviewers are OPTIONAL"
  echo "       (see workflow header for the steady-state policy)."
  exit 1
fi

IFS=$'\t' read -r ENV_BYPASS_OK ENV_HAS_REVIEWERS ENV_PSR_OK <<< "$ENV_FLAGS"

if [ "$ENV_BYPASS_OK" != "yes" ]; then
  echo "ERROR: '${ENVIRONMENT}' environment has can_admins_bypass != false."
  echo "       Required: can_admins_bypass == false (admins must NOT be able to skip the env policy)."
  exit 1
fi

if [ "$ENV_HAS_REVIEWERS" = "yes" ] && [ "$ENV_PSR_OK" != "yes" ]; then
  echo "ERROR: '${ENVIRONMENT}' has required_reviewers but prevent_self_review != true."
  echo "       If reviewers are configured at all, prevent_self_review MUST be true,"
  echo "       otherwise a PR author could approve their own release."
  exit 1
fi
if [ "$ENV_HAS_REVIEWERS" != "yes" ]; then
  echo "INFO: '${ENVIRONMENT}' has no required_reviewers rule — releases auto-publish on main."
  echo "      This is the intended steady state for this repo (see workflow header)."
  echo "      To re-enable a human gate, see docs/RELEASE-RUNBOOK.md ('Re-enabling the"
  echo "      environment approval gate')."
fi

# Branch-policy check: filter by type == "branch" so a tag policy named "main"
# cannot satisfy the assertion (defense in depth — admins would have to add a
# tag policy named "main" deliberately for this to matter, but the filter costs
# nothing).
ENV_POLICIES=$(gh api "repos/${REPO}/environments/${ENVIRONMENT}/deployment-branch-policies" \
  --jq '[.branch_policies[] | select(.type == "branch") | .name] | sort' 2>/dev/null || echo "")
if [ "$ENV_POLICIES" != '["main"]' ]; then
  echo "ERROR: '${ENVIRONMENT}' deployment branch policy is not restricted to 'main' only."
  echo "       Current branch-type policies: ${ENV_POLICIES:-<none>}"
  echo "       Without a main-only policy the OIDC token's 'environment' claim has no"
  echo "       server-enforced boundary."
  exit 1
fi

# Aggregator: report every policy weakness in one pass instead of one-at-a-time.
# The dismiss_stale_reviews check closes a real attack chain (approve clean PR,
# force-push malicious commit to the PR branch, stale approval still satisfies
# the merge gate). The bypass-actor check fires if anyone beyond the expected
# adobe-bot semantic-release identity is allowed to skip PR review.
# Identity assertion (replaces the prior cardinality check, which would have
# passed if 'adobe-bot' had been swapped with another single actor — admin-side
# configuration drift attack).
#
# Note: gh api does NOT support --arg (only the standalone jq CLI does). We
# inline-substitute EXPECTED_BYPASS_USER into the jq string after asserting
# it matches ^[a-zA-Z0-9-]+$ above, so the interpolation cannot inject quotes.
# Also: prefer direct `!= true` / `!= false` over `// false` / `// true`
# defaults — jq's `//` treats false as absent and would mis-evaluate boolean
# checks (see comment on ENV_WEAKNESSES above).
PROTECTION_WEAKNESSES=$(gh api "repos/${REPO}/branches/main/protection" --jq '
  [ (if (.required_pull_request_reviews.required_approving_review_count // 0) < 1 then "required_approving_review_count < 1" else empty end),
    (if .required_pull_request_reviews.dismiss_stale_reviews != true then "dismiss_stale_reviews not strictly true" else empty end),
    (if .required_pull_request_reviews.require_last_push_approval != true then "require_last_push_approval not strictly true (allows reviewer-as-pusher self-approval after dismiss_stale)" else empty end),
    (if .enforce_admins.enabled != true then "enforce_admins not strictly true" else empty end),
    (if .allow_force_pushes.enabled != false then "force-push allowed" else empty end),
    (if .allow_deletions.enabled != false then "deletion allowed" else empty end),
    (if ((.required_status_checks.contexts // []) | any(. == "Test")) | not then "Test not in required_status_checks" else empty end),
    (if (((.required_pull_request_reviews.bypass_pull_request_allowances.users // []) | map(.login)) != ["'"${EXPECTED_BYPASS_USER}"'"])
       then "bypass.users is \((.required_pull_request_reviews.bypass_pull_request_allowances.users // []) | map(.login) | tojson) (expected [\"'"${EXPECTED_BYPASS_USER}"'\"])" else empty end),
    (if (((.required_pull_request_reviews.bypass_pull_request_allowances.teams // []) | length) > 0)
       then "unexpected bypass.teams entries" else empty end),
    (if (((.required_pull_request_reviews.bypass_pull_request_allowances.apps // []) | length) > 0)
       then "unexpected bypass.apps entries" else empty end)
  ] | join("; ")
' 2>/dev/null || echo "__MISSING__")

if [ "$PROTECTION_WEAKNESSES" = "__MISSING__" ]; then
  echo "ERROR: branch protection on 'main' is not configured (or unreadable) on ${REPO}."
  echo "       Required:"
  echo "         required_pull_request_reviews.required_approving_review_count >= 1"
  echo "         required_pull_request_reviews.dismiss_stale_reviews == true"
  echo "         required_pull_request_reviews.require_last_push_approval == true"
  echo "         enforce_admins.enabled == true"
  echo "         allow_force_pushes.enabled == false"
  echo "         allow_deletions.enabled == false"
  echo "         required_status_checks.contexts contains 'Test'"
  echo "         bypass_pull_request_allowances.users == [\"${EXPECTED_BYPASS_USER}\"], no teams, no apps"
  exit 1
fi

if [ -n "$PROTECTION_WEAKNESSES" ]; then
  echo "ERROR: branch protection on 'main' is weaker than the trust-binding security"
  echo "       model requires. Weaknesses found:"
  echo "         ${PROTECTION_WEAKNESSES}"
  echo ""
  echo "       Current state:"
  gh api "repos/${REPO}/branches/main/protection" --jq '{
    required_approvals: .required_pull_request_reviews.required_approving_review_count,
    dismiss_stale_reviews: .required_pull_request_reviews.dismiss_stale_reviews,
    enforce_admins: .enforce_admins.enabled,
    allow_force_pushes: .allow_force_pushes.enabled,
    allow_deletions: .allow_deletions.enabled,
    status_checks: .required_status_checks.contexts,
    bypass_users: [.required_pull_request_reviews.bypass_pull_request_allowances.users[]?.login],
    bypass_teams: [.required_pull_request_reviews.bypass_pull_request_allowances.teams[]?.slug],
    bypass_apps: [.required_pull_request_reviews.bypass_pull_request_allowances.apps[]?.slug]
  }' 2>/dev/null | sed 's/^/         /'
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
  "@adobe/spacecat-shared-project-engine-client"
  "@adobe/spacecat-shared-rum-api-client"
  "@adobe/spacecat-shared-scrape-client"
  "@adobe/spacecat-shared-slack-client"
  "@adobe/spacecat-shared-splunk-client"
  "@adobe/spacecat-shared-tier-client"
  "@adobe/spacecat-shared-tokowaka-client"
  "@adobe/spacecat-shared-user-manager-client"
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
  echo "Remove them from PACKAGES, and revoke their npm trust bindings:"
  echo "  npm trust list <pkg>                  # find the trust-id of the stale binding"
  echo "  npm trust revoke <pkg> --id <trust-id>"
  echo "(npm 11 revoke takes <package> + --id only — not the --repository/--file flags"
  echo " used to register, see docs/RELEASE-RUNBOOK.md FM-4.)"
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

# Atomic write via mktemp + mv: a partial write (disk full mid-stream) leaves the
# tempfile, and the rename never happens — operator sees the WARNING and the
# final-named file does not exist (no "looks complete but is truncated" failure).
# Tempfile is created in the same directory as AUDIT_FILE so the mv is an in-fs
# rename (truly atomic). mktemp -t / $TMPDIR could land on a tmpfs while
# AUDIT_FILE is on disk; cross-fs mv falls back to copy+unlink (not atomic).
TMP_AUDIT=$(mktemp "${SCRIPT_DIR}/npm-trust-audit.XXXXXX" 2>/dev/null || echo "")
if [ -n "${TMP_AUDIT}" ] \
   && printf '%s\n' "${AUDIT_CONTENT}" > "${TMP_AUDIT}" 2>/dev/null \
   && [ -s "${TMP_AUDIT}" ] \
   && mv "${TMP_AUDIT}" "${AUDIT_FILE}" 2>/dev/null; then
  echo "Audit log also written to: ${AUDIT_FILE}"
else
  [ -n "${TMP_AUDIT}" ] && rm -f "${TMP_AUDIT}" 2>/dev/null
  echo "WARNING: failed to write audit log to ${AUDIT_FILE}"
  echo "         Trust bindings ARE registered. Capture the audit trail above manually"
  echo "         for SITES-42702 — the file artifact could not be persisted."
fi
