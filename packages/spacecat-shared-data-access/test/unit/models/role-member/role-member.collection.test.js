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
import { expect } from 'chai';

import RoleMemberCollection from '../../../../src/models/role-member/role-member.collection.js';
import schema from '../../../../src/models/role-member/role-member.schema.js';

describe('RoleMemberCollection', () => {
  it('all roles by identities', async () => {
    const es = {
      entities: { roleMember: {} },
    };
    const er = {};
    const rmc = new RoleMemberCollection(es, er, schema, { debug() {} });

    rmc.allByImsOrgId = (orgId, { filter }) => {
      expect(orgId).to.equal('FEEF00FAA@AdobeOrg');

      const objs = [{ identity: 'imsID:1234@4567.e' }, { identity: 'imsOrgID:1234' }];
      const ops = { eq: (a, b) => a === b };

      const fr = filter(objs[0], ops);
      return objs.filter((obj) => {
        const res = filter(obj, ops);
        return res.includes('true') && fr.includes(' OR ');
      });
    };

    const rms = await rmc.allRoleMembershipByIdentities('FEEF00FAA@AdobeOrg', ['imsID:1234@4567.e', 'imsOrgID:FEEF00FAA@AdobeOrg']);
    expect(rms).to.have.length(1);
    expect(rms[0].identity).to.equal('imsID:1234@4567.e');
  });
});
