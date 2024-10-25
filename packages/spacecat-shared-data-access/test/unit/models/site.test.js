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

const validData = {
  baseURL: 'https://www.example.com',
  deliveryType: 'aem_edge',
  hlxConfig: {
    rso: {
      owner: 'some-owner',
      site: 'some-site',
      ref: 'main',
    },
    cdnProdHost: 'www.example.com',
    code: {
      owner: 'some-owner',
      repo: 'some-repo',
      source: {
        type: 'github',
        url: 'https://github.com/some-owner/some-repo',
      },
    },
    content: {
      contentBusId: '1234',
      source: {
        type: 'onedrive',
        url: 'https://some-owner.sharepoint.com/:f:/r/sites/SomeFolder/Shared%20Documents/some-site/www',
      },
    },
    hlxVersion: 5,
  },
  organizationId: 'org123',
};

describe('Site Model Tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if baseURL is not a valid URL', () => {
      expect(() => createSite({ ...validData, baseURL: 'invalid-url' })).to.throw('Base URL must be a valid URL');
    });

    it('throws an error if deliveryType is invalid', () => {
      expect(() => createSite({ ...validData, deliveryType: 'invalid' })).to.throw('Invalid delivery type: invalid');
    });

    it('throws an error if hlxConfig is invalid', () => {
      expect(() => createSite({ ...validData, hlxConfig: '1234' })).to.throw('HLX Config must be an object: 1234');
    });

    it('creates a site object with valid baseURL', () => {
      const site = createSite({ ...validData });
      expect(site).to.be.an('object');
      expect(site.getBaseURL()).to.equal(validData.baseURL);
    });

    it('creates a site without hlxConfig', () => {
      const site = createSite({ ...validData, hlxConfig: undefined });
      expect(site).to.be.an('object');
      expect(site.getHlxConfig()).to.deep.equal({});
    });

    it('creates a site with default organization id', () => {
      const site = createSite({ ...validData, organizationId: undefined });
      expect(site.getOrganizationId()).to.equal('default');
    });

    it('creates a site with provided config', () => {
      const config = {
        slack: {
          workspace: 'workspace1',
          channel: 'channel1',
        },
        handlers: {
          type1: { mentions: { slack: ['slackId1'] } },
          type2: { mentions: { slack: ['slackId2'] } },
        },
      };
      const site = createSite({ ...validData, config });
      const siteConfig = site.getConfig();

      expect(siteConfig).to.be.an('object');
      expect(siteConfig.getSlackConfig()).to.be.an('object');
      expect(siteConfig.getSlackMentions('type1')).to.deep.equal(['slackId1']);
      expect(siteConfig.getSlackMentions('type2')).to.deep.equal(['slackId2']);
    });

    it('creates a site with provided hlxConfig', () => {
      const newHlxConfig = {
        cdnProdHost: 'www.another-example.com',
        code: {
          owner: 'another-owner',
          repo: 'another-repo',
          source: {
            type: 'github',
            url: 'https://github.com/another-owner/another-repo',
          },
        },
        content: {
          contentBusId: '1234',
          source: {
            type: 'onedrive',
            url: 'https://another-owner.sharepoint.com/:f:/r/sites/SomeFolder/Shared%20Documents/another-site/www',
          },
        },
        hlxVersion: 5,
      };
      const site = createSite({ ...validData, hlxConfig: newHlxConfig });
      const helixConfig = site.getHlxConfig();

      expect(helixConfig).to.be.an('object');
      expect(helixConfig).to.deep.equal(newHlxConfig);
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
      const conf = {
        slack: {
          workspace: 'workspace',
          channel: 'channel',
        },
        handlers: {
          404: {
            mentions: { slack: ['slackId'] },
          },
        },
      };
      site.updateConfig(conf);
      const updatedConf = site.getConfig();
      const slack = updatedConf.getSlackConfig();
      expect(slack).to.be.an('object');
      expect(slack.workspace).to.equal('workspace');
      expect(slack.channel).to.equal('channel');
      expect(updatedConf.getSlackMentions(404)).to.deep.equal(['slackId']);
    });

    it('updates gitHubURL correctly', () => {
      const newGitHubURL = 'https://gibhub.com/example/example';
      site.updateGitHubURL(newGitHubURL);
      expect(site.getGitHubURL()).to.equal(newGitHubURL);
    });

    it('updates hlxConfig correctly', () => {
      const newHlxConfig = {
        cdnProdHost: 'www.another-example.com',
        code: {
          owner: 'another-owner',
          repo: 'another-repo',
          source: {
            type: 'github',
            url: 'https://github.com/another-owner/another-repo',
          },
        },
        content: {
          contentBusId: '1234',
          source: {
            type: 'onedrive',
            url: 'https://another-owner.sharepoint.com/:f:/r/sites/SomeFolder/Shared%20Documents/another-site/www',
          },
        },
        hlxVersion: 5,
      };

      site.updateHlxConfig(newHlxConfig);
      const helixConfig = site.getHlxConfig();

      expect(helixConfig).to.be.an('object');
      expect(helixConfig).to.deep.equal(newHlxConfig);
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

    it('throws an error when updating with an invalid hlxConfig', () => {
      expect(() => site.updateHlxConfig('abcd')).to.throw('HLX Config must be an object');
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

      site.updateConfig({});

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
});
