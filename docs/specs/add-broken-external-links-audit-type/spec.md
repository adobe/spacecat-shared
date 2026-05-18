## Spec: spacecat-shared [TESTING-SDD-PR]

### Problem
`Audit.AUDIT_TYPES` in `spacecat-shared-data-access` is the single source of truth for all audit type strings consumed by the audit worker and any tooling. Without registering `broken-external-links` here, consumer repos would hardcode the string, risking drift and breaking the type-safety convention.

### Implementation Tasks

**Task 1 — Add type constant**
- **File:** `packages/spacecat-shared-data-access/src/models/audit/audit.model.js`
- **Change:** Add one entry to `static AUDIT_TYPES`:
  ```js
  BROKEN_EXTERNAL_LINKS: 'broken-external-links',
  ```
  Insert alphabetically near `BROKEN_BACKLINKS` and `BROKEN_INTERNAL_LINKS`.
- **Effort:** XS

**Task 2 — Publish new semver**
- Run `npm run semantic-release-dry` on the branch to confirm the version bump.
- The PR merge triggers semantic-release; `spacecat-audit-worker` must bump its `@adobe/spacecat-shared-data-access` dependency after publication.

### Affected Files
- `packages/spacecat-shared-data-access/src/models/audit/audit.model.js`
- `packages/spacecat-shared-data-access/test/unit/models/audit/audit.model.test.js` (add assertion for new constant)

### Testing Strategy
- Existing test for `Audit.AUDIT_TYPES` — add `expect(Audit.AUDIT_TYPES.BROKEN_EXTERNAL_LINKS).to.equal('broken-external-links')`.
- Coverage gate: 100% lines/statements, 97% branches.

### Dependencies on Other Repos
None — this is the root of the dependency chain.

### Notes
- No DB schema changes needed; the audit type string is stored in existing `audits.audit_type` column.
- No `AUDIT_TYPE_PROPERTIES` entry is needed unless properties (like LHS score dimensions) are required — external links audit has none.
