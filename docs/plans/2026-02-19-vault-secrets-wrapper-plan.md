# spacecat-shared vault-secrets-wrapper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update `vault-secrets-wrapper.js` to auto-resolve `bootstrapPath` from `ctx.func.name` instead of using a static `DEFAULT_BOOTSTRAP_PATH` constant, while preserving the explicit `bootstrapPath` option for overrides.

**Architecture:** The `ensureClient` function currently falls back to `DEFAULT_BOOTSTRAP_PATH = '/mysticat/vault-bootstrap'` when `opts.bootstrapPath` is not provided. We replace this with a `resolveBootstrapPath(ctx, opts)` function that returns `opts.bootstrapPath` if set, otherwise derives the path from the context as `/mysticat/bootstrap/${ctx.func.name}`. This makes the wrapper zero-config for Lambda services where `ctx.func.name` matches the service name. An error is thrown if neither `opts.bootstrapPath` nor `ctx.func.name` is available.

**Tech Stack:** Node.js 22+, Mocha + Chai + Sinon + Nock for testing, c8 for coverage

---

## Task 1: Write failing tests for auto-resolution from ctx.func.name

### File: `/Users/dj/adobe/github/adobe/spacecat-shared/packages/spacecat-shared-vault-secrets/test/vault-secrets-wrapper.test.js`

Add a new `describe` block for bootstrap path resolution inside the existing `vaultSecrets wrapper` describe. This goes after the existing `path resolution` describe block (after line 467).

### Code to add (after the closing `});` of `describe('path resolution', ...)` at line 467):

```js
  describe('bootstrap path resolution', () => {
    it('auto-resolves bootstrapPath from ctx.func.name', async () => {
      // Bootstrap should be fetched from /mysticat/bootstrap/api-service
      const autoBootstrapPath = '/mysticat/bootstrap/api-service';
      nock(AWS_ENDPOINT)
        .post('/', (body) => {
          const str = typeof body === 'string' ? body : JSON.stringify(body);
          return str.includes(autoBootstrapPath);
        })
        .reply(200, { SecretString: JSON.stringify(bootstrapConfig) });

      mockAppRoleLogin();
      mockSecretRead();

      const ctx = makeContext();
      const result = await loadSecrets(ctx);

      expect(result).to.deep.equal(testSecrets);
    });

    it('explicit bootstrapPath overrides auto-resolution', async () => {
      const customPath = '/custom/bootstrap/path';
      nock(AWS_ENDPOINT)
        .post('/', (body) => {
          const str = typeof body === 'string' ? body : JSON.stringify(body);
          return str.includes(customPath);
        })
        .reply(200, { SecretString: JSON.stringify(bootstrapConfig) });

      mockAppRoleLogin();
      mockSecretRead();

      const ctx = makeContext();
      const result = await loadSecrets(ctx, { bootstrapPath: customPath });

      expect(result).to.deep.equal(testSecrets);
    });

    it('throws when ctx.func.name is missing and no bootstrapPath provided', async () => {
      const ctx = makeContext({ func: { package: 'test', version: '1.0.0' } });

      await expect(loadSecrets(ctx)).to.be.rejectedWith(
        'Cannot resolve bootstrap path: ctx.func.name is not set and no bootstrapPath option provided',
      );
    });
  });
```

### Verify

```bash
cd /Users/dj/adobe/github/adobe/spacecat-shared/packages/spacecat-shared-vault-secrets && npm test
```

**Expected:** 3 new tests FAIL:
1. `auto-resolves bootstrapPath from ctx.func.name` - FAILS because the wrapper still uses `DEFAULT_BOOTSTRAP_PATH` (`/mysticat/vault-bootstrap`), not `/mysticat/bootstrap/api-service`. The nock mock won't match, causing a connection error.
2. `explicit bootstrapPath overrides auto-resolution` - PASSES (this already works).
3. `throws when ctx.func.name is missing` - FAILS because the wrapper currently falls back to `DEFAULT_BOOTSTRAP_PATH` silently instead of throwing.

The existing 51 tests should still pass because they all explicitly pass `bootstrapPath: BOOTSTRAP_PATH`.

---

## Task 2: Implement resolveBootstrapPath and update ensureClient

### File: `/Users/dj/adobe/github/adobe/spacecat-shared/packages/spacecat-shared-vault-secrets/src/vault-secrets-wrapper.js`

### Change 1: Remove the DEFAULT_BOOTSTRAP_PATH constant

**Find (line 18):**
```js
const DEFAULT_BOOTSTRAP_PATH = '/mysticat/vault-bootstrap';
```

**Replace with:**
```js
function resolveBootstrapPath(ctx, opts) {
  if (opts.bootstrapPath) return opts.bootstrapPath;
  if (ctx.func && ctx.func.name) return `/mysticat/bootstrap/${ctx.func.name}`;
  throw new Error(
    'Cannot resolve bootstrap path: ctx.func.name is not set and no bootstrapPath option provided',
  );
}
```

### Change 2: Update ensureClient to accept ctx and use resolveBootstrapPath

**Find (line 38-77):**
```js
async function ensureClient(opts, log) {
  if (clientLock) {
    await clientLock;
    if (!vaultClient || !vaultClient.isAuthenticated()) {
      throw new Error('Vault client initialization failed');
    }
    return;
  }

  let resolve;
  clientLock = new Promise((r) => {
    resolve = r;
  });

  try {
    if (!vaultClient) {
      const bootstrapPath = opts.bootstrapPath || DEFAULT_BOOTSTRAP_PATH;
      bootstrapConfig = await loadBootstrapConfig({ bootstrapPath });

      vaultClient = new VaultClient({
        vaultAddr: bootstrapConfig.vault_addr,
        mountPoint: bootstrapConfig.mount_point,
      });
      bootstrapEnvironment = bootstrapConfig.environment;

      await vaultClient.authenticate(bootstrapConfig.role_id, bootstrapConfig.secret_id);
    } else if (!vaultClient.isAuthenticated()) {
      await vaultClient.authenticate(bootstrapConfig.role_id, bootstrapConfig.secret_id);
    } else if (vaultClient.isTokenExpiringSoon()) {
      await vaultClient.renewToken();
    }

    if (log) {
      log.info('Vault client ready');
    }
  } finally {
    clientLock = null;
    resolve();
  }
}
```

**Replace with:**
```js
async function ensureClient(ctx, opts, log) {
  if (clientLock) {
    await clientLock;
    if (!vaultClient || !vaultClient.isAuthenticated()) {
      throw new Error('Vault client initialization failed');
    }
    return;
  }

  let resolve;
  clientLock = new Promise((r) => {
    resolve = r;
  });

  try {
    if (!vaultClient) {
      const bootstrapPath = resolveBootstrapPath(ctx, opts);
      bootstrapConfig = await loadBootstrapConfig({ bootstrapPath });

      vaultClient = new VaultClient({
        vaultAddr: bootstrapConfig.vault_addr,
        mountPoint: bootstrapConfig.mount_point,
      });
      bootstrapEnvironment = bootstrapConfig.environment;

      await vaultClient.authenticate(bootstrapConfig.role_id, bootstrapConfig.secret_id);
    } else if (!vaultClient.isAuthenticated()) {
      await vaultClient.authenticate(bootstrapConfig.role_id, bootstrapConfig.secret_id);
    } else if (vaultClient.isTokenExpiringSoon()) {
      await vaultClient.renewToken();
    }

    if (log) {
      log.info('Vault client ready');
    }
  } finally {
    clientLock = null;
    resolve();
  }
}
```

### Change 3: Update loadSecrets to pass ctx to ensureClient

**Find (line 113):**
```js
  await ensureClient(opts, ctx.log);
```

**Replace with:**
```js
  await ensureClient(ctx, opts, ctx.log);
```

### Verify

```bash
cd /Users/dj/adobe/github/adobe/spacecat-shared/packages/spacecat-shared-vault-secrets && npm test
```

**Expected:** All 54 tests pass (51 existing + 3 new). The existing tests pass because they all explicitly provide `bootstrapPath: BOOTSTRAP_PATH`, which takes priority in `resolveBootstrapPath`. The 3 new tests now pass because:
1. Auto-resolution uses `/mysticat/bootstrap/api-service` from `ctx.func.name`
2. Explicit `bootstrapPath` overrides auto-resolution (already worked)
3. Missing `ctx.func.name` without `bootstrapPath` throws the expected error

---

## Task 3: Verify lint passes

### Verify

```bash
cd /Users/dj/adobe/github/adobe/spacecat-shared/packages/spacecat-shared-vault-secrets && npm run lint
```

**Expected:** No lint errors.

---

## Task 4: Commit the changes

### Commands

```bash
cd /Users/dj/adobe/github/adobe/spacecat-shared
git add packages/spacecat-shared-vault-secrets/src/vault-secrets-wrapper.js
git add packages/spacecat-shared-vault-secrets/test/vault-secrets-wrapper.test.js
git commit -m "feat(vault-secrets): auto-resolve bootstrapPath from ctx.func.name

Replace static DEFAULT_BOOTSTRAP_PATH with resolveBootstrapPath() that
derives the SM path from ctx.func.name (/mysticat/bootstrap/{service}).
Explicit bootstrapPath option still works for overrides. Throws if
neither ctx.func.name nor bootstrapPath is available."
```

**Expected:** Commit succeeds on `feat/vault-secrets-wrapper` branch.

---

## Summary of changes

### Source change (`vault-secrets-wrapper.js`)

| Before | After |
|--------|-------|
| `const DEFAULT_BOOTSTRAP_PATH = '/mysticat/vault-bootstrap';` | `function resolveBootstrapPath(ctx, opts)` that returns `opts.bootstrapPath` or `/mysticat/bootstrap/${ctx.func.name}` |
| `ensureClient(opts, log)` with `opts.bootstrapPath \|\| DEFAULT_BOOTSTRAP_PATH` | `ensureClient(ctx, opts, log)` calling `resolveBootstrapPath(ctx, opts)` |
| `await ensureClient(opts, ctx.log)` | `await ensureClient(ctx, opts, ctx.log)` |

### Test additions (`vault-secrets-wrapper.test.js`)

| Test | Asserts |
|------|---------|
| auto-resolves bootstrapPath from ctx.func.name | nock matches `/mysticat/bootstrap/api-service` (not the old static path) |
| explicit bootstrapPath overrides auto-resolution | nock matches `/custom/bootstrap/path` |
| throws when ctx.func.name is missing | rejects with descriptive error message |

### Existing test impact

All 51 existing tests pass unchanged because they all explicitly pass `bootstrapPath: BOOTSTRAP_PATH` in their options, which takes priority in `resolveBootstrapPath`.
