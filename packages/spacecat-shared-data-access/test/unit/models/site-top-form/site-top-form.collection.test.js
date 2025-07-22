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
    siteTopFormId: 'f12345',
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
      expect(mockElectroService.entities.siteTopForm.delete.calledOnceWith([{ siteTopFormId: 'f12345' }]))
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
      expect(mockElectroService.entities.siteTopForm.delete.calledOnceWith([{ siteTopFormId: 'f12345' }]))
        .to.be.true;
    });
  });

  describe('removeByUrlAndFormSource', () => {
    it('throws an error if url is not provided', async () => {
      await expect(instance.removeByUrlAndFormSource()).to.be.rejectedWith('URL is required');
    });

    it('throws an error if formSource is not provided', async () => {
      await expect(instance.removeByUrlAndFormSource('https://example.com')).to.be.rejectedWith('FormSource is required');
    });

    it('removes a specific form by URL and formSource', async () => {
      const url = 'https://example.com/contact';
      const formSource = '#contact-form';

      instance.findByUrlAndFormSource = stub().resolves(model);

      await instance.removeByUrlAndFormSource(url, formSource);

      expect(instance.findByUrlAndFormSource).to.have.been.calledOnceWith(url, formSource);
      expect(mockElectroService.entities.siteTopForm.delete.calledOnceWith([{ siteTopFormId: 'f12345' }]))
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
});
