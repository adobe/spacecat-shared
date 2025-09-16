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
  it('should migrate the ASO data', async () => {
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
    const ASO_IMS_ORGS_PAID_TIER = [
      '2C488785558BC9F67F000101@AdobeOrg',
      '14DFEF2E54411B460A4C98A6@AdobeOrg',
      '39BFB008560A6FB87F000101@AdobeOrg',
      '0A2D38B352782F1E0A490D4C@AdobeOrg',
      '2C940C0F53DB1E260A490D45@AdobeOrg',
      '0DCC245863D248FA0A495EBD@AdobeOrg',
      '969430F0543F253D0A4C98C6@AdobeOrg',
      '4B3021A168B055E70A495FC3@AdobeOrg',
      '1358406C534BC94D0A490D4D@AdobeOrg',
      'AB388C3E55F2BDE17F000101@AdobeOrg',
      '32523BB96217F7B60A495CB6@AdobeOrg',
      '8C6767C25245AD1A0A490D4C@AdobeOrg',
      'ADD71D3E633F65A90A495CE5@AdobeOrg',
    ];

    // Get all orgs and filter out the LLMO only orgs
    const orgs = (await Organization.all())
      .filter((org) => !LLMO_ONLY_ORG_IDS.includes(org.getId()));

    for (const org of orgs) {
      const sites = await Site.allByOrganizationId(org.getId());
      console.log(`ORG ${org.getName()} (${org.getId()}) with ${sites.length} sites`);

      const isPaidTier = ASO_IMS_ORGS_PAID_TIER.includes(org.getImsOrgId());
      console.log('  imsOrgId', org.getImsOrgId(), 'isPaidTier', isPaidTier ? 'PAID' : 'FREE_TRIAL');

      for (const site of sites) {
        console.log(`  SITE ${site.getBaseURL()} (${site.getId()})`);
        const tierClient = await TierClient.createForSite(context, site, productCode);
        const result = await tierClient.checkValidEntitlement();
        console.log('    has entitlement?', result.entitlement ? 'yes' : 'no');
        console.log('    has site enrollment?', result.siteEnrollment ? 'yes' : 'no');
        if (result.entitlement && result.siteEnrollment) {
          continue;
        }
        await tierClient.createEntitlement(isPaidTier ? 'PAID' : 'FREE_TRIAL');
        console.log('    created entitlement and site enrollment');
      }
    }
  }).timeout(1000000);
});
