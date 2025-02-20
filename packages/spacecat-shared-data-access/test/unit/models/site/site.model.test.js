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

import EntityRegistry from '../../../../src/models/base/entity.registry.js';
import Site from '../../../../src/models/site/site.model.js';
import schema from '../../../../src/models/site/site.schema.js';
import siteFixtures from '../../../fixtures/sites.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleSite = siteFixtures[0];

describe('SiteModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleSite;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(Site, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the Site instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(instance.getId()).to.equal('5d6d4439-6659-46c2-b646-92d110fa5a52');
    });
  });

  describe('organizationId', () => {
    it('gets organizationId', () => {
      expect(instance.getOrganizationId()).to.equal('4854e75e-894b-4a74-92bf-d674abad1423');
    });

    it('sets organizationId', () => {
      instance.setOrganizationId('1e9c6f94-f226-41f3-9005-4bb766765ac2');
      expect(instance.record.organizationId).to.equal('1e9c6f94-f226-41f3-9005-4bb766765ac2');
    });
  });

  describe('baseURL', () => {
    it('gets baseURL', () => {
      expect(instance.getBaseURL()).to.equal('https://example0.com');
    });

    it('sets baseURL', () => {
      instance.setBaseURL('https://www.example.org');
      expect(instance.getBaseURL()).to.equal('https://www.example.org');
    });
  });

  describe('config', () => {
    it('gets config', () => {
      const config = instance.getConfig();
      delete config.imports;
      expect(config).to.deep.equal(siteFixtures[0].config);
    });
  });

  describe('gitHubURL', () => {
    it('gets gitHubURL', () => {
      expect(instance.getGitHubURL()).to.equal('https://github.com/org-0/test-repo');
    });

    it('sets gitHubURL', () => {
      instance.setGitHubURL('new-github-url');
      expect(instance.getGitHubURL()).to.equal('new-github-url');
    });
  });

  describe('deliveryType', () => {
    it('gets deliveryType', () => {
      expect(instance.getDeliveryType()).to.equal('aem_edge');
    });

    it('sets deliveryType', () => {
      instance.setDeliveryType('aem_cs');
      expect(instance.getDeliveryType()).to.equal('aem_cs');
    });
  });

  describe('hlxConfig', () => {
    it('gets hlxConfig', () => {
      expect(instance.getHlxConfig()).to.deep.equal(undefined);
    });

    it('sets hlxConfig', () => {
      const newHlxConfig = { bar: 'baz' };
      instance.setHlxConfig(newHlxConfig);
      expect(instance.getHlxConfig()).to.deep.equal(newHlxConfig);
    });
  });

  describe('isLive', () => {
    it('gets isLive', () => {
      expect(instance.getIsLive()).to.equal(true);
    });

    it('sets isLive', () => {
      instance.setIsLive(false);
      expect(instance.getIsLive()).to.equal(false);
    });
  });

  describe('isLiveToggledAt', () => {
    it('gets isLiveToggledAt', () => {
      expect(instance.getIsLiveToggledAt()).to.equal('2024-11-29T07:45:55.952Z');
    });

    it('sets isLiveToggledAt', () => {
      instance.setIsLiveToggledAt('2024-01-02T00:00:00.000Z');
      expect(instance.getIsLiveToggledAt()).to.equal('2024-01-02T00:00:00.000Z');
    });
  });

  describe('toggleLive', () => {
    it('toggles the site live status', async () => {
      expect(instance.getIsLive()).to.equal(false);

      instance.toggleLive();

      expect(instance.getIsLive()).to.equal(true);
    });
  });

  describe('test permissions', () => {
    function getAllowAllCtx() {
      return {
        acls: [{
          role: 'foo@bar.org',
          acl: [
            { path: '/', actions: ['C', 'R', 'U', 'D'] },
            { path: '/**', actions: ['C', 'R', 'U', 'D'] },
          ],
        }],
      };
    }

    function getAclCtx() {
      return {
        acls: [{
          role: 'foo@bar.org',
          acl: [
            { path: '/organization/12345678-bbbb-1ccc-8ddd-eeeeeeeeeeee/site/88888888-7777-1ccc-8ddd-666666666666', actions: ['D'] },
            { path: '/organization/aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee/site/*', actions: ['U'] },
            { path: '/organization/ffffffff-bbbb-1ccc-8ddd-eeeeeeeeeeee/site/*', actions: ['C'] },
            { path: '/organization/*/site/*', actions: ['R'] },
          ],
        }],
        aclEntities: {
          model: ['organization', 'site'],
        },
      };
    }

    it('create permission', () => {
      // Prepare dep objects
      const es = { entities: { site: {} } };
      const er = new EntityRegistry(es, { aclCtx: getAclCtx() }, { debug: () => { } });

      const record = {
        siteId: '123456789',
        organizationId: 'ffffffff-bbbb-1ccc-8ddd-eeeeeeeeeeee',
      };

      // Create the instance
      const site = new Site(es, er, schema, record, {});
      expect(site.getId()).to.equal('123456789');
    });

    it('no create permission', () => {
      // Prepare dep objects
      const es = { entities: { site: {} } };
      const er = new EntityRegistry(es, { aclCtx: getAclCtx() }, { debug: () => { } });

      const record = {
        siteId: '123456789',
        organizationId: 'aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee',
      };

      // Try to create the instance
      expect(() => new Site(es, er, schema, record, {})).to.throw('Permission denied');
    });

    it('specific instance permission', () => {
      // Prepare the instance
      instance.aclCtx = getAllowAllCtx();
      instance.setOrganizationId('aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee');
      instance.aclCtx = getAclCtx();

      // Test the instance
      instance.setIsLive(false);

      expect(() => instance.getIsLive()).to.throw('Permission denied');
    });

    it('wildcard instance permission', () => {
      // Prepare the instance
      instance.aclCtx = getAllowAllCtx();
      instance.setOrganizationId('00000000-1111-1ccc-8ddd-222222222222');
      instance.aclCtx = getAclCtx();

      // Test the instance
      instance.getIsLive(); // Should be allowed

      expect(() => instance.setIsLive(false)).to.throw('Permission denied');
    });

    it('delete permission', async () => {
      const removed = [];
      instance.entity.remove = (el) => ({
        go: () => removed.push(el),
      });

      // Prepare the instance
      instance.aclCtx = getAllowAllCtx();
      instance.setOrganizationId('12345678-bbbb-1ccc-8ddd-eeeeeeeeeeee');
      instance.record[instance.idName] = '88888888-7777-1ccc-8ddd-666666666666';
      instance.aclCtx = getAclCtx();

      // Test the instance
      await instance.remove();
      expect(removed).to.have.length(1);
      expect(removed[0].siteId).to.equal('88888888-7777-1ccc-8ddd-666666666666');
    });

    it('no delete permission', async () => {
      const removed = [];
      instance.entity.remove = (el) => ({
        go: () => removed.push(el),
      });

      // Prepare the instance
      instance.aclCtx = getAllowAllCtx();
      instance.setOrganizationId('00000000-1111-1ccc-8ddd-222222222222');
      instance.aclCtx = getAclCtx();

      // Test the instance
      try {
        await instance.remove();
      } catch (e) {
        expect(e.message).to.equal('Permission denied');
        expect(removed).to.have.length(0);
        // good
        return;
      }
      expect.fail('Expected error as delete shouldnt be allowed');
    });
  });
});
