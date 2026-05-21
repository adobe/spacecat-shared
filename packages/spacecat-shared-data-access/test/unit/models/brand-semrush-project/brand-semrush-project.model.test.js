/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import BrandSemrushProject from '../../../../src/models/brand-semrush-project/brand-semrush-project.model.js';
import brandSemrushProjectFixtures from '../../../fixtures/brand-semrush-projects.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleRow = brandSemrushProjectFixtures[0];

describe('BrandSemrushProjectModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleRow;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(BrandSemrushProject, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the BrandSemrushProject instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('brandSemrushProjectId', () => {
    it('gets brandSemrushProjectId', () => {
      expect(instance.getId()).to.equal('5b1e2d6a-7c5f-4a91-9b32-8e34ad11d201');
    });
  });

  describe('brandId', () => {
    it('gets brandId', () => {
      expect(instance.getBrandId()).to.equal('c3e1a4b6-2a8e-4d61-8b03-7d0a1d6b3201');
    });

    it('sets brandId', () => {
      const next = 'c3e1a4b6-2a8e-4d61-8b03-7d0a1d6b3202';
      instance.setBrandId(next);
      expect(instance.getBrandId()).to.equal(next);
    });
  });

  describe('semrushProjectId', () => {
    it('gets semrushProjectId', () => {
      expect(instance.getSemrushProjectId()).to.equal('proj-fixture-us-en');
    });

    it('sets semrushProjectId', () => {
      instance.setSemrushProjectId('proj-fixture-us-en-v2');
      expect(instance.getSemrushProjectId()).to.equal('proj-fixture-us-en-v2');
    });
  });

  describe('semrushLocationId', () => {
    it('gets semrushLocationId', () => {
      expect(instance.getSemrushLocationId()).to.equal(2840);
    });

    it('sets semrushLocationId', () => {
      instance.setSemrushLocationId(2826);
      expect(instance.getSemrushLocationId()).to.equal(2826);
    });
  });

  describe('language', () => {
    it('gets language', () => {
      expect(instance.getLanguage()).to.equal('en');
    });

    it('sets language', () => {
      instance.setLanguage('de');
      expect(instance.getLanguage()).to.equal('de');
    });
  });
});
