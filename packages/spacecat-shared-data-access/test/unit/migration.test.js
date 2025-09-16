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
      '908936ED5D35CC220A495CD4@AdobeOrg',
      '86BD1D525E2224130A495CBB@AdobeOrg',
      '38931D6666E3ECDA0A495E80@AdobeOrg',
      '42A126776407096B0A495E50@AdobeOrg',
      'EE9332B3547CC74E0A4C98A1@AdobeOrg',
      '63C70EF1613FCF530A495EE2@AdobeOrg',
      '39BFB008560A6FB87F000101@AdobeOrg',
      'F8AB34FA53CE7E830A490D44@AdobeOrg',
      'C0BA356C5CF531FA0A495C43@AdobeOrg',
      'F489CFB4556ECF927F000101@AdobeOrg',
      'FD6415F354EEF3250A4C98A4@AdobeOrg',
      '79575F6258C1A2410A495D1A@AdobeOrg',
      '7EF5AE375630F4CD7F000101@AdobeOrg',
      'E6D328AE56CDAF037F000101@AdobeOrg',
      '812B47145DC5A2450A495C14@AdobeOrg',
      'C44A225E687684770A495CE7@AdobeOrg',
      '0A2D38B352782F1E0A490D4C@AdobeOrg',
      '021654A663AF3D5A0A495FD4@AdobeOrg',
      'FC533DBE5A312B660A495EC2@AdobeOrg',
      '0CEB60F754C7E06B0A4C98A2@AdobeOrg',
      'C2C7C77B56E2C5147F000101@AdobeOrg',
      'C8C1552962AB27F50A495FFD@AdobeOrg',
      'DD581E376703901E0A495FCA@AdobeOrg',
      '4F8A1ED764EFB4CB0A495C8E@AdobeOrg',
      '61F31DEE6516DB040A495FF5@AdobeOrg',
      '60B81EF86516D7410A495C57@AdobeOrg',
      '353078A25DA83E030A495C21@AdobeOrg',
      '0B96B03459707BE40A495C70@AdobeOrg',
      '6EF5A3F558F47EAC0A495D39@AdobeOrg',
      '2C940C0F53DB1E260A490D45@AdobeOrg',
      'E71EADC8584130D00A495EBD@AdobeOrg',
      '16BE1EDA6470A0D30A495FF2@AdobeOrg',
      '05791F3F677F1AE80A495CB0@AdobeOrg',
      'CC8B2205683E94010A495FD6@AdobeOrg',
      '0DCC245863D248FA0A495EBD@AdobeOrg',
      '969430F0543F253D0A4C98C6@AdobeOrg',
      '118765E655DEE7427F000101@AdobeOrg',
      '4B3021A168B055E70A495FC3@AdobeOrg',
      '0A47356C53E9D4D70A490D44@AdobeOrg',
      '1E22171B520E93BF0A490D44@AdobeOrg',
      '1358406C534BC94D0A490D4D@AdobeOrg',
      'AB388C3E55F2BDE17F000101@AdobeOrg',
      '32523BB96217F7B60A495CB6@AdobeOrg',
      '8C6767C25245AD1A0A490D4C@AdobeOrg',
      'ADD71D3E633F65A90A495CE5@AdobeOrg',
      'EA7F7DBC5776B93C7F000101@AdobeOrg',
      '22951DFC64CBD4BA0A495C70@AdobeOrg',
      '234304B15ED9FB3C0A495C3D@AdobeOrg',
      'B948222C68B75D870A495CC5@AdobeOrg',
      '8EB461AC63584A310A495FAF@AdobeOrg',
      '36DE898555D732137F000101@AdobeOrg',
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
