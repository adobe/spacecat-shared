# IMS promise-client pair selector

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Author** | Char |
| **Created** | 2026-08-11 |
| **Updated** | 2026-08-11 |
| **Decided** | N/A |
| **Approvers** | N/A |
| **Jira** | LLMO-6928 (parent LLMO-6623) |

## Summary

Let `ImsPromiseClient.createFrom` build a client from a *named* IMS
emitter/consumer credential pair, not only the single hard-coded pair. This is
the dependency-root change for LLMO-6623: giving the Semrush-facing paths a
dedicated promise-token pair (scoped for Semrush UDH) with limited blast radius,
instead of reusing the shared pair that serves every promise flow.

This spec covers only the `spacecat-shared-ims-client` contract. The cross-repo
flow (the `x-promise-audience` header, auth-service mint, api-service exchange,
UI cache) is designed in LLMO-6623 and its per-repo sub-tasks.

## Problem Statement

### Current State

`ImsPromiseClient.createFrom(context, type)` reads a single, fixed set of env
vars from `context.env`:

- EMITTER: `IMS_PROMISE_EMITTER_CLIENT_ID`, `IMS_PROMISE_EMITTER_CLIENT_SECRET`,
  `IMS_PROMISE_EMITTER_DEFINITION_ID`
- CONSUMER: `IMS_PROMISE_CONSUMER_CLIENT_ID`,
  `IMS_PROMISE_CONSUMER_CLIENT_SECRET`
- Both: `IMS_HOST`, `AUTOFIX_CRYPT_SECRET`, `AUTOFIX_CRYPT_SALT`

There is no way to select a second pair. A consumer that needs a different
IMS client pair (e.g. one holding the `semrush` scope) cannot get one without
overwriting the shared env vars, which would move every promise flow onto that
pair.

The client sends no `scope` parameter at mint, exchange, or invalidate. The
exchanged token's scope is governed by the promise definition's scope list
intersected with the consumer's grants — so no code change is needed to
"request" `semrush`; a dedicated pair whose definition carries `semrush` is
enough.

Separately, the validation error at `src/clients/ims-promise-client.js:60`
is wrong: the message says the definition id is required "for CONSUMER type",
but the check at line 59 requires it for the EMITTER type.

### Desired State

- `createFrom` accepts an optional pair selector. With no selector, behavior is
  byte-for-byte identical (existing callers untouched).
- With `{ pair: 'SEMRUSH' }`, it reads a prefixed set of env vars for the
  dedicated pair.
- The validation message matches the check.

### Gap Analysis

- No pair parameter on `createFrom`.
- No env-var naming convention for additional pairs.
- Misleading validation message.

## Goals and Non-Goals

### Goals

- Optional, backward-compatible pair selector on `createFrom`.
- A stable env-var naming contract for the `SEMRUSH` pair that auth-service and
  api-service depend on.
- Fix the EMITTER/CONSUMER validation message.

### Non-Goals

- The `x-promise-audience` header, and any auth-service / api-service / UI
  change (their own sub-tasks).
- Sending a `scope` parameter (scope is governed by the promise definition).
- Changing the crypt keys — `AUTOFIX_CRYPT_SECRET` / `_SALT` stay shared across
  all pairs.

## Proposed Solution

### API contract

```
ImsPromiseClient.createFrom(context, type, opts = {})
```

- `opts.pair` (optional string). Absent → current env names. `'SEMRUSH'` → the
  prefixed names below. Any other value → throw (fail closed, clear message).

### Env-var naming contract (the `SEMRUSH` pair)

| Type | Env vars read from `context.env` |
|------|----------------------------------|
| EMITTER | `IMS_PROMISE_SEMRUSH_EMITTER_CLIENT_ID`, `IMS_PROMISE_SEMRUSH_EMITTER_CLIENT_SECRET`, `IMS_PROMISE_SEMRUSH_EMITTER_DEFINITION_ID` |
| CONSUMER | `IMS_PROMISE_SEMRUSH_CONSUMER_CLIENT_ID`, `IMS_PROMISE_SEMRUSH_CONSUMER_CLIENT_SECRET` |
| Both | `IMS_HOST`, `AUTOFIX_CRYPT_SECRET`, `AUTOFIX_CRYPT_SALT` (shared, unprefixed) |

Naming rule: `IMS_PROMISE_{PAIR}_{TYPE}_{FIELD}` where `{PAIR}` is the
uppercased selector. This is the contract Vault (LLMO-6931) loads and the
downstream services read.

### Validation fix

Correct the message at `ims-promise-client.js:60` to say the definition id is
required for the EMITTER type (matching the line-59 check).

## Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| `opts.pair` selector on `createFrom` | Backward compatible, one factory, callers opt in | Adds a param | Selected |
| Separate `createSemrushFrom` factory | Explicit | Duplicates the factory; doesn't generalize to future pairs | Rejected |
| Pass raw client id/secret as args | Fully general | Leaks credential handling to every caller; loses the env-name contract | Rejected |

### Decision Rationale

`opts.pair` keeps a single factory and a single place that owns the env-name
contract, stays backward compatible, and generalizes to any future pair by name.

## Success Criteria

### Functional Requirements

- [ ] `createFrom(context, type)` unchanged — same env vars, same errors.
- [ ] `createFrom(context, type, { pair: 'SEMRUSH' })` reads the prefixed env
      vars for both EMITTER and CONSUMER.
- [ ] Missing a required prefixed env var throws a clear error.
- [ ] An unknown `opts.pair` throws.
- [ ] Validation message matches the EMITTER check.

### Validation Plan

- [ ] Unit tests in `test/clients/ims-promise-client.test.js` (mock-context +
      nock, no `process.env`): default path unchanged, `SEMRUSH` resolution for
      both types, missing-prefixed-env throws, unknown-pair throws.
- [ ] Coverage stays at the package bar: 100% lines/statements, 97% branches.

## Dependencies

### Internal Dependencies

- Downstream consumers of this contract: spacecat-auth-service (LLMO-6929),
  spacecat-api-service (LLMO-6930), Vault config (LLMO-6931). They are blocked
  on this package publishing (~1.15.0).

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| A change accidentally alters the default (no-pair) path | Low | High | Test asserts the default env names and errors are unchanged; the pair branch is additive |
| Env-name contract drifts from what Vault loads / services read | Medium | Medium | This table is the single source; the sub-tasks reference it |

## References

- Parent: LLMO-6623 (dedicated IMS promise-token pair for the Semrush proxy).
- Cross-repo design and rollout: LLMO-6623 description + the code-side plan.
- `src/clients/ims-promise-client.js` (current `createFrom`, validation at :59-60).

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-08-11 | Char | Initial draft |
