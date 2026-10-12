# ADR-0002: `entitlement.tier_changed` as the target-architecture seam for tier transitions

- **Status:** Accepted (groundwork — no live consumer yet)
- **Date:** 2026-07-17
- **Package:** `@adobe/spacecat-shared-tier-client`
- **Relates to:** the FREE_TRIAL→PAID provisioning flow (api-service endpoint + spacecat-fulfillment-worker)

## Context

Entitlement tier transitions (most importantly FREE_TRIAL→PAID, but also fresh
entitlement creation and other non-PAID transitions) are the trigger for downstream
provisioning work — e.g. standing up the prompt-suggestion schedule when an org goes PAID,
and, eventually, tearing that provisioning down on a PAID→trial transition.

Today that reaction is driven imperatively: an `spacecat-api-service` endpoint performs the
tier change via `TierClient.createEntitlement(tier)` and the caller (or the
`spacecat-fulfillment-worker`) then does the provisioning. There is a single choke point
where a tier actually changes — `TierClient.createEntitlement` in this package — but nothing
is emitted from it, so every reaction has to be wired to the specific call site that happened
to perform the change.

The architecture review recommended writing down a domain event, `entitlement.tier_changed`,
as the **target architecture**: the eventual replacement for the endpoint/reaction approach,
emitted from the choke point so consumers can subscribe instead of being coupled to call
sites. This ADR records that decision and the groundwork implementation.

## Decision

### The event

Introduce a domain event **`entitlement.tier_changed`**, emitted from the single choke point
where a tier changes: `TierClient.createEntitlement(tier)`.

- **Constant:** `ENTITLEMENT_TIER_CHANGED = 'entitlement.tier_changed'`, exported from the
  package (with a typed `EntitlementTierChangedEvent` payload in `index.d.ts`).
- **Emitted on an actual change only:**
  - Fresh entitlement create → `{ from: null, to: tier }`.
  - Existing entitlement, tier transition (`setTier`+`save`) → `{ from: prevTier, to: tier }`.
  - No change (tier unchanged, or existing entitlement is already PAID and is not
    downgraded) → **no event**. Creating only a site enrollment on an existing entitlement is
    not a tier change and emits nothing.
- **Payload:**

  ```jsonc
  {
    "type": "entitlement.tier_changed",
    "entitlementId": "…",
    "organizationId": "…",
    "productCode": "LLMO",
    "siteId": "…|null",        // null for org-only scope
    "enrollmentId": "…|null",  // null when no enrollment is in scope
    "from": "FREE_TRIAL|null", // null on a fresh create
    "to": "PAID",
    "occurredAt": "2026-07-17T00:00:00.000Z"
  }
  ```

### Emission mechanism: opt-in, best-effort, non-breaking

`tier-client` is a shared library with 6+ consumers (api-service tier-provisioning,
access-control, entitlement controller, several Slack actions/commands, etc.). The emission
must not force any of them to configure new infrastructure and must never change the
`createEntitlement` return contract.

We use the **ecosystem's idiomatic publish path — the shared SQS helper on the request
context** (`context.sqs`, provided by `sqsWrapper` from `@adobe/spacecat-shared-utils`, which
every SpaceCat Lambda already wires) plus an `ENTITLEMENT_EVENTS_QUEUE_URL` env var. No new
SDK dependency is added to the package, and no factory/constructor signature changes.

- **Opt-in:** emission is a no-op unless the caller's context provides **both** `context.sqs`
  **and** `context.env.ENTITLEMENT_EVENTS_QUEUE_URL`. Existing consumers configure neither, so
  they are entirely unaffected. This is what makes the change safe to ship ahead of any
  consumer.
- **Best-effort:** a publish failure is caught and logged (`log.warn`); it never propagates
  out of `createEntitlement`/`save`. Provisioning correctness today does not depend on the
  event, so a lost event must not fail the tier change.
- **Additive:** additions only — the constant, the private emit method, and optional
  `sqs`/`env` on the typed context. No behavioural change for callers that don't opt in.

## Intended consumers (future)

- **→PAID:** provision the prompt-suggestion schedule for the org/site (today handled by the
  api-service endpoint + fulfillment worker).
- **PAID→trial (future):** tear the provisioning down.

When the first real consumer is built, a dedicated queue is provisioned, its URL is set as
`ENTITLEMENT_EVENTS_QUEUE_URL` on the emitting service, and the consumer subscribes. Until
then this is dormant groundwork.

## Consequences

**Good**

- The event is defined and emitted from the one place tiers change, so future reactions
  subscribe to a fact instead of being coupled to whichever call site performed the change.
- Ships safely now with zero risk to existing consumers (no-op until a queue is configured).
- No new dependency; uses the transport every SpaceCat service already has.

**Costs / risks**

- No end-to-end delivery until a queue and a consumer exist — the event is unobservable in
  production until then (by design).
- Best-effort delivery means an at-most-once event on the emit side; the eventual
  provisioning consumer must remain idempotent and not treat the event as the system of
  record. Provisioning today does not rely on it.
- The env-var contract (`ENTITLEMENT_EVENTS_QUEUE_URL`) must be documented where the emitting
  service's config lives when a consumer is wired.
