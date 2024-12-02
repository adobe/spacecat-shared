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

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { sanitizeIdAndAuditFields, sanitizeTimestamps } from '../../../src/v2/util/util.js';

use(chaiAsPromised);

describe('Configuration IT', async () => {
  let sampleData;
  let Configuration;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    Configuration = dataAccess.Configuration;
  });

  it('finds one configuration by version', async () => {
    const sampleConfiguration = sampleData.configurations[1];
    const configuration = await Configuration.getConfigurationByVersion(
      sampleConfiguration.getVersion(),
    );

    expect(configuration).to.be.an('object');
    expect(
      sanitizeTimestamps(configuration.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleConfiguration.toJSON()),
    );
  });

  it('finds the latest configuration', async () => {
    const sampleConfiguration = sampleData.configurations[0];
    const configuration = await Configuration.getLatestConfiguration();

    expect(configuration).to.be.an('object');
    expect(
      sanitizeTimestamps(configuration.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleConfiguration.toJSON()),
    );
  });

  it('updates a configuration', async () => {
    const configuration = await Configuration.getLatestConfiguration();

    const data = {
      enabledByDefault: true,
      enabled: {
        sites: ['site1'],
        orgs: ['org1'],
      },
    };

    const expectedConfiguration = {
      ...configuration.toJSON(),
      handlers: {
        ...configuration.toJSON().handlers,
        test: data,
      },
      version: configuration.getVersion() + 1,
    };

    configuration.addHandler('test', data);

    await configuration.save();

    const updatedConfiguration = await Configuration.getLatestConfiguration();
    expect(updatedConfiguration.getId()).to.not.equal(configuration.getId());
    expect(updatedConfiguration.record.createdAt).to.be.greaterThan(configuration.record.createdAt);
    expect(updatedConfiguration.record.updatedAt).to.be.greaterThan(configuration.record.updatedAt);
    expect(
      sanitizeIdAndAuditFields('Configuration', updatedConfiguration.toJSON()),
    ).to.eql(
      sanitizeIdAndAuditFields('Configuration', expectedConfiguration),
    );
  });
});
