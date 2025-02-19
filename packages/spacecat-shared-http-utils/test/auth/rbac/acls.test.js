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

import { getDBRoles } from '../../../src/auth/rbac/acls.js';

describe('Get Roles', () => {
  it.only('get roles from DB', async () => {
    const commands = [];
    const client = {
      send(c) {
        commands.push(c);
        return {
          Items: [
            {
              roles: {
                SS: ['MY_ROLE1'],
              },
            },
            {
              roles: {
                SS: ['MY_ROLE2', 'MY_ROLE3'],
              },
            },
          ],
        };
      },
    };

    const imsUserId = 'abc@def.g';
    const imsOrgId = 'F00FEEFAA123';
    const imsGroups = {
      'F00FEEFAA123@AdobeOrg': {
        groups: [{
          groupid: '348994793',
          user_visible_name: 'MY_ROLE_PROFILE',
        }, {
          groupid: '348994794',
          user_visible_name: 'YOUR_ROLE_PROFILE',
        }],
      },
      'BAAD11BAA@AdobeOrg': {
        groups: [{
          groupid: '348994795',
          user_visible_name: 'MY_ROLE_PROFILE',
        }],
      },
    };

    const roles = await getDBRoles(client, { imsUserId, imsOrgId, imsGroups });
    expect(roles).to.deep.equal(new Set(['MY_ROLE1', 'MY_ROLE2', 'MY_ROLE3']));

    expect(commands).to.have.length(1);
    expect(commands[0].constructor.name).to.equal('QueryCommand');

    const eav = {
      ':userident': {
        S: 'imsID:abc@def.g',
      },
      ':orgid': {
        S: 'F00FEEFAA123',
      },
      ':orgident': {
        S: 'imsOrgID:F00FEEFAA123',
      },
      ':grp0': {
        S: 'imsOrgID/groupID:F00FEEFAA123/348994793',
      },
      ':grp1': {
        S: 'imsOrgID/groupID:F00FEEFAA123/348994794',
      },
    };
    expect(commands[0].input.ExpressionAttributeValues).to.deep.equal(eav);
    expect(commands[0].input.KeyConditionExpression).to.equal('orgid = :orgid');
    expect(commands[0].input.FilterExpression).to.equal(
      'identifier IN (:userident, :orgident, :grp0, :grp1)',
    );
    expect(commands[0].input.ProjectionExpression).to.equal('#roles');
    expect(commands[0].input.ExpressionAttributeNames).to.deep.equal(
      { '#roles': 'roles' },
    );
  });
});
