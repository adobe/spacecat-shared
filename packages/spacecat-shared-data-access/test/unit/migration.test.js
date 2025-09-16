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

/* eslint-env mocha */
/* eslint-disable no-await-in-loop, no-continue */

import TierClient from '@adobe/spacecat-shared-tier-client';

import { createDataAccess } from '../../src/service/index.js';

describe.skip('ASO Migration Script', () => {
  it('should migrate the ASO data', async (done) => {
    const { DYNAMO_TABLE_NAME_DATA } = process.env;
    const productCode = 'ASO';

    const context = {
      log: {
        info: () => {},
        error: () => {},
        debug: () => {},
        warn: () => {},
      },
    };

    context.dataAccess = createDataAccess({
      tableNameData: DYNAMO_TABLE_NAME_DATA,
    }, context.log);

    const { Organization, Site } = context.dataAccess;

    const LLMO_ONLY_ORG_IDS = [];
    const ASO_ORG_IDS_PAID_TIER = [];

    // Get all orgs and filter out the LLMO only orgs
    const orgs = (await Organization.all())
      .filter((org) => !LLMO_ONLY_ORG_IDS.includes(org.getId()));

    for (const org of orgs) {
      const sites = await Site.allByOrganizationId(org.getId());

      console.log(`ORG ${org.getName()} (${org.getId()}) with ${sites.length} sites`);
      for (const site of sites) {
        console.log(`  SITE ${site.getBaseURL()} (${site.getId()})`);

        const tierClient = await TierClient.createForSite(context, site, productCode);
        const result = await tierClient.checkValidEntitlement();
        console.log('    has entitlement?', result.entitlement ? 'yes' : 'no');
        console.log('    has site enrollment?', result.siteEnrollment ? 'yes' : 'no');
        if (result.entitlement && result.siteEnrollment) {
          continue;
        }
        const isPaidTier = ASO_ORG_IDS_PAID_TIER.includes(org.getId());
        await tierClient.createEntitlement(isPaidTier ? 'PAID' : 'FREE_TRIAL');
        console.log('    created entitlement', isPaidTier ? 'PAID' : 'FREE_TRIAL');
      }
    }

    done();
  }).timeout(1000000);
});
