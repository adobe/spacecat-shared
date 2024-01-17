/*
 * Copyright 2023 Adobe. All rights reserved.
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
import { createOrganization } from '../../../src/models/organization.js';

const validData = {
  id: '1111111',
  imsOrgId: '1234@AdobeOrg',
  name: 'ABCD',
};

describe('Organization Model Tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if name is empty', () => {
      expect(() => createOrganization({ ...validData, name: '' })).to.throw('Org name must be provided');
    });

    it('creates an organization', () => {
      const org = createOrganization({ ...validData });
      expect(org).to.be.an('object');
      expect(org.getName()).to.equal(validData.name);
    });

    it('creates an organization with default config when none provided', () => {
      const org = createOrganization({ ...validData });
      const config = org.getConfig();

      expect(config).to.be.an('object');
      expect(config.alerts).to.be.an('array');
      expect(config.slack).to.be.an('object');
    });

    it('creates an organization with provided config', () => {
      const conf = {
        slack: {
          workspace: 'workspace',
          channel: 'channel',
        },
        alerts: [{
          type: '404',
          byOrg: false,
          mentions: [{ slack: ['slackId'] }],
        }],
      };
      const org = createOrganization({ ...validData, config: conf });
      const config = org.getConfig();

      expect(config.slack).to.be.an('object');
      expect(config.alerts).to.be.an('array');
      expect(config.slack.workspace).to.equal('workspace');
      expect(config.slack.channel).to.equal('channel');
    });
  });

  describe('Organization Object Functionality', () => {
    beforeEach(() => {
    });

    it('updates name correctly', () => {
    });

    it('updates imsOrgId correctly', () => {
    });

    it('updates config correctly', () => {
    });

    it('throws an error when updating with an invalid name', () => {
    });

    it('updates updatedAt when imsOrgId is updated', async () => {
    });

    it('updates updatedAt when name is updated', async () => {
    });
  });
});
