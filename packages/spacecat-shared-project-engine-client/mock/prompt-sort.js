/*
 * Copyright 2026 Adobe. All rights reserved.
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

/** The recognised `sort_field` values — the authorship timestamps the consumer sorts on. */
export const SORTABLE_FIELDS = /** @type {const} */ (['metadata.created_at', 'metadata.updated_at']);

/**
 * The `by_tags` prompt-list ordering the live Semrush Project Engine performs — the single source
 * of truth behind the `.../aio/prompts/by_tags.js` handler, exposed on the per-request context as
 * `context.sortPromptsByMetadata` (every route reads its lib helpers through `$.context`, never an
 * import — see {@link Context}). Kept a pure function so it is unit-tested on its own (the route
 * handler is coverage-excluded), the same convention as {@link resolveUrl} / `tagId` (LLMO-6666).
 *
 * Wire contract (verified live 2026-07-29 against LLMO-Dev-2, Brand-A, project `997e17c3`):
 * - The sort keys are the request-body fields `sort_field` and `sort_dir` of
 *   `model.AIOPromptsListRequest`. The authorship surface sorts on `metadata.created_at` and
 *   `metadata.updated_at`; those are the only recognised `sort_field` values.
 * - `sort` / `order` are NOT the wire keys — the live API silently ignores them and returns default
 *   (store) order with a 200. The handler only ever passes `sort_field` / `sort_dir` here, so a
 *   caller that sends the wrong keys lands on the `sortField`-unrecognised branch below and gets
 *   store order — which is exactly what makes the two request shapes distinguishable now (the whole
 *   point of LLMO-6666; before this, every ordering assertion was vacuous).
 *
 * Semantics (defined here, deterministically, so the api-service assertion in LLMO-6667 can pin
 * them):
 * - An unrecognised `sortField` (including the wrong `sort` key, an empty value, or a non-metadata
 *   field) returns the input order unchanged — a 200 in default order, so the mock never becomes
 *   stricter than prod.
 * - `sortDir` is ascending only for the literal `'asc'` (case-insensitive); every other value —
 *   absent, `'desc'`, or unrecognised — is descending, matching live's omitted-`sort_dir` default.
 * - A prompt whose sort key is missing — `metadata` absent/`null`, or that specific timestamp unset
 *   — sorts LAST in BOTH directions. Missing values are the tail, never interleaved, so a project
 *   mixing stamped and unstamped prompts is deterministic regardless of direction.
 * - The sort is STABLE: ties on the compared value, and the all-missing tail, preserve input
 *   (store) order. `include_metadata` gating is orthogonal — it reads the STORED `metadata`, so
 *   sorting on a metadata field while the response omits the `metadata` key is valid and never
 *   throws (the handler sorts the prompt list, then maps to items).
 *
 * Provenance of the two edge behaviors (LLMO-6666):
 * - Default direction (absent `sort_dir`) = descending is LIVE-VERIFIED (2026-08-04, prod Lovesac
 *   `2840/en`): a read with `sort_field` and no `sort_dir` returned the exact same order as an
 *   explicit `sort_dir=desc`. This originally defaulted to ascending and was corrected here.
 * - Missing-key position = LAST-in-both-directions is still mock-DEFINED, not live-verified: the
 *   fleet is fully stamped post-backfill, so no null-metadata prompt exists to observe live. It
 *   matches the spec's "NULLS LAST" (§16 gate G5); confirm against Semrush's `ORDER BY … NULLS`
 *   semantics before treating it as a prod-faithfulness guarantee. Tracked on LLMO-6666.
 *
 * Values are compared with `<` / `>`; the timestamps are ISO-8601 strings, which order correctly
 * lexicographically. No dependency on their being parseable dates — an opaque interim value still
 * orders consistently with itself.
 *
 * @template {{ metadata?: Record<string, unknown> | null }} T
 * @param {readonly T[]} prompts the filtered prompt list (store order)
 * @param {{ sortField?: unknown, sortDir?: unknown }} [sort] the request-body `sort_field` /
 *   `sort_dir`, verbatim
 * @returns {T[]} a new array in the requested order; the input order when `sortField` is not a
 *   recognised metadata sort key
 */
export const sortPromptsByMetadata = (prompts, { sortField, sortDir } = {}) => {
  const list = Array.isArray(prompts) ? [...prompts] : [];
  const field = typeof sortField === 'string' ? sortField : '';
  // Cast unavoidable: a `readonly` tuple's `.includes()` narrows its arg to the tuple's literal
  // union, so tsc rejects an arbitrary `string`. Widening `field` to `any` is the standard
  // membership-test escape; the runtime check is exactly what narrows it back to a valid field.
  if (!SORTABLE_FIELDS.includes(/** @type {any} */ (field))) {
    return list;
  }

  const key = field.slice('metadata.'.length); // 'created_at' | 'updated_at'
  // Ascending ONLY for the literal `'asc'`; absent / `'desc'` / unrecognised is descending. Only
  // the OMITTED default is live-verified (2026-08-04, below); grouping an unrecognised value with
  // it is a mock choice, not verified — but unreachable end-to-end: the api-service controller
  // allow-lists `order` to asc/desc, so a bad value 400s before it reaches the mock.
  const descending = String(sortDir ?? '').toLowerCase() !== 'asc';
  /** @param {T} prompt @returns {any} the sort-key value, or `undefined` when absent/null */
  const valueOf = (prompt) => {
    const value = prompt?.metadata?.[key];
    return value === undefined || value === null ? undefined : value;
  };

  // Decorate with the original index so ties and the missing-value tail keep store order (a stable
  // sort — Array.prototype.sort is not guaranteed stable across every runtime for this shape, so it
  // is made explicit rather than assumed).
  return list
    .map((prompt, index) => ({ prompt, index }))
    .sort((a, b) => {
      const av = valueOf(a.prompt);
      const bv = valueOf(b.prompt);
      // A missing sort key sorts last in BOTH directions; all-missing and ties fall through to the
      // stable store-order tiebreak below.
      if (av === undefined && bv === undefined) {
        return a.index - b.index;
      }
      if (av === undefined) {
        return 1;
      }
      if (bv === undefined) {
        return -1;
      }
      if (av < bv) {
        return descending ? 1 : -1;
      }
      if (av > bv) {
        return descending ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map((decorated) => decorated.prompt);
};
