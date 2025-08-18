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
import roleMembers from '../../fixtures/role-members.fixture.js';

describe('RoleMember IT', () => {
  let RoleMember;

  before(async () => {
    await seedDatabase();
    const acls = [{
      acl: [{
        actions: ['R', 'C', 'U', 'D'],
        path: '/role/*/roleMember/*',
      }, {
        actions: ['R'],
        path: '/role/*',
      }],
    }];
    const aclCtx = { acls };
    const dataAccess = getDataAccess({ aclCtx });
    RoleMember = dataAccess.RoleMember;
  });

  it('should read seeded role members by imsOrgId', async () => {
    // Get role members by imsOrgId and verify they exist
    const orgId = roleMembers[0].imsOrgId; // DAADAADAA@AdobeOrg
    const members = await RoleMember.allByImsOrgId(orgId);
    expect(members).to.be.an('array');
    expect(members.length).to.be.greaterThan(0);

    // Verify we can find the seeded role members
    const foundMembers = roleMembers.filter((m) => m.imsOrgId === orgId);
    expect(members.length).to.be.at.least(foundMembers.length);
  });

  it('should create a new role member', async () => {
    const newRoleMember = {
      imsOrgId: 'NEWORG@AdobeOrg',
      identity: 'imsID:newuser@example.com',
      roleId: '1d6b2f29-4d2d-405e-aad6-1f62e6933c39', // Use existing role
    };
    const created = await RoleMember.create(newRoleMember);
    expect(created).to.exist;
    expect(created.getImsOrgId()).to.equal('NEWORG@AdobeOrg');
    expect(created.getIdentity()).to.equal('imsID:newuser@example.com');
    expect(created.getRoleId()).to.equal('1d6b2f29-4d2d-405e-aad6-1f62e6933c39');
  });

  it('should update a role member', async () => {
    // Create a fresh role member first, then update it
    const newRoleMember = {
      imsOrgId: 'UPDATEORG123@AdobeOrg',
      identity: 'imsID:updateuser@example.com',
      roleId: '1d6b2f29-4d2d-405e-aad6-1f62e6933c39', // Use existing role
    };

    const created = await RoleMember.create(newRoleMember);
    expect(created).to.exist;

    // Now update the role member we just created
    created.setIdentity('imsID:updated@example.com');
    await created.save();

    // Verify the update worked
    const updated = await RoleMember.findById(created.getRoleMemberId());
    expect(updated.getIdentity()).to.equal('imsID:updated@example.com');
  });

  it('should delete a role member', async () => {
    // Create a fresh role member first, then delete it
    const newRoleMember = {
      imsOrgId: 'DELETEORG123@AdobeOrg',
      identity: 'imsID:deleteuser@example.com',
      roleId: '1d6b2f29-4d2d-405e-aad6-1f62e6933c39', // Use existing role
    };

    const created = await RoleMember.create(newRoleMember);
    expect(created).to.exist;
    const memberId = created.getRoleMemberId();

    // Now delete the role member we just created
    await created.remove();

    // Verify it's been deleted
    const deleted = await RoleMember.findById(memberId);
    expect(deleted).to.be.null;
  });

  it('should find role members by imsOrgId index', async () => {
    const orgId = roleMembers[0].imsOrgId; // DAADAADAA@AdobeOrg
    const results = await RoleMember.allByImsOrgId(orgId);
    expect(results).to.be.an('array');
    expect(results.length).to.be.greaterThan(0);
    results.forEach((member) => {
      expect(member.getImsOrgId()).to.equal(orgId);
    });
  });

  it('should find role members by imsOrgId and identity', async () => {
    const orgId = roleMembers[0].imsOrgId; // DAADAADAA@AdobeOrg
    const { identity } = roleMembers[0]; // imsOrgID:DAADAADAA@AdobeOrg
    const results = await RoleMember.allByImsOrgIdAndIdentity(orgId, identity);
    expect(results).to.be.an('array');
    expect(results.length).to.be.greaterThan(0);
    results.forEach((member) => {
      expect(member.getImsOrgId()).to.equal(orgId);
      expect(member.getIdentity()).to.equal(identity);
    });
  });

  it('should find all matching roles for identities', async () => {
    const members = await RoleMember.allRoleMembershipByIdentities(
      'DAADAADAA@AdobeOrg',
      ['imsOrgID:DAADAADAA@AdobeOrg', 'imsID:1234@5678.e'],
    );
    expect(members).to.be.an('array');
    expect(members.length).to.be.greaterThan(0);

    // Verify we can get the associated roles
    const roles = await Promise.all(members.map(async (m) => m.getRole()));
    const roleNames = roles.map((r) => r.getName());
    expect(new Set(roleNames)).to.deep.equal(new Set(['foo-role', 'bar-role', 'far-role']));
    expect(roles).to.be.an('array');
    expect(roles.length).to.be.greaterThan(0);

    // All roles should have names
    roles.forEach((role) => {
      expect(role.getName()).to.be.a('string');
      expect(role.getName().length).to.be.greaterThan(0);
    });
  });
});
