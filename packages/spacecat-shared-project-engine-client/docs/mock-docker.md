# Project Engine mock — Docker image

The runnable-server form of the [stateful mock](./mock-usage.md), packaged as a Docker image so a
**cross-repo e2e suite** (e.g. `spacecat-api-service`) can boot it without depending on this
package's `mock/` source — the same way `spacecat-shared-data-access` consumes the
`mysticat-data-service` image for its integration tests.

The published client ships only `src/` (`files: ["src"]`), so the mock is never on npm. This image
is the only cross-repo distribution of it.

- **Image:** `ghcr.io/adobe/spacecat-shared-project-engine-client-mock`
- **Tag:** the published client version, e.g. `:1.2.0`, plus `:latest`. The image version always
  matches the `@adobe/spacecat-shared-project-engine-client` npm version it was built from.
- **Exposed:** `8443` (HTTPS only)
- **Base URL inside:** `https://<host>:8443/enterprise/projects/api`

## Image size & the multi-stage build

The image is built in two stages (see `Dockerfile`) to keep the runtime layer lean:

- **builder** — full `npm install` (incl. devDeps), runs `spec:convert && spec:overlay` to bake
  `build/openapi3.json`, and mints the self-signed cert with `openssl`.
- **runtime** — clean base + only what the mock needs to *run*: a prod-only `node_modules` (the
  `counterfact` engine; the build/test toolchain is dropped), the baked spec, `mock/`, the cert,
  and `caddy` (TLS) + `curl` (healthcheck). `openssl` (build-only) and `bash` (the entrypoint is
  POSIX `sh`) are not installed, and `spec/` / `scripts/` are absent (their only job ran in the
  builder). The container runs as the unprivileged `node` user (uid 1000), not root.

`counterfact` stays a **devDependency** in `package.json` so consumers of the *published* client
(`files: ["src"]`) never inherit it. The runtime stage installs it explicitly from a derived,
throwaway runtime-only manifest, pinned to the exact version `package.json` declares.

The dominant remaining weight is `counterfact` itself: it transpiles the materialized `.ts`
handlers at runtime, so it drags `typescript`/`esbuild`/`tsx` (plus a dashboard/telemetry) as
genuine runtime deps — that toolchain is the floor and cannot be pruned without redesigning the
mock. The base is pinned to a `node:24-alpine` digest for reproducibility; a distroless runtime
would shave the node-alpine layer further but is a stretch (no shell/apk → Caddy/curl/entrypoint
rework).

## Why HTTPS / why Caddy

`spacecat-api-service`'s transport (`rest-transport.js` `baseUrl()`) **throws `503` on any non-https
base URL** — missing, unparseable, or non-`https:` scheme all fail the same check. Counterfact only
speaks plain HTTP, so the image runs **Caddy as a TLS terminator** on `:8443`, reverse-proxying to
the mock on `127.0.0.1:4010`. The `https:` requirement is satisfied for real, not bypassed.

The cert is a **self-signed, build-time** cert (no private key is committed to this public repo).
It carries no real trust, so the consuming test process disables verification:
`NODE_TLS_REJECT_UNAUTHORIZED=0`. Its SANs cover `localhost`, `127.0.0.1`, and the compose/CI
service alias `project-engine-client-mock`.

## Security: loopback / ephemeral only

The mock's `__*` control routes (`/__reset`, `/__seed`, `/__quota`, `/__dump`) are **unauthenticated
by design** and `/__dump` returns the entire store. The image therefore must only ever be reached
over **loopback** (local dev) or on an **ephemeral CI runner** — never bound to a shared host.
`docker-compose.yml` binds `127.0.0.1:8443` for exactly this reason; do the same anywhere else.

## Local usage

```bash
# from packages/spacecat-shared-project-engine-client
npm run docker:build           # docker build -t …project-engine-client-mock:local .
npm run docker:run             # docker run --rm -p 127.0.0.1:8443:8443 …:local

# or via compose (adds a healthcheck + the loopback binding)
docker compose up --build

# verify (note -k: self-signed cert; __dump is auth-exempt)
curl -ksf https://localhost:8443/enterprise/projects/api/__dump | jq
```

Seed selection and the control routes work exactly as in [`mock-usage.md`](./mock-usage.md) — pass
`MOCK_SEED` as an env var (`-e MOCK_SEED=empty-workspace`), drive `__seed` / `__reset` over HTTPS.

## Consuming from spacecat-api-service e2e

Same image, same env in local and CI — only the orchestration differs.

**Env the e2e process needs:**

```bash
SEMRUSH_PROJECTS_BASE_URL=https://localhost:8443
NODE_TLS_REJECT_UNAUTHORIZED=0          # accept the mock's self-signed cert (test process only)
```

`baseUrl()` does no host allowlist — only the `protocol === 'https:'` check — so
`https://localhost:8443` is accepted with no api-service code change.

**CI (GitHub Actions):**

```yaml
jobs:
  e2e:
    services:
      project-engine-client-mock:
        image: ghcr.io/adobe/spacecat-shared-project-engine-client-mock:1.2.0   # pin to the client version
        ports: ["8443:8443"]
        # credentials: only needed if the GHCR package is kept private (see below)
    env:
      SEMRUSH_PROJECTS_BASE_URL: https://localhost:8443
      NODE_TLS_REJECT_UNAUTHORIZED: '0'
    steps:
      - run: |   # wait for TLS to be up before the suite
          until curl -ksf https://localhost:8443/enterprise/projects/api/__dump >/dev/null; do sleep 1; done
```

If the job itself runs inside a container, reach the service by its alias
(`https://project-engine-client-mock:8443`) — that hostname is in the cert SANs.

## Publishing (CI)

`.github/workflows/project-engine-client-mock-image.yaml` builds and pushes on the per-package release tag
`@adobe/spacecat-shared-project-engine-client-v*` (pushed by `main.yaml`'s release job via the
`ADOBE_BOT_GITHUB_TOKEN` PAT, which triggers downstream workflows). It tags `:<version>` + `:latest`
and pushes with the workflow's built-in `GITHUB_TOKEN` (`packages: write`). `workflow_dispatch`
(input: `version`) rebuilds a specific already-published version for the first publish or recovery.

**One-time after the first publish:** set the GHCR package visibility to **public** in the package
settings, so local devs and api-service CI pull with no auth. If org policy forbids a public package,
keep it private and grant the consuming repo (`spacecat-api-service`) read access on the package; CI
then adds a `docker/login-action` step (or `services.*.credentials`) with `GITHUB_TOKEN`.
