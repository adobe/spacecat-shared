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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { sanitizeIdAndAuditFields, sanitizeTimestamps } from '../../../src/util/util.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('OrganizationIdentityProvider IT', async () => {
  let sampleData;
  let OrganizationIdentityProvider;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    OrganizationIdentityProvider = dataAccess.OrganizationIdentityProvider;
  });

  it('gets an organization identity provider by id', async () => {
    const sampleProvider = sampleData.organizationIdentityProviders[0];
    const provider = await OrganizationIdentityProvider.findById(sampleProvider.getId());

    expect(provider).to.be.an('object');
    expect(
      sanitizeTimestamps(provider.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleProvider.toJSON()),
    );
  });

  it('gets all organization identity providers by provider', async () => {
    const sampleProvider = sampleData.organizationIdentityProviders[0];
    const providerType = sampleProvider.getProvider();

    const providers = await OrganizationIdentityProvider.allByProvider(providerType);

    expect(providers).to.be.an('array');
    expect(providers.length).to.be.greaterThan(0);

    for (const provider of providers) {
      expect(provider.getProvider()).to.equal(providerType);
    }
  });

  it('gets all organization identity providers by provider and external id', async () => {
    const sampleProvider = sampleData.organizationIdentityProviders[0];
    const providerType = sampleProvider.getProvider();
    const externalId = sampleProvider.getExternalId();

    const providers = await OrganizationIdentityProvider.allByProviderAndExternalId(
      providerType,
      externalId,
    );

    expect(providers).to.be.an('array');
    expect(providers.length).to.be.greaterThan(0);

    for (const provider of providers) {
      expect(provider.getProvider()).to.equal(providerType);
      expect(provider.getExternalId()).to.equal(externalId);
    }
  });

  it('adds a new organization identity provider', async () => {
    const data = {
      organizationId: sampleData.organizations[0].getId(),
      provider: 'MICROSOFT',
      externalId: 'microsoft-org-new',
      metadata: {
        domain: 'new-example.com',
        ssoEnabled: true,
      },
      updatedBy: 'system',
    };

    const provider = await OrganizationIdentityProvider.create(data);

    expect(provider).to.be.an('object');

    expect(
      sanitizeIdAndAuditFields('OrganizationIdentityProvider', provider.toJSON()),
    ).to.eql(data);
  });

  it('updates an organization identity provider metadata', async () => {
    const provider = await OrganizationIdentityProvider.findById(
      sampleData.organizationIdentityProviders[0].getId(),
    );

    const newMetadata = {
      domain: 'updated-example.com',
      ssoEnabled: false,
      newField: 'newValue',
    };

    const expectedProvider = {
      ...provider.toJSON(),
      metadata: newMetadata,
    };

    provider.setMetadata(newMetadata);

    await provider.save();

    const updatedProvider = await OrganizationIdentityProvider.findById(provider.getId());

    expect(updatedProvider.getId()).to.equal(provider.getId());
    expect(updatedProvider.record.createdAt).to.equal(provider.record.createdAt);
    expect(updatedProvider.record.updatedAt).to.not.equal(provider.record.updatedAt);
    expect(
      sanitizeIdAndAuditFields('OrganizationIdentityProvider', updatedProvider.toJSON()),
    ).to.eql(
      sanitizeIdAndAuditFields('OrganizationIdentityProvider', expectedProvider),
    );
  });

  it('removes an organization identity provider', async () => {
    const provider = await OrganizationIdentityProvider.findById(
      sampleData.organizationIdentityProviders[0].getId(),
    );

    await provider.remove();

    const notFound = await OrganizationIdentityProvider.findById(
      sampleData.organizationIdentityProviders[0].getId(),
    );
    expect(notFound).to.be.null;
  });
});
