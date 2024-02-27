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

import { isIsoDate } from '@adobe/spacecat-shared-utils';
import { expect } from 'chai';
import { createSite } from '../../../src/models/site.js';
import { sleep } from '../util.js';
import { Config } from '../../../src/models/site/config.js';

const validData = {
  baseURL: 'https://www.example.com',
  deliveryType: 'aem_edge',
  organizationId: 'org123',
  auditConfig: {
    auditsDisabled: false,
    auditTypeConfigs: {
      type1: { /* some config */ },
      type2: { /* some config */ },
    },
  },
};

describe('Site Model Tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if baseURL is not a valid URL', () => {
      expect(() => createSite({ ...validData, baseURL: 'invalid-url' })).to.throw('Base URL must be a valid URL');
    });

    it('throws an error if deliveryType is invalid', () => {
      expect(() => createSite({ ...validData, deliveryType: 'invalid' })).to.throw('Invalid delivery type: invalid');
    });

    it('creates a site object with valid baseURL', () => {
      const site = createSite({ ...validData });
      expect(site).to.be.an('object');
      expect(site.getBaseURL()).to.equal(validData.baseURL);
    });

    it('creates a site with default organization id', () => {
      const site = createSite({ ...validData, organizationId: undefined });
      expect(site.getOrganizationId()).to.equal('default');
    });

    it('creates a site with default auditConfig when none provided', () => {
      const site = createSite({ ...validData });
      const auditConfig = site.getAuditConfig();

      expect(auditConfig).to.be.an('object');
      expect(auditConfig.auditsDisabled()).be.false;
      expect(auditConfig.getAuditTypeConfig('type1')).to.be.an('object');
    });

    it('creates a site with provided auditConfig', () => {
      const newAuditConfig = {
        auditsDisabled: true,
        auditTypeConfigs: {
          type1: { /* some config */ },
          type2: { /* some config */ },
        },
      };
      const site = createSite({ ...validData, auditConfig: newAuditConfig });
      const auditConfig = site.getAuditConfig();

      expect(auditConfig).to.be.an('object');
      expect(auditConfig.auditsDisabled()).to.be.true;
      expect(auditConfig.getAuditTypeConfig('type1')).to.be.an('object');
      expect(auditConfig.getAuditTypeConfig('type1').disabled()).to.be.true;
      expect(auditConfig.getAuditTypeConfig('type2')).to.be.an('object');
      expect(auditConfig.getAuditTypeConfig('type2').disabled()).to.be.true;
    });
  });

  describe('Site Object Functionality', () => {
    let site;

    beforeEach(() => {
      site = createSite(validData);
    });

    // see TODO in src/models/site.js
    /*    it('updates baseURL correctly', () => {
      const newURL = 'https://www.newexample.com';
      site.updateBaseURL(newURL);
      expect(site.getBaseURL()).to.equal(newURL);
    });

    it('throws an error when updating with an invalid baseURL', () => {
      expect(() => site.updateBaseURL('invalid-url')).to.throw('Base URL must be a valid URL');
    });
    */

    it('updates deliveryType correctly', () => {
      const newDeliveryType = 'aem_cs';
      site.updateDeliveryType(newDeliveryType);
      expect(site.getDeliveryType()).to.equal(newDeliveryType);
    });

    it('updates organizationId correctly', () => {
      const organizationId = 'newOrg123';
      site.updateOrganizationId(organizationId);
      expect(site.getOrganizationId()).to.equal(organizationId);
    });

    it('updates config correctly', () => {
      const conf = Config({
        slack: {
          workspace: 'workspace',
          channel: 'channel',
        },
        alerts: [{
          type: '404',
          byOrg: false,
          mentions: [{ slack: ['slackId'] }],
        }],
      });
      site.updateConfig(conf);
      const updatedConf = site.getConfig();
      expect(updatedConf.slack).to.be.an('object');
      expect(updatedConf.alerts).to.be.an('array');
      expect(updatedConf.slack.workspace).to.equal('workspace');
      expect(updatedConf.slack.channel).to.equal('channel');
      expect(updatedConf.alerts[0].mentions[0].slack[0]).to.equal('slackId');
    });

    it('updates gitHubURL correctly', () => {
      const newGitHubURL = 'https://gibhub.com/example/example';
      site.updateGitHubURL(newGitHubURL);
      expect(site.getGitHubURL()).to.equal(newGitHubURL);
    });

    it('throws an error when updating with an invalid deliveryType', () => {
      expect(() => site.updateDeliveryType('invalid')).to.throw('Invalid delivery type: invalid');
    });

    it('throws an error when updating with an invalid github URL', () => {
      expect(() => site.updateGitHubURL('')).to.throw('GitHub URL must be a valid URL');
    });

    it('throws an error when updating with an invalid config', () => {
      expect(() => site.updateConfig('abcd')).to.throw('Config must be provided');
    });

    it('sets audits correctly', () => {
      const audits = [{ id: 'audit1' }, { id: 'audit2' }];
      site.setAudits(audits);
      expect(site.getAudits()).to.deep.equal(audits);
    });

    // see TODO in src/models/site.js
    /*
    it('updates updatedAt when base URL is updated', async () => {
      const initialUpdatedAt = site.getUpdatedAt();

      await sleep(10);

      site.updateBaseURL('https://www.newexample.com');

      expect(site.getUpdatedAt()).to.not.equal(initialUpdatedAt);
    }); */

    it('updates updatedAt when organizationId is updated', async () => {
      const initialUpdatedAt = site.getUpdatedAt();

      await sleep(20);

      site.updateOrganizationId('newOrg123');

      expect(site.getUpdatedAt()).to.not.equal(initialUpdatedAt);
    });

    it('updates updatedAt when config is updated', async () => {
      const initialUpdatedAt = site.getUpdatedAt();

      await sleep(20);

      site.updateConfig(Config({}));

      expect(site.getUpdatedAt()).to.not.equal(initialUpdatedAt);
    });

    it('updates updatedAt when gitHubURL is updated', async () => {
      const initialUpdatedAt = site.getUpdatedAt();

      await sleep(20);

      site.updateGitHubURL('https://gibhub.com/example/example');

      expect(site.getUpdatedAt()).to.not.equal(initialUpdatedAt);
    });

    it('toggles live status', async () => {
      expect(site.isLive()).to.be.false;

      site.toggleLive();

      expect(site.isLive()).to.be.true;
      expect(isIsoDate(site.getIsLiveToggledAt())).to.be.true;
    });
  });

  describe('AuditConfig Integration', () => {
    let site;

    beforeEach(() => {
      site = createSite(validData);
    });

    it('handles AuditConfig and AuditConfigType correctly', () => {
      const auditConfigData = {
        auditsDisabled: false,
        auditTypeConfigs: {
          type1: { /* some config */ },
          type2: { /* some config */ },
        },
      };
      const newSite = createSite({ ...validData, auditConfig: auditConfigData });
      const auditConfig = newSite.getAuditConfig();

      expect(auditConfig).to.be.an('object');
      expect(auditConfig.auditsDisabled()).to.be.false;
      expect(auditConfig.getAuditTypeConfig('type1')).to.be.an('object');
      expect(auditConfig.getAuditTypeConfig('type1').disabled()).to.be.false;
    });

    it('sets all audits disabled correctly', () => {
      site.setAllAuditsDisabled(true);
      expect(site.getAuditConfig().auditsDisabled()).to.be.true;
    });

    it('updates a specific audit type configuration', () => {
      site.updateAuditTypeConfig('type1', { disabled: true });
      expect(site.getAuditConfig().getAuditTypeConfig('type1').disabled()).to.be.true;
    });

    it('adds a new audit type configuration if it does not exist', () => {
      site.updateAuditTypeConfig('type3', { disabled: true });
      expect(site.getAuditConfig().getAuditTypeConfig('type3').disabled()).to.be.true;
    });
  });
});
