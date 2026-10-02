# ADR-0002: Embedding client placement and semantic-index utils ownership

- **Status:** Accepted; Decision 4 amended 2026-10-01 (see Amendment)
- **Ticket:** LLMO-7445
- **Deciders:** Lookup Service working group (LLMO-7445)
- **Date:** 2026-09-17
- **Relates to:** PR #1933 (this change) · audit-worker ADR 006 (Lookup Service write foundation) + ADR 007 (topic dimension) · spacecat-api-service#3298 (by-topics read endpoint) · mysticat-data-service semantic tables + RPCs

## Scope

This ADR governs, within `spacecat-shared`, **where embeddings support lives and what the shared layer owns** for the Lookup Service semantic (by-topic) matching: the Azure embeddings client (`@adobe/spacecat-shared-gpt-client`) and the semantic-index storage/retrieval helpers (`@adobe/spacecat-shared-data-access`). It does **not** decide the product/design of semantic matching itself — that is the cross-repo Lookup Service design (audit-worker ADR 006/007) — only the shared-library boundaries the same way ADR-0001 did for the Semrush client.

## Context

Semantic by-topic matching needs one embedding model used on both sides — the **write** path (audit-worker embeds opportunity topic titles) and the **read** path (api-service embeds the query text on a cache miss) — so their vectors are comparable by construction. Before this change `spacecat-shared` had no embeddings client (`gpt-client` was chat/completions only) and no vector storage helpers.

Two placement questions had to be settled so future consumers don't re-litigate them:

1. Does the embeddings client belong in `gpt-client`, or in a new `spacecat-shared-embedding-client` package?
2. What does the shared layer own vs. what does each consumer own?

## Decision

### 1. The embeddings client extends `gpt-client`; it is not a new package

`AzureEmbeddingClient` ships in `@adobe/spacecat-shared-gpt-client` alongside `AzureOpenAIClient`, because embeddings are the **same vendor and auth** (Azure OpenAI endpoint/key/api-version) as the chat client — that package already groups multiple Azure/LLM-provider clients. A separate package would duplicate the auth/transport shape for no isolation benefit. It is a **distinct class**, not an overload of the chat client (embeddings ≠ chat/completions).

### 2. Consumers depend on the `EmbeddingProvider` interface, not the concrete client

The client implements a minimal `EmbeddingProvider` typedef (`createEmbeddings(inputs, options?) => number[][]`). Consumers (and the api-service engine) type against the interface, so the provider/model can be swapped later — an online, forward-only re-embed (see Consequences), no code-shape change. A future extraction into a dedicated package stays non-breaking behind this seam.

### 3. Ownership boundary — the shared client owns transport

Following ADR-0001's test (*true for every consumer → shared; specific to one → consumer*):

**Shared client (`AzureEmbeddingClient`) owns:**
- Authentication (Azure `api-key`), endpoint/version resolution (`AZURE_EMBEDDING_*` with fallback to `AZURE_OPENAI_*`).
- Retry/backoff for transient 429/5xx (honoring a **bounded** `Retry-After`, exponential backoff with jitter, capped).
- Batching a set of inputs into one call and returning vectors **in input order**, with a response-length guard.

**Consumers own:**
- Caching. The durable query-embedding cache (`semantic_query_embedding`) and its key policy (`hash(normalizedText)+model+dims`) live in the data-access helpers/consumer, not the client — staleness/keying is a consumer concern.
- _Superseded by the amendment below:_ Passing the model/dimension on every write and search. They pass the shared `SEMANTIC_MATCHING_CONFIG.embedding` (`model`, `dims`, spread straight into the helpers), which `data-access` defines because it owns the stored index, and do not hardcode the values. It is a code constant, not env config: the label is persisted on every row and in the cache key, so writer and reader agree as long as they run the same data-access version, and changing it is a re-embed plus upgrading both. `embedding.dims` must match the `vector(N)` columns. The helpers still accept any `model` / `dims`, so a same-dims model change can run the online re-embed below.
- Translating a client failure into an HTTP response (api-service returns 503; the audit-worker write path degrades best-effort).

### 4. Semantic-index helpers live in `data-access`, mirroring the URL index

_Superseded by the amendment below:_ `semantic-index.utils.js` mirrors `url-index.utils.js`: `syncOpportunitySemantic` (full-replace per `source_type`), `lookupOpportunitiesByVectors` (ANN read RPC wrapper, many query vectors per call), and the batched `semantic_query_embedding` cache helpers (`getQueryEmbeddings` / `upsertQueryEmbeddings` / `touchQueryEmbeddings`). (`copyEntityVectors`, a wrapper over the `wrpc_copy_opportunity_semantic_vectors` RPC, was removed with its only caller, the offsite snapshot vector copy.) Text normalization + hashing live in this layer so a value written always matches a later read/re-sync. **The shared layer stores and reads pre-embedded vectors; it never embeds** — embedding is the writer's (audit-worker's) job via the client above.

_Superseded by the amendment below:_ **Type registries.** `OPPORTUNITY_SEMANTIC_SOURCE_TYPES` (kinds of embedded text: `topic`, later `claim`) and `OPPORTUNITY_SEMANTIC_ENTITY_TYPES` (opportunity types, from `OPPORTUNITY_TYPES`) are defined in `spacecat-shared-utils` (so non-Node consumers such as the UI can import them and their types) and re-exported from this layer, and this library's writer stores and reader accepts only their values; anything else is a `ValidationError`. The reader takes `sourceTypes` (required, non-empty) and optional `entityTypes` (omitted or empty = all), deduped, so a list can never exceed its registry. The DB does not duplicate the registries: the RPC only rejects empty, multi-dimensional, or NULL-element lists and lists over 100 elements (a length bound, not a registry mirror; `NULL` entity types = all; the reader sends `NULL` when `entityTypes` is omitted or empty). A team that wants its opportunities searchable adds its source kind and/or opportunity type to the registries, indexes with them, and callers opt in by passing them.

**Status filter.** The reader also takes optional `statuses`, checked against `Opportunity.STATUSES` and deduped like the type lists. The RPC applies it before the per-query limit, so filtered-out opportunities never take result slots. Which statuses count as visible is the caller's choice. The data-service casts the list to its status enum, so a value it doesn't know is an error, not an empty result. Sending `statuses` needs a data-service with `p_statuses` (mysticat-data-service PR 1132).

_Superseded by the amendment below:_ Adding an entity type: (1) add it to `OPPORTUNITY_TYPES` if it is new, and to `OPPORTUNITY_SEMANTIC_ENTITY_TYPES` (plus its literal type in `constants.d.ts`), and release `spacecat-shared-utils`; (2) bump data-access's utils pin and release data-access; (3) bump data-access in the writer (audit-worker) and the reader (api-service). The writer rejects the type until step 3, so index only after it. A new source kind is the same, in `OPPORTUNITY_SEMANTIC_SOURCE_TYPES`.

### Amendment (2026-10-01): semantic-index redesign

The index was redesigned before it had external consumers (mysticat-data-service `semantic_index_redesign` migration). This supersedes the parts of Decision 4 above that conflict with it, and the alternatives that rejected embedding in data-access and argued for registries.

- **Two match columns instead of `source_type`.** Rows carry `match_type` (which lookup they serve: `topic`, later `claim`) and `match_field_type` (which field the text came from, e.g. `topic`). Callers never pass the match type: each dimension has its own functions (`indexSemanticTopics`, `lookupOpportunitiesByTopic`, `lookupSuggestionsByTopic`) that set it internally, so a producer can't index under the wrong lookup. Callers pass `matchFieldType` on write and may filter by `matchFieldTypes` on read.
- **No type registries.** `OPPORTUNITY_SEMANTIC_SOURCE_TYPES` / `OPPORTUNITY_SEMANTIC_ENTITY_TYPES` are removed from utils. `entityType` and `matchFieldType` are free-form, length-bounded strings, and filter lists are shape-checked and capped at 100 values. Callers that want a narrow search pass `entityTypes` explicitly. A producer can index a new field or entity type without a shared release.
- **Opportunities and suggestions share one shape.** `opportunity_semantic_embedding` and `suggestion_semantic_embedding` have the same columns. The topic writer, `indexSemanticTopics`, takes a `target` (`SEMANTIC_TARGETS`). There are two topic readers: `lookupOpportunitiesByTopic`, and `lookupSuggestionsByTopic`, which adds `opportunityStatuses`. The claim functions follow the same pattern when that dimension lands.
- **The shared layer now embeds.** `indexSemanticTopics` and `embedQueries` take an `EmbeddingProvider` (Decision 2) and call it. Transport, auth and retry stay in the client (Decision 3); data-access only decides which texts need a vector. That keeps the batching, dedupe and cache-first logic in one place instead of in every producer.
- **The writer reads the query cache but never writes it.** Stored texts are normalized the same way as queries, so a topic already embedded for a query is reused. Only the read path (`embedQueries`) writes `semantic_query_embedding`, so the cache keeps meaning "texts users searched".
- **Claims are their own dimension (2026-10-02).** `indexSemanticClaims` (any target) and `lookupSuggestionsByClaim` set `match_type=claim`; the topic functions never read or write claim rows. For suggestions the offsite writer stores the title (`match_field_type=title`) and the derived topics (`topic`) as claims. There is no opportunity claim reader until a by-claims lookup for opportunities is agreed.
- **The writer reuses vectors from its own table (2026-10-02).** Before the query cache, a new text takes a vector already stored in the target table for the same site and generation, from any entity, match type or field, so a suggestion's claim-topic rows reuse its topic rows' vectors. It is site- and table-scoped on purpose: reading the other target's table would couple the targets to save one small embed per new text per site.
- **Callers never pass the embedding generation.** The writer, `embedQueries` and both lookups read `SEMANTIC_MATCHING_CONFIG.embedding` themselves. After a model change the writer treats rows from the old generation as stale and overwrites them on the entity's next refresh.
- **The writer copies vectors from the query cache into index rows**, so a bad cache row would persist past cache eviction. This relies on PostgREST being reachable only internally, and on the cache helpers being internal to data-access (only `embedQueries` writes the cache).
- **The read side is bounded.** `embedQueries` rejects texts that are empty or over `MAX_TEXT_LENGTH` once normalized and more than `MAX_QUERY_TEXTS` texts, embeds the distinct misses in one call, and treats a cache read failure as all misses (logged and returned as `cacheError`), like the writer.

## Consequences

- `gpt-client` gains an embeddings surface and its own `AZURE_EMBEDDING_*` config (documented in its README); the intended cost, not a drawback.
- The shared embedding model is a cross-repo contract: both the write and read paths must point at the **same deployment**. ANN search is **scoped to one generation** — `lookupOpportunitiesByTopic` / `lookupSuggestionsByTopic` (and the search RPCs) filter on `model`+`dims`, read from `SEMANTIC_MATCHING_CONFIG.embedding`, and the query cache is keyed on `model+dims`. This makes a **same-dims model change an online, forward-only re-embed** (chosen over an atomic swap — see Alternatives): the read path queries the new generation immediately while the write path back-populates it entity-by-entity on the normal refresh cadence, overwriting old-generation rows in place. Entities that are never refreshed (e.g. closed opportunities) keep old-generation rows, which search ignores; the model-change runbook ends with a one-off sweep deleting rows whose `model`/`dims` is not current. **Accepted cost:** during the migration window, opportunities not yet re-embedded don't match new-generation queries (reduced recall), self-healing as the backfill completes. A **dimension change** is out of this online path — it needs a new `vector(N)` column and an atomic swap, not a forward-only re-embed.
- _Superseded by the amendment below:_ **Deploy ordering:** `lookupOpportunitiesByVectors` calls `rpc_opportunity_semantic_search` with `p_source_types`/`p_entity_types` (lists) and `p_query_embeddings` (a list of vectors) plus `p_model`/`p_dims`, so the data-service release carrying that signature must be deployed **before** any consumer upgrades to this library version — otherwise PostgREST can't resolve the function (`PGRST202`).
- _Superseded by the amendment below:_ **Registry version skew:** the registries check inputs, not results. A newer writer can index a type an older reader doesn't know, and with `entityTypes` omitted that `entity_type` comes back unvalidated, so a reader that must recognise every returned type passes `entityTypes` explicitly.
- Consumers stay thin: they inject the `EmbeddingProvider`, own their cache/status mapping, and call the `data-access` helpers — no matching logic is reimplemented per consumer.

## Alternatives considered

- **A new `spacecat-shared-embedding-client` package.** Rejected for now: same vendor/auth as `gpt-client`; deferred behind the `EmbeddingProvider` seam so a later extraction is non-breaking.
- **Overloading `AzureOpenAIClient`.** Rejected: embeddings are a different API surface; a distinct class keeps each client cohesive.
- _Superseded by the amendment below:_ **Embedding inside the shared data-access layer.** Rejected: transport/auth belongs in a client (ADR-0001 boundary), and the write side (audit-worker) owns when/what to embed.
- **Producer-namespaced source types (e.g. `offsite_topic`).** Rejected: `entity_type` already identifies the producer, so namespacing `source_type` would duplicate it. Generic kinds plus an optional `entityTypes` filter keep the two axes separate. Accepted cost: a new producer that indexes `topic` shows up in by-topics results by default unless callers pass `entityTypes`.
- _Superseded by the amendment below:_ **A `*` (all types) wildcard.** Rejected: results would change silently whenever a new producer starts indexing, and an exact scan's cost grows with every type included. Callers that want every kind pass `Object.values(OPPORTUNITY_SEMANTIC_SOURCE_TYPES)` explicitly.
- **Registries enforced in the DB (CHECK/enum).** Rejected: a migration for every new type; the registries live next to the helpers that enforce them.
- **Validating `entityType` against `OPPORTUNITY_TYPES` directly.** Rejected: it saves no release steps (a new upstream type still needs the exact utils pin bumped and a data-access release) and only loses the opt-in: it would immediately admit every opportunity type already behind today's pin, so any of them could be indexed and searched without a deliberate registration.
- **Embedding model label from env (e.g. derived from `AZURE_EMBEDDING_DEPLOYMENT`).** Rejected: writer and reader have separate env configs, so a mismatch would silently return no matches; a deployment name is an alias, not a model id; and changing the label is a re-embed, which should be a reviewed release.
- **Atomic-swap migration (full index rebuild + coordinated cutover) instead of the online, generation-scoped re-embed.** Rejected: it would require rebuilding the whole opportunity index and flipping the read path over in lockstep across four repos — high operational risk and coordination cost for a rare event. The chosen online path (ANN search filtered by `model`+`dims`) lets the read path move to the new generation immediately while the write path back-populates on its normal cadence; the accepted cost is reduced recall for not-yet-re-embedded opportunities during the migration window (see Consequences). Atomic swap remains the required approach for a **dimension** change, which the online path deliberately does not cover.
