/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { Response } from '@adobe/fetch';

export declare function createResponse(body: object, status?: number, headers?: object): Response;

export declare function ok(body?: string, headers?: object): Response;

export declare function created(body: object, headers?: object): Response;

export declare function accepted(body: object, headers?: object): Response;

export declare function noContent(headers?: object): Response;

export declare function badRequest(message?: string, headers?: object): Response;

export declare function notFound(message?: string, headers?: object): Response;

export declare function methodNotAllowed(message?: string, headers?: object): Response;

export declare function internalServerError(message?: string, headers?: object): Response;

export declare function found(location: string): Response;

export declare function unauthorized(message?: string, headers?: object): Response;

export declare function forbidden(message?: string, headers?: object): Response;

/**
 * FACS route-capability configuration consumed by `facsWrapper`.
 *
 * - `PRODUCTS_ROUTES`: per-product map of `'METHOD /path'` → `'<product>/<capability>'`.
 * - `PRODUCTS_FACS_RESOURCE_PARAM_ALIASES`: per-product map of resource type →
 *   the route param/body/query aliases that carry that resource's id.
 * - `INTERNAL_ROUTES`: routes that bypass FACS entirely (internal / not customer-facing).
 * - `FACS_NON_RESOURCE_PARAMS`: param names that are not ReBAC resources.
 * - `FACS_ONBOARDED_PRODUCTS`: uppercase product codes with FACS enforcement live. A
 *   recognized product (one present in `PRODUCTS_ROUTES`) absent from this list bypasses
 *   the FACS layer; a missing/unrecognized `x-product` still fail-closes. Omit to make the
 *   product-onboarding gate inert (all recognized products treated as onboarded).
 */
export interface FacsRouteCapabilities {
  PRODUCTS_ROUTES: Record<string, Record<string, string>>;
  PRODUCTS_FACS_RESOURCE_PARAM_ALIASES?: Record<string, Record<string, string[]>>;
  INTERNAL_ROUTES?: string[];
  FACS_NON_RESOURCE_PARAMS?: string[];
  FACS_ONBOARDED_PRODUCTS?: string[];
  /**
   * Per-product SECONDARY resource param (opt-in). When no PRIMARY resource resolves
   * for a route, the wrapper falls back to the secondary param (identified by `aliases`)
   * and delegates the grant/deny decision to the registered resolver named by `resolver`
   * (see `secondaryResolvers` on `facsWrapper`). Used for cross-resource authorization
   * such as LLMO site routes decided against the site's brands.
   */
  PRODUCTS_FACS_SECONDARY_RESOURCE?: Record<
    string,
    { resourceType: string; aliases: string[]; resolver: string }
  >;
}

/**
 * A secondary-resource resolver registered by the consuming service and referenced by key
 * from `FacsRouteCapabilities.PRODUCTS_FACS_SECONDARY_RESOURCE[<product>].resolver`.
 * Returns `true` to grant, `false` to deny; a thrown error is treated as deny (fail-closed).
 */
export type FacsSecondaryResolver = (
  context: object,
  args: {
    resourceType: string;
    resourceId: string;
    capability: string;
    product: string;
    subjectId?: string;
    orgId?: string;
  },
) => Promise<boolean>;

/**
 * FACS authorization wrapper for the helix-shared-wrap `.with()` chain.
 * Enforces FACS permissions for external customer users per route, gated by a LaunchDarkly
 * feature flag. Internal identities and Adobe internal orgs always bypass.
 *
 * @param fn - The handler to wrap.
 * @param opts - Options containing the FACS route-capability configuration and, optionally,
 *   the secondary-resource resolvers referenced by `PRODUCTS_FACS_SECONDARY_RESOURCE`.
 * @returns A wrapped handler.
 */
export function facsWrapper(
  fn: (request: Request, context: object) => Promise<Response>,
  opts: {
    routeFacsCapabilities: FacsRouteCapabilities;
    secondaryResolvers?: Record<string, FacsSecondaryResolver>;
  },
): (request: Request, context: object) => Promise<Response>;

/**
 * Read-only admin authorization wrapper for the helix-shared-wrap `.with()` chain.
 * Blocks write operations for read-only admin users, gated by a LaunchDarkly feature flag.
 *
 * @param fn - The handler to wrap.
 * @param opts - Options containing a routeCapabilities map of route patterns to actions.
 * @returns A wrapped handler.
 */
export function readOnlyAdminWrapper(
  fn: Function,
  opts: { routeCapabilities: Record<string, string> },
): Function;

/**
 * Compression
 */
export interface CompressResponseOptions {
  minSize?: number;
  preference?: string[];
}

export declare function compressResponse(
  fn: (request: any, context: any) => Promise<Response>,
  opts?: CompressResponseOptions,
): (request: any, context: any) => Promise<Response>;

/**
 * Utility functions
 */
export function hashWithSHA256(input: string): string;
