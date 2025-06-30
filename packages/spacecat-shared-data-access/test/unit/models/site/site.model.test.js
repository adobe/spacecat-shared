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
import nock from 'nock';

import Site, { computeExternalIds } from '../../../../src/models/site/site.model.js';
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

  describe('computeExternalIds', () => {
    it('computes external IDs for document authoring type with valid RSO config', () => {
      const attrs = {
        authoringType: Site.AUTHORING_TYPES.DA,
        hlxConfig: {
          rso: {
            ref: 'main',
            owner: 'adobe',
            site: 'example-site',
          },
        },
      };

      const result = computeExternalIds(attrs, Site.AUTHORING_TYPES);

      expect(result).to.deep.equal({
        externalOwnerId: 'main#adobe',
        externalSiteId: 'example-site',
      });
    });

    it('computes external IDs for document authoring type with missing RSO config', () => {
      const attrs = {
        authoringType: Site.AUTHORING_TYPES.DA,
        hlxConfig: {},
      };

      const result = computeExternalIds(attrs, Site.AUTHORING_TYPES);

      expect(result).to.deep.equal({
        externalOwnerId: undefined,
        externalSiteId: undefined,
      });
    });

    it('computes external IDs for document authoring type with partial RSO config', () => {
      const attrs = {
        authoringType: Site.AUTHORING_TYPES.DA,
        hlxConfig: {
          rso: {
            ref: 'main',
            owner: 'adobe',
            // site is missing
          },
        },
      };

      const result = computeExternalIds(attrs, Site.AUTHORING_TYPES);

      expect(result).to.deep.equal({
        externalOwnerId: 'main#adobe',
        externalSiteId: undefined,
      });
    });

    it('computes external IDs for cloud service authoring type with valid delivery config', () => {
      const attrs = {
        authoringType: Site.AUTHORING_TYPES.CS,
        deliveryConfig: {
          programId: '12345',
          environmentId: '67890',
        },
      };

      const result = computeExternalIds(attrs, Site.AUTHORING_TYPES);

      expect(result).to.deep.equal({
        externalOwnerId: 'p12345',
        externalSiteId: 'e67890',
      });
    });

    it('computes external IDs for cloud service authoring type with missing delivery config', () => {
      const attrs = {
        authoringType: Site.AUTHORING_TYPES.CS,
      };

      const result = computeExternalIds(attrs, Site.AUTHORING_TYPES);

      expect(result).to.deep.equal({
        externalOwnerId: undefined,
        externalSiteId: undefined,
      });
    });

    it('computes external IDs for cloud service authoring type with partial delivery config', () => {
      const attrs = {
        authoringType: Site.AUTHORING_TYPES.CS,
        deliveryConfig: {
          programId: '12345',
          // environmentId is missing
        },
      };

      const result = computeExternalIds(attrs, Site.AUTHORING_TYPES);

      expect(result).to.deep.equal({
        externalOwnerId: 'p12345',
        externalSiteId: undefined,
      });
    });
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

  describe('name', () => {
    it('gets name', () => {
      expect(instance.getName()).to.equal('test-site');
    });

    it('sets name', () => {
      instance.setName('new-site');
      expect(instance.getName()).to.equal('new-site');
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

  describe('authoringType', () => {
    it('gets authoringType', () => {
      expect(instance.getAuthoringType()).to.equal('cs/crosswalk');
    });

    it('sets authoringType', () => {
      instance.setAuthoringType('cs');
      expect(instance.getAuthoringType()).to.equal('cs');
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

  describe('resolveFinalURL', () => {
    afterEach(() => {
      nock.cleanAll();
    });

    it('resolves the final URL using the base URL', async () => {
      instance.setBaseURL('https://spacecat.com');
      const config = instance.getConfig();
      config.getFetchConfig = () => ({});

      nock(instance.getBaseURL())
        .get('/')
        .reply(301, undefined, { Location: 'https://redirected.com' });
      nock('https://redirected.com')
        .get('/')
        .reply(200);

      const finalURL = await instance.resolveFinalURL();

      expect(finalURL).to.equal('redirected.com');
    });

    it('resolves the final URL using the overrideBaseURL', async () => {
      const config = instance.getConfig();
      config.getFetchConfig = () => ({ overrideBaseURL: 'http://override.com' });

      const finalURL = await instance.resolveFinalURL();

      expect(finalURL).to.equal('override.com');
    });

    it('resolves the final URL using the User-Agent header', async () => {
      instance.setBaseURL('https://spacecat.com');
      const userAgent = 'Mozilla/5.0';
      const config = instance.getConfig();
      config.getFetchConfig = () => ({ headers: { 'User-Agent': userAgent } });

      nock(instance.getBaseURL(), {
        reqheaders: {
          'User-Agent': userAgent,
        },
      })
        .get('/')
        .reply(200);

      const finalURL = await instance.resolveFinalURL();

      expect(finalURL).to.equal(instance.getBaseURL().replace(/^https?:\/\//, ''));
    });
  });
});
