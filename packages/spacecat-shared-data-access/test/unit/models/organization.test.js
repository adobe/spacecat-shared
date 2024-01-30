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
import { createOrganization } from '../../../src/models/organization.js';
import { sleep } from '../util.js';

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
      expect(config.alerts[0].mentions[0].slack[0]).to.equal('slackId');
    });
  });

  describe('Organization Object Functionality', () => {
    let organization;

    beforeEach(() => {
      organization = createOrganization(validData);
    });

    it('updates name correctly', () => {
      const name = 'newOrgName123';
      organization.updateName(name);
      expect(organization.getName()).to.equal(name);
    });

    it('updates imsOrgId correctly', () => {
      const imsOrgId = 'newImsOrg123';
      organization.updateImsOrgId(imsOrgId);
      expect(organization.getImsOrgId()).to.equal(imsOrgId);
    });

    it('updates config correctly', () => {
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
      organization.updateConfig(conf);
      const updatedConf = organization.getConfig();
      expect(updatedConf.slack).to.be.an('object');
      expect(updatedConf.alerts).to.be.an('array');
      expect(updatedConf.slack.workspace).to.equal('workspace');
      expect(updatedConf.slack.channel).to.equal('channel');
      expect(updatedConf.alerts[0].mentions[0].slack[0]).to.equal('slackId');
    });

    it('throws an error when updating with an empty name', () => {
      expect(() => organization.updateName('')).to.throw('Org name must be provided');
    });

    it('throws an error when updating with an empty imsOrgId', () => {
      expect(() => organization.updateImsOrgId('')).to.throw('IMS Org ID must be provided');
    });

    it('throws an error when updating with an invalid config', () => {
      expect(() => organization.updateConfig('abcd')).to.throw('Config must be provided');
    });

    it('updates updatedAt when imsOrgId is updated', async () => {
      const initialUpdatedAt = organization.getUpdatedAt();

      await sleep(20);

      organization.updateName('Name123');

      expect(organization.getUpdatedAt()).to.not.equal(initialUpdatedAt);
    });

    it('updates updatedAt when name is updated', async () => {
      const initialUpdatedAt = organization.getUpdatedAt();

      await sleep(20);

      organization.updateImsOrgId('imsOrg123');

      expect(organization.getUpdatedAt()).to.not.equal(initialUpdatedAt);
    });

    it('updates updatedAt when config is updated', async () => {
      const initialUpdatedAt = organization.getUpdatedAt();

      await sleep(20);

      organization.updateConfig({});

      expect(organization.getUpdatedAt()).to.not.equal(initialUpdatedAt);
    });
  });
});
