# Plan: user-manager-client — stateful mock handlers for sub-workspace lifecycle (issue #1700)

GitHub issue: adobe/spacecat-shared#1700  
Target PR: extends PR #1685 (`feat/llmo-5616-user-manager-mock`)  
Blocking issue: none (independent of overlay work in #1699)

## Goal

The Counterfact mock (PR #1685) is already stateful for the v1 workspace CRUD chain.
Three endpoints used by `spacecat-api-service`'s sub-workspace provisioning path still
fall back to auto-generated random stubs:

- `POST /v2/workspaces/{id}/child` — non-stateful, returns random id
- `GET /v1/workspaces/{id}/status` — random status string, poll never reliably reads `ready`
- `POST /v2/workspaces/{id}/resources/transfer` — random 200

Hand-author the three missing handlers using the `$.context.createChild` pattern that
already exists in `_.context.ts`, extend the seed/reset fixtures, and add E2E coverage.

## Branch

Work directly on `feat/llmo-5616-user-manager-mock` (the open PR #1685 branch).
Fetch and check it out before starting:

```
git fetch origin feat/llmo-5616-user-manager-mock
git checkout feat/llmo-5616-user-manager-mock
```

## Context changes (_.context.ts)

`createChild()` already exists and is correct. Two methods need to be added:

### getStatus(id: string)

```ts
getStatus(id: string) {
  const ws = this.workspaces.get(id);
  if (!ws) return null;
  // Return the stored status or default to 'ready' for seeded workspaces.
  return { status: (ws as any)._status ?? 'ready' };
}
```

Optionally support a "pending then ready" path to exercise the poll:

```ts
setStatusSequence(id: string, statuses: string[]) {
  const ws = this.workspaces.get(id);
  if (!ws) return false;
  (ws as any)._statusQueue = [...statuses];
  return true;
}
```

Update `getStatus` to pop from the queue: if `_statusQueue` is non-empty, shift and
return it; otherwise return `ready`. The queue persists until consumed or reset.

### transferResources(id: string, body: Dict)

```ts
transferResources(id: string, body: Dict) {
  const ws = this.workspaces.get(id);
  if (!ws) return null;
  // Reflect the transferred resources allocation in the store.
  const existing = this.resources.get(id) ?? { workspace_id: id };
  const updated = { ...existing, ...(body.resources ?? {}) };
  this.resources.set(id, updated);
  return updated;
}
```

### Seed fixture updates

Add a default `_statusQueue` hint in `DEFAULT_FIXTURES` so the "pending → ready" poll
path can be tested without explicit setup:

```ts
workspaces: [
  { id: 'ws-root', parent_id: null, ... },
  { id: 'ws-child', parent_id: 'ws-root', ..., _status: 'ready' },
]
```

`ws-root` has no `_status`, so `getStatus` defaults to `'ready'`. No structural
change to the fixture schema is needed.

## New handler files

### .counterfact/routes/v2/workspaces/{id}/child.ts

```ts
// LLMO-5616 stateful handler (do-not-clobber).
import { nf } from '../../../_.helpers.js';

export const POST = async ($) => {
  const child = $.context.createChild($.path.id, $.body ?? {});
  return child ? $.response[200].json(child) : nf($, 'parent workspace not found');
};
```

The `createChild` method on Context already generates a deterministic id
(`ws-new-<counter>`) and stores the child in the workspace map — no context changes
needed for the handler itself.

### .counterfact/routes/v1/workspaces/{id}/status.ts

```ts
// LLMO-5616 stateful handler (do-not-clobber).
import { nf } from '../../../_.helpers.js';

export const GET = async ($) => {
  const status = $.context.getStatus($.path.id);
  return status ? $.response[200].json(status) : nf($);
};
```

Returns `{status: 'ready'}` for any seeded workspace. If `setStatusSequence` was
called (e.g. `['not ready', 'created', 'ready']`), the handler returns them in
sequence — letting the poll test exercise the full provisioning state machine.

### .counterfact/routes/v2/workspaces/{id}/resources/transfer.ts

```ts
// LLMO-5616 stateful handler (do-not-clobber).
import { nf } from '../../../_.helpers.js';

export const POST = async ($) => {
  const result = $.context.transferResources($.path.id, $.body ?? {});
  return result ? $.response[200].json(result) : nf($, 'workspace not found');
};
```

## E2E test additions (test/mock.test.js)

Add to the existing `describe('User Manager mock (LLMO-5616)')` suite. Reset via
`POST /__reset` in `beforeEach` (already wired).

```js
describe('sub-workspace lifecycle', () => {
  it('POST /v2/workspaces/:id/child creates a child with deterministic id', async () => {
    const res = await api('POST', '/v2/workspaces/ws-root/child', {
      title: 'Market Mirror', resources: { ai: { units: 100 } },
    });
    expect(res.status).to.equal(200);
    expect(res.body.id).to.be.a('string').and.match(/^ws-new-/);
    expect(res.body.parent_id).to.equal('ws-root');
    // child is reachable via GET after creation
    const get = await api('GET', `/v2/workspaces/${res.body.id}`);
    expect(get.status).to.equal(200);
  });

  it('GET /v1/workspaces/:id/status returns ready for seeded workspace', async () => {
    const res = await api('GET', '/v1/workspaces/ws-root/status');
    expect(res.status).to.equal(200);
    expect(res.body.status).to.equal('ready');
  });

  it('GET /v1/workspaces/:id/status returns 404 for unknown workspace', async () => {
    const res = await api('GET', '/v1/workspaces/no-such-ws/status');
    expect(res.status).to.be.oneOf([404, 500]);
  });

  it('POST /v2/workspaces/:id/resources/transfer reflects allocation in store', async () => {
    const res = await api('POST', '/v2/workspaces/ws-child/resources/transfer', {
      resources: { projects: 5, keywords: 500 },
    });
    expect(res.status).to.equal(200);
    expect(res.body).to.include({ projects: 5, keywords: 500 });
  });

  it('status sequence — pending then ready exercises the poll path', async () => {
    // Set up a pending→ready sequence for ws-root via the context directly.
    // This requires exposing setStatusSequence through POST /__status-sequence
    // or calling it in a test-only setup route. Simpler: test the sequence via
    // two consecutive GET calls if the queue is seeded in DEFAULT_FIXTURES.
    // Implementation note: seed 'ws-pending' with _statusQueue: ['not ready', 'ready']
    // in DEFAULT_FIXTURES to exercise this without a new control route.
  });
});
```

**Optional "pending → ready" fixture approach** (simpler than a control route): add
a dedicated `ws-pending` workspace to `DEFAULT_FIXTURES` with
`_statusQueue: ['not ready', 'created', 'ready']`. The test calls
`GET /v1/workspaces/ws-pending/status` three times and asserts the progression.

## Validation gates

1. `npm run mock` starts without errors; Counterfact compiles the three new `.ts`
   files with no type errors.
2. `npm test` — all new E2E assertions pass; no regressions in the existing
   workspace CRUD tests.
3. Manual smoke: run `npm run mock` and call the three endpoints with `curl` or
   Postman; confirm deterministic ids and `ready` status.
4. `npm run lint` — clean (all new handler files use `// LLMO-5616 stateful handler
   (do-not-clobber).` banner and the `nf` import from `_.helpers.js`).
5. Coverage: the mock handlers are exercised behaviorally via E2E (Counterfact
   compiles them at runtime), so unit coverage numbers are unaffected — the
   existing coverage threshold still passes.

## Out of scope

- OpenAPI overlay corrections — tracked in #1699.
- Client wrapper (`openapi-fetch` layer) — separate PR.
- Exposing `setStatusSequence` via a dedicated mock-control HTTP route — only add
  if the "pending → ready" poll path cannot be tested cleanly via the fixture approach.
