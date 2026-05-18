# Extract OIDC Trusted Publisher setup tooling before propagating to sibling repos

Status: proposed (PR #1592 follow-up)
Tracking issue: TBD (to be filed under adobe/spacecat-shared issues)
Driver: solaris007 round-3 review of PR #1592

## Context

PR #1592 migrates npm publishing in `adobe/spacecat-shared` from a long-lived
`ADOBE_BOT_NPM_TOKEN` to npm OIDC Trusted Publishers. The same migration needs
to land on the ~10 sibling `spacecat-*` / `mysticat-*` publishing repos.

Round-3 review flagged this extraction as Important:

> The current code shape is monolithic per-repo: a ~370-line setup script
> with hardcoded constants and a ~60-line workflow guard step with the same
> regex contract. Drift across 10 copies is supply-chain risk, not
> test-suite tedium — any of those copies regressing on the protection-state
> check or the phase-detection regex is a silent security weakening, not a
> build failure.

## What to extract

From `adobe/spacecat-shared` post-PR-#1592:

1. **`scripts/setup-npm-trusted-publishers.sh` (~370 lines)** — currently
   has hardcoded:
   - `REPO`, `WORKFLOW`, `ENVIRONMENT` constants
   - `EXPECTED_NPM_USER`, `EXPECTED_BYPASS_USER` constants
   - `PACKAGES` array (auto-derivable from `packages/*/package.json` via the
     existing drift check)
   - Branch-protection policy schema (10-attribute aggregator jq)
   - Environment policy schema (`can_admins_bypass=false`,
     `required_reviewers` non-empty, `prevent_self_review=true`, main-only
     deployment policy)

2. **`.github/workflows/main.yaml` "Verify SR_NO_NPM_AUTH guard consistency"
   step** (~60 lines with the YAML-key-anchored phase-detection regex)

3. **`docs/RELEASE-RUNBOOK.md`** (templatable: 5 failure-mode procedures,
   detection section, rotation sequence)

## Two viable shapes — recommendation: Option A

For an operation that registers OIDC trust bindings on npmjs.com (a
security-critical, provider-neutral configuration), **Option A is the
recommended shape**:

- Provider-neutral — any operator with `npm` and a token can run it, no
  Claude/agent runtime required.
- Version-pinnable — `npx @adobe/oidc-trusted-publishers-setup@1.2.3`
  gives a reproducible, auditable execution.
- Auditable — the tarball's contents on npmjs.com become part of the
  supply-chain attestation surface (provenance metadata for the tool
  itself).
- Composes with CI — the workflow tripwire becomes a versioned composite
  action callable by every sibling repo.

Option B is kept as a documented alternative for the case where the
extraction is gated on org-wide skill availability — it's lower-friction
for operators already running Claude Code, but it adds a runtime dependency
on the skill harness for a flow whose entire purpose is to eliminate
runtime dependencies.

### Option A — npm tool (RECOMMENDED)

Publish `@adobe/oidc-trusted-publishers-setup`. Each repo's
`scripts/setup-npm-trusted-publishers.sh` becomes a 5-line wrapper:

```bash
#!/usr/bin/env bash
exec npx @adobe/oidc-trusted-publishers-setup@latest \
  --repo adobe/<this-repo> \
  --workflow main.yaml \
  --environment npm-publish \
  --expected-user adobe-bot
```

The CI tripwire becomes a composite action under
`adobe/oidc-trusted-publishers-setup/.github/actions/verify-sr-no-npm-auth-guard@v1`.

### Option B — aem-sites-architecture skill (alternative)

A Claude Code skill that codifies the migration as a series of agent-driven
steps. Operator runs the skill in each repo; the skill enforces the same
configuration shape.

## Acceptance criteria

- One shared implementation of the setup script + CI tripwire (Option A or B)
- Fixture-tested phase-detection regex (`tests/fixtures/` covering
  phase-1-clean, phase-1-missing-guard, phase-2-clean, phase-2-leftover-guard)
- Branch-protection policy schema lives in the extracted tool, not per-repo
  copies
- **Hard cap**: extract before any repo beyond `adobe/spacecat-shared` picks
  up this pattern

## Out of scope (recommended ahead of propagation)

- Replace `ADOBE_BOT_GITHUB_TOKEN` PAT with a GitHub App installation token.
  This is the residual hole in the post-OIDC threat model — `adobe-bot` is
  on `main`'s PR-bypass list, so compromising its GitHub credentials still
  allows pushing to `main` and triggering a release with a valid sigstore
  attestation that says "this was built from main" (true but compromised).
- Periodic protection-drift detection cron (should live in the extracted tool)
- Pinning `actions/*` to commit SHAs (already deferred in PR #1592)

## References

- PR #1592 — migration baseline
- SITES-42702 — migration tracking ticket
- npm Trusted Publishers: https://docs.npmjs.com/trusted-publishers
