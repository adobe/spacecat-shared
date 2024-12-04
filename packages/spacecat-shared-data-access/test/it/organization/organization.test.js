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

/* eslint-env mocha */
/* eslint-disable no-console */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { sanitizeIdAndAuditFields, sanitizeTimestamps } from '../../../src/v2/util/util.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('Organization IT', async () => {
  let sampleData;
  let Organization;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    Organization = dataAccess.Organization;
  });

  it('gets all organizations', async () => {
    const organizations = await Organization.all();
    // organizations.reverse(); // sort key is descending by default

    expect(organizations).to.be.an('array');
    expect(organizations.length).to.equal(sampleData.organizations.length);
    for (let i = 0; i < organizations.length; i += 1) {
      const org = sanitizeTimestamps(organizations[i].toJSON());
      const sampleOrg = sanitizeTimestamps(sampleData.organizations[i].toJSON());

      expect(org).to.eql(sampleOrg);
    }
  });

  it('gets an organization by id', async () => {
    const sampleOrganization = sampleData.organizations[0];
    const organization = await Organization.findById(sampleOrganization.getId());

    expect(organization).to.be.an('object');
    expect(
      sanitizeTimestamps(organization.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleOrganization.toJSON()),
    );
  });

  it('gets an organization by IMS org id', async () => {
    const sampleOrganization = sampleData.organizations[0];
    const organization = await Organization.findByImsOrgId(sampleOrganization.getImsOrgId());

    expect(organization).to.be.an('object');
    expect(
      sanitizeTimestamps(organization.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleOrganization.toJSON()),
    );
  });

  it('adds a new organization', async () => {
    const data = {
      name: 'New Organization',
      imsOrgId: 'newOrgId',
      config: {
        some: 'config',
      },
      fulfillableItems: {
        some: 'items',
      },
    };

    const organization = await Organization.create(data);

    expect(organization).to.be.an('object');

    expect(
      sanitizeIdAndAuditFields('Organization', organization.toJSON()),
    ).to.eql(data);
  });

  it('updates an organization', async () => {
    const organization = await Organization.findById(sampleData.organizations[0].getId());

    const data = {
      name: 'Updated Organization',
      imsOrgId: 'updatedOrgId',
      config: {
        some: 'updated',
      },
      fulfillableItems: {
        some: 'updated',
      },
    };

    const expectedOrganization = {
      ...organization.toJSON(),
      ...data,
    };

    organization.setName(data.name);
    organization.setImsOrgId(data.imsOrgId);
    organization.setConfig(data.config);
    organization.setFulfillableItems(data.fulfillableItems);

    await organization.save();

    const updatedOrganization = await Organization.findById(organization.getId());
    expect(updatedOrganization.getId()).to.equal(organization.getId());
    expect(updatedOrganization.record.createdAt).to.equal(organization.record.createdAt);
    expect(updatedOrganization.record.updatedAt).to.not.equal(organization.record.updatedAt);
    expect(
      sanitizeIdAndAuditFields('Organization', updatedOrganization.toJSON()),
    ).to.eql(
      sanitizeIdAndAuditFields('Organization', expectedOrganization),
    );
  });
});
