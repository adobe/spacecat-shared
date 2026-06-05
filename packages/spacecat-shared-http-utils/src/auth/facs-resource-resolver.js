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

import { extractParamNamesInOrder } from './route-utils.js';

/**
 * Inverts a per-product resource → [aliases] structure into a per-product
 * alias → resourceType lookup, done once at wrapper construction.
 *
 * Input shape (from `routeFacsCapabilities.PRODUCTS_FACS_RESOURCE_PARAM_ALIASES`):
 *
 * ```
 * {
 *   LLMO: { brand: ['brandId'] },
 *   ASO:  { },
 *   ACO:  { },
 * }
 * ```
 *
 * Returns a `Map<productCode, Map<alias, resourceType>>` keyed by UPPERCASE
 * product code (matching the `x-product` header's normalised form).
 *
 * Throws when an alias is declared twice under the SAME product
 * (`brand: ['brandId'], site: ['brandId']`) — that's a config typo. The same
 * alias appearing under different products is allowed (the whole point of
 * per-product scope is that different products may treat the same param
 * differently).
 *
 * @param {Object<string, Object<string, string[]>> | undefined} productsResourceParamAliases
 * @returns {Map<string, Map<string, string>>}
 */
export function buildAliasLookupsPerProduct(productsResourceParamAliases) {
  const perProduct = new Map();
  if (!productsResourceParamAliases) {
    return perProduct;
  }
  for (const [product, resourceMap] of Object.entries(productsResourceParamAliases)) {
    const lookup = new Map();
    for (const [resourceType, aliases] of Object.entries(resourceMap || {})) {
      for (const alias of aliases || []) {
        if (lookup.has(alias)) {
          throw new Error(
            `facsWrapper: alias '${alias}' is declared under multiple resources `
            + `for product '${product}' ('${lookup.get(alias)}' and '${resourceType}')`,
          );
        }
        lookup.set(alias, resourceType);
      }
    }
    perProduct.set(product.toUpperCase(), lookup);
  }
  return perProduct;
}

/**
 * Resolves the ReBAC resource a request is about, so `facsWrapper` Phase 2
 * can look up the state-layer mapping.
 *
 * Resolution order:
 *  1. **LIFO over URL params** — the rightmost ReBAC-relevant route param
 *     wins. For `/v2/orgs/:spaceCatId/brands/:brandId/prompts/:promptId`,
 *     `promptId` is non-resource → falls back to `brandId` (the next param
 *     to its left that IS in the alias lookup for this product).
 *  2. **Body / query fallback** — only when the route declares **zero** URL
 *     params at all. Routes that carry any path param (ReBAC-relevant or not)
 *     never consult body or query. This matches the stricter anti-spoofing
 *     precondition used by `readOnlyAdminWrapper`: the presence of any
 *     URL-bound identity in the path establishes the resource boundary,
 *     and reading a sibling resource id from the body would re-open the
 *     spoofing surface the URL was meant to close. The body is tried first;
 *     the query string is consulted only when the body carries no matching
 *     alias (matches the `/state/access-mappings` URL grammar, which carries
 *     the resource in body on writes and in query on listings).
 *
 * Returns `null` when:
 *  - the product has no ReBAC scope (no entry in `aliasLookupsPerProduct`,
 *    or empty alias lookup) — Phase 1 JWT check is sufficient,
 *  - the route is not resource-scoped (listing endpoints, global queries,
 *    management CRUD without a body resource id).
 *
 * `facsWrapper` interprets `null` as "skip the state-layer check".
 *
 * @param {Object} args
 * @param {string} args.productCode - Upper-cased product code (e.g. `'LLMO'`).
 * @param {string} args.routePattern - Matched route pattern,
 *   e.g. `'PATCH /sites/:siteId/llmo/config'`.
 * @param {Object<string, string>} [args.params] - Extracted URL params.
 * @param {Object} [args.body] - Parsed request body, if any.
 * @param {Object<string, string>} [args.query] - Parsed query-string params,
 *   if any. Used as a final fallback when the route declares no URL params
 *   and the body carries no matching alias.
 * @param {Map<string, Map<string, string>>} args.aliasLookupsPerProduct
 * @returns {{ resourceType: string, resourceId: string,
 *             source: 'param' | 'body' | 'query' } | null}
 */
export function resolveFacsResource({
  productCode,
  routePattern,
  params,
  body,
  query,
  aliasLookupsPerProduct,
}) {
  if (!productCode || !routePattern || !aliasLookupsPerProduct) {
    return null;
  }
  const aliasLookup = aliasLookupsPerProduct.get(productCode);
  if (!aliasLookup || aliasLookup.size === 0) {
    return null;
  }

  // (1) LIFO scan over URL params declared by the route.
  const routeParams = extractParamNamesInOrder(routePattern);
  for (let i = routeParams.length - 1; i >= 0; i -= 1) {
    const name = routeParams[i];
    const resourceType = aliasLookup.get(name);
    if (resourceType) {
      const value = params?.[name];
      if (value) {
        return { resourceType, resourceId: String(value), source: 'param' };
      }
    }
  }

  // (2) Body fallback — only when the route declares NO URL params at all.
  // Matches the anti-spoofing precondition used by readOnlyAdminWrapper:
  // a route with any path params, ReBAC-relevant or not, must NOT read a
  // resource id from the body.
  if (routeParams.length > 0) {
    return null;
  }

  if (body && typeof body === 'object') {
    for (const [alias, resourceType] of aliasLookup) {
      const value = body[alias];
      if (value) {
        return { resourceType, resourceId: String(value), source: 'body' };
      }
    }
  }

  // (3) Query fallback — same anti-spoofing precondition (no URL params on the
  // route). Used by listing endpoints under the `/state/access-mappings` URL
  // grammar, which carries the scoping resource id in the query string.
  if (query && typeof query === 'object') {
    for (const [alias, resourceType] of aliasLookup) {
      const value = query[alias];
      if (value) {
        return { resourceType, resourceId: String(value), source: 'query' };
      }
    }
  }

  return null;
}
