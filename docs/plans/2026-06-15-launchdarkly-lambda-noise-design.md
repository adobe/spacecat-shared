# LaunchDarkly Lambda Log-Noise Elimination - Design

- Date: 2026-06-15
- Status: proposed
- Owner: Dominique Jäggi
- Affected packages: `spacecat-shared-launchdarkly-client`, `spacecat-shared-http-utils`
- Downstream consumer: `spacecat-api-service` (version bump + redeploy)

## Problem

In SpaceCat prod, LaunchDarkly (LD) SDK log lines dominate the `error`-level logs. Over a
representative window (Coralogix prod, `spacecat-services-prod`, `level=error`,
2026-06-15 00:00:00Z - 05:45:00Z, ~5.75h):

- Total `error` events: 148,521
- LaunchDarkly SDK lines (all `level=error`):
  - `info: [launchdarkly] will retry stream connection in N ms` - 55,323
  - `warn: [launchdarkly] waitForInitialization called without a timeout` - 44,165
  - `warn: [launchdarkly] received I/O error ... will retry` - 5,737
  - Subtotal: 105,225 (~71% of all prod errors)
- `api-service` alone accounts for 105,912 of the 148,521 errors - i.e. api-service's
  error volume is almost entirely LD noise.

These are not real errors. They drown the genuine operational errors (import-worker RUM
domainkey 404s, audit-worker enrollment + DB constraint issues) and inflate error-rate
signals.

## Root cause

Three compounding factors:

1. **Wrong SDK logger in the deployed client.** The auth-path LD client running in prod is
   `@adobe/spacecat-shared-launchdarkly-client@1.0.4`, resolved as a **nested** copy under
   `spacecat-shared-http-utils` (which hard-pins `launchdarkly-client@1.0.4`). That version
   passes **no `logger`** to `ld.init()`, so the SDK falls back to `basicLogger`, which
   writes every level (info/warn/error) to `console.error` / stderr. AWS Lambda captures
   all stderr as `error`-level, so every LD line is tagged `error`. The `info:` / `warn:`
   prefixes in the messages are the `basicLogger` format - the tell that our wrapper logger
   is not in play.

2. **Per-request streaming client churn.** The IMS auth handler creates a brand-new
   streaming LD client on every authenticated request, with no caching:
   - `spacecat-shared-http-utils/src/auth/handlers/ims.js:169` - `LaunchDarklyClient.createFrom(context)`
   - `spacecat-shared-http-utils/src/auth/read-only-admin-wrapper.js:169` - same

   Each client opens a streaming connection and calls `waitForInitialization()` with **no
   timeout**. Under Lambda freeze/thaw, streaming connections cannot stay alive, so each
   invocation re-connects and retries - producing the "will retry stream connection" and
   "received I/O error ... will retry" storms. The missing timeout produces the
   "waitForInitialization called without a timeout" warning.

3. **The existing logger fix never reached prod.** PR #1511 (`launchdarkly-client@1.2.x`,
   2026-04-06) already routes LD `info`/`warn`/`debug` through the Lambda logger at `debug`
   level. It is shadowed by the nested `1.0.4` pin in `http-utils`, so the auth path never
   loads it. The version cascade - not just the code - is what kept this broken.

## Goal

Eliminate the LD log noise **at the source** (not merely relabel it), and stop the
underlying Lambda anti-pattern (per-request streaming client creation, untimed init).

### Non-goals / out of scope

- The `url.parse` `DEP0169` DeprecationWarning (1,098 events) - explicitly out of scope.
- LD daemon mode (DynamoDB feature store + LD Relay) - more robust at scale but requires new
  infra; not warranted for the current single kill-switch flag. Recorded as a future option.

## Design

The behavior change lives entirely in `spacecat-shared-launchdarkly-client`. The release
cascade carries it to prod.

### Part 1 - `spacecat-shared-launchdarkly-client` changes

SDK in use: `@launchdarkly/node-server-sdk@9.10.10`.

1. **Singleton cache (per `sdkKey`).** Cache the initialized underlying SDK client and its
   init promise at module scope, keyed by `sdkKey`. The lightweight `LaunchDarklyClient`
   wrapper stays per-call so each request keeps its own `log` (correct requestId), but
   `init()` reuses the cached SDK client / init promise. Effect: **one init per warm Lambda
   container instead of one per request.**
   - On init failure, clear the cached promise so the next request retries (no poisoned
     cache that permanently fails a warm container).

2. **Polling instead of streaming.** Pass `{ stream: false, pollInterval: 30 }` to
   `ld.init()`. Removes the persistent streaming connection (the source of the "will retry
   stream connection" / "received I/O error" storms) and drops `launchdarkly-eventsource`
   from the hot path. `pollInterval` is in seconds; 30s staleness is acceptable for a
   kill-switch flag.
   - Caveat to validate: the SDK `LDOptions.stream` doc says streaming should be disabled
     "on the advice of LaunchDarkly support." Disabling streaming in serverless is a
     well-established pattern, but we will validate flag-evaluation correctness explicitly
     (see Validation gates) and note this deviation.

3. **Bounded init with timeout.** Replace `await client.waitForInitialization()` with
   `await client.waitForInitialization({ timeoutSeconds: 5 })`. Removes the "without a
   timeout" warning and bounds cold-start latency. On timeout/throw, fail-open: the auth
   call sites already catch and return `false`.

4. **Keep the logger mapping.** Retain the existing wrapper mapping (`error -> log.error`;
   `warn`/`info`/`debug -> log.debug`) as defense-in-depth for any residual SDK chatter.

### Part 2 - Release cascade (this is what lands it in prod)

1. Release `spacecat-shared-launchdarkly-client` (minor) with Part 1.
2. **Bump `spacecat-shared-http-utils`'s pin from `launchdarkly-client@1.0.4` to the new
   version**, then release `http-utils`. Without this the nested `1.0.4` keeps shadowing the
   fix - this is the step the prior fix missed.
3. Bump `spacecat-api-service` to the new `http-utils` (and dedupe to a single hoisted
   `launchdarkly-client`), then redeploy.

### Part 3 - Rollout and validation gates

Deploy dev first, validate in Coralogix, then prod.

## Test plan

`spacecat-shared` enforces 100% lines/statements, 97% branches per package. New/updated unit
tests in `spacecat-shared-launchdarkly-client`:

- Cache reuse: two `createFrom` / `init()` calls with the same `sdkKey` call `ld.init` once.
- Polling options: `ld.init` receives `{ stream: false, pollInterval: 30 }`.
- Timeout: `waitForInitialization` is called with `{ timeoutSeconds: 5 }`.
- Fail-open / cache-clear: when init rejects, the cached promise is cleared and a subsequent
  call retries `ld.init`.
- Logger mapping unchanged: `info`/`warn`/`debug -> log.debug`, `error -> log.error`.

## Validation gates

- **Dev (after deploy):** Coralogix `spacecat-services-dev`, `level=error` -
  LD templates (`will retry stream connection`, `waitForInitialization ... timeout`,
  `received I/O error`) drop to ~0; api-service error volume drops sharply over a comparable
  window. Confirm `FF_READ_ONLY_ORG` still gates a known org (flag evaluation correct) and
  cold-start latency is acceptable.
- **Prod (after deploy):** same Coralogix verification on `spacecat-services-prod`.

## Expected outcome

- api-service prod error volume falls from ~106k to near-zero LD lines over a comparable
  window; the genuine import-worker / audit-worker errors become the visible top-N.
- Residual LD lines (a handful per cold start) are `debug` level and suppressed at prod's
  default `info` level.
- Secondary benefits: lower auth-path latency (no per-request streaming connect / untimed
  init) and no wasted outbound streaming connections.

## Tunables (defaults)

- `pollInterval`: 30 seconds.
- init `timeoutSeconds`: 5 seconds.

## References

- Coralogix prod analysis 2026-06-15 (window above).
- Prior logger fix: PR #1511 (`launchdarkly-client@1.2.x`), commit `9efd5a95`.
- Call sites: `spacecat-shared-http-utils/src/auth/handlers/ims.js:169`,
  `spacecat-shared-http-utils/src/auth/read-only-admin-wrapper.js:169`.
