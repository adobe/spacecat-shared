# Release Runbook — npm OIDC Trusted Publishers

On-call procedures for the npm OIDC-based publish path
(`.github/workflows/main.yaml` release job).

The release job publishes all 22 `@adobe/*` packages to npmjs.com via the
`npm-publish` GitHub Environment with sigstore provenance. Trust binding
recorded on npmjs.com: `{repo: adobe/spacecat-shared, workflow: main.yaml,
environment: npm-publish}`. Authentication uses OIDC (no `NPM_TOKEN`).

## Normal release flow

1. PR merges to `main` (gated by branch protection: PR review, dismiss-stale,
   `Test` status check, no force-push, no direct push except `adobe-bot`).
2. `release` job triggers on `main` with `environment: npm-publish` — a
   `spacecat-admins` reviewer must approve before the job runs.
3. semantic-release computes the next version per package, publishes via
   OIDC + sigstore, tags, and pushes the `chore(release): <version> [skip ci]`
   commit back to `main` using `ADOBE_BOT_GITHUB_TOKEN` (on the branch
   protection bypass list).

Verify provenance after a release:

```bash
npm view @adobe/<package> --json | jq '.dist.attestations'
```

---

## Failure mode 1: First OIDC release fails after merge

Symptoms:

- Release job fails at the `Semantic Release` step.
- `npm publish` errors with one of: `403 OIDC trust binding mismatch`,
  `401 unauthenticated`, or `sigstore: token mint failed`.

Recovery (revert and resume token-based publishing):

```bash
git revert <merge-sha-of-this-PR>
git push origin main   # bot is on branch-protection bypass, this succeeds
```

`ADOBE_BOT_NPM_TOKEN` is intentionally retained in GitHub repo secrets for
≥ 2 successful release cycles (per SITES-42702). The revert re-adds
`NPM_TOKEN: ${{ secrets.ADOBE_BOT_NPM_TOKEN }}` to the workflow env and the
next release publishes via the token path.

Investigate the OIDC failure:

- Trust binding registered with the wrong workflow filename? Check
  `npm trust list <package>` and re-run `scripts/setup-npm-trusted-publishers.sh`.
- `npm-publish` environment misconfigured? Verify deployment branch policy
  via `gh api repos/adobe/spacecat-shared/environments/npm-publish/deployment-branch-policies`.
- Workflow's `environment: npm-publish` declaration removed accidentally?
  Check `.github/workflows/main.yaml`.

After fixing, open a fresh PR re-introducing the OIDC migration.

## Failure mode 2: Sigstore unavailable

Symptoms:

- Release job fails at the sigstore attestation step inside `npm publish`.
- https://status.sigstore.dev/ shows degraded availability.

Break-glass: publish without provenance for the duration of the outage.

```yaml
# In .github/workflows/main.yaml, release job env:
NPM_CONFIG_PROVENANCE: 'false'
```

**Realistic timing (~30–60 min):**

1. Open a PR setting `NPM_CONFIG_PROVENANCE: 'false'`.
2. Get review approval (required by branch protection — `dismiss_stale_reviews`
   is on, so any push invalidates prior approvals).
3. `Test` job runs (~10 min).
4. Merge — release job triggers, requires `spacecat-admins` approval at the
   `npm-publish` environment gate.
5. Release publishes without provenance.
6. After sigstore recovers, open a follow-up PR flipping back to `'true'`.
   Same timing for the revert.

Decision factor: a release blocked by sigstore is usually fine to defer for
a few hours. Only flip to `'false'` for time-critical security fixes where
the gain from immediate publish outweighs the temporary loss of attestation.

## Failure mode 3: Partial publish (timeout-minutes: 15 hit mid-way)

Symptoms:

- Release job killed after 15 min — some of the 22 packages on npmjs.com at
  version `X+1`, others still at `X`.
- Git tag may or may not have been pushed depending on whether
  semantic-release reached the `@semantic-release/git` plugin step.

Inspect partial state:

```bash
for pkg in @adobe/spacecat-shared-data-access @adobe/spacecat-shared-utils ...; do
  echo "$pkg: $(npm view "$pkg" dist-tags.latest)"
done
```

Recovery, depending on which side made progress:

- **Git tag exists, some packages didn't publish**: the `chore(release):`
  commit is already on `main`. Re-trigger the release job from the Actions UI
  (Run workflow → Release). semantic-release skips already-published versions
  and publishes the missing ones.
- **Git tag missing**: revert the in-progress `chore(release):` commit (if it
  was pushed before timeout), then push a no-op commit to `main` to retrigger
  the release.
- **Both missing**: re-trigger the release job; semantic-release starts fresh.

Pre-emption: for releases touching > 10 packages, monitor the job. If a
single-PR release is unusually large, consider a one-off PR bumping
`timeout-minutes` to 20 or 25 for that release window.

## Failure mode 4: Workflow file or environment renamed

Trust bindings on npmjs.com reference `{repo, workflow filename, environment}`.
Renaming `.github/workflows/main.yaml` or the `npm-publish` GitHub Environment
silently invalidates all 22 bindings — the first release after the rename
fails with `OIDC trust binding mismatch`.

Recovery:

1. Update the `WORKFLOW` or `ENVIRONMENT` constant in
   `scripts/setup-npm-trusted-publishers.sh` to the new name.
2. Re-run the script as `adobe-bot`. `npm trust` is idempotent, so existing
   bindings under the old name remain but the new ones are registered.
3. Revoke the old bindings manually so they don't accumulate as orphaned
   trust:

   ```bash
   for pkg in @adobe/spacecat-shared-data-access ...; do
     npm trust revoke github "$pkg" \
       --repository adobe/spacecat-shared \
       --file <old-workflow-filename>
   done
   ```

The workflow header comment and the setup-script preflight both warn about
this hazard, but a renamer six months from now may not read either — keep
this runbook up to date with whatever the workflow filename actually is.

## Failure mode 5: Setup-script preflight refuses to register bindings

Symptoms (operator running the setup script as `adobe-bot`):

- Preflight fails with `branch protection on 'main' is weaker than the
  trust-binding security model requires`, or
- `'npm-publish' deployment branch policy is not restricted to 'main' only`.

Recovery: do not bypass the preflight by editing the script. Fix the underlying
configuration. Reference the security model required:

| Setting | Required value |
|---|---|
| Environment `npm-publish` exists | yes |
| Env `deployment_branch_policy` | `["main"]` only |
| Env `can_admins_bypass` | `false` |
| Env required reviewers | non-empty (`spacecat-admins`) |
| Branch protection on `main` | exists |
| `required_approving_review_count` | ≥ 1 |
| `dismiss_stale_reviews` | `true` |
| `enforce_admins` | `true` |
| `allow_force_pushes` | `false` |
| `allow_deletions` | `false` |
| `required_status_checks.contexts` | contains `Test` |
| Bypass actors (users + teams + apps) | ≤ 1 (only `adobe-bot`) |

If a setting is wrong, fix it in repo settings (`Settings → Branches` for
branch protection, `Settings → Environments → npm-publish` for the env),
then re-run the script.

---

## ADOBE_BOT_NPM_TOKEN rotation

Per SITES-42702, retain `ADOBE_BOT_NPM_TOKEN` in GitHub repo secrets for at
least 2 successful OIDC releases as rollback insurance. After that, complete
the cleanup in this order (each step is a separate PR; the CI tripwire
validates atomicity of step 3):

1. Delete the `ADOBE_BOT_NPM_TOKEN` secret from
   `Settings → Secrets and variables → Actions`.
2. Revoke the npm-side token on npmjs.com (separate from GitHub deletion).
3. In a single PR: remove the `SR_NO_NPM_AUTH: 'true'` env var from
   `.github/workflows/main.yaml` AND remove the strict guard
   (`...(process.env.SR_NO_NPM_AUTH === 'true' ? [] : ["@semantic-release/npm"]),`)
   from all 24 `.releaserc.cjs` files. The CI step
   `Verify SR_NO_NPM_AUTH guard consistency` auto-detects this transition
   and validates that the cleanup is complete (it would fail if env var is
   removed while some configs still reference `SR_NO_NPM_AUTH`).
4. (Optional follow-up) Remove the `Verify SR_NO_NPM_AUTH guard consistency`
   CI step itself — it becomes a no-op once `SR_NO_NPM_AUTH` is gone from
   the workflow.

---

## Cross-references

- [SITES-42702](https://jira.corp.adobe.com/browse/SITES-42702) — migration tracking ticket
- `.github/workflows/main.yaml` — release workflow with inline rename hazards
- `scripts/setup-npm-trusted-publishers.sh` — trust binding setup + preflight
- npm Trusted Publishers docs: https://docs.npmjs.com/trusted-publishers
- sigstore status: https://status.sigstore.dev/
