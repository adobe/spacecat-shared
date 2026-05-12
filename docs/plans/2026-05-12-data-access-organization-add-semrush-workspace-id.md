# `spacecat-shared-data-access`: Add `semrushWorkspaceId` to Organization - Implementation Plan


**Goal:** Add a top-level `semrushWorkspaceId` string attribute to the `Organization` model in `spacecat-shared-data-access`, with auto-generated `findBySemrushWorkspaceId` / `allBySemrushWorkspaceId` collection accessors via `addAllIndex`. Mirrors the `imsOrgId` pattern.

**Architecture:** Single SchemaBuilder `.addAttribute` + `.addAllIndex` call on the Organization schema. TypeScript declarations follow. Unit tests use `createElectroMocks` (no DB). Integration test follows the existing `findByImsOrgId` IT pattern but is gated on the parallel DB migration landing in `mysticat-data-service` and a new Docker image being published.

**Tech Stack:** Node.js, ESM, ElectroDB-shaped SchemaBuilder, sinon (for unit-test mocks), mocha + chai (test runner), c8 (coverage; 100% lines / 97% branches enforced), semantic-release (versioning), husky + lint-staged (pre-commit), ESLint.

**Parent proposal:** [adobe/mysticat-architecture#61](https://github.com/adobe/mysticat-architecture/pull/61) - "Adobe IMS Integration with Semrush (First Pass)"

**Position in sequence:**
- Step 1 = `mysticat-data-service` PR ([adobe/mysticat-data-service#593](https://github.com/adobe/mysticat-data-service/pull/593)) - adds the DB column
- **Step 2 = this plan** - exposes the attribute on the data-access model
- Step 3 = `spacecat-api-service` consumes the new shared-data-access version (separate plan)
- Step 4 = `project-elmo-ui` consumes new `semrushWorkspaceId` from org response (separate plan)

**Dependency on Step 1:** unit tests + schema + types + fixture changes need the IT Docker image to have the column. Step 1 (data-service PR #593) merged and published `v5.15.0` (now in dev/stage/prod). The IT image tag is bumped from `v5.1.1` to `v5.15.0` in this same PR; the IT test is included un-skipped from the start.

**Note (post-mortem):** the initial CI on this branch failed because fixture[0] referenced `semrushWorkspaceId` while the IT image was still pinned to `v5.1.1` (no column). PostgREST rejected the org seed insert, the seed gracefully skipped organizations, and every downstream entity (sites, sentiment_topics, etc.) cascade-failed on `organization_id` NOT NULL constraints. The fix was simply to bump the image tag — Task 10 in the original plan, but pulled forward since the image was already available.

---

### Task 1: Branch off `origin/main`

**Files:** none yet

- [ ] **Step 1: Verify clean working tree**

```bash
git status
git fetch origin main
```

Expected: clean, `origin/main` up to date.

- [ ] **Step 2: Create feature branch from `origin/main`**

```bash
git switch -c feat/data-access-organization-semrush-workspace-id origin/main
```

---

### Task 2: Write failing unit tests for getter / setter

**Files:**
- Modify: `packages/spacecat-shared-data-access/test/unit/models/organization/organization.model.test.js`

- [ ] **Step 1: Add the test block after the existing `imsOrgId` block (line 86)**

In `packages/spacecat-shared-data-access/test/unit/models/organization/organization.model.test.js`, find the existing `describe('imsOrgId', ...)` block (around line 76) and add this new block immediately after it:

```javascript
  describe('semrushWorkspaceId', () => {
    it('gets semrushWorkspaceId', () => {
      expect(instance.getSemrushWorkspaceId()).to.equal('ws_test_existing');
    });

    it('sets semrushWorkspaceId', () => {
      instance.setSemrushWorkspaceId('ws_test_new');
      expect(instance.getSemrushWorkspaceId()).to.equal('ws_test_new');
    });

    it('returns undefined when semrushWorkspaceId is absent on the record', () => {
      const recordWithout = { ...instance.record };
      delete recordWithout.semrushWorkspaceId;
      const { mockEntityModel } = createElectroMocks(Organization, recordWithout);
      expect(mockEntityModel.getSemrushWorkspaceId()).to.be.undefined;
    });
  });
```

Note: the third test relies on `createElectroMocks` already being imported at the top of the file (it is, since the file uses it elsewhere). If the import is named differently, mirror the surrounding imports rather than adding a duplicate.

- [ ] **Step 2: Update the test record fixture so the getter test has a value to read**

In the same file, find where `instance` is constructed (look near the top, where the test record is defined - typically `const mockRecord = { ... }`). Add `semrushWorkspaceId: 'ws_test_existing'` alongside the other top-level fields.

- [ ] **Step 3: Run the new tests and confirm they fail**

```bash
npm test -w packages/spacecat-shared-data-access -- --grep "semrushWorkspaceId"
```

Expected: All three new tests FAIL. Failure reason should mention the missing accessor (`getSemrushWorkspaceId is not a function`) or undefined value, NOT a syntax error in the test code.

If failures are syntax errors, fix the test code before continuing.

- [ ] **Step 4: Commit the failing tests**

```bash
git add packages/spacecat-shared-data-access/test/unit/models/organization/organization.model.test.js
git commit -m "test(data-access): add failing tests for Organization.semrushWorkspaceId"
```

---

### Task 3: Add failing unit tests for collection accessors

**Files:**
- Modify: `packages/spacecat-shared-data-access/test/unit/models/organization/organization.collection.test.js`

- [ ] **Step 1: Find the existing `findByImsOrgId` / `allByImsOrgId` test block**

Open `packages/spacecat-shared-data-access/test/unit/models/organization/organization.collection.test.js` and search for `findByImsOrgId` or `allByImsOrgId`. The existing pattern shows how to verify the collection method exists and delegates to the underlying ElectroDB query.

- [ ] **Step 2: Append a mirroring test block after the imsOrgId collection tests**

Add a block that exercises `findBySemrushWorkspaceId` and `allBySemrushWorkspaceId`, mirroring the `findByImsOrgId` / `allByImsOrgId` block exactly in style and assertions. Use `ws_test_collection_001` as the test workspace ID.

If the existing test does:

```javascript
it('finds an organization by IMS org id', async () => {
  const result = await collection.findByImsOrgId('1234567890ABCDEF12345678@AdobeOrg');
  expect(result).to.be.an('object');
  // ...
});
```

then add:

```javascript
it('finds an organization by Semrush workspace id', async () => {
  const result = await collection.findBySemrushWorkspaceId('ws_test_collection_001');
  expect(result).to.be.an('object');
  // ... matching assertions from the imsOrgId test
});

it('returns an array via allBySemrushWorkspaceId', async () => {
  const result = await collection.allBySemrushWorkspaceId('ws_test_collection_001');
  expect(result).to.be.an('array');
  // ... matching assertions
});
```

Read the actual imsOrgId test first and copy its structure precisely - do not paraphrase. The mocks need the same setup.

- [ ] **Step 3: Run the new tests and confirm they fail**

```bash
npm test -w packages/spacecat-shared-data-access -- --grep "Semrush"
```

Expected: tests fail with "findBySemrushWorkspaceId is not a function" or similar.

- [ ] **Step 4: Commit**

```bash
git add packages/spacecat-shared-data-access/test/unit/models/organization/organization.collection.test.js
git commit -m "test(data-access): add failing tests for Organization.findBySemrushWorkspaceId / allBy"
```

---

### Task 4: Add the schema attribute + index

**Files:**
- Modify: `packages/spacecat-shared-data-access/src/models/organization/organization.schema.js`

- [ ] **Step 1: Insert the new attribute before `.addAllIndex(['imsOrgId'])`**

Current end of schema (lines 39-48):

```javascript
  .addAttribute('imsOrgId', {
    type: 'string',
    validate: (value) => !value || Organization.IMS_ORG_ID_REGEX.test(value),
  })
  .addAttribute('fulfillableItems', {
    type: 'any',
    validate: (value) => !value || isNonEmptyObject(value),
  })
  .addAllIndex(['imsOrgId']);
```

Change to:

```javascript
  .addAttribute('imsOrgId', {
    type: 'string',
    validate: (value) => !value || Organization.IMS_ORG_ID_REGEX.test(value),
  })
  .addAttribute('fulfillableItems', {
    type: 'any',
    validate: (value) => !value || isNonEmptyObject(value),
  })
  .addAttribute('semrushWorkspaceId', {
    type: 'string',
  })
  .addAllIndex(['imsOrgId'])
  .addAllIndex(['semrushWorkspaceId']);
```

Notes:
- No `validate` function for now - Semrush has not confirmed workspace-ID format. Add a regex later in a follow-up if/when the format is locked.
- Each `addAllIndex` call generates one pair of accessors. We need both `imsOrgId` (existing) and `semrushWorkspaceId` (new), so two separate calls.

- [ ] **Step 2: Run unit tests; verify ALL Semrush tests pass**

```bash
npm test -w packages/spacecat-shared-data-access -- --grep "semrushWorkspaceId\|Semrush"
```

Expected: all new tests PASS.

- [ ] **Step 3: Run the full unit test suite for the package**

```bash
npm test -w packages/spacecat-shared-data-access
```

Expected: all tests pass. Coverage thresholds (100% lines, 97% branches) still met.

If coverage fails: the new code paths (getter/setter for the new attribute) are exercised, but check the coverage report for any new uncovered lines.

- [ ] **Step 4: Commit**

```bash
git add packages/spacecat-shared-data-access/src/models/organization/organization.schema.js
git commit -m "feat(data-access): add semrushWorkspaceId attribute and index to Organization

Adds a top-level string attribute and an addAllIndex entry so the
collection auto-generates findBySemrushWorkspaceId and
allBySemrushWorkspaceId accessors. Mirrors the imsOrgId pattern.

Part of the Adobe IMS to Semrush integration (first pass).
Parent proposal: adobe/mysticat-architecture#61
DB migration: adobe/mysticat-data-service#593"
```

---

### Task 5: Update TypeScript declarations

**Files:**
- Modify: `packages/spacecat-shared-data-access/src/models/organization/index.d.ts`

- [ ] **Step 1: Add `getSemrushWorkspaceId` / `setSemrushWorkspaceId` to the `Organization` interface**

Find the existing line `getImsOrgId(): string;` and add immediately after:

```typescript
  getSemrushWorkspaceId(): string;
```

Find the existing line `setImsOrgId(imsOrgId: string): Organization;` and add immediately after:

```typescript
  setSemrushWorkspaceId(semrushWorkspaceId: string): Organization;
```

- [ ] **Step 2: Add `findBySemrushWorkspaceId` / `allBySemrushWorkspaceId` to the `OrganizationCollection` interface**

Find the existing lines:

```typescript
  allByImsOrgId(imsOrgId: string): Promise<Organization[]>;
  findByImsOrgId(imsOrgId: string): Promise<Organization | null>;
```

Add immediately after:

```typescript
  allBySemrushWorkspaceId(semrushWorkspaceId: string): Promise<Organization[]>;
  findBySemrushWorkspaceId(semrushWorkspaceId: string): Promise<Organization | null>;
```

- [ ] **Step 3: Run lint and type-check**

```bash
npm run lint -w packages/spacecat-shared-data-access
```

Expected: clean. If lint complains about the TS declarations, fix and re-lint.

- [ ] **Step 4: Commit**

```bash
git add packages/spacecat-shared-data-access/src/models/organization/index.d.ts
git commit -m "feat(data-access): add TS declarations for Organization.semrushWorkspaceId accessors"
```

---

### Task 6: Update test fixtures

**Files:**
- Modify: `packages/spacecat-shared-data-access/test/fixtures/organizations.fixture.js`

- [ ] **Step 1: Add `semrushWorkspaceId` to at least one fixture record**

Open the file. Three organization records exist (lines ~14, 44, 74 each starting with `organizationId`). Add `semrushWorkspaceId` to the first record (so existing tests that read fixture[0] can see it).

After:

```javascript
imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
```

Add:

```javascript
semrushWorkspaceId: 'ws_fixture_001',
```

Do NOT add to records 2 or 3 - this exercises the "null/absent" case naturally.

- [ ] **Step 2: Run all unit tests; confirm no regressions**

```bash
npm test -w packages/spacecat-shared-data-access
```

Expected: all pass; coverage still 100%/97%.

- [ ] **Step 3: Commit**

```bash
git add packages/spacecat-shared-data-access/test/fixtures/organizations.fixture.js
git commit -m "test(data-access): include semrushWorkspaceId in Organization fixture"
```

---

### Task 7: Add (skipped) integration test for `findBySemrushWorkspaceId`

**Files:**
- Modify: `packages/spacecat-shared-data-access/test/it/organization/organization.test.js`

The IT test for `findBySemrushWorkspaceId` depends on the parallel DB migration in mysticat-data-service merging and a new ECR image being published. Until that happens, the column does not exist in the IT Docker container's database. We add the test now with `it.skip(...)` so the code lives in this PR; a small follow-up commit removes the skip and bumps the image tag.

- [ ] **Step 1: Find the existing `it('gets an organization by IMS org id', ...)` test (around line 73)**

- [ ] **Step 2: Add the skipped test block immediately after it**

```javascript
  // TODO: un-skip after adobe/mysticat-data-service#593 merges and the new
  // Docker image is published. Then bump MYSTICAT_DATA_SERVICE_TAG default
  // in test/it/postgrest/docker-compose.yml.
  it.skip('gets an organization by Semrush workspace id', async () => {
    const sampleOrganization = sampleData.organizations[0];
    const organization = await Organization.findBySemrushWorkspaceId(
      sampleOrganization.getSemrushWorkspaceId(),
    );

    delete sampleOrganization.record.config;
    delete organization.record.config;

    expect(organization).to.be.an('object');
    expect(
      sanitizeTimestamps(organization.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleOrganization.toJSON()),
    );
  });
```

- [ ] **Step 3: Verify the skipped test does not break the IT suite**

The IT suite requires Docker + ECR access. If you cannot run IT locally, this verification is best left to CI (which runs it on the PR). Run if you can:

```bash
npm run test:it -w packages/spacecat-shared-data-access
```

Expected: `1 pending` (the skipped test), other Organization IT tests pass. If your local Docker can't pull from ECR, that's fine - CI will run it.

- [ ] **Step 4: Commit**

```bash
git add packages/spacecat-shared-data-access/test/it/organization/organization.test.js
git commit -m "test(data-access): add (skipped) IT test for findBySemrushWorkspaceId

Skipped until adobe/mysticat-data-service#593 merges and the new Docker
image is published. A follow-up commit bumps MYSTICAT_DATA_SERVICE_TAG
in test/it/postgrest/docker-compose.yml and removes the .skip."
```

---

### Task 8: Final lint, full test, push branch

**Files:** none modified in this task

- [ ] **Step 1: Run full lint and tests one more time**

```bash
npm run lint -w packages/spacecat-shared-data-access
npm test -w packages/spacecat-shared-data-access
```

Expected: clean. Coverage thresholds met.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feat/data-access-organization-semrush-workspace-id
```

---

### Task 9: Open PR (PAUSE for human approval)

**Files:** none

- [ ] **Step 1: Show the PR body to the user; pause for approval before posting**

- [ ] **Step 2: Open the PR via `mcp__github__create_pull_request`**

```
owner: adobe
repo: spacecat-shared
title: feat(data-access): add semrushWorkspaceId attribute to Organization
head: feat/data-access-organization-semrush-workspace-id
base: main
body: (see plan-supplied template below)
```

PR body:

```markdown
## Summary

Adds `semrushWorkspaceId` as a top-level string attribute on the `Organization` model in `spacecat-shared-data-access`. Auto-generates `findBySemrushWorkspaceId` / `allBySemrushWorkspaceId` collection accessors via `addAllIndex`. Mirrors the `imsOrgId` pattern exactly.

## Part of

Adobe IMS to Semrush integration (first pass). Parent proposal: **adobe/mysticat-architecture#61**.

Step 2 of a multi-repo sequence:
- ✅ Step 1 - DB column: **adobe/mysticat-data-service#593** (parallel; needs to merge before this lands for the IT test to be un-skipped)
- 👉 Step 2 - this PR
- Step 3 - spacecat-api-service consumes the new shared-data-access version (follow-up)
- Step 4 - project-elmo-ui consumes the new field (follow-up)

## What's changed

- `organization.schema.js` - new `addAttribute('semrushWorkspaceId', { type: 'string' })` + `addAllIndex(['semrushWorkspaceId'])`
- `index.d.ts` - TS declarations for getter / setter / `findBy*` / `allBy*`
- `organization.model.test.js` - unit tests for getter / setter / absent case
- `organization.collection.test.js` - unit tests for collection accessors
- `organizations.fixture.js` - fixture[0] gets `semrushWorkspaceId: 'ws_fixture_001'`
- `organization.test.js` (IT) - skipped IT test for `findBySemrushWorkspaceId` (will be un-skipped after Step 1 image is published)

## Open follow-up

- Bump `MYSTICAT_DATA_SERVICE_TAG` default in `test/it/postgrest/docker-compose.yml` to the version published after mysticat-data-service#593 merges
- Remove `it.skip(...)` on the new IT test (1-line change)

## Local verification

- `npm run lint -w packages/spacecat-shared-data-access` ✅
- `npm test -w packages/spacecat-shared-data-access` ✅ (coverage thresholds met)
- IT test for new accessor is intentionally skipped pending Step 1
```

Expected: PR URL returned.

- [ ] **Step 3: Wait for CI green**

Watch the CI run on the PR via `gh run watch` or MCP. CI runs: lint, unit tests, IT tests, semantic-release dry-run.

Expected: all green. The skipped IT test should show up as `pending` (1 pending), not failed.

If CI fails: fix on a new commit (no amend), push, repeat.

---

### Task 10: After Step 1 merges and image is published - bump image tag and un-skip IT test (PAUSE for human approval)

**Trigger:** Step 1 (`adobe/mysticat-data-service#593`) is merged to main, semantic-release runs, a new Docker image is built and tagged (e.g. `v5.4.0`). The version number is visible in:
- `environments.yml` `dev:` line after the data-service CD pipeline completes
- The semantic-release commit message on data-service main

**Files:**
- Modify: `packages/spacecat-shared-data-access/test/it/postgrest/docker-compose.yml`
- Modify: `packages/spacecat-shared-data-access/test/it/organization/organization.test.js`

- [ ] **Step 1: Confirm the published image version**

Check `https://github.com/adobe/mysticat-data-service/blob/main/environments.yml` `dev:` field for the new version, OR look at the semantic-release commit on data-service main.

Capture the version (e.g. `v5.4.0`).

- [ ] **Step 2: Bump `MYSTICAT_DATA_SERVICE_TAG` default**

In `packages/spacecat-shared-data-access/test/it/postgrest/docker-compose.yml`, find:

```yaml
    image: ${MYSTICAT_DATA_SERVICE_REPOSITORY:-682033462621.dkr.ecr.us-east-1.amazonaws.com/mysticat-data-service}:${MYSTICAT_DATA_SERVICE_TAG:-v5.1.1}
```

Change `v5.1.1` to the new published version (e.g. `v5.4.0`).

- [ ] **Step 3: Un-skip the IT test**

In `packages/spacecat-shared-data-access/test/it/organization/organization.test.js`, change `it.skip(` to `it(` on the new Semrush IT test, and remove the TODO comment block above it.

- [ ] **Step 4: Run IT tests locally if possible**

```bash
npm run test:it -w packages/spacecat-shared-data-access
```

Expected: the previously-skipped test now PASSES.

If you can't run locally (no ECR access), CI will verify.

- [ ] **Step 5: Commit**

```bash
git add packages/spacecat-shared-data-access/test/it/postgrest/docker-compose.yml \
        packages/spacecat-shared-data-access/test/it/organization/organization.test.js
git commit -m "test(data-access): bump data-service image tag and enable Semrush IT test

mysticat-data-service v<NEW_VERSION> includes the semrush_workspace_id
column (PR #593). Bumps the pinned IT image tag and un-skips the
Organization.findBySemrushWorkspaceId IT test."
```

- [ ] **Step 6: Push and wait for CI**

```bash
git push
```

Watch CI; expect all-green including the IT test now exercising the new column.

---

### Task 11: Merge (PAUSE for human approval)

**Files:** none

- [ ] **Step 1: After Task 10's CI is green and the PR is reviewed and approved, merge**

Use `mcp__github__merge_pull_request` (squash). Do NOT merge with red CI (project rule).

- [ ] **Step 2: Watch the release pipeline**

After merge to main, the spacecat-shared `release` workflow runs semantic-release. The data-access package version bumps from `3.56.x` to `3.57.0` (`feat:` = minor) and publishes to npm.

Watch via `gh run watch <run-id>` on adobe/spacecat-shared.

- [ ] **Step 3: Capture the new published version**

After release completes, the new version is in `packages/spacecat-shared-data-access/package.json` on main, AND on npm:

```bash
npm view @adobe/spacecat-shared-data-access version
```

This version unblocks Step 3 (`spacecat-api-service` bumps its dependency).

---

## Validation gates

| Gate | After Task | What to check |
|---|---|---|
| Unit tests fail as expected | Task 2-3 | All new Semrush unit tests fail before the schema attribute is added |
| Schema applied; unit tests pass | Task 4 | All unit tests pass, coverage thresholds (100% lines / 97% branches) met |
| TS declarations consistent | Task 5 | Lint clean |
| Fixtures updated | Task 6 | Full unit suite still passing |
| IT test parked | Task 7 | IT test exists but skipped; suite shows `1 pending` |
| Branch pushed | Task 8 | CI green on the push (unit + lint + skipped IT test) |
| PR opened with clear dependency | Task 9 | PR exists with description noting Step 1 dependency |
| Step 1 dependency landed | Task 10 (trigger) | New data-service image published |
| IT test passing | Task 10 | After bump + un-skip, CI green including the un-skipped IT test |
| Merge | Task 11 | Squash merged; semantic-release publishes new version to npm |

## What this plan does NOT cover

- **`spacecat-api-service` consuming the new attribute** - separate plan for Step 3 (the API surfacing `semrushWorkspaceId` on `GET /organizations/{orgId}` and adding the proxy endpoint)
- **`project-elmo-ui` consuming `semrushWorkspaceId`** - separate plan for Step 4
- **Populating `semrushWorkspaceId` for any specific customer** - a runbook step blocked on Semrush assigning workspace IDs
- **Format-validation regex on the attribute** - intentionally omitted; add later if/when Semrush confirms the workspace-ID format

## Rollback strategy

If something goes wrong post-merge:

1. **Pre-publish** (Task 11 not yet run / semantic-release not yet released): revert the merge via a new PR. semantic-release will not publish a new version.
2. **Post-publish**: the new version is on npm. Revert the merge AND publish a patch release that re-removes the attribute. Consumers that have already bumped to the new version will need to revert their bump. Avoid this scenario - hold consumer bumps until the new version is stable in production.
3. **Schema-only bug** (e.g. wrong attribute name, missing index): patch in a forward-only release (`fix:` commit) rather than reverting.
