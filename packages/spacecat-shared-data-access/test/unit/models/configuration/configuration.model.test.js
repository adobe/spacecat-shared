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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import Configuration from '../../../../src/models/configuration/configuration.model.js';
import configurationFixtures from '../../../fixtures/configurations.fixture.js';
import { createElectroMocks } from '../../util.js';
import { sanitizeIdAndAuditFields } from '../../../../src/util/util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleConfiguration = configurationFixtures[0];
const site = {
  getId: () => 'c6f41da6-3a7e-4a59-8b8d-2da742ac2dbe',
  getOrganizationId: () => '757ceb98-05c8-4e07-bb23-bc722115b2b0',
};

const org = {
  getId: () => site.getOrganizationId(),
};

describe('ConfigurationModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = { ...sampleConfiguration };

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(Configuration, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    beforeEach(() => {
      mockRecord = { ...sampleConfiguration };

      ({
        mockElectroService,
        model: instance,
      } = createElectroMocks(Configuration, mockRecord));

      mockElectroService.entities.patch = stub().returns({ set: stub() });
    });

    it('initializes the Configuration instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('configurationId', () => {
    it('gets configurationId', () => {
      expect(instance.getId()).to.equal(sampleConfiguration.configurationId);
    });
  });

  describe('attributes', () => {
    it('gets version', () => {
      expect(instance.getVersion()).to.equal(2);
    });

    it('gets queues', () => {
      expect(instance.getQueues()).to.deep.equal(sampleConfiguration.queues);
    });

    it('gets jobs', () => {
      expect(instance.getJobs()).to.deep.equal(sampleConfiguration.jobs);
    });

    it('gets handlers', () => {
      expect(instance.getHandlers()).to.deep.equal(sampleConfiguration.handlers);
    });

    it('gets handler', () => {
      expect(instance.getHandler('apex')).to.deep.equal(sampleConfiguration.handlers.apex);
    });

    it('gets slackRoles', () => {
      expect(instance.getSlackRoles()).to.deep.equal(sampleConfiguration.slackRoles);
    });

    it('gets slackRoleMembersByRole', () => {
      expect(instance.getSlackRoleMembersByRole('scrape')).to.deep.equal(sampleConfiguration.slackRoles.scrape);
      delete instance.record.slackRoles;
      expect(instance.getSlackRoleMembersByRole('scrape')).to.deep.equal([]);
    });
  });

  describe('handler enabled/disabled', () => {
    it('returns false if a handler does not exist', () => {
      expect(instance.isHandlerEnabledForSite('non-existent-handler', site)).to.be.false;
      expect(instance.isHandlerEnabledForOrg('non-existent-handler', org)).to.be.false;
    });

    it('returns true if a handler is enabled by default', () => {
      expect(instance.isHandlerEnabledForSite('404', site)).to.be.true;
      expect(instance.isHandlerEnabledForOrg('404', org)).to.be.true;
    });

    it('returns true when enabled is there and the handler is enabled by default', () => {
      console.log('starting test');
      expect(instance.isHandlerEnabledForSite('sitemap', site)).to.be.true;
      expect(instance.isHandlerEnabledForOrg('sitemap', org)).to.be.true;
    });

    it('returns false if a handler is not enabled by default', () => {
      expect(instance.isHandlerEnabledForSite('organic-keywords', site)).to.be.false;
      expect(instance.isHandlerEnabledForOrg('organic-keywords', org)).to.be.false;
    });

    it('returns true when a handler is enabled for a site', () => {
      expect(instance.isHandlerEnabledForSite('lhs-mobile', site)).to.be.true;
    });

    it('returns false when a handler is disabled for a site', () => {
      expect(instance.isHandlerEnabledForSite('cwv', site)).to.be.false;
    });

    it('returns true when a handler is enabled for an organization', () => {
      expect(instance.isHandlerEnabledForOrg('lhs-mobile', org)).to.be.true;
    });

    it('returns false when a handler is disabled for an organization', () => {
      expect(instance.isHandlerEnabledForOrg('cwv', org)).to.be.false;
    });

    it('gets enabled site ids for a handler', () => {
      expect(instance.getEnabledSiteIdsForHandler('lhs-mobile')).to.deep.equal(['c6f41da6-3a7e-4a59-8b8d-2da742ac2dbe']);
      delete instance.record.handlers;
      expect(instance.getEnabledSiteIdsForHandler('lhs-mobile')).to.deep.equal([]);
    });

    it('gets all enabled audits for a site', () => {
      expect(Object.keys(instance.getHandlers() || {})
        .filter((handler) => instance.isHandlerEnabledForSite(handler, site))).to.deep.equal(['404', 'rum-ingest', 'sitemap', 'lhs-mobile']);
      expect(instance.getEnabledAuditsForSite(site)).to.deep.equal(['lhs-mobile', '404']);
    });

    it('gets all disabled audits for a site', () => {
      expect(Object.keys(instance.getHandlers() || {})
        .filter((handler) => !instance.isHandlerEnabledForSite(handler, site))).to.deep.equal(['organic-keywords', 'cwv']);
      expect(instance.getDisabledAuditsForSite(site)).to.deep.equal(['cwv', 'organic-keywords']);
    });

    it('returns empty array for disabled audits when no handlers exist', () => {
      delete instance.record.handlers;
      expect(instance.getDisabledAuditsForSite(site)).to.deep.equal([]);
    });

    it('returns empty array for disabled audits when no jobs exist', () => {
      delete instance.record.jobs;
      expect(instance.getDisabledAuditsForSite(site)).to.deep.equal([]);
    });
  });

  describe('manage handlers', () => {
    it('adds a new handler', () => {
      const handlerData = {
        enabledByDefault: true,
      };

      instance.addHandler('new-handler', handlerData);
      expect(instance.getHandler('new-handler')).to.deep.equal(handlerData);
    });

    it('updates handler orgs for a handler disabled by default with enabled', () => {
      instance.updateHandlerOrgs('lhs-mobile', org.getId(), true);
      expect(instance.getHandler('lhs-mobile').enabled.orgs).to.include(org.getId());
    });

    it('updates handler orgs for a handler disabled by default with disabled', () => {
      instance.updateHandlerOrgs('404', org.getId(), false);
      expect(instance.getHandler('404').disabled.orgs).to.include(org.getId());
    });

    it('updates handler orgs for a handler enabled by default', () => {
      instance.updateHandlerOrgs('404', org.getId(), true);
      expect(instance.getHandler('404').disabled.orgs).to.not.include(org.getId());
    });

    it('updates handler sites for a handler disabled by default', () => {
      instance.updateHandlerSites('lhs-mobile', site.getId(), true);
      expect(instance.getHandler('lhs-mobile').enabled.sites).to.include(site.getId());
    });

    it('updates handler sites for a handler enabled by default', () => {
      instance.updateHandlerSites('404', site.getId(), true);
      expect(instance.getHandler('404').disabled.sites).to.not.include(site.getId());
    });

    it('enables a handler for a site', () => {
      instance.enableHandlerForSite('organic-keywords', site);
      expect(instance.isHandlerEnabledForSite('organic-keywords', site)).to.be.true;
      expect(instance.getHandler('organic-keywords').enabled.sites).to.include(site.getId());
    });

    it('tries to enable a handler for a site with un-met dependencies', () => {
      instance.disableHandlerForSite('organic-keywords', site);
      expect(instance.getHandler('organic-keywords').enabled?.sites || []).to.not.include(site.getId());
      instance.addHandler('new-handler', {
        enabledByDefault: false,
        dependencies: [{ handler: 'organic-keywords', actions: ['action'] }],
        enabled: { sites: [], orgs: [] },
      });
      expect(() => instance.enableHandlerForSite('new-handler', site)).to.throw(Error, 'Cannot enable handler new-handler for site c6f41da6-3a7e-4a59-8b8d-2da742ac2dbe because of missing dependencies: organic-keywords');
      expect(instance.getHandler('new-handler').enabled.sites).to.not.include(site.getId());
    });

    it('enables a handler for a site with met dependencies', () => {
      instance.addHandler('new-handler', {
        enabledByDefault: false,
        dependencies: [{ handler: 'organic-keywords', actions: ['action'] }],
        enabled: { sites: [], orgs: [] },
      });
      instance.enableHandlerForSite('organic-keywords', site);
      expect(instance.getHandler('organic-keywords').enabled.sites).to.include(site.getId());
      instance.enableHandlerForSite('new-handler', site);
      expect(instance.getHandler('new-handler').enabled.sites).to.include(site.getId());
    });

    it('disables a handler for a site', () => {
      instance.enableHandlerForSite('organic-keywords', site);
      instance.disableHandlerForSite('organic-keywords', site);
      expect(instance.getHandler('organic-keywords').disabled.sites).to.not.include(site.getId());
    });

    it('enables a handler for an organization', () => {
      instance.enableHandlerForOrg('404', org);
      expect(instance.getHandler('404').disabled.orgs).to.not.include(org.getId());
    });

    it('tries to enable a handler for an organization with un-met dependencies', () => {
      expect(instance.getHandler('organic-keywords').enabled.orgs).to.not.include(org.getId());
      instance.addHandler('new-handler', {
        enabledByDefault: false,
        dependencies: [{ handler: 'organic-keywords', actions: ['action'] }],
        enabled: { sites: [], orgs: [] },
      });
      expect(() => instance.enableHandlerForOrg('new-handler', org)).to.throw(Error, 'Cannot enable handler new-handler for org 757ceb98-05c8-4e07-bb23-bc722115b2b0 because of missing dependencies: organic-keywords');
      expect(instance.getHandler('new-handler').enabled.orgs).to.not.include(org.getId());
    });

    it('enables a handler for an organization with met dependencies', () => {
      instance.addHandler('new-handler', {
        enabledByDefault: false,
        dependencies: [{ handler: 'organic-keywords', actions: ['action'] }],
        enabled: { sites: [], orgs: [] },
      });
      instance.enableHandlerForOrg('organic-keywords', org);
      expect(instance.getHandler('organic-keywords').enabled.orgs).to.include(org.getId());
      instance.enableHandlerForOrg('new-handler', org);
      expect(instance.getHandler('new-handler').enabled.orgs).to.include(org.getId());
    });

    it('disables a handler for an organization', () => {
      instance.enableHandlerForOrg('organic-keywords', org);
      instance.disableHandlerForOrg('organic-keywords', org);
      expect(instance.getHandler('organic-keywords').enabled.orgs).to.not.include(org.getId());
    });
  });

  describe('sandbox audit configuration', () => {
    const sandboxSite = {
      getId: () => 'sandbox-site-id',
      getOrganizationId: () => 'sandbox-org-id',
      isSandbox: true,
    };

    beforeEach(() => {
      // Add sandbox audit config to the test configuration
      instance.state = {
        version: 1,
        queues: { test: 'test' },
        jobs: [],
        handlers: {},
      };
      // Set sandboxAudits using the proper attribute setter
      instance.setSandboxAudits({
        enabledAudits: {
          cwv: {
            expire: '5',
          },
          'alt-text': {},
        },
      });
    });

    it('checks if audit is enabled for sandbox', () => {
      expect(instance.isAuditEnabledForSandbox('cwv')).to.be.true;
      expect(instance.isAuditEnabledForSandbox('alt-text')).to.be.true;
      expect(instance.isAuditEnabledForSandbox('non-existent')).to.be.false;
    });

    it('gets sandbox audit config', () => {
      expect(instance.getSandboxAuditConfig('cwv')).to.deep.equal({ expire: '5' });
      expect(instance.getSandboxAuditConfig('alt-text')).to.deep.equal({});
      expect(instance.getSandboxAuditConfig('non-existent')).to.be.null;
    });

    it('gets all enabled sandbox audits', () => {
      expect(instance.getEnabledSandboxAudits()).to.deep.equal(['cwv', 'alt-text']);
    });

    it('updates sandbox audit config', () => {
      instance.updateSandboxAuditConfig('new-audit', { expire: '5' });
      expect(instance.getSandboxAuditConfig('new-audit')).to.deep.equal({ expire: '5' });
    });

    it('removes sandbox audit config', () => {
      instance.updateSandboxAuditConfig('cwv', null);
      expect(instance.isAuditEnabledForSandbox('cwv')).to.be.false;
    });

    it('enables handler for sandbox site regardless of other settings', () => {
      // Even though cwv is disabled for the site in the regular handlers config
      expect(instance.isHandlerEnabledForSite('cwv', sandboxSite)).to.be.true;

      // Should still respect regular config for non-sandbox sites
      expect(instance.isHandlerEnabledForSite('cwv', site)).to.be.false;
    });

    it('returns empty array when no sandbox audits configured', () => {
      instance.setSandboxAudits(null);
      expect(instance.getEnabledSandboxAudits()).to.deep.equal([]);
    });

    it('handles updating non-existent sandbox config', () => {
      instance.setSandboxAudits(null);
      instance.updateSandboxAuditConfig('new-audit', { expire: '5' });
      expect(instance.getSandboxAuditConfig('new-audit')).to.deep.equal({ expire: '5' });
    });

    it('handles getSandboxAuditConfig when sandboxAudits is null', () => {
      instance.setSandboxAudits(null);
      expect(instance.getSandboxAuditConfig('any-audit')).to.be.null;
    });

    it('handles getSandboxAuditConfig when sandboxAudits is undefined', () => {
      instance.setSandboxAudits(undefined);
      expect(instance.getSandboxAuditConfig('any-audit')).to.be.null;
    });

    it('handles getSandboxAuditConfig when enabledAudits is null', () => {
      instance.setSandboxAudits({ enabledAudits: null });
      expect(instance.getSandboxAuditConfig('any-audit')).to.be.null;
    });

    it('handles getEnabledSandboxAudits when sandboxAudits is null', () => {
      instance.setSandboxAudits(null);
      expect(instance.getEnabledSandboxAudits()).to.deep.equal([]);
    });

    it('handles getEnabledSandboxAudits when sandboxAudits is undefined', () => {
      instance.setSandboxAudits(undefined);
      expect(instance.getEnabledSandboxAudits()).to.deep.equal([]);
    });

    it('handles getEnabledSandboxAudits when enabledAudits is null', () => {
      instance.setSandboxAudits({ enabledAudits: null });
      expect(instance.getEnabledSandboxAudits()).to.deep.equal([]);
    });

    it('handles isAuditEnabledForSandbox when sandboxAudits is null', () => {
      instance.setSandboxAudits(null);
      expect(instance.isAuditEnabledForSandbox('any-audit')).to.be.false;
    });

    it('handles isAuditEnabledForSandbox when sandboxAudits is undefined', () => {
      instance.setSandboxAudits(undefined);
      expect(instance.isAuditEnabledForSandbox('any-audit')).to.be.false;
    });

    it('handles isAuditEnabledForSandbox when enabledAudits is null', () => {
      instance.setSandboxAudits({ enabledAudits: null });
      expect(instance.isAuditEnabledForSandbox('any-audit')).to.be.false;
    });

    it('checks if configuration has sandbox audits', () => {
      // Should return true when sandbox audits are configured
      expect(instance.hasSandboxAudits()).to.be.true;

      // Should return false when sandbox audits are null
      instance.setSandboxAudits(null);
      expect(instance.hasSandboxAudits()).to.be.false;

      // Should return false when sandbox audits are undefined
      instance.setSandboxAudits(undefined);
      expect(instance.hasSandboxAudits()).to.be.false;

      // Should return false when enabledAudits is empty
      instance.setSandboxAudits({ enabledAudits: {} });
      expect(instance.hasSandboxAudits()).to.be.false;

      // Should return false when enabledAudits is null
      instance.setSandboxAudits({ enabledAudits: null });
      expect(instance.hasSandboxAudits()).to.be.false;

      // Should return true when enabledAudits has content
      instance.setSandboxAudits({ enabledAudits: { cwv: {} } });
      expect(instance.hasSandboxAudits()).to.be.true;
    });
  });

  describe('Handler Management', () => {
    it('handles disableHandlerForSite when handler is not enabled', () => {
      const mockSite = {
        getId: () => 'site2',
        getOrganizationId: () => 'org2',
      };
      // Should not throw error when trying to disable non-enabled handler
      expect(() => instance.disableHandlerForSite('cwv', mockSite)).to.not.throw();
    });

    it('handles disableHandlerForOrg when handler is not enabled', () => {
      const mockOrg = { getId: () => 'org2' };
      // Should not throw error when trying to disable non-enabled handler
      expect(() => instance.disableHandlerForOrg('cwv', mockOrg)).to.not.throw();
    });
  });

  describe('save', () => {
    it('saves the configuration', async () => {
      instance.collection = {
        create: stub().resolves(),
      };

      await instance.save();

      expect(instance.collection.create).to.have.been.calledOnceWithExactly(
        sanitizeIdAndAuditFields('Configuration', instance.toJSON()),
      );
    });
  });
});
