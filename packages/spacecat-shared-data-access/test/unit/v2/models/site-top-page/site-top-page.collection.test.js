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

import SiteTopPageCollection from '../../../../../src/v2/models/site-top-page/site-top-page.collection.js';
import SiteTopPage from '../../../../../src/v2/models/site-top-page/site-top-page.model.js';
import SiteTopPageSchema from '../../../../../src/v2/models/site-top-page/site-top-page.schema.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(SiteTopPageSchema).model.schema;

let mockElectroService;

describe('SiteTopPageCollection', () => {
  let instance;
  let mockSiteTopPageModel;
  let mockLogger;
  let mockEntityRegistry;

  const mockRecord = {
    siteTopPageId: 's12345',
    siteId: 's67890',
    url: 'https://www.example.com',
    traffic: 1000,
    source: 'ahrefs',
    geo: 'global',
    topKeywords: 'keyword1',
    importedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mockLogger = {
      error: spy(),
      info: spy(),
      warn: spy(),
    };

    mockEntityRegistry = {
      getCollection: stub(),
    };

    mockElectroService = {
      entities: {
        siteTopPage: {
          model: {
            name: 'siteTopPage',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['siteTopPageId'],
                },
              },
            },
          },
          delete: stub().returns({
            go: stub().resolves({}),
          }),
        },
      },
    };

    mockSiteTopPageModel = new SiteTopPage(
      mockElectroService,
      mockEntityRegistry,
      mockRecord,
      mockLogger,
    );

    instance = new SiteTopPageCollection(
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the SiteTopPageCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.log).to.equal(mockLogger);
    });
  });

  describe('removeForSiteId', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.removeForSiteId()).to.be.rejectedWith('SiteId is required');
    });

    it('removes all SiteTopPages for a given siteId', async () => {
      const siteId = 'site12345';

      instance.allBySiteId = stub().resolves([mockSiteTopPageModel]);

      await instance.removeForSiteId(siteId);

      expect(instance.allBySiteId.calledOnceWith(siteId)).to.be.true;
      expect(mockElectroService.entities.siteTopPage.delete.calledOnceWith([{ siteTopPageId: 's12345' }]))
        .to.be.true;
    });

    it('remove all SiteTopPages for a given siteId, source and geo', async () => {
      const siteId = 'site12345';
      const source = 'ahrefs';
      const geo = 'global';

      instance.allBySiteIdAndSourceAndGeo = stub().resolves([mockSiteTopPageModel]);

      await instance.removeForSiteId(siteId, source, geo);

      expect(instance.allBySiteIdAndSourceAndGeo).to.have.been.calledOnceWith(siteId, source, geo);
      expect(mockElectroService.entities.siteTopPage.delete).to.have.been.calledOnceWith([{ siteTopPageId: 's12345' }]);
    });
  });
});
