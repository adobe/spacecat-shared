/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

// @ts-check

/**
 * The stateful slice of the Project Engine mock.
 *
 * The confirmed consumer inventory (see docs/mock-statefulness.md) makes six resource groups
 * write-then-read: **projects** (per workspace), **ai_models** / **prompts** / **benchmarks** /
 * **tags** (per project), and **brand_urls** (per benchmark) — see {@link STATEFUL_RESOURCES}.
 * This module
 * encodes that set as pure operations over an {@link InMemoryStore} —
 * collection-key scoping plus the CRUD each group needs — with no Counterfact / HTTP coupling,
 * so it is unit-testable on its own. The Counterfact runner adapts these into per-path handlers
 * (mapping store results into spec-valid response envelopes); non-stateful operations (catalogs,
 * echo reads, the publish/202 acks) are thin hand-authored handlers too. The runner serves NO
 * auto-stubs (`--serve`, no `generate` — see run.js), so an unmodelled path 404s; nothing falls
 * back to a generated random response.
 */

/**
 * @typedef {import('./store.js').InMemoryStore} InMemoryStore
 * @typedef {import('./store.js').Entity} Entity
 */

/**
 * Resource groups the live audit confirmed the consumer
 * write-then-reads: projects, ai_models, prompts, plus benchmarks (per project) and brand_urls
 * (per benchmark) — the competitor-benchmark and brand-URL sync flows create→list→update→delete,
 * so they need real state to be faithfully testable. `tags` are the project-level AIO taxonomy
 * (the Categories surface): the consumer creates standalone tags per market project — a bare-named
 * category under the `category` dimension root — and must read them back even before any prompt
 * carries them, so they need real state too.
 */
export const STATEFUL_RESOURCES = Object.freeze([
  'projects', 'ai_models', 'prompts', 'benchmarks', 'tags', 'brand_urls',
]);

/**
 * Builds the store collection key for a resource, scoped so two workspaces (or projects, or
 * benchmarks) never share state. `projects` are scoped per workspace; `ai_models`, `prompts`,
 * `benchmarks`, and `tags` per project; `brand_urls` per benchmark (within a project).
 * @param {'projects' | 'ai_models' | 'prompts' | 'benchmarks' | 'tags' | 'brand_urls'} resource
 * @param {{ workspaceId?: string | number, projectId?: string | number,
 *   benchmarkId?: string | number }} scope
 * @returns {string}
 */
export function collectionKey(resource, scope = {}) {
  const { workspaceId, projectId, benchmarkId } = scope;
  if (resource === 'projects') {
    return `projects:${workspaceId}`;
  }
  if (resource === 'brand_urls') {
    return `brand_urls:${workspaceId}:${projectId}:${benchmarkId}`;
  }
  return `${resource}:${workspaceId}:${projectId}`;
}

/**
 * The four keys `model.AIOPromptMetadata` / `model.AIOPromptMetadataPatch` carry (LLMO-6288 WP2
 * rework, delivered swagger 2026-07-20 — the v3 `/aio/prompts` metadata family). Iterated by
 * {@link mergeMetadataPatch} so a merge only ever touches these, never an arbitrary caller-supplied
 * key.
 */
const METADATA_KEYS = ['created_at', 'created_by', 'updated_at', 'updated_by'];

/**
 * The 100-char cap the live API applies to `created_by` / `updated_by`. Its CONTRACT status
 * differs by write path, so on the patch paths this is an ASSUMPTION the mock encodes, not a
 * constraint the delivered spec pins:
 * - CREATE (`model.AIOPromptMetadata`) declares `maxLength: 100` on both keys — part of the
 *   vendored contract — so Counterfact's request validation rejects an over-length author before
 *   any handler runs (with a plain-text body; prod returns JSON — a known framework divergence, see
 *   the review thread). The handler check below is redundant defence-in-depth there.
 * - the PATCH shape (`model.AIOPromptMetadataPatch`) declares NO length, and the delivered ADR's
 *   CHECK carries no length clause either (it constrains object-ness + the key set and calls the
 *   values opaque strings, "Not validated"). Live nonetheless 400s a 101-char author on the patch
 *   path (verified against prod, Rainer review), so the mock enforces the cap in the PATCH HANDLERS
 *   — deliberately NOT in the request schema (prod's swagger doesn't declare it either), so the
 *   mock returns prod's exact JSON `<field>: exceeds 100 characters` body rather than Counterfact's
 *   plain-text schema rejection. One inference beyond what the delivered contract pins; practical
 *   risk nil (longest prod author seen is 49 chars).
 */
const AUTHOR_KEYS = ['created_by', 'updated_by'];
const MAX_AUTHOR_LENGTH = 100;

/**
 * The first of `created_by` / `updated_by` whose STRING value exceeds {@link MAX_AUTHOR_LENGTH}, or
 * `undefined` if neither does. Returns the KEY (not a boolean) so the PATCH handlers can build
 * prod's field-specific `<field>: exceeds 100 characters` 400 body. Only a string value being SET
 * can overflow; an absent key or an explicit `null` (delete) never does, so a merge-patch's `null`
 * entries are exempt by construction.
 * @param {unknown} metadataLike a create item's full `metadata`, or a patch's per-key object
 * @returns {string | undefined}
 */
const oversizedAuthorField = (metadataLike) => AUTHOR_KEYS.find((k) => {
  const value = /** @type {Record<string, unknown> | undefined} */ (metadataLike)?.[k];
  return typeof value === 'string' && value.length > MAX_AUTHOR_LENGTH;
});

/**
 * True when {@link oversizedAuthorField} finds an over-length author — the boolean the create-path
 * pre-gate and the atomic re-check use. A violation 400s (and, for the batch metadata PATCH, rolls
 * back the WHOLE batch) rather than partially applying.
 * @param {unknown} m a create item's full `metadata`, or a patch's per-key object
 * @returns {boolean}
 */
const violatesAuthorLengthCheck = (m) => oversizedAuthorField(m) !== undefined;

/**
 * True when a metadata-shaped object carries a key OUTSIDE the closed {@link METADATA_KEYS} set.
 * The live CHECK rejects any such key — `(metadata - ARRAY['created_at','created_by','updated_at',
 * 'updated_by']) = '{}'::jsonb` — so a stray or typo'd key (a fifth field, or `updated_By`) 400s on
 * EVERY write path, and on the batch metadata PATCH rolls the whole batch back. Enforced on BOTH
 * write paths so the mock refuses it exactly where live does: otherwise the create path would
 * PERSIST an unknown key (and echo it back on the `by_tags` read) while the merge path SILENTLY
 * dropped it — two divergences that also let the mock reach a state live cannot represent (a fifth
 * key surviving every later patch). Neither generated request schema carries
 * `additionalProperties: false`, so ajv passes an extra key through to the handler; this guard is
 * where it stops (Rainer review, LLMO-6288 rework). A `null` / non-object value carries no keys and
 * is exempt by construction (request validation already rejects a non-object `metadata`).
 * @param {unknown} metadataLike a create item's full `metadata`, or a patch's per-key object
 * @returns {boolean}
 */
const violatesClosedKeySet = (metadataLike) => {
  if (metadataLike === null || typeof metadataLike !== 'object') {
    return false;
  }
  return Object.keys(metadataLike).some((key) => !METADATA_KEYS.includes(key));
};

/**
 * RFC 7396 JSON Merge Patch, scoped to the four {@link METADATA_KEYS}: a key ABSENT from `patch`
 * is kept unchanged, a STRING value sets/overwrites it, and an explicit `null` DELETES it. When
 * the merge leaves no surviving key, the result collapses to `undefined` — the mock's "no
 * metadata" state, matching the delivered contract's "the row's metadata collapses to null."
 * @param {Record<string, unknown> | undefined} current the prompt's existing `metadata`
 * @param {Record<string, unknown>} patch the merge-patch object (`AIOPromptMetadataPatch`-shaped)
 * @returns {Record<string, unknown> | undefined}
 */
const mergeMetadataPatch = (current, patch) => {
  const next = { ...(current ?? {}) };
  for (const key of METADATA_KEYS) {
    if (key in patch) {
      if (patch[key] === null) {
        delete next[key];
      } else {
        next[key] = patch[key];
      }
    }
  }
  return Object.keys(next).length === 0 ? undefined : next;
};

/**
 * Union two AIO-tag lists by tag `id`: the existing tags first (order preserved), then any tag from
 * `incoming` whose id is not already present, in request order. Models prod attaching a v3 create
 * request's tags to a DEDUPE hit — "create with these tags" is idempotent for metadata but ADDITIVE
 * for tags (verified against prod, Rainer review) — without ever duplicating an already-attached
 * id. A non-array `existing` is treated as empty.
 * @param {unknown} existing the stored prompt's `tags`
 * @param {Array<{ id: string, name: string }> | undefined} incoming the request's resolved tags
 * @returns {Array<{ id: string, name: string }>}
 */
const unionTagsById = (existing, incoming) => {
  const base = Array.isArray(existing) ? existing : [];
  const seen = new Set(base.map((t) => String(t?.id)));
  const merged = [...base];
  for (const tag of incoming ?? []) {
    if (!seen.has(String(tag.id))) {
      seen.add(String(tag.id));
      merged.push(tag);
    }
  }
  return merged;
};

/**
 * The stateful operations, grouped by resource. Each operates on the store and returns stored
 * entities / lists / booleans — never HTTP envelopes — so the Counterfact adapter owns response
 * shaping. Pure and synchronous; the store clones on every read/write.
 * @param {InMemoryStore} store
 */
export function createStatefulOps(store) {
  return {
    projects: {
      /**
       * @param {{ workspaceId: string | number }} scope
       * @param {Partial<Entity> & Record<string, unknown>} body
       * @returns {Entity}
       */
      create(scope, body) {
        return store.create(collectionKey('projects', scope), body);
      },
      /**
       * @param {{ workspaceId: string | number }} scope
       * @returns {Entity[]}
       */
      list(scope) {
        return store.list(collectionKey('projects', scope));
      },
      /**
       * @param {{ workspaceId: string | number }} scope
       * @param {string} id
       * @returns {Entity | undefined}
       */
      get(scope, id) {
        return store.get(collectionKey('projects', scope), id);
      },
      /**
       * Partially updates a project, returning the updated entity or undefined if unknown.
       * @param {{ workspaceId: string | number }} scope
       * @param {string} id
       * @param {Record<string, unknown>} patch
       * @returns {Entity | undefined}
       */
      update(scope, id, patch) {
        return store.update(collectionKey('projects', scope), id, patch);
      },
      /**
       * @param {{ workspaceId: string | number }} scope
       * @param {string} id
       * @returns {boolean}
       */
      remove(scope, id) {
        return store.delete(collectionKey('projects', scope), id);
      },
    },

    ai_models: {
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @returns {Entity[]}
       */
      list(scope) {
        return store.list(collectionKey('ai_models', scope));
      },
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Partial<Entity> & Record<string, unknown>} body
       * @returns {Entity}
       */
      add(scope, body) {
        return store.create(collectionKey('ai_models', scope), body);
      },
      /**
       * Deletes the given model ids, reporting how many were actually removed.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<string>} ids
       * @returns {number}
       */
      removeMany(scope, ids) {
        const key = collectionKey('ai_models', scope);
        return ids.reduce((removed, id) => (store.delete(key, id) ? removed + 1 : removed), 0);
      },
    },

    prompts: {
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {(entity: Entity) => boolean} [predicate]
       * @returns {Entity[]}
       */
      list(scope, predicate) {
        return store.list(collectionKey('prompts', scope), predicate);
      },
      /**
       * Creates one entity per supplied prompt, returning all created entities.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<Partial<Entity> & Record<string, unknown>>} prompts
       * @returns {Entity[]}
       */
      createMany(scope, prompts) {
        const key = collectionKey('prompts', scope);
        return prompts.map((prompt) => store.create(key, prompt));
      },
      /**
       * Partially updates one stored prompt in place (the id-based `PUT /aio/prompts/tags` tag-set
       * write), returning the updated entity or undefined if the id is unknown. Live silently skips
       * an unknown prompt id, so the handler treats an `undefined` return as a no-op.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {string} id
       * @param {Record<string, unknown>} patch
       * @returns {Entity | undefined}
       */
      update(scope, id, patch) {
        return store.update(collectionKey('prompts', scope), id, patch);
      },
      /**
       * Reads one stored prompt by id (cloned), or undefined if unknown — the metadata write paths
       * resolve the target through this before touching it.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {string} id
       * @returns {Entity | undefined}
       */
      get(scope, id) {
        return store.get(collectionKey('prompts', scope), id);
      },
      /**
       * True when ANY item in a metadata-bearing batch would violate the live `created_by` /
       * `updated_by` `maxLength: 100` CHECK (LLMO-6288 WP2 rework, delivered swagger 2026-07-20).
       * Callers check this BEFORE resolving tag ids / metering quota / writing anything, so the
       * create and patch routes 400 first — matching the delivered contract's "a CHECK violation
       * rolls the WHOLE batch back" atomicity (the same validate-before-write discipline this mock
       * already applies to tag_id resolution).
       * @param {Array<{ metadata?: unknown }>} items each carrying a full or per-key `metadata`
       * @returns {boolean}
       */
      hasOversizedAuthor(items) {
        return items.some((item) => violatesAuthorLengthCheck(item.metadata));
      },
      /**
       * True when ANY item in a metadata-bearing batch carries a metadata key outside the closed
       * set (see {@link violatesClosedKeySet}). The v3 create routes check this alongside
       * {@link hasOversizedAuthor} BEFORE resolving tag ids / metering quota / writing anything, so
       * a stray or typo'd key 400s FIRST and nothing is created — the same atomic
       * validate-before-write discipline the author-length CHECK uses, returning the same 400 the
       * live closed-key-set CHECK produces (LLMO-6288 rework, Rainer review).
       * @param {Array<{ metadata?: unknown }>} items each carrying a full or per-key `metadata`
       * @returns {boolean}
       */
      hasUnknownMetadataKey(items) {
        return items.some((item) => violatesClosedKeySet(item.metadata));
      },
      /**
       * Counts how many of `names` would be GENUINELY NEW prompts — a name is free only if it is
       * neither already present in the project NOR a repeat earlier in the same list. This is the
       * dedupe-aware quota unit both v3 create routes meter on (a dedupe hit costs no quota), so it
       * matches `createManyWithMetadata`'s own in-store + in-batch dedupe. Extracted here so
       * the two create handlers (`aio/prompts.js`, `aio/prompts/tagged.js`) — and any future create
       * route — share ONE counter rather than each re-deriving the name-scan, which could drift
       * apart from the real dedupe (MysticatBot review, LLMO-6288 rework).
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<string>} names the requested prompt names, in request order
       * @returns {number}
       */
      countNewPrompts(scope, names) {
        const seen = new Set(store.list(collectionKey('prompts', scope)).map((p) => p.name));
        let count = 0;
        for (const name of names) {
          if (!seen.has(name)) {
            seen.add(name);
            count += 1;
          }
        }
        return count;
      },
      /**
       * The v3 CREATE contract (`aio-create-prompts` / `aio-create-tagged-prompts`, LLMO-6288 WP2
       * rework — supersedes the ADR's dropped `*-with-metadata` PUT family this mock previously
       * modelled): each item is either a DEDUPE hit — an existing prompt already carries this exact
       * `name` (in the store, or earlier in this same batch) — or a genuinely new prompt.
       * - A dedupe hit PRESERVES the stored `metadata` (idempotent — live-documented: "Dedupe hits
       *   preserve the previously stored metadata and report is_new = false") and echoes back the
       *   EXISTING id + that stored metadata + `is_new: false`; the request's `metadata` is
       *   discarded. Its request `tags`, however, are UNIONED onto the existing prompt: prod
       *   attaches a create's tags to a dedupe hit (verified live, Rainer review), so "create with
       *   these tags" is idempotent for metadata but ADDITIVE for tags — a re-run import with new
       *   tags keeps piling them on, matching prod. The attachment is invisible in the response
       *   (the envelope carries no `tags` field) and shows only on a `by_tags` re-read.
       * - A new item is created with its supplied `tags` (already resolved by the caller — this
       *   function is tag-id-agnostic) and `metadata` (may be absent), `is_new: true`.
       * Response order mirrors the request 1:1 — one result PER INPUT ITEM, not just the
       * newly-created subset (the delivered swagger: "Response returns per-item {id, name,
       * is_new, metadata}"). ATOMIC on the metadata CHECK ({@link hasOversizedAuthor} +
       * {@link hasUnknownMetadataKey}): if the caller did not already gate on it, this re-checks
       * both the author-length and closed-key-set clauses and refuses to write anything.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<{ name: string, metadata?: unknown,
       *   tags?: Array<{id: string, name: string}> }>} items
       * @returns {{ ok: true, results: Array<{ id: string, name: string, is_new: boolean,
       *   metadata: unknown }>, existingCount: number } | { ok: false }}
       */
      createManyWithMetadata(scope, items) {
        if (items.some((item) => violatesAuthorLengthCheck(item.metadata)
          || violatesClosedKeySet(item.metadata))) {
          return { ok: false };
        }
        const key = collectionKey('prompts', scope);
        const byName = new Map(store.list(key).map((p) => [p.name, p]));
        /** @type {Array<{ id: string, name: string, is_new: boolean, metadata: unknown }>} */
        const results = [];
        let existingCount = 0;
        for (const item of items) {
          const existing = byName.get(item.name);
          if (existing) {
            existingCount += 1;
            // Attach the request's tags to the dedupe hit (union by id — prod is additive for tags
            // on a dedupe hit), leaving the stored metadata untouched (dedupe is idempotent for
            // metadata). `byName` is refreshed so a later in-batch repeat of this name unions onto
            // the just-updated tags too.
            const mergedTags = unionTagsById(existing.tags, item.tags);
            const grew = mergedTags.length
              !== (Array.isArray(existing.tags) ? existing.tags.length : 0);
            const stored = grew
              ? /** @type {Entity} */ (store.update(key, existing.id, { tags: mergedTags }))
              : existing;
            byName.set(String(existing.name), stored);
            results.push({
              id: existing.id,
              name: String(existing.name),
              is_new: false,
              metadata: existing.metadata,
            });
          } else {
            const created = store.create(key, {
              name: item.name,
              is_new: true,
              tags: item.tags ?? [],
              metadata: item.metadata,
            });
            // Guards against a repeated name WITHIN this same batch (mirrors the v2 create paths'
            // in-batch dedupe): the second occurrence sees this fresh entity as "existing" too.
            byName.set(created.name, created);
            results.push({
              id: created.id, name: String(created.name), is_new: true, metadata: created.metadata,
            });
          }
        }
        return { ok: true, results, existingCount };
      },
      /**
       * The v3 combined PATCH (`aio-patch-prompt`, LLMO-6288 WP2 rework) — `name` and/or
       * `metadata`, at least one required (the schema marks neither required, so the "≥1" rule is
       * enforced here, not by request validation). `metadata: null` WIPES the whole block
       * (collapses to `undefined`, the mock's "no metadata" state); a `metadata` OBJECT is an
       * RFC 7396 merge via {@link mergeMetadataPatch} (absent key = keep, string = set, explicit
       * null = delete); an ABSENT `metadata` key leaves it untouched. `name` may not be `null` —
       * the spec keeps it a plain, non-nullable string, so that case 400s at REQUEST VALIDATION
       * before this ever runs. A `name` equal to a SIBLING prompt's exact text conflicts (409),
       * same rule as the dedicated `/rename` endpoint; nothing is mutated. A metadata patch that
       * violates the CHECK 400s, nothing mutated. The 400 causes are reported as DISTINCT statuses
       * — `empty-request` (neither field), `check-violation` (an over-length `created_by`/
       * `updated_by`), and `unknown-key` (a metadata key outside the closed four) — rather than a
       * single `bad-request` (MysticatBot/Rainer review, LLMO-6288 rework), so a caller who
       * supplied a well-formed-but-rejected metadata patch is never told "request must include one
       * of name or metadata". Both `check-violation` and `unknown-key` are clauses of the same live
       * CHECK and both 400.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {string} id
       * @param {{ name?: string, metadata?: unknown }} patch `metadata: null` wipes;
       *   `metadata: {...}` merges; an absent key of either leaves it untouched
       * @returns {{ status: 'ok', entity: Entity }
       *   | { status: 'not-found' | 'conflict' | 'empty-request' | 'unknown-key' }
       *   | { status: 'check-violation', field: string }}
       *   `check-violation` carries the offending author `field` so the handler can build prod's
       *   `<field>: exceeds 100 characters` message.
       */
      patchOne(scope, id, { name, metadata } = {}) {
        const hasName = name !== undefined;
        const hasMetadata = metadata !== undefined;
        if (!hasName && !hasMetadata) {
          return { status: 'empty-request' };
        }
        const key = collectionKey('prompts', scope);
        const current = store.get(key, id);
        if (!current) {
          return { status: 'not-found' };
        }
        if (hasName && store.list(key).some((p) => p.id !== id && p.name === name)) {
          return { status: 'conflict' };
        }
        let nextMetadata = current.metadata;
        if (hasMetadata) {
          if (metadata === null) {
            nextMetadata = undefined;
          } else {
            if (violatesClosedKeySet(metadata)) {
              return { status: 'unknown-key' };
            }
            const over = oversizedAuthorField(metadata);
            if (over) {
              return { status: 'check-violation', field: over };
            }
            nextMetadata = mergeMetadataPatch(
              /** @type {Record<string, unknown> | undefined} */ (current.metadata),
              /** @type {Record<string, unknown>} */ (metadata),
            );
          }
        }
        /** @type {Record<string, unknown>} */
        const write = { metadata: nextMetadata };
        if (hasName) {
          write.name = name;
        }
        const updated = store.update(key, id, write);
        return { status: 'ok', entity: /** @type {Entity} */ (updated) };
      },
      /**
       * The v3 BATCH metadata PATCH (`aio-patch-prompts-metadata-batch`, LLMO-6288 WP2 rework) —
       * `{ id, metadata }` per item, run as ONE transaction: an unknown `id`, or any item's
       * `metadata` violating the CHECK (an over-length author, or a key outside the closed four),
       * aborts the WHOLE batch (`not-found` / `check-violation` / `unknown-key` respectively) with
       * NOTHING written — the delivered contract's "a CHECK-constraint violation on any item rolls
       * the batch back". Every item is resolved AND validated before any merge is applied. The
       * `check-violation` and `unknown-key` statuses are the SAME ones {@link patchOne} returns for
       * the identical conditions, so the two metadata-write ops share one internal status
       * vocabulary (MysticatBot/Rainer review, LLMO-6288 rework) — a future handler dispatching on
       * status can't hit a `bad-request` vs `check-violation` split for what is one CHECK.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<{ id: string, metadata: unknown }>} items
       * @returns {{ status: 'ok' }
       *   | { status: 'not-found' | 'unknown-key' }
       *   | { status: 'check-violation', field: string }}
       */
      patchMetadataBatch(scope, items) {
        const key = collectionKey('prompts', scope);
        /** @type {Array<{ id: string, current: Entity, metadata: unknown }>} */
        const resolved = [];
        for (const { id, metadata } of items) {
          const current = store.get(key, id);
          if (!current) {
            return { status: 'not-found' };
          }
          resolved.push({ id, current, metadata });
        }
        if (resolved.some(({ metadata }) => violatesClosedKeySet(metadata))) {
          return { status: 'unknown-key' };
        }
        for (const { metadata } of resolved) {
          const over = oversizedAuthorField(metadata);
          if (over) {
            return { status: 'check-violation', field: over };
          }
        }
        for (const { id, current, metadata } of resolved) {
          store.update(key, id, {
            metadata: mergeMetadataPatch(
              /** @type {Record<string, unknown> | undefined} */ (current.metadata),
              /** @type {Record<string, unknown>} */ (metadata),
            ),
          });
        }
        return { status: 'ok' };
      },
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<string>} ids
       * @returns {number}
       */
      removeMany(scope, ids) {
        const key = collectionKey('prompts', scope);
        return ids.reduce((removed, id) => (store.delete(key, id) ? removed + 1 : removed), 0);
      },
    },

    benchmarks: {
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @returns {Entity[]}
       */
      list(scope) {
        return store.list(collectionKey('benchmarks', scope));
      },
      /**
       * Creates one benchmark per supplied entry, returning all created entities (so the caller
       * can surface their ids). The own/main-brand benchmark is system-managed, so created
       * benchmarks are always competitor (`main_brand: false`) — matching the live create API.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<Partial<Entity> & Record<string, unknown>>} benchmarks
       * @returns {Entity[]}
       */
      createMany(scope, benchmarks) {
        const key = collectionKey('benchmarks', scope);
        return benchmarks.map((b) => store.create(key, b));
      },
      /**
       * Updates one benchmark in place, returning the updated entity or undefined if unknown.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {string} id
       * @param {Record<string, unknown>} patch
       * @returns {Entity | undefined}
       */
      update(scope, id, patch) {
        return store.update(collectionKey('benchmarks', scope), id, patch);
      },
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<string>} ids
       * @returns {number}
       */
      removeMany(scope, ids) {
        const key = collectionKey('benchmarks', scope);
        return ids.reduce((removed, id) => (store.delete(key, id) ? removed + 1 : removed), 0);
      },
    },

    tags: {
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @returns {Entity[]}
       */
      list(scope) {
        return store.list(collectionKey('tags', scope));
      },
      /**
       * Resolve-before-create for a batch of project tags — the discipline live REQUIRES of every
       * consumer (gate 7, verified 2026-07-02): the `POST /aio/tags` endpoint does NOT dedupe, so
       * creating a tag whose NAME already exists at the same parent is a same-name/same-parent
       * COLLISION that live answers with a hard 500. This models it: it resolves each requested tag
       * (by its deterministic id) against the stored collection and, if any id is already taken —
       * or repeats within the batch — the batch is rejected ATOMICALLY (`collision: true`, nothing
       * written) so the caller can 500. On no collision every tag is persisted.
       *
       * The id is derived from the tag's `(parent, name)` pair (see tag-id.js), so an id clash IS a
       * same-name/same-parent clash: the same name under a DIFFERENT parent derives a different id
       * and is created normally, which is what live does and what the dimension-root model needs
       * (two sub-categories may share a bare name under different categories).
       *
       * One deliberate, LOUD divergence: `PATCH` keeps a tag's id stable across a rename or a
       * re-parent, after which the stored id no longer equals `tagId(name, parent)`. Re-creating
       * the tag's ORIGINAL `(parent, name)` then derives an id already occupied by the moved tag,
       * and this reports a collision where live would mint a fresh opaque id and return 201.
       * The mock cannot represent two tags at one derived id; failing loudly beats silently handing
       * the caller back a tag that now lives somewhere else in the tree.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<Entity>} tags each carrying its deterministic `id` (+ optional `parent_id`)
       * @returns {{ tags: Entity[], collision: boolean }} `collision: true` ⇒ nothing was written
       */
      upsertMany(scope, tags) {
        const key = collectionKey('tags', scope);
        // Atomic pre-check: an id already in the store, or repeated inside this batch, is a
        // collision. Checked before any write, so a collision leaves the store untouched.
        const seen = new Set();
        for (const tag of tags) {
          if (seen.has(tag.id) || store.get(key, tag.id)) {
            return { tags: [], collision: true };
          }
          seen.add(tag.id);
        }
        const stored = tags.map((tag) => store.create(key, tag));
        return { tags: stored, collision: false };
      },
      /**
       * Re-parents / renames one tag in place (the `PATCH /aio/tags/{tag_id}` — `aio-update-tag`
       * surface), returning the updated entity or undefined if the id is unknown. The id stays
       * stable (Semrush tag ids are opaque; only `name`/`parent_id` change). Promoting a child to a
       * root is expressed by patching `parent_id` to `''` (the read path treats a falsy `parent_id`
       * as a root); `children_count`/`path` are never stored, so they are not part of the patch.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {string} id
       * @param {Record<string, unknown>} patch
       * @returns {Entity | undefined}
       */
      update(scope, id, patch) {
        return store.update(collectionKey('tags', scope), id, patch);
      },
      /**
       * Removes the given tag ids from the project's tag collection, reporting how many standalone
       * tags were actually removed, and DETACHES each removed id from every prompt that carries it.
       *
       * The detach is not a courtesy — it is the live contract (gate 4, verified 2026-07-02):
       * deleting a tag detaches it from every carrying prompt, and a prompt whose only tag was
       * deleted becomes fully unassigned rather than orphaned or silently still matchable through
       * `by_tags`. A mock that left the tag embedded on the prompt would keep answering `by_tags`
       * queries for an id that no longer exists, hiding exactly the class of bug consumers must
       * handle.
       *
       * The returned count reports the STANDALONE tags removed, not prompts touched: an id that
       * names no stored tag still detaches from any prompt carrying it, and does not count.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<string>} ids
       * @returns {number}
       */
      removeMany(scope, ids) {
        const key = collectionKey('tags', scope);
        const removed = ids.reduce((n, id) => (store.delete(key, id) ? n + 1 : n), 0);

        const doomed = new Set(ids.map((id) => String(id)));
        const promptsKey = collectionKey('prompts', scope);
        for (const prompt of store.list(promptsKey)) {
          const tags = Array.isArray(prompt.tags) ? prompt.tags : [];
          const kept = tags.filter((t) => !doomed.has(String(t?.id)));
          if (kept.length !== tags.length) {
            store.update(promptsKey, prompt.id, { tags: kept });
          }
        }
        return removed;
      },
    },

    brand_urls: {
      /**
       * @param {{ workspaceId: string | number, projectId: string | number,
       *   benchmarkId: string | number }} scope
       * @returns {Entity[]}
       */
      list(scope) {
        return store.list(collectionKey('brand_urls', scope));
      },
      /**
       * Creates one brand URL per supplied entry, returning all created entities.
       * @param {{ workspaceId: string | number, projectId: string | number,
       *   benchmarkId: string | number }} scope
       * @param {Array<Partial<Entity> & Record<string, unknown>>} urls
       * @returns {Entity[]}
       */
      createMany(scope, urls) {
        const key = collectionKey('brand_urls', scope);
        return urls.map((u) => store.create(key, u));
      },
      /**
       * @param {{ workspaceId: string | number, projectId: string | number,
       *   benchmarkId: string | number }} scope
       * @param {Array<string>} ids
       * @returns {number}
       */
      removeMany(scope, ids) {
        const key = collectionKey('brand_urls', scope);
        return ids.reduce((removed, id) => (store.delete(key, id) ? removed + 1 : removed), 0);
      },
    },
  };
}
