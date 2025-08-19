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
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import roles from '../../fixtures/roles.fixture.js';

describe('Role IT', () => {
  let Role;

  before(async () => {
    await seedDatabase();
    const acls = [{
      acl: [
        { actions: ['C', 'R', 'U', 'D'], path: '/role/**' },
      ],
    }];
    const aclCtx = { acls };
    const dataAccess = getDataAccess({ aclCtx });
    Role = dataAccess.Role;
  });

  it('should read seeded roles by id', async () => {
    for (const role of roles) {
      // eslint-disable-next-line no-await-in-loop
      const found = await Role.findById(role.roleId);
      expect(found).to.exist;
      expect(found.getName()).to.equal(role.name);
      expect(found.getImsOrgId()).to.equal(role.imsOrgId);
    }
  });

  it('should create a new role', async () => {
    const newRole = {
      roleId: '99999999-9999-4999-9999-999999999999',
      name: 'new-role',
      imsOrgId: 'NEWORG123456789012345678@AdobeOrg',
      acl: [],
    };
    const created = await Role.create(newRole);
    expect(created).to.exist;
    expect(created.getName()).to.equal('new-role');
    expect(created.getImsOrgId()).to.equal('NEWORG123456789012345678@AdobeOrg');
  });

  it('should update a role', async () => {
    // Use a role that hasn't been modified by other tests
    const roleToUpdate = roles[2]; // far-role
    const found = await Role.findById(roleToUpdate.roleId);
    expect(found).to.exist;
    found.setName('updated-far-role');
    await found.save();
    const updated = await Role.findById(roleToUpdate.roleId);
    expect(updated.getName()).to.equal('updated-far-role');
  });

  it('should delete a role', async () => {
    // Use a role that hasn't been modified by other tests
    const roleToDelete = roles[3]; // tar-role
    const found = await Role.findById(roleToDelete.roleId);
    expect(found).to.exist;
    await found.remove();
    const deleted = await Role.findById(roleToDelete.roleId);
    expect(deleted).to.be.null;
  });

  it('should find roles by imsOrgId and name index', async () => {
    const roleForIndex = roles[1];
    const orgId = roleForIndex.imsOrgId;
    const { name } = roleForIndex;
    const results = await Role.allByImsOrgIdAndName(orgId, name);
    expect(results).to.be.an('array');
    expect(results.length).to.be.greaterThan(0);
    expect(results[0].getImsOrgId()).to.equal(orgId);
    expect(results[0].getName()).to.equal(name);
  });
});
