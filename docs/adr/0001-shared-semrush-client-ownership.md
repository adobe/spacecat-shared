# ADR-0001: Ownership boundary for the shared Semrush client

- **Status:** Accepted
- **Ticket:** LLMO-5975
- **Deciders:** Alicia (BP), Rainer Friederich
- **Date:** 2026-07-06
- **Relates to:** PR #1661 (typed client wrapper), PR #2766 (retry re-enabled in api-service), LLMO-5461/5459 (Semrush Project Engine client)

## Scope

This ADR governs **REST transport to the Semrush gateway authenticated by IMS Bearer** — the Project Engine and User Manager surfaces. It deliberately does **not** decide transport for the AI Visibility surface (gRPC/HTTP2 + OAuth2 client-credentials), which is a different protocol and auth model; see Non-goals.

## Context

The Semrush Project Engine and User Manager clients exist as typed wrappers in `spacecat-shared` (`@adobe/spacecat-shared-project-engine-client`, `@adobe/spacecat-shared-user-manager-client`; PR #1661 lineage: IMS Bearer auth, retry/backoff).

`spacecat-api-service` **already consumes these shared clients** for its Project Engine and User Manager call paths (`controllers/serenity.js`, `controllers/brands.js`, `support/serenity/**`) — a migration that landed in prior shipped work. That migration pinned `maxRetries: 0` to preserve the previous one-shot behaviour, which silently disabled the shared clients' retry in production. PR #2766 removes that pin, restoring retry/backoff on those paths.

We need the ownership boundary stated explicitly so future consumers and future transport work don't re-litigate what belongs in the shared client versus the calling service.

## Decision

### The boundary

**The shared client owns transport.** It is the single place that knows how to *talk to Semrush* over REST/IMS-Bearer:

- Authentication (IMS Bearer)
- Retries and backoff
- Request timeouts
- A typed error taxonomy — every failure surfaces as a defined error type, not a raw HTTP response or a thrown string

**Consumers own their own context:**

- Translating the client's typed errors into their own HTTP responses / status codes
- Caching
- Redaction of sensitive fields for their own logging and output

The test for "does this go in the shared client?": *is it true for every consumer, or specific to one?* Auth and retry are true for everyone → shared. How a 404 becomes an HTTP response, what gets cached, what gets redacted → consumer.

## State of api-service consumption (was LLMO-5980)

The original framing of LLMO-5980 — "should api-service migrate onto the shared client?" — is moot for the primary surfaces: it already has. Confirmed current state across the four Semrush-facing call paths:

| Surface | On shared client? | Retry |
|---|---|---|
| Project Engine | Yes (`project-engine-client`) | Restored by #2766 |
| User Manager | Yes (`user-manager-client`) | Restored by #2766 |
| **Elements API** | **No** — hand-rolled `elements-transport.js` | **None** |
| **AI Visibility** | **No** — gRPC/OAuth2, `grpc-transport.js` | **None** |

**LLMO-5980 is redefined as: close the two remaining surfaces, on their own merits.**

- **Elements** — same paradigm as Project Engine (REST, IMS Bearer, *same gateway* `SEMRUSH_PROJECTS_BASE_URL`), one endpoint (`fetchElement`, POST), hand-rolled, zero retry. This is the same resilience gap #2766 just closed, on the same gateway. It should be closed as a small, scoped follow-up — either by consuming the shared client if the endpoint fits it, or by mirroring the retry behaviour in place. Tracked separately; not bundled with the boundary decision.
- **AI Visibility** — out of scope for this ADR (see Non-goals).

## Non-goals

- **AI Visibility transport (gRPC/HTTP2 + OAuth2).** Different protocol, different auth model; it does not drop onto the REST/IMS-Bearer shared client. Whether the shared-client boundary should ever stretch to cover gRPC/OAuth2 — or whether that surface gets its own client — is a separate decision, to be made when someone actually works that surface, not pre-emptively here.

## Consequences

**Good**

- One obvious home for REST/IMS-Bearer transport logic; PRs stop re-arguing the boundary.
- The production retry gap on the migrated surfaces is closed (#2766), independent of any further work.
- No speculative expansion of the boundary to protocols nobody is currently working.

**Costs / risks**

- Two Semrush-facing surfaces (Elements, AI Visibility) remain off the shared client with no retry. Elements is a known, scoped follow-up; AI Visibility is explicitly deferred. Both carry a live resilience gap until addressed.
- Consumers each implement error→HTTP translation. Mitigated by the typed error taxonomy being clear enough that translation is mechanical.

## Follow-on work

- **LLMO-5977** — client facade in `spacecat-shared` (makes the boundary real in code). Gated on this ADR.
- **LLMO-5978 + LLMO-5979** — typed errors + request timeouts, landing together as one hardening PR.
- **LLMO-5980** — close Elements (small, same-shape); AI Visibility deferred as a non-goal.
- **LLMO-5976** — spec-verify CI gate. Independent; shipped (PR #1777).
