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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { sanitizeIdAndAuditFields, sanitizeTimestamps, zeroPad } from '../../../src/util/util.js';

use(chaiAsPromised);

describe('Configuration IT', async () => {
  let sampleData;
  let Configuration;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    Configuration = dataAccess.Configuration;
  });

  // TODO: Re-enable once S3 mocking is set up
  it.skip('gets all configurations', async () => {
    const configurations = await Configuration.all();

    expect(configurations).to.be.an('array');
    expect(configurations).to.have.lengthOf(sampleData.configurations.length);
    configurations.forEach((configuration, index) => {
      expect(
        sanitizeTimestamps(configuration.toJSON()),
      ).to.eql(
        sanitizeTimestamps(sampleData.configurations[index].toJSON()),
      );
    });
  });

  // TODO: Re-enable once S3 mocking is set up - findByVersion() now uses S3
  it.skip('finds one configuration by version', async () => {
    const sampleConfiguration = sampleData.configurations[1];
    const configuration = await Configuration.findByVersion(
      sampleConfiguration.getVersion(),
    );

    expect(configuration).to.be.an('object');
    expect(
      sanitizeTimestamps(configuration.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleConfiguration.toJSON()),
    );
  });

  // TODO: Re-enable once S3 mocking is set up - findLatest() now uses S3
  it.skip('finds the latest configuration', async () => {
    const sampleConfiguration = sampleData.configurations[0];
    const configuration = await Configuration.findLatest();

    expect(configuration).to.be.an('object');
    expect(
      sanitizeTimestamps(configuration.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleConfiguration.toJSON()),
    );
  });

  // TODO: Re-enable once S3 mocking is set up - save() now uses S3
  it.skip('updates a configuration', async () => {
    const configuration = await Configuration.findLatest();

    const data = {
      enabledByDefault: true,
      productCodes: ['ASO'],
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
      versionString: zeroPad(configuration.getVersion() + 1, 10),
    };

    configuration.addHandler('test', data);

    await configuration.save();

    const updatedConfiguration = await Configuration.findLatest();
    expect(updatedConfiguration.getId()).to.not.equal(configuration.getId());
    expect(
      Date.parse(updatedConfiguration.record.createdAt),
    ).to.be.greaterThan(
      Date.parse(configuration.record.createdAt),
    );
    expect(
      Date.parse(updatedConfiguration.record.updatedAt),
    ).to.be.greaterThan(
      Date.parse(configuration.record.updatedAt),
    );
    expect(
      sanitizeIdAndAuditFields('Configuration', updatedConfiguration.toJSON()),
    ).to.eql(
      sanitizeIdAndAuditFields('Configuration', expectedConfiguration),
    );
  });

  // TODO: Re-enable once S3 mocking is set up - uses findLatest()/save() which now use S3
  it.skip('registers a new audit', async () => {
    const configuration = await Configuration.findLatest();
    configuration.registerAudit('structured-data', true, 'weekly', ['LLMO']);
    await configuration.save();

    const updatedConfiguration = await Configuration.findLatest();
    expect(updatedConfiguration.getHandler('structured-data')).to.deep.equal({
      enabledByDefault: true,
      dependencies: [],
      disabled: {
        sites: [],
        orgs: [],
      },
      enabled: {
        sites: [],
        orgs: [],
      },
      productCodes: ['LLMO'],
    });
  });

  // TODO: Re-enable once S3 mocking is set up - uses findLatest()/save() which now use S3
  it.skip('unregisters an audit', async () => {
    const configuration = await Configuration.findLatest();
    configuration.unregisterAudit('structured-data');
    await configuration.save();

    const updatedConfiguration = await Configuration.findLatest();
    expect(updatedConfiguration.getHandler('structured-data')).to.be.undefined;
    expect(updatedConfiguration.getJobs().find((job) => job.group === 'audits' && job.type === 'structured-data')).to.be.undefined;
  });
});
