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

    it('returns empty array for enabled audits when handlers is null', () => {
      delete instance.record.handlers;
      expect(instance.getEnabledAuditsForSite(site)).to.deep.equal([]);
    });

    it('returns empty array for enabled audits when jobs is null', () => {
      delete instance.record.jobs;
      expect(instance.getEnabledAuditsForSite(site)).to.deep.equal([]);
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

    it('adds a new handler when handlers object is null', () => {
      delete instance.record.handlers;

      const handlerData = {
        enabledByDefault: true,
      };

      instance.addHandler('first-handler', handlerData);
      expect(instance.getHandler('first-handler')).to.deep.equal(handlerData);
    });

    it('checks if handler is enabled for site when disabled.orgs is missing', () => {
      instance.addHandler('test-missing-orgs', {
        enabledByDefault: true,
        disabled: { sites: [] },
      });

      const isEnabled = instance.isHandlerEnabledForSite('test-missing-orgs', site);
      expect(isEnabled).to.be.true;
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

    it('disables a handler for a site when not enabled (early return)', () => {
      const handler = instance.getHandler('organic-keywords');
      const initialState = JSON.parse(JSON.stringify(handler));

      instance.disableHandlerForSite('organic-keywords', site);

      expect(instance.getHandler('organic-keywords')).to.deep.equal(initialState);
    });

    it('disables a handler for an organization when not enabled (early return)', () => {
      const handler = instance.getHandler('organic-keywords');
      const initialState = JSON.parse(JSON.stringify(handler));

      instance.disableHandlerForOrg('organic-keywords', org);

      expect(instance.getHandler('organic-keywords')).to.deep.equal(initialState);
    });

    it('disables a handler enabled by default when disabled array does not exist', () => {
      instance.addHandler('test-handler-enabled', {
        enabledByDefault: true,
      });

      instance.disableHandlerForSite('test-handler-enabled', site);

      expect(instance.getHandler('test-handler-enabled').disabled.sites).to.include(site.getId());
    });

    it('enables a handler not enabled by default when enabled array does not exist', () => {
      instance.addHandler('test-handler-not-enabled', {
        enabledByDefault: false,
      });

      instance.enableHandlerForSite('test-handler-not-enabled', site);

      expect(instance.getHandler('test-handler-not-enabled').enabled.sites).to.include(site.getId());
    });

    it('enables a handler enabled by default that was previously disabled', () => {
      instance.disableHandlerForSite('404', site);
      expect(instance.getHandler('404').disabled.sites).to.include(site.getId());

      instance.enableHandlerForSite('404', site);
      expect(instance.getHandler('404').disabled.sites).to.not.include(site.getId());
    });

    it('handles handler with disabled object missing sites array', () => {
      instance.addHandler('test-handler-partial-disabled', {
        enabledByDefault: true,
        disabled: { orgs: [] },
      });

      instance.disableHandlerForSite('test-handler-partial-disabled', site);

      expect(instance.getHandler('test-handler-partial-disabled').disabled.sites).to.include(site.getId());
    });

    it('handles handler with enabled object missing sites array', () => {
      instance.addHandler('test-handler-partial-enabled', {
        enabledByDefault: false,
        enabled: { orgs: [] },
      });

      instance.enableHandlerForSite('test-handler-partial-enabled', site);

      expect(instance.getHandler('test-handler-partial-enabled').enabled.sites).to.include(site.getId());
    });

    it('handles handler with disabled object missing orgs array when checking if enabled', () => {
      instance.addHandler('test-handler-no-orgs', {
        enabledByDefault: true,
        disabled: { sites: [] },
      });

      const isEnabled = instance.isHandlerEnabledForOrg('test-handler-no-orgs', org);
      expect(isEnabled).to.be.true;
    });

    it('returns early when trying to enable a non-existent handler', () => {
      const handlers = instance.getHandlers();
      const initialHandlers = JSON.parse(JSON.stringify(handlers));

      instance.enableHandlerForSite('non-existent-handler', site);

      expect(instance.getHandlers()).to.deep.equal(initialHandlers);
    });

    it('disables a handler not enabled by default when enabled array exists', () => {
      instance.enableHandlerForSite('organic-keywords', site);
      expect(instance.getHandler('organic-keywords').enabled.sites).to.include(site.getId());

      instance.disableHandlerForSite('organic-keywords', site);
      expect(instance.getHandler('organic-keywords').enabled.sites).to.not.include(site.getId());
    });

    it('registers a new audit', () => {
      const auditType = 'structured-data';
      instance.registerAudit(auditType, true, 'weekly', ['ASO']);
      expect(instance.getHandler(auditType)).to.deep.equal({
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
        productCodes: ['ASO'],
      });
      expect(instance.getJobs().find((job) => job.group === 'audits' && job.type === auditType)).to.deep.equal({
        group: 'audits',
        type: 'structured-data',
        interval: 'weekly',
      });
    });

    it('throws error when registering an empty audit type', () => {
      expect(() => instance.registerAudit('', true, 'weekly', ['ASO'])).to.throw(Error, 'Audit type must be a non-empty string');
    });

    it('throws error when registering a null audit type', () => {
      expect(() => instance.registerAudit(null, true, 'weekly', ['ASO'])).to.throw(Error, 'Audit type must be a non-empty string');
    });

    it('throws error when audit name exceeds 37 characters', () => {
      const longAuditType = 'this-is-a-very-long-audit-name-that-exceeds-37-characters';
      expect(() => instance.registerAudit(longAuditType, true, 'weekly', ['ASO'])).to.throw(Error, 'Audit type must not exceed 37 characters');
    });

    it('throws error when audit name contains invalid characters', () => {
      expect(() => instance.registerAudit('invalid@audit!', true, 'weekly', ['ASO'])).to.throw(Error, 'Audit type can only contain lowercase letters, numbers, and hyphens');
    });

    it('throws error when audit name contains spaces', () => {
      expect(() => instance.registerAudit('invalid audit', true, 'weekly', ['ASO'])).to.throw(Error, 'Audit type can only contain lowercase letters, numbers, and hyphens');
    });

    it('throws error when audit name contains underscores', () => {
      expect(() => instance.registerAudit('invalid_audit', true, 'weekly', ['ASO'])).to.throw(Error, 'Audit type can only contain lowercase letters, numbers, and hyphens');
    });

    it('throws error when audit name contains uppercase letters', () => {
      expect(() => instance.registerAudit('MyAudit', true, 'weekly', ['ASO'])).to.throw(Error, 'Audit type can only contain lowercase letters, numbers, and hyphens');
    });

    it('throws error when audit name contains mixed case letters', () => {
      expect(() => instance.registerAudit('my-Custom-Audit', true, 'weekly', ['ASO'])).to.throw(Error, 'Audit type can only contain lowercase letters, numbers, and hyphens');
    });

    it('throws error when audit name starts with uppercase letter', () => {
      expect(() => instance.registerAudit('Custom-audit', true, 'weekly', ['ASO'])).to.throw(Error, 'Audit type can only contain lowercase letters, numbers, and hyphens');
    });

    it('throws error when registering an already registered audit', () => {
      expect(() => instance.registerAudit('404', true, 'weekly', ['ASO'])).to.throw(Error, 'Audit type "404" is already registered');
    });

    it('allows registering any valid audit type as string', () => {
      const auditType = 'my-custom-audit-123';
      instance.registerAudit(auditType, true, 'weekly', ['ASO']);
      expect(instance.getHandler(auditType)).to.deep.equal({
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
        productCodes: ['ASO'],
      });
      expect(instance.getJobs().find((job) => job.group === 'audits' && job.type === auditType)).to.deep.equal({
        group: 'audits',
        type: 'my-custom-audit-123',
        interval: 'weekly',
      });
    });

    it('registers audit when handlers is null', () => {
      const getHandlersStub = stub(instance, 'getHandlers');
      getHandlersStub.onFirstCall().returns(null);
      getHandlersStub.callThrough();

      const auditType = 'first-audit';
      instance.registerAudit(auditType, true, 'daily', ['ASO']);

      const handler = instance.getHandler(auditType);
      expect(handler).to.exist;
      expect(handler.enabledByDefault).to.be.true;
      expect(handler.productCodes).to.deep.equal(['ASO']);

      getHandlersStub.restore();
    });

    it('throws error when registering an invalid job interval', () => {
      expect(() => instance.registerAudit('new-test-audit', true, 'invalid-interval', ['ASO'])).to.throw(Error, 'Invalid interval invalid-interval');
    });

    it('throws error when registering an invalid product code', () => {
      expect(() => instance.registerAudit('new-test-audit-2', true, 'weekly', ['invalid'])).to.throw(Error, 'Invalid product codes provided');
    });

    it('throws error when registering an empty product code', () => {
      expect(() => instance.registerAudit('new-test-audit-3', true, 'weekly', [])).to.throw(Error, 'No product codes provided');
    });

    it('unregisters an audit', () => {
      const auditType = 'lhs-mobile';
      instance.unregisterAudit(auditType);
      expect(instance.getHandler(auditType)).to.be.undefined;
      expect(instance.getJobs().find((job) => job.group === 'audits' && job.type === auditType)).to.be.undefined;
    });

    it('throws error when unregistering an empty audit type', () => {
      expect(() => instance.unregisterAudit('')).to.throw(Error, 'Audit type must be a non-empty string');
    });

    it('throws error when unregistering a null audit type', () => {
      expect(() => instance.unregisterAudit(null)).to.throw(Error, 'Audit type must be a non-empty string');
    });

    it('throws error when unregistering a non-existent audit', () => {
      expect(() => instance.unregisterAudit('non-existent-audit')).to.throw(Error, 'Audit type "non-existent-audit" is not registered');
    });
  });

  describe('updateQueues', () => {
    it('merges single queue URL while keeping others', () => {
      const existingQueues = instance.getQueues();

      instance.updateQueues({
        audits: 'sqs://new-audit-queue',
      });

      const updatedQueues = instance.getQueues();
      expect(updatedQueues.audits).to.equal('sqs://new-audit-queue');
      expect(updatedQueues.imports).to.equal(existingQueues.imports);
      expect(updatedQueues.reports).to.equal(existingQueues.reports);
      expect(updatedQueues.scrapes).to.equal(existingQueues.scrapes);
    });

    it('merges multiple queue URLs while keeping others', () => {
      const existingQueues = instance.getQueues();

      instance.updateQueues({
        audits: 'sqs://new-audit-queue',
        imports: 'sqs://new-import-queue',
      });

      const updatedQueues = instance.getQueues();
      expect(updatedQueues.audits).to.equal('sqs://new-audit-queue');
      expect(updatedQueues.imports).to.equal('sqs://new-import-queue');
      expect(updatedQueues.reports).to.equal(existingQueues.reports);
      expect(updatedQueues.scrapes).to.equal(existingQueues.scrapes);
    });

    it('updates all queues successfully', () => {
      const newQueues = {
        audits: 'sqs://new-audit-queue',
        imports: 'sqs://new-import-queue',
        reports: 'sqs://new-report-queue',
        scrapes: 'sqs://new-scrape-queue',
      };

      instance.updateQueues(newQueues);

      expect(instance.getQueues()).to.deep.equal(newQueues);
    });

    it('adds new queue type while keeping existing ones', () => {
      const existingQueues = instance.getQueues();

      instance.updateQueues({
        newQueueType: 'sqs://new-queue-type',
      });

      const updatedQueues = instance.getQueues();
      expect(updatedQueues.newQueueType).to.equal('sqs://new-queue-type');
      expect(updatedQueues.audits).to.equal(existingQueues.audits);
      expect(updatedQueues.imports).to.equal(existingQueues.imports);
    });

    it('throws error when queues is not provided', () => {
      expect(() => instance.updateQueues(null)).to.throw(Error, 'Queues configuration cannot be empty');
    });

    it('throws error when queues is empty object', () => {
      expect(() => instance.updateQueues({})).to.throw(Error, 'Queues configuration cannot be empty');
    });
  });

  describe('updateJob', () => {
    it('updates job interval successfully', () => {
      instance.updateJob('404', { interval: 'weekly' });

      const job = instance.getJobs().find((j) => j.type === '404');
      expect(job.interval).to.equal('weekly');
    });

    it('updates job group successfully', () => {
      instance.updateJob('404', { group: 'audits' });

      const job = instance.getJobs().find((j) => j.type === '404');
      expect(job.group).to.equal('audits');
    });

    it('updates both interval and group successfully', () => {
      instance.updateJob('404', { interval: 'monthly', group: 'audits' });

      const job = instance.getJobs().find((j) => j.type === '404');
      expect(job.interval).to.equal('monthly');
      expect(job.group).to.equal('audits');
    });

    it('throws error when job type not found', () => {
      expect(() => instance.updateJob('non-existent-job', { interval: 'daily' })).to.throw(Error, 'Job type "non-existent-job" not found in configuration');
    });

    it('throws error when invalid interval provided', () => {
      expect(() => instance.updateJob('404', { interval: 'invalid-interval' })).to.throw(Error, 'Invalid interval "invalid-interval"');
    });

    it('throws error when invalid group provided', () => {
      expect(() => instance.updateJob('404', { group: 'invalid-group' })).to.throw(Error, 'Invalid group "invalid-group"');
    });
  });

  describe('updateHandlerProperties', () => {
    it('updates handler enabledByDefault successfully', () => {
      instance.updateHandlerProperties('404', { enabledByDefault: false });

      const handler = instance.getHandler('404');
      expect(handler.enabledByDefault).to.be.false;
    });

    it('updates handler productCodes successfully', () => {
      const newProductCodes = ['ASO', 'LLMO'];
      instance.updateHandlerProperties('404', { productCodes: newProductCodes });

      const handler = instance.getHandler('404');
      expect(handler.productCodes).to.deep.equal(newProductCodes);
    });

    it('updates handler dependencies successfully', () => {
      const newDependencies = [{ handler: 'cwv', actions: ['test'] }];
      instance.updateHandlerProperties('404', { dependencies: newDependencies });

      const handler = instance.getHandler('404');
      expect(handler.dependencies).to.deep.equal(newDependencies);
    });

    it('updates handler movingAvgThreshold successfully', () => {
      instance.updateHandlerProperties('404', { movingAvgThreshold: 5 });

      const handler = instance.getHandler('404');
      expect(handler.movingAvgThreshold).to.equal(5);
    });

    it('updates handler percentageChangeThreshold successfully', () => {
      instance.updateHandlerProperties('404', { percentageChangeThreshold: 10 });

      const handler = instance.getHandler('404');
      expect(handler.percentageChangeThreshold).to.equal(10);
    });

    it('updates multiple handler properties at once', () => {
      instance.updateHandlerProperties('404', {
        enabledByDefault: false,
        productCodes: ['ASO'],
        movingAvgThreshold: 7,
      });

      const handler = instance.getHandler('404');
      expect(handler.enabledByDefault).to.be.false;
      expect(handler.productCodes).to.deep.equal(['ASO']);
      expect(handler.movingAvgThreshold).to.equal(7);
    });

    it('throws error when handler not found', () => {
      expect(() => instance.updateHandlerProperties('non-existent', { enabledByDefault: true })).to.throw(Error, 'Handler "non-existent" not found in configuration');
    });

    it('throws error when productCodes is empty array', () => {
      expect(() => instance.updateHandlerProperties('404', { productCodes: [] })).to.throw(Error, 'productCodes must be a non-empty array');
    });

    it('throws error when productCodes is not an array', () => {
      expect(() => instance.updateHandlerProperties('404', { productCodes: 'invalid' })).to.throw(Error, 'productCodes must be a non-empty array');
    });

    it('throws error when invalid product code provided', () => {
      expect(() => instance.updateHandlerProperties('404', { productCodes: ['INVALID_CODE'] })).to.throw(Error, 'Invalid product codes provided');
    });

    it('throws error when dependency handler does not exist', () => {
      expect(() => instance.updateHandlerProperties('404', {
        dependencies: [{ handler: 'non-existent-handler', actions: ['test'] }],
      })).to.throw(Error, 'Dependency handler "non-existent-handler" does not exist in configuration');
    });

    it('throws error when movingAvgThreshold is less than 1', () => {
      expect(() => instance.updateHandlerProperties('404', { movingAvgThreshold: 0 })).to.throw(Error, 'movingAvgThreshold must be greater than or equal to 1');
    });

    it('throws error when percentageChangeThreshold is less than 1', () => {
      expect(() => instance.updateHandlerProperties('404', { percentageChangeThreshold: 0 })).to.throw(Error, 'percentageChangeThreshold must be greater than or equal to 1');
    });
  });

  describe('updateConfiguration', () => {
    it('merges handlers - adds new handler while keeping existing ones', () => {
      const newHandler = {
        'new-test-handler': {
          enabledByDefault: true,
          productCodes: ['ASO'],
        },
      };

      instance.updateConfiguration({ handlers: newHandler });

      const updatedHandlers = instance.getHandlers();
      expect(updatedHandlers['404']).to.exist;
      expect(updatedHandlers.cwv).to.exist;
      expect(updatedHandlers['new-test-handler']).to.deep.equal(newHandler['new-test-handler']);
    });

    it('merges handlers - updates existing handler properties', () => {
      const existingCwv = instance.getHandler('cwv');

      instance.updateConfiguration({
        handlers: {
          cwv: {
            movingAvgThreshold: 20,
          },
        },
      });

      const updatedCwv = instance.getHandler('cwv');
      expect(updatedCwv.enabledByDefault).to.equal(existingCwv.enabledByDefault);
      expect(updatedCwv.productCodes).to.deep.equal(existingCwv.productCodes);
      expect(updatedCwv.movingAvgThreshold).to.equal(20);
    });

    it('merges jobs - updates existing job interval', () => {
      instance.updateConfiguration({
        jobs: [{ group: 'audits', type: 'cwv', interval: 'weekly' }],
      });

      const updatedJobs = instance.getJobs();
      const updatedCwvJob = updatedJobs.find((j) => j.type === 'cwv');

      expect(updatedCwvJob.interval).to.equal('weekly');
      expect(updatedJobs.length).to.be.greaterThan(1);
      expect(updatedJobs.find((j) => j.type === '404')).to.exist;
    });

    it('merges jobs - adds new job while keeping existing ones', () => {
      const existingJobs = instance.getJobs();

      instance.updateConfiguration({
        jobs: [{ group: 'audits', type: 'new-test-job', interval: 'monthly' }],
      });

      const updatedJobs = instance.getJobs();

      expect(updatedJobs.length).to.equal(existingJobs.length + 1);
      expect(updatedJobs.find((j) => j.type === 'new-test-job')).to.deep.equal({
        group: 'audits',
        type: 'new-test-job',
        interval: 'monthly',
      });
    });

    it('merges queues - updates specific queue URLs while keeping others', () => {
      const existingQueues = instance.getQueues();

      instance.updateConfiguration({
        queues: {
          audits: 'sqs://new-audit-queue',
        },
      });

      const updatedQueues = instance.getQueues();

      expect(updatedQueues.audits).to.equal('sqs://new-audit-queue');
      expect(updatedQueues.imports).to.equal(existingQueues.imports);
      expect(updatedQueues.reports).to.equal(existingQueues.reports);
    });

    it('merges multiple sections at once', () => {
      instance.updateConfiguration({
        handlers: {
          cwv: { movingAvgThreshold: 15 },
        },
        jobs: [{ group: 'audits', type: 'cwv', interval: 'daily' }],
        queues: { audits: 'sqs://audit-queue' },
      });

      const updatedHandlers = instance.getHandlers();
      const updatedJobs = instance.getJobs();
      const updatedQueues = instance.getQueues();

      expect(updatedHandlers['404']).to.exist;
      expect(updatedHandlers.cwv.movingAvgThreshold).to.equal(15);
      expect(updatedJobs.find((j) => j.type === '404')).to.exist;
      expect(updatedJobs.find((j) => j.type === 'cwv').interval).to.equal('daily');
      expect(updatedQueues.audits).to.equal('sqs://audit-queue');
    });

    it('handles null handlers gracefully when merging', () => {
      const getHandlersStub = stub(instance, 'getHandlers');
      getHandlersStub.onFirstCall().returns(null);
      getHandlersStub.callThrough();

      instance.updateConfiguration({
        handlers: {
          'new-handler': {
            enabledByDefault: true,
            productCodes: ['ASO'],
          },
        },
      });

      const handlers = instance.getHandlers();
      expect(handlers['new-handler']).to.exist;
      expect(handlers['new-handler'].enabledByDefault).to.be.true;

      getHandlersStub.restore();
    });

    it('handles null jobs gracefully when merging', () => {
      const getJobsStub = stub(instance, 'getJobs');
      getJobsStub.onFirstCall().returns(null);
      getJobsStub.callThrough();

      instance.updateConfiguration({
        jobs: [{
          type: 'new-job',
          group: 'audits',
          interval: 'daily',
        }],
      });

      const jobs = instance.getJobs();
      expect(jobs).to.be.an('array');
      expect(jobs.find((j) => j.type === 'new-job')).to.exist;

      getJobsStub.restore();
    });

    it('handles null queues gracefully when merging', () => {
      const getQueuesStub = stub(instance, 'getQueues');
      getQueuesStub.onFirstCall().returns(null);
      getQueuesStub.callThrough();

      instance.updateConfiguration({
        queues: {
          audits: 'sqs://new-queue',
        },
      });

      const queues = instance.getQueues();
      expect(queues).to.be.an('object');
      expect(queues.audits).to.equal('sqs://new-queue');

      getQueuesStub.restore();
    });

    it('throws error when data is not provided', () => {
      expect(() => instance.updateConfiguration(null)).to.throw(Error, 'Configuration data cannot be empty');
    });

    it('throws error when data is empty object', () => {
      expect(() => instance.updateConfiguration({})).to.throw(Error, 'Configuration data cannot be empty');
    });

    it('throws error when handlers is not an object', () => {
      expect(() => instance.updateConfiguration({ handlers: 'invalid' })).to.throw(Error, 'Handlers must be a non-empty object if provided');
    });

    it('throws error when handlers is empty object', () => {
      expect(() => instance.updateConfiguration({ handlers: {} })).to.throw(Error, 'Handlers must be a non-empty object if provided');
    });

    it('throws error when jobs is not an array', () => {
      expect(() => instance.updateConfiguration({ jobs: 'invalid' })).to.throw(Error, 'Jobs must be an array if provided');
    });

    it('throws error when queues is not an object', () => {
      expect(() => instance.updateConfiguration({ queues: 'invalid' })).to.throw(Error, 'Queues must be a non-empty object if provided');
    });

    it('throws error when queues is empty object', () => {
      expect(() => instance.updateConfiguration({ queues: {} })).to.throw(Error, 'Queues must be a non-empty object if provided');
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
