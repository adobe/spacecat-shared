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
 * - `sortDir` is descending only for the literal `'desc'` (case-insensitive); every other value,
 *   including absent and `'asc'`, is ascending.
 * - A prompt whose sort key is missing — `metadata` absent/`null`, or that specific timestamp unset
 *   — sorts LAST in BOTH directions. Missing values are the tail, never interleaved, so a project
 *   mixing stamped and unstamped prompts is deterministic regardless of direction.
 * - The sort is STABLE: ties on the compared value, and the all-missing tail, preserve input
 *   (store) order. `include_metadata` gating is orthogonal — it reads the STORED `metadata`, so
 *   sorting on a metadata field while the response omits the `metadata` key is valid and never
 *   throws (the handler sorts the prompt list, then maps to items).
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
  if (!SORTABLE_FIELDS.includes(/** @type {any} */ (field))) {
    return list;
  }

  const key = field.slice('metadata.'.length); // 'created_at' | 'updated_at'
  const descending = String(sortDir ?? '').toLowerCase() === 'desc';
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
