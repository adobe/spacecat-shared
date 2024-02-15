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

  it('does not create a configuration when is invalid', () => {
    expect(() => createConfiguration({})).to.throw('Configuration validation error: "version" is required');
  });
});
