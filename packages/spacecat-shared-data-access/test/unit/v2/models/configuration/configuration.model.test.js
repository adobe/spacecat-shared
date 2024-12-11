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
import { Entity } from 'electrodb';
import { spy, stub } from 'sinon';
import sinonChai from 'sinon-chai';

import Configuration from '../../../../../src/v2/models/configuration/configuration.model.js';
import ConfigurationSchema from '../../../../../src/v2/models/configuration/configuration.schema.js';
import configurationFixtures from '../../../../fixtures/configurations.fixture.js';
import { sanitizeIdAndAuditFields } from '../../../../../src/v2/util/util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(ConfigurationSchema).model.schema;
const sampleConfiguration = configurationFixtures[0];
const site = {
  getId: () => 'c6f41da6-3a7e-4a59-8b8d-2da742ac2dbe',
  getOrganizationId: () => '757ceb98-05c8-4e07-bb23-bc722115b2b0',
};

const org = {
  getId: () => site.getOrganizationId(),
};

describe('Configuration', () => {
  let configurationInstance;
  let mockElectroService;
  let mockModelFactory;
  let mockRecord;
  let mockLogger;

  beforeEach(() => {
    mockElectroService = {
      entities: {
        configuration: {
          model: {
            name: 'configuration',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['configurationId'],
                },
              },
            },
          },
          patch: stub().returns({
            set: stub(),
          }),
        },
      },
    };

    mockModelFactory = {
      getCollection: stub(),
    };

    mockLogger = {
      error: spy(),
    };

    mockRecord = { ...sampleConfiguration };

    configurationInstance = new Configuration(
      mockElectroService,
      mockModelFactory,
      mockRecord,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the Configuration instance correctly', () => {
      expect(configurationInstance).to.be.an('object');
      expect(configurationInstance.record).to.deep.equal(mockRecord);
    });
  });

  describe('configurationId', () => {
    it('gets configurationId', () => {
      expect(configurationInstance.getId()).to.equal(sampleConfiguration.configurationId);
    });
  });

  describe('attributes', () => {
    it('gets version', () => {
      expect(configurationInstance.getVersion()).to.equal(2);
    });

    it('gets queues', () => {
      expect(configurationInstance.getQueues()).to.deep.equal(sampleConfiguration.queues);
    });

    it('gets jobs', () => {
      expect(configurationInstance.getJobs()).to.deep.equal(sampleConfiguration.jobs);
    });

    it('gets handlers', () => {
      expect(configurationInstance.getHandlers()).to.deep.equal(sampleConfiguration.handlers);
    });

    it('gets handler', () => {
      expect(configurationInstance.getHandler('apex')).to.deep.equal(sampleConfiguration.handlers.apex);
    });

    it('gets slackRoles', () => {
      expect(configurationInstance.getSlackRoles()).to.deep.equal(sampleConfiguration.slackRoles);
    });

    it('gets slackRoleMembersByRole', () => {
      expect(configurationInstance.getSlackRoleMembersByRole('scrape')).to.deep.equal(sampleConfiguration.slackRoles.scrape);
      delete configurationInstance.record.slackRoles;
      expect(configurationInstance.getSlackRoleMembersByRole('scrape')).to.deep.equal([]);
    });
  });

  describe('handler enabled/disabled', () => {
    it('returns false if a handler does not exist', () => {
      expect(configurationInstance.isHandlerEnabledForSite('non-existent-handler', site)).to.be.false;
      expect(configurationInstance.isHandlerEnabledForOrg('non-existent-handler', org)).to.be.false;
    });

    it('returns true if a handler is enabled by default', () => {
      expect(configurationInstance.isHandlerEnabledForSite('404', site)).to.be.true;
      expect(configurationInstance.isHandlerEnabledForOrg('404', org)).to.be.true;
    });

    it('returns false if a handler is not enabled by default', () => {
      expect(configurationInstance.isHandlerEnabledForSite('organic-keywords', site)).to.be.false;
      expect(configurationInstance.isHandlerEnabledForOrg('organic-keywords', org)).to.be.false;
    });

    it('returns true when a handler is enabled for a site', () => {
      expect(configurationInstance.isHandlerEnabledForSite('lhs-mobile', site)).to.be.true;
    });

    it('returns false when a handler is disabled for a site', () => {
      expect(configurationInstance.isHandlerEnabledForSite('cwv', site)).to.be.false;
    });

    it('returns true when a handler is enabled for an organization', () => {
      expect(configurationInstance.isHandlerEnabledForOrg('lhs-mobile', org)).to.be.true;
    });

    it('returns false when a handler is disabled for an organization', () => {
      expect(configurationInstance.isHandlerEnabledForOrg('cwv', org)).to.be.false;
    });

    it('gets enabled site ids for a handler', () => {
      expect(configurationInstance.getEnabledSiteIdsForHandler('lhs-mobile')).to.deep.equal(['c6f41da6-3a7e-4a59-8b8d-2da742ac2dbe']);
      delete configurationInstance.record.handlers;
      expect(configurationInstance.getEnabledSiteIdsForHandler('lhs-mobile')).to.deep.equal([]);
    });
  });

  describe('manage handlers', () => {
    it('adds a new handler', () => {
      const handlerData = {
        enabledByDefault: true,
      };

      configurationInstance.addHandler('new-handler', handlerData);
      expect(configurationInstance.getHandler('new-handler')).to.deep.equal(handlerData);
    });

    it('updates handler orgs for a handler disabled by default with enabled', () => {
      configurationInstance.updateHandlerOrgs('lhs-mobile', org.getId(), true);
      expect(configurationInstance.getHandler('lhs-mobile').enabled.orgs).to.include(org.getId());
    });

    it('updates handler orgs for a handler disabled by default with disabled', () => {
      configurationInstance.updateHandlerOrgs('404', org.getId(), false);
      expect(configurationInstance.getHandler('404').disabled.orgs).to.include(org.getId());
    });

    it('updates handler orgs for a handler enabled by default', () => {
      configurationInstance.updateHandlerOrgs('404', org.getId(), true);
      expect(configurationInstance.getHandler('404').disabled.orgs).to.not.include(org.getId());
    });

    it('updates handler sites for a handler disabled by default', () => {
      configurationInstance.updateHandlerSites('lhs-mobile', site.getId(), true);
      expect(configurationInstance.getHandler('lhs-mobile').enabled.sites).to.include(site.getId());
    });

    it('updates handler sites for a handler enabled by default', () => {
      configurationInstance.updateHandlerSites('404', site.getId(), true);
      expect(configurationInstance.getHandler('404').disabled.sites).to.not.include(site.getId());
    });

    it('enables a handler for a site', () => {
      configurationInstance.enableHandlerForSite('organic-keywords', site);
      expect(configurationInstance.isHandlerEnabledForSite('organic-keywords', site)).to.be.true;
      expect(configurationInstance.getHandler('organic-keywords').enabled.sites).to.include(site.getId());
    });

    it('disables a handler for a site', () => {
      configurationInstance.enableHandlerForSite('organic-keywords', site);
      configurationInstance.disableHandlerForSite('organic-keywords', site);
      expect(configurationInstance.getHandler('organic-keywords').disabled.sites).to.not.include(site.getId());
    });

    it('enables a handler for an organization', () => {
      configurationInstance.enableHandlerForOrg('404', org);
      expect(configurationInstance.getHandler('404').disabled.orgs).to.not.include(org.getId());
    });

    it('disables a handler for an organization', () => {
      configurationInstance.enableHandlerForOrg('organic-keywords', org);
      configurationInstance.disableHandlerForOrg('organic-keywords', org);
      expect(configurationInstance.getHandler('organic-keywords').enabled.orgs).to.not.include(org.getId());
    });
  });

  describe('save', () => {
    it('saves the configuration', async () => {
      configurationInstance.collection = {
        create: stub().resolves(),
      };

      await configurationInstance.save();

      expect(configurationInstance.collection.create).to.have.been.calledOnceWithExactly(
        sanitizeIdAndAuditFields('Configuration', configurationInstance.toJSON()),
      );
    });
  });
});
