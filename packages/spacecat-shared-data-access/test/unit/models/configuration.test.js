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
import { expect } from 'chai';
import { createConfiguration } from '../../../src/models/configuration.js';

const validData = {
  jobs: [
    {
      group: 'audits',
      type: 'lhs-mobile',
      interval: 'daily',
    }, {
      group: 'audits',
      type: '404',
      interval: 'daily',
    }, {
      group: 'imports',
      type: 'rum-ingest',
      interval: 'daily',
    }, {
      group: 'reports',
      type: '404-external-digest',
      interval: 'weekly',
    }, {
      group: 'audits',
      type: 'apex',
      interval: 'weekly',
    },
  ],
  handlers: {
    404: {
      disabled: {
        sites: ['site1'],
        orgs: ['org1', 'org2'],
      },
      enabledByDefault: true,
      dependencies: [],
    },
    'broken-backlinks': {
      enabledByDefault: false,
      enabled: {
        sites: ['site2'],
        orgs: ['org2'],
      },
      dependencies: [],
    },
    cwv: {
      enabledByDefault: true,
    },
  },
  queues: {
    audits: 'sqs://.../spacecat-services-audit-jobs',
    imports: 'sqs://.../spacecat-services-import-jobs',
    reports: 'sqs://.../spacecat-services-report-jobs',
  },
  version: 'v1',
};

describe('Configuration Model Tests', () => {
  it('creates a configuration', () => {
    const configuration = createConfiguration(validData);
    expect(configuration).to.be.an('object');
    expect(configuration.getVersion()).to.equal(validData.version);
    expect(configuration.getQueues()).to.deep.equal(validData.queues);
    expect(configuration.getJobs()).to.deep.equal(validData.jobs);
  });

  it('checks if a handler type is enabled for a site', () => {
    const configuration = createConfiguration(validData);
    const isEnabled = configuration.isHandlerEnabledForSite('404', { getId: () => 'site1', getOrganizationId: () => 'org2' });
    expect(isEnabled).to.be.a('boolean');
    expect(isEnabled).to.be.false;
  });

  it('checks if a handler type is enabled for a site', () => {
    const configuration = createConfiguration(validData);
    const isEnabled = configuration.isHandlerEnabledForSite('404', { getId: () => 'site2', getOrganizationId: () => 'org2' });
    expect(isEnabled).to.be.a('boolean');
    expect(isEnabled).to.be.false;
  });

  it('checks if a handler type is enabled for a site if siteId is enabled', () => {
    const configuration = createConfiguration(validData);
    const isEnabled = configuration.isHandlerEnabledForSite('broken-backlinks', { getId: () => 'site2', getOrganizationId: () => 'org1' });
    expect(isEnabled).to.be.a('boolean');
    expect(isEnabled).to.be.true;
  });

  it('checks if a handler type is enabled for a site if enabledByDefault is true', () => {
    const configuration = createConfiguration(validData);
    const isEnabled = configuration.isHandlerEnabledForSite('cwv', { getId: () => 'site3', getOrganizationId: () => 'org1' });
    expect(isEnabled).to.be.a('boolean');
    expect(isEnabled).to.be.true;
  });

  it('checks if a handler type is enabled for an organization', () => {
    const configuration = createConfiguration(validData);
    const isEnabled = configuration.isHandlerEnabledForOrg('404', { getId: () => 'org1' });
    expect(isEnabled).to.be.a('boolean');
    expect(isEnabled).to.be.false;
  });

  it('checks if a handler type is enabled for an organization', () => {
    const configuration = createConfiguration(validData);
    const isEnabled = configuration.isHandlerEnabledForOrg('cwv', { getId: () => 'org3' });
    expect(isEnabled).to.be.a('boolean');
    expect(isEnabled).to.be.true;
  });

  it('checks if a handler type is enabled for an organization', () => {
    const configuration = createConfiguration(validData);
    const isEnabled = configuration.isHandlerEnabledForOrg('broken-backlinks', { getId: () => 'org2' });
    expect(isEnabled).to.be.a('boolean');
    expect(isEnabled).to.be.true;
  });

  it('enables a handler type for a site when disabled by id', () => {
    const configuration = createConfiguration(validData);
    configuration.enableHandlerForSite('404', { getId: () => 'site1', getOrganizationId: () => 'org3' });
    const isEnabled = configuration.isHandlerEnabledForSite('404', { getId: () => 'site1', getOrganizationId: () => 'org3' });
    expect(isEnabled).to.be.true;
  });

  it('enables a handler type for a site when disabled by default', () => {
    const configuration = createConfiguration(validData);
    configuration.enableHandlerForSite('broken-backlinks', { getId: () => 'site1', getOrganizationId: () => 'org3' });
    const isEnabled = configuration.isHandlerEnabledForSite('broken-backlinks', { getId: () => 'site1', getOrganizationId: () => 'org3' });
    expect(isEnabled).to.be.true;
  });

  it('disables a handler type for a site when enabled by siteId', () => {
    const configuration = createConfiguration(validData);
    configuration.disableHandlerForSite('broken-backlinks', { getId: () => 'site2', getOrganizationId: () => 'org7' });
    const isEnabled = configuration.isHandlerEnabledForSite('broken-backlinks', { getId: () => 'site2', getOrganizationId: () => 'org7' });
    expect(isEnabled).to.be.true;
  });

  it('disables a handler type for a site when enabled by default', () => {
    const configuration = createConfiguration(validData);
    configuration.disableHandlerForSite('404', { getId: () => 'site4', getOrganizationId: () => 'org5' });
    const isEnabled = configuration.isHandlerEnabledForSite('404', { getId: () => 'site4', getOrganizationId: () => 'org3' });
    expect(isEnabled).to.be.false;
  });

  it('enables a handler type for an organization', () => {
    const configuration = createConfiguration(validData);
    configuration.enableHandlerForOrg('404', { getId: () => 'org1' });
    const isEnabled = configuration.isHandlerEnabledForOrg('404', { getId: () => 'org1' });
    expect(isEnabled).to.be.true;
  });

  it('enables a handler type for an organization when disabled by default', () => {
    const configuration = createConfiguration(validData);
    configuration.enableHandlerForOrg('broken-backlinks', { getId: () => 'org4' });
    const isEnabled = configuration.isHandlerEnabledForOrg('broken-backlinks', { getId: () => 'org4' });
    expect(isEnabled).to.be.true;
  });

  it('disables a handler type for an organization when enabled by default', () => {
    const configuration = createConfiguration(validData);
    configuration.disableHandlerForOrg('404', { getId: () => 'org4' });
    const isEnabled = configuration.isHandlerEnabledForOrg('404', { getId: () => 'org4' });
    expect(isEnabled).to.be.false;
  });

  it('disables a handler type for an organization when orgId is enabled', () => {
    const configuration = createConfiguration(validData);
    configuration.disableHandlerForOrg('broken-backlinks', { getId: () => 'org2' });
    const isEnabled = configuration.isHandlerEnabledForOrg('404', { getId: () => 'org2' });
    expect(isEnabled).to.be.false;
  });

  it('does not create a configuration when is invalid', () => {
    expect(() => createConfiguration({})).to.throw('Configuration validation error: "version" is required');
  });
});
