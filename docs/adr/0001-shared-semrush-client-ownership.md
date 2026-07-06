# ADR-0001: Ownership boundary for the shared Semrush client

- **Status:** Accepted
- **Ticket:** LLMO-5975
- **Deciders:** Alicia (DRS/BP), Rainer Friederich
- **Date:** 2026-07-06
- **Relates to:** PR #1661 (typed client wrapper), LLMO-5461/5459 (Semrush Project Engine client)

## Context

The Semrush Project Engine client exists as a typed wrapper in `spacecat-shared` (PR #1661: IMS Bearer auth, retry). Separately, `spacecat-api-service` has its own hand-built Serenity transport for the same upstream.

We are building out the shared client (facade, typed errors, request timeouts). Before that lands, we need one thing fixed: **what belongs inside the shared client, and what belongs to the code that uses it.** Without an agreed line, every subsequent PR re-litigates it, and the client accretes consumer-specific logic that doesn't belong to everyone.

This decision gates the facade work (LLMO-5977). It does not gate the spec-verify CI gate (LLMO-5976), which is independent and already shipped (PR #1777).

## Decision

### The boundary

**The shared client owns transport.** It is the single place that knows how to *talk to Semrush*:

- Authentication (IMS Bearer)
- Retries and backoff
- Request timeouts
- A typed error taxonomy — every failure surfaces as a defined error type, not a raw HTTP response or a thrown string

**Consumers own their own context.** Each service using the client is responsible for:

- Translating the client's typed errors into its own HTTP responses / status codes
- Caching
- Redaction of sensitive fields for its own logging and output

The test for "does this go in the shared client?": *is it true for every consumer, or specific to one?* Auth and retry are true for everyone → shared. How a 404 becomes an HTTP response, what gets cached, what gets redacted — those depend on who's calling → consumer.

## On spacecat-api-service and duplication (LLMO-5980)

Investigation confirmed that transport behavior has **diverged** between the two implementations: the shared client and the api-service Serenity path do not carry the same resilience behavior. Under the boundary above, that divergence is a boundary violation — transport concerns should not be maintained twice.

Two distinct problems follow, on two different clocks, and they are handled separately:

1. **Any live resilience gap is closed directly, where it exists** — a small, targeted change to bring the affected path up to parity. This is the urgent, cheap fix; it does not wait on any facade work.
2. **Consolidating api-service onto the shared client is deferred as a deliberate call — NOT auto-funded by the trigger firing.** A divergence being found is the reason to close the gap (1), not the reason to fund a facade-gated rewrite of a working client. Migration remains real, deliberate future work, sequenced only after the facade (LLMO-5977) exists — because the facade is the thing api-service would migrate *onto*.

**LLMO-5980 is recorded as "revisit deliberately."** It is not closed as a non-goal, and it is not funded now. It is revisited on its own merits once the facade lands and the maintenance cost of two clients is weighed against the rewrite cost — not stampeded by the resilience gap, which (1) already addresses.

## Consequences

**Good**

- One obvious home for transport logic; PRs stop re-arguing the boundary.
- The live resilience divergence is closed cheaply and immediately, independent of the facade timeline.
- No speculative rewrite of a working client.

**Costs / risks**

- Two Semrush clients coexist for now, and closing the resilience gap directly means the parity fix lives in both paths until consolidation. Accepted deliberately: the direct fix protects production during the window before any migration would land.
- Consumers must each implement error→HTTP translation. Mitigated by the typed error taxonomy being clear enough that translation is mechanical.

## Follow-on work

- **LLMO-5977** — client facade in `spacecat-shared` (makes the boundary real in code). Gated on this ADR.
- **LLMO-5978 + LLMO-5979** — typed errors + request timeouts, landing together as one hardening PR.
- **LLMO-5980** — revisit deliberately after the facade; not funded now.
- **LLMO-5976** — spec-verify CI gate. Independent; shipped (PR #1777).
