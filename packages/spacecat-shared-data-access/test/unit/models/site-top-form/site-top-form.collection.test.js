/*
 * Copyright 2025 Adobe. All rights reserved.
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

import SiteTopForm from '../../../../src/models/site-top-form/site-top-form.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SiteTopFormCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    siteTopFormId: '1336eeb5-2d71-4016-825a-550feb483dfb',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(SiteTopForm, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SiteTopFormCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('removeForSiteId', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.removeForSiteId()).to.be.rejectedWith('SiteId is required');
    });

    it('removes all SiteTopForms for a given siteId', async () => {
      const siteId = 'site12345';

      instance.allBySiteId = stub().resolves([model]);

      await instance.removeForSiteId(siteId);

      expect(instance.allBySiteId.calledOnceWith(siteId)).to.be.true;
      expect(mockElectroService.entities.siteTopForm.delete.calledOnceWith([{ siteTopFormId: '1336eeb5-2d71-4016-825a-550feb483dfb' }]))
        .to.be.true;
    });

    it('does not call remove when there are no SiteTopForms for a given siteId', async () => {
      const siteId = 'site12345';

      instance.allBySiteId = stub().resolves([]);

      await instance.removeForSiteId(siteId);

      expect(instance.allBySiteId.calledOnceWith(siteId)).to.be.true;
      expect(mockElectroService.entities.siteTopForm.delete).to.not.have.been.called;
    });

    it('removes all SiteTopForms for a given siteId and source', async () => {
      const siteId = 'site12345';
      const source = 'ahrefs';

      instance.allBySiteIdAndSource = stub().resolves([model]);

      await instance.removeForSiteId(siteId, source);

      expect(instance.allBySiteIdAndSource).to.have.been.calledOnceWith(siteId, source);
      expect(mockElectroService.entities.siteTopForm.delete.calledOnceWith([{ siteTopFormId: '1336eeb5-2d71-4016-825a-550feb483dfb' }]))
        .to.be.true;
    });
  });

  describe('removeByUrlAndFormSource', () => {
    it('throws an error if url is not provided', async () => {
      await expect(instance.removeByUrlAndFormSource()).to.be.rejectedWith('URL is required');
    });

    it('handles removal when formSource is not provided (defaults to empty string)', async () => {
      const url = 'https://example.com/contact';

      instance.findByUrlAndFormSource = stub().resolves(model);

      await instance.removeByUrlAndFormSource(url);

      expect(instance.findByUrlAndFormSource).to.have.been.calledOnceWith(url, '');
      expect(mockElectroService.entities.siteTopForm.delete.calledOnceWith([{ siteTopFormId: 'f12345' }]))
        .to.be.true;
    });

    it('removes a specific form by URL and formSource', async () => {
      const url = 'https://example.com/contact';
      const formSource = '#contact-form';

      instance.findByUrlAndFormSource = stub().resolves(model);

      await instance.removeByUrlAndFormSource(url, formSource);

      expect(instance.findByUrlAndFormSource).to.have.been.calledOnceWith(url, formSource);
      expect(mockElectroService.entities.siteTopForm.delete.calledOnceWith([{ siteTopFormId: '1336eeb5-2d71-4016-825a-550feb483dfb' }]))
        .to.be.true;
    });

    it('does not call remove when form is not found', async () => {
      const url = 'https://example.com/contact';
      const formSource = '#contact-form';

      instance.findByUrlAndFormSource = stub().resolves(null);

      await instance.removeByUrlAndFormSource(url, formSource);

      expect(instance.findByUrlAndFormSource).to.have.been.calledOnceWith(url, formSource);
      expect(mockElectroService.entities.siteTopForm.delete).to.not.have.been.called;
    });
  });

  describe('create', () => {
    it('throws an error if URL is not provided', async () => {
      const item = {
        siteId: 'site123',
        formSource: '#contact-form',
        source: 'google',
      };

      await expect(instance.create(item)).to.be.rejectedWith('URL is required and cannot be empty');
    });

    it('throws an error if URL is empty', async () => {
      const item = {
        siteId: 'site123',
        url: '',
        formSource: '#contact-form',
        source: 'google',
      };

      await expect(instance.create(item)).to.be.rejectedWith('URL is required and cannot be empty');
    });

    it('sets formSource to empty string when not provided', async () => {
      const item = {
        siteId: 'site123',
        url: 'https://example.com/contact',
        source: 'google',
      };

      mockElectroService.entities.siteTopForm.create.returns({
        go: () => Promise.resolve({ data: mockRecord }),
      });

      const result = await instance.create(item);

      expect(result).to.not.be.null;
      expect(mockElectroService.entities.siteTopForm.create).to.have.been.calledOnce;
    });

    it('sets formSource to empty string when null', async () => {
      const item = {
        siteId: 'site123',
        url: 'https://example.com/contact',
        formSource: null,
        source: 'google',
      };

      mockElectroService.entities.siteTopForm.create.returns({
        go: () => Promise.resolve({ data: mockRecord }),
      });

      const result = await instance.create(item);

      expect(result).to.not.be.null;
      expect(mockElectroService.entities.siteTopForm.create).to.have.been.calledOnce;
    });

    it('preserves formSource when provided', async () => {
      const item = {
        siteId: 'site123',
        url: 'https://example.com/contact',
        formSource: '#contact-form',
        source: 'google',
      };

      mockElectroService.entities.siteTopForm.create.returns({
        go: () => Promise.resolve({ data: mockRecord }),
      });

      const result = await instance.create(item);

      expect(result).to.not.be.null;
      expect(mockElectroService.entities.siteTopForm.create).to.have.been.calledOnce;
    });
  });

  describe('createMany', () => {
    it('throws an error if any item is missing URL', async () => {
      const items = [
        {
          siteId: 'site123',
          url: 'https://example.com/form1',
          source: 'google',
        },
        {
          siteId: 'site123',
          formSource: '#form2',
          source: 'google',
        },
      ];

      await expect(instance.createMany(items)).to.be.rejectedWith('URL is required and cannot be empty for all items');
    });

    it('throws an error if any item has empty URL', async () => {
      const items = [
        {
          siteId: 'site123',
          url: 'https://example.com/form1',
          source: 'google',
        },
        {
          siteId: 'site123',
          url: '',
          formSource: '#form2',
          source: 'google',
        },
      ];

      await expect(instance.createMany(items)).to.be.rejectedWith('URL is required and cannot be empty for all items');
    });

    it('processes all items and sets default formSource', async () => {
      const items = [
        {
          siteId: 'site123',
          url: 'https://example.com/form1',
          formSource: '#form1',
          source: 'google',
        },
        {
          siteId: 'site123',
          url: 'https://example.com/form2',
          formSource: null,
          source: 'google',
        },
        {
          siteId: 'site123',
          url: 'https://example.com/form3',
          source: 'google',
        },
      ];

      // Mock the put method to simulate successful batch creation
      mockElectroService.entities.siteTopForm.put.returns({
        go: () => Promise.resolve({
          data: [mockRecord, mockRecord, mockRecord],
        }),
      });

      const result = await instance.createMany(items);

      expect(result).to.not.be.null;
      expect(result.createdItems).to.be.an('array');
      expect(mockElectroService.entities.siteTopForm.put).to.have.been.called;
    });
  });

  describe('findByUrlAndFormSource', () => {
    it('throws an error if URL is not provided', async () => {
      await expect(instance.findByUrlAndFormSource()).to.be.rejectedWith('URL is required');
    });

    it('throws an error if URL is empty', async () => {
      await expect(instance.findByUrlAndFormSource('')).to.be.rejectedWith('URL is required');
    });

    it('uses empty string as default formSource', async () => {
      const url = 'https://example.com/contact';

      const mockFindByIndexKeys = stub(instance, 'findByIndexKeys').resolves(model);

      await instance.findByUrlAndFormSource(url);

      expect(mockFindByIndexKeys).to.have.been.calledOnceWith({
        url,
        formSource: '',
      }, {
        index: 'spacecat-data-gsi2pk-gsi2sk',
      });

      mockFindByIndexKeys.restore();
    });

    it('uses provided formSource', async () => {
      const url = 'https://example.com/contact';
      const formSource = '#contact-form';

      const mockFindByIndexKeys = stub(instance, 'findByIndexKeys').resolves(model);

      await instance.findByUrlAndFormSource(url, formSource);

      expect(mockFindByIndexKeys).to.have.been.calledOnceWith({
        url,
        formSource,
      }, {
        index: 'spacecat-data-gsi2pk-gsi2sk',
      });

      mockFindByIndexKeys.restore();
    });

    it('tries legacy null formSource when not found with empty string', async () => {
      const url = 'https://example.com/contact';

      const mockFindByIndexKeys = stub(instance, 'findByIndexKeys')
        .onFirstCall().resolves(null)
        .onSecondCall()
        .resolves(model);

      const result = await instance.findByUrlAndFormSource(url, '');

      expect(mockFindByIndexKeys).to.have.been.calledTwice;
      expect(mockFindByIndexKeys.firstCall).to.have.been.calledWith({
        url,
        formSource: '',
      }, {
        index: 'spacecat-data-gsi2pk-gsi2sk',
      });
      expect(mockFindByIndexKeys.secondCall).to.have.been.calledWith({
        url,
        formSource: null,
      }, {
        index: 'spacecat-data-gsi2pk-gsi2sk',
      });

      expect(result).to.equal(model);

      mockFindByIndexKeys.restore();
    });

    it('handles error in legacy null search gracefully', async () => {
      const url = 'https://example.com/contact';

      const mockFindByIndexKeys = stub(instance, 'findByIndexKeys')
        .onFirstCall().resolves(null)
        .onSecondCall()
        .throws(new Error('Legacy search error'));

      const result = await instance.findByUrlAndFormSource(url, '');

      expect(result).to.be.null;
      expect(mockLogger.debug).to.have.been.calledWith('Legacy null formSource search failed: Legacy search error');

      mockFindByIndexKeys.restore();
    });

    it('handles general error and returns null', async () => {
      const url = 'https://example.com/contact';

      const mockFindByIndexKeys = stub(instance, 'findByIndexKeys').throws(new Error('Database error'));

      const result = await instance.findByUrlAndFormSource(url, '#form');

      expect(result).to.be.null;
      expect(mockLogger.error).to.have.been.calledWith('Failed to find form by URL and formSource: Database error');

      mockFindByIndexKeys.restore();
    });
  });
});
