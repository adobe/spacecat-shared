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

import { expect } from 'chai';

import {
  buildAliasLookupsPerProduct,
  resolveFacsResource,
} from '../../src/auth/facs-resource-resolver.js';

describe('buildAliasLookupsPerProduct', () => {
  it('returns an empty Map for undefined / null input', () => {
    expect(buildAliasLookupsPerProduct(undefined).size).to.equal(0);
    expect(buildAliasLookupsPerProduct(null).size).to.equal(0);
  });

  it('inverts the resource → [aliases] structure per product, upper-casing keys', () => {
    const lookups = buildAliasLookupsPerProduct({
      LLMO: { brand: ['brandId'] },
      aso: { site: ['siteId'] }, // lowercased input
    });
    expect([...lookups.keys()]).to.deep.equal(['LLMO', 'ASO']);
    expect(lookups.get('LLMO').get('brandId')).to.equal('brand');
    expect(lookups.get('ASO').get('siteId')).to.equal('site');
  });

  it('tolerates empty / undefined inner resource maps', () => {
    const lookups = buildAliasLookupsPerProduct({
      LLMO: { brand: ['brandId'] },
      ASO: {},
      ACO: undefined,
    });
    expect(lookups.get('ASO').size).to.equal(0);
    expect(lookups.get('ACO').size).to.equal(0);
  });

  it('tolerates undefined / null alias lists under a resource', () => {
    const lookups = buildAliasLookupsPerProduct({
      LLMO: { brand: undefined, site: null },
    });
    expect(lookups.get('LLMO').size).to.equal(0);
  });

  it('throws when an alias is declared under two resources for the same product', () => {
    expect(() => buildAliasLookupsPerProduct({
      LLMO: { brand: ['brandId'], site: ['brandId'] },
    })).to.throw(/declared under multiple resources for product 'LLMO'/);
  });

  it('allows the same alias under different products (per-product scope is the point)', () => {
    expect(() => buildAliasLookupsPerProduct({
      LLMO: { brand: ['brandId'] },
      ASO: { brand: ['brandId'] },
    })).to.not.throw();
  });
});

describe('resolveFacsResource', () => {
  const aliasLookupsPerProduct = buildAliasLookupsPerProduct({
    LLMO: { brand: ['brandId'] },
    ASO: {},
  });

  it('returns null when productCode is missing', () => {
    expect(resolveFacsResource({
      productCode: undefined,
      routePattern: 'GET /v2/orgs/:spaceCatId/brands/:brandId',
      params: { brandId: 'b1' },
      aliasLookupsPerProduct,
    })).to.equal(null);
  });

  it('returns null when routePattern is missing', () => {
    expect(resolveFacsResource({
      productCode: 'LLMO',
      routePattern: undefined,
      params: { brandId: 'b1' },
      aliasLookupsPerProduct,
    })).to.equal(null);
  });

  it('returns null when aliasLookupsPerProduct is missing', () => {
    expect(resolveFacsResource({
      productCode: 'LLMO',
      routePattern: 'GET /v2/orgs/:spaceCatId/brands/:brandId',
      params: { brandId: 'b1' },
      aliasLookupsPerProduct: undefined,
    })).to.equal(null);
  });

  it('returns null when the product has no ReBAC scope', () => {
    // ASO has an empty resource map; treated as "not enrolled" by the resolver.
    expect(resolveFacsResource({
      productCode: 'ASO',
      routePattern: 'GET /sites/:siteId',
      params: { siteId: 's1' },
      aliasLookupsPerProduct,
    })).to.equal(null);
  });

  it('returns null when the product is not in the lookup map at all', () => {
    expect(resolveFacsResource({
      productCode: 'ACO',
      routePattern: 'GET /sites/:siteId',
      params: { siteId: 's1' },
      aliasLookupsPerProduct,
    })).to.equal(null);
  });

  it('resolves the LIFO-rightmost ReBAC-relevant URL param', () => {
    // brandId is at index 1 (rightmost ReBAC param); promptId is non-resource for LLMO.
    const result = resolveFacsResource({
      productCode: 'LLMO',
      routePattern: 'GET /v2/orgs/:spaceCatId/brands/:brandId/prompts/:promptId',
      params: { spaceCatId: 'o1', brandId: 'b1', promptId: 'p1' },
      aliasLookupsPerProduct,
    });
    expect(result).to.deep.equal({
      resourceType: 'brand',
      resourceId: 'b1',
      source: 'param',
    });
  });

  it('skips URL params that are not ReBAC-relevant for this product', () => {
    // promptId is not in the LLMO alias lookup → skipped.
    // spaceCatId is not in the lookup either → no resource resolved.
    const result = resolveFacsResource({
      productCode: 'LLMO',
      routePattern: 'GET /v2/orgs/:spaceCatId/prompts/:promptId',
      params: { spaceCatId: 'o1', promptId: 'p1' },
      aliasLookupsPerProduct,
    });
    expect(result).to.equal(null);
  });

  it('returns null when a ReBAC-relevant param is declared but missing in params object', () => {
    // brandId is in the route pattern but undefined at runtime — return null
    // rather than picking up a non-resource param to its left.
    const result = resolveFacsResource({
      productCode: 'LLMO',
      routePattern: 'GET /v2/orgs/:spaceCatId/brands/:brandId',
      params: { spaceCatId: 'o1' /* no brandId */ },
      aliasLookupsPerProduct,
    });
    expect(result).to.equal(null);
  });

  it('coerces non-string resourceId values via String()', () => {
    const result = resolveFacsResource({
      productCode: 'LLMO',
      routePattern: 'GET /brands/:brandId',
      params: { brandId: 42 },
      aliasLookupsPerProduct,
    });
    expect(result.resourceId).to.equal('42');
  });

  describe('body fallback', () => {
    it('reads from body when the route has zero ReBAC params in the URL', () => {
      const result = resolveFacsResource({
        productCode: 'LLMO',
        routePattern: 'POST /v2/orgs/:spaceCatId/brands',
        params: { spaceCatId: 'o1' },
        body: { brandId: 'b-from-body' },
        aliasLookupsPerProduct,
      });
      expect(result).to.deep.equal({
        resourceType: 'brand',
        resourceId: 'b-from-body',
        source: 'body',
      });
    });

    it('does NOT fall back to body when the URL declares a ReBAC param (even if absent)', () => {
      // Routes with a ReBAC URL param never consult the body — prevents
      // body-based spoofing.
      const result = resolveFacsResource({
        productCode: 'LLMO',
        routePattern: 'GET /brands/:brandId',
        params: { /* brandId missing */ },
        body: { brandId: 'b-from-body' },
        aliasLookupsPerProduct,
      });
      expect(result).to.equal(null);
    });

    it('handles non-object bodies without crashing', () => {
      const result = resolveFacsResource({
        productCode: 'LLMO',
        routePattern: 'POST /something',
        params: {},
        body: 'not-an-object',
        aliasLookupsPerProduct,
      });
      expect(result).to.equal(null);
    });

    it('returns null when body has no resource-aliased fields', () => {
      const result = resolveFacsResource({
        productCode: 'LLMO',
        routePattern: 'POST /something',
        params: {},
        body: { name: 'foo' },
        aliasLookupsPerProduct,
      });
      expect(result).to.equal(null);
    });
  });
});
