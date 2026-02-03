# Copilot PR Review Instructions

## 1. Review Goals and Priorities

Your primary purpose is to identify **behavior-breaking defects**, **schema/validation issues**, **breaking API changes**, and **missing tests for changed behavior**.
When such issues are present, prioritize them above all other considerations (performance, style).

Use **three severities**:

* **Critical** – Breaking changes, bugs, schema validation issues, missing required validation, incorrect types, or missing tests for changed behavior.
  *Respond with:* "This PR should not be merged until this is fixed."
* **Major** – Missing or incorrect TypeScript definitions, missing documentation, missing but non-blocking tests, realistic performance concerns.
* **Minor** – Stylistic suggestions or optional improvements.
  *Only list Minor issues if no Critical issues exist.*

If you find any Critical issue, list it first and deprioritize all other feedback.

---

## 2. Output Format (Always Required)

Respond using the following structure:

### Summary

1–3 sentences describing the overall health of the PR.

### Issues

#### Critical

* List each issue, quoting relevant code and suggesting a concrete fix.

#### Major

* As above.

#### Minor

* As above. Only include if there are no Critical issues.

### Suggested Tests

* Describe which tests should be added or updated (if applicable). If no test changes are needed, state that clearly.

---

## 3. Core Checks (Apply to Every PR)

### 3.1 Bug & Regression Scan

Look for defects including:

* Missing or incorrect null/undefined checks.
* Incorrect async/await handling.
* Schema validation gaps or incorrect type definitions.
* Changes to model schemas without corresponding migration considerations.
* Logic changes without corresponding test updates.

**If you see changed behavior without new or updated tests, mark as Critical.**

---

### 3.2 Schema and Model Integrity

For any changes to models in `packages/spacecat-shared-data-access/src/models/`:

**Require:**

* Corresponding schema file (`.schema.js`) updates when model changes.
* Validation functions for all required attributes.
* Type definitions (`.d.ts` or `index.d.ts`) matching the implementation.
* Collection methods properly expose model operations.

**If a model changes but schema validation is missing → Critical.**
**If required attributes lack validation → Critical.**
**If type definitions don't match implementation → Major.**

**Canonical reference:**

```js
// All attributes must have appropriate validation
.addAttribute('baseURL', {
  type: 'string',
  required: true,
  validate: (value) => isValidUrl(value),
})
```

---

### 3.3 Breaking Changes and Versioning

This is a shared library consumed by multiple services. Breaking changes require special attention.

**For any public API changes:**

* Function signature changes → **Critical** unless properly documented.
* Removed exports → **Critical** unless deprecated in a previous release.
* Changed return types → **Critical** unless backward compatible.
* New required parameters → **Critical** unless default values provided.

**Require:**

* Clear documentation of breaking changes in PR description.

**If a breaking change is not clearly marked → Critical.**

---

### 3.4 Use of Shared Utilities

Check that utility functions from `packages/spacecat-shared-utils/src/` are used consistently:

* `isValidUrl`, `isIsoDate`, `isObject`, `isNonEmptyObject` for validation.
* `hasText`, `isValidUUID` where applicable.
* Avoid reimplementing validation logic that already exists.

**If validation logic is duplicated instead of using shared utils → Major.**

---

### 3.5 Required Tests

For any non-trivial code change:

* Unit tests under `packages/*/test/` using Mocha/Chai/Sinon/nock.
* Integration tests where relevant (typically in `test/it/`).
* Tests must assert behavior, not just shallow coverage.
* Mock external dependencies appropriately.
* Fixtures and helpers must be updated consistently.

**If behavior changes but tests do not → Critical.**
**If new public API methods lack tests → Critical.**

**For new entities in `packages/spacecat-shared-data-access/src/models/`:**

* **Unit tests are required** in `test/unit/models/<entity>/` covering:
  - Model methods and business logic
  - Collection query methods
  - Validation and error handling
  - Edge cases

* **Integration tests are required** in `test/it/<entity>/` covering:
  - Database operations against local DynamoDB
  - All collection query methods (findById, allBy..., pagination, filtering)
  - Create, update, remove operations
  - Reference relationships (if applicable)
  - Must update `test/fixtures/index.fixtures.js` with sample data
  - Must verify auto-generated accessor methods work correctly

**If new entity lacks integration tests → Critical.**

If a PR is documentation-only or comment-only, explicitly mark tests as not required.

---

## 4. Repo-Specific Patterns & Rules

### 4.1 Monorepo Package Structure

For changes affecting package structure:

* Each package must have its own `package.json` with correct dependencies.
* Exports in `index.js` must match TypeScript definitions in `index.d.ts`.
* No circular dependencies between packages.

**Missing or incorrect package.json → Critical.**
**TypeScript definitions don't match exports → Major.**

---

### 4.2 HTTP Utilities and Response Helpers

For changes to `packages/spacecat-shared-http-utils/`:

* All response helpers must return valid `Response` objects.
* Status codes must match HTTP conventions.
* Error responses must include error header (`x-error`).
* Content-Type must be set appropriately.
* Compression (gzip/brotli) must work correctly.

**Canonical reference:**

```js
// All error responses must include x-error header
export function badRequest(message = 'bad request', headers = {}) {
  return createResponse({ message }, 400, {
    [HEADER_ERROR]: message,
    ...headers,
  });
}
```

---

### 4.3 Data Access Layer Patterns

For changes to `packages/spacecat-shared-data-access/`:

**Schema Builder Usage:**

* All models must use `SchemaBuilder` for schema definition.
* References must be properly declared (`belongs_to`, `has_many`, `has_one`).
* Indexes must be defined for commonly queried fields.
* Attributes must include proper validation functions.

**Model and Collection Consistency:**

* Every model must have a corresponding collection class.
* Collection methods must properly handle errors.
* DTOs must not leak internal model structure.

**If internal model fields are exposed → Critical.**
**If references are incorrect → Critical.**

**Canonical reference:**

```js
const schema = new SchemaBuilder(Model, Collection)
  .addReference('belongs_to', 'Organization')
  .addReference('has_many', 'Audits')
  .addAttribute('baseURL', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })
  .addAllIndex(['baseURL'])
  .build();
```

---

### 4.4 Client Implementations

For any client package (`*-client/`):

* Must handle errors gracefully and return meaningful error messages.
* Must validate inputs before making external calls.
* Must include proper TypeScript definitions.
* Must not expose API keys or credentials.
* Must use `@adobe/fetch` for HTTP requests where appropriate.

**If client exposes credentials → Critical (Security).**
**If client lacks input validation → Critical.**
**If errors are not handled → Major.**

---

### 4.5 TypeScript Definitions

All packages with JavaScript implementation must have TypeScript definitions:

* `index.d.ts` at package root or alongside source files.
* Types must accurately reflect JavaScript implementation.
* Exported functions must have parameter and return types.
* Complex objects should use interfaces or types.

**If TypeScript definitions are missing for new exports → Major.**
**If types don't match implementation → Major.**

**Canonical reference:**

```typescript
export interface SiteDto {
  id: string;
  baseURL: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export function toJSON(site: any): SiteDto;
```

---

## 5. Performance Scan (Secondary Priority)

Raise **Major** issues for realistic performance risks:

* N+1 query patterns in collection methods.
* Missing indexes for frequently queried fields.
* Unbounded loops or recursion.
* Large payload handling without streaming.
* Inefficient validation in hot paths.

Do **not** speculate without evidence.

---

## 6. Security Scan

Flag security issues as **Critical (Security)**:

* Secrets or API keys in code or tests.
* Missing validation on external inputs.
* Unsafe regex patterns.
* Exposure of sensitive data in DTOs.

**If secrets are committed → Critical (Security).**
**If DTOs leak sensitive fields → Critical (Security).**

---

## 7. Documentation and Change Control

For any new or changed:

* Public API method
* Model schema
* Shared utility function
* Client interface

Require updates to:

* JSDoc comments on functions and classes.
* `README.md` in the affected package.
* TypeScript definitions.

**Missing JSDoc on public APIs → Major.**
**Missing README updates for new significant features → Major.**

---

## 8. Linting and Code Quality

This repo uses `@adobe/eslint-config-helix` with ESLint 9:

* No linting errors should be introduced.
* Test files may use `func-names: off` and `no-console: off`.
* Source files must follow all linting rules.
* Use lint-staged pre-commit hook for validation.

**If linting errors are introduced → Major.**

Run linting with: `npm run lint -ws`

---

## 9. Test Coverage

This repo uses c8 for coverage:

* New code should maintain or improve coverage.
* Aim for high coverage on critical paths (models, validation, clients).
* Test edge cases and error paths.
* Use `/* c8 ignore */` sparingly and only with good and justified reason.

Run tests with: `npm test -ws`

**If coverage significantly drops → Major.**

### Integration Tests for Data Access Package

For `packages/spacecat-shared-data-access/`, integration tests are **mandatory** for all entities:

**Requirements:**
1. Create `test/it/<entity>/<entity>.test.js` file
2. Add sample fixtures to `test/fixtures/index.fixtures.js`
3. Test all collection query methods against local DynamoDB
4. Test CRUD operations (create, update, remove)
5. Test pagination and filtering
6. Test relationships (belongs_to, has_many references)
7. Verify auto-generated accessor methods work correctly

**Integration test pattern:**
```javascript
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

describe('EntityName IT', function () {
  let sampleData;
  let EntityName;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();
    const dataAccess = getDataAccess();
    EntityName = dataAccess.EntityName;
  });

  // Test all query methods, CRUD operations, etc.
});
```

**Reference examples:**
- `test/it/audit-url/audit-url.test.js` - Composite key entity with GSI
- `test/it/site/site.test.js` - Entity with references and relationships
- `test/it/experiment/experiment.test.js` - Simple entity pattern

**If new entity in spacecat-shared-data-access lacks integration tests → Critical.**

---

## 10. Final Quality Pass

Once all Critical and Major issues are addressed:

* Ensure models, schemas, collections, and tests are consistent.
* Ensure TypeScript definitions match exports.
* Ensure documentation is complete.
* Ensure no lint rules are violated.
* Only then offer stylistic suggestions (Minor).