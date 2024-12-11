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

import Site from '../../../../../src/v2/models/site/site.model.js';
import SiteSchema from '../../../../../src/v2/models/site/site.schema.js';
import siteFixtures from '../../../../fixtures/sites.fixture.js';
import { Config } from '../../../../../src/models/site/config.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(SiteSchema).model.schema;
const sampleSite = siteFixtures[0];

describe('Site', () => {
  let siteInstance;
  let mockElectroService;
  let mockModelFactory;
  let mockRecord;
  let mockLogger;

  beforeEach(() => {
    mockElectroService = {
      entities: {
        site: {
          model: {
            name: 'site',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['siteId'],
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

    mockRecord = sampleSite;

    siteInstance = new Site(
      mockElectroService,
      mockModelFactory,
      mockRecord,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the Site instance correctly', () => {
      expect(siteInstance).to.be.an('object');
      expect(siteInstance.record).to.deep.equal(mockRecord);
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(siteInstance.getId()).to.equal('5d6d4439-6659-46c2-b646-92d110fa5a52');
    });
  });

  describe('organizationId', () => {
    it('gets organizationId', () => {
      expect(siteInstance.getOrganizationId()).to.equal('4854e75e-894b-4a74-92bf-d674abad1423');
    });

    it('sets organizationId', () => {
      siteInstance.setOrganizationId('new-organization-id');
      expect(siteInstance.record.organizationId).to.equal('new-organization-id');
    });
  });

  describe('baseURL', () => {
    it('gets baseURL', () => {
      expect(siteInstance.getBaseURL()).to.equal('https://example0.com');
    });

    it('sets baseURL', () => {
      siteInstance.setBaseURL('https://www.example.org');
      expect(siteInstance.getBaseURL()).to.equal('https://www.example.org');
    });
  });

  describe('config', () => {
    it('gets config', () => {
      const config = Config.toDynamoItem(siteInstance.getConfig());
      delete config.imports;
      expect(config).to.deep.equal(sampleSite.config);
    });
  });

  describe('gitHubURL', () => {
    it('gets gitHubURL', () => {
      expect(siteInstance.getGitHubURL()).to.equal('https://github.com/org-0/test-repo');
    });

    it('sets gitHubURL', () => {
      siteInstance.setGitHubURL('new-github-url');
      expect(siteInstance.getGitHubURL()).to.equal('new-github-url');
    });
  });

  describe('deliveryType', () => {
    it('gets deliveryType', () => {
      expect(siteInstance.getDeliveryType()).to.equal('aem_edge');
    });

    it('sets deliveryType', () => {
      siteInstance.setDeliveryType('aem_cs');
      expect(siteInstance.getDeliveryType()).to.equal('aem_cs');
    });
  });

  describe('hlxConfig', () => {
    it('gets hlxConfig', () => {
      expect(siteInstance.getHlxConfig()).to.deep.equal(undefined);
    });

    it('sets hlxConfig', () => {
      const newHlxConfig = { bar: 'baz' };
      siteInstance.setHlxConfig(newHlxConfig);
      expect(siteInstance.getHlxConfig()).to.deep.equal(newHlxConfig);
    });
  });

  describe('isLive', () => {
    it('gets isLive', () => {
      expect(siteInstance.getIsLive()).to.equal(true);
    });

    it('sets isLive', () => {
      siteInstance.setIsLive(false);
      expect(siteInstance.getIsLive()).to.equal(false);
    });
  });

  describe('isLiveToggledAt', () => {
    it('gets isLiveToggledAt', () => {
      expect(siteInstance.getIsLiveToggledAt()).to.equal('2024-11-29T07:45:55.952Z');
    });

    it('sets isLiveToggledAt', () => {
      siteInstance.setIsLiveToggledAt('2024-01-02T00:00:00.000Z');
      expect(siteInstance.getIsLiveToggledAt()).to.equal('2024-01-02T00:00:00.000Z');
    });
  });

  describe('getLatestAuditByType', () => {
    it('returns the latest audit by type', async () => {
      const mockAudit = {
        auditType: 'someAuditType',
        auditedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockFind = stub().returns(mockAudit);

      siteInstance.entityRegistry = {
        getCollection: stub().returns({ findByIndexKeys: mockFind }),
      };

      const latestAudit = await siteInstance.getLatestAuditByType('someAuditType');

      expect(latestAudit).to.deep.equal(mockAudit);
      expect(siteInstance.entityRegistry.getCollection).to.have.been.calledOnceWithExactly('AuditCollection');
      expect(mockFind).to.have.been.calledOnceWithExactly(
        { siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52', auditType: 'someAuditType' },
      );
    });
  });

  describe('toggleLive', () => {
    it('toggles the site live status', async () => {
      expect(siteInstance.getIsLive()).to.equal(false);

      siteInstance.toggleLive();

      expect(siteInstance.getIsLive()).to.equal(true);
    });
  });
});
