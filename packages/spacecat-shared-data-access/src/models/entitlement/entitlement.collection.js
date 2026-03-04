/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import BaseCollection from '../base/base.collection.js';
import { DEFAULT_PAGE_SIZE } from '../../util/postgrest.utils.js';

/**
 * EntitlementCollection - A collection class responsible for managing Entitlement entities.
 * Extends the BaseCollection to provide specific methods for interacting with Entitlement records.
 *
 * @class EntitlementCollection
 * @extends BaseCollection
 */
class EntitlementCollection extends BaseCollection {
  static COLLECTION_NAME = 'EntitlementCollection';

  /**
   * Finds all entitlements for a given product code with their parent organization
   * data embedded via PostgREST resource embedding. This avoids N+1 queries when
   * you need both entitlement and organization data.
   *
   * @param {string} productCode - Product code to filter by (e.g., 'LLMO').
   * @returns {Promise<Array<{entitlement: object, organization: object}>>}
   */
  async allByProductCodeWithOrganization(productCode) {
    if (!productCode) {
      throw new Error('productCode is required');
    }

    const allResults = [];
    let offset = 0;
    let keepGoing = true;

    while (keepGoing) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await this.postgrestService
        .from('entitlements')
        .select('id, product_code, tier, organization_id, organizations!inner(id, name, ims_org_id)')
        .eq('product_code', productCode)
        .not('organizations.ims_org_id', 'is', null)
        .range(offset, offset + DEFAULT_PAGE_SIZE - 1);

      if (error) {
        this.log.error('[EntitlementCollection] Failed to query entitlements with organizations', error);
        throw new Error(`Failed to query entitlements with organizations: ${error.message}`);
      }

      if (!data || data.length === 0) {
        keepGoing = false;
      } else {
        allResults.push(...data);
        keepGoing = data.length >= DEFAULT_PAGE_SIZE;
        offset += DEFAULT_PAGE_SIZE;
      }
    }

    return allResults.map((row) => ({
      entitlement: {
        id: row.id,
        productCode: row.product_code,
        tier: row.tier,
      },
      organization: row.organizations ? {
        id: row.organizations.id,
        name: row.organizations.name,
        imsOrgId: row.organizations.ims_org_id,
      } : null,
    }));
  }
}

export default EntitlementCollection;
