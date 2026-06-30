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

import Brand from '../../../../src/models/brand/brand.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleRow = {
  brandId: 'c3e1a4b6-2a8e-4d61-8b03-7d0a1d6b3201',
  name: 'Fixture Brand',
  status: 'active',
  semrushWorkspaceId: 'sub-ws-fixture',
};

describe('BrandModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleRow;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(Brand, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the Brand instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('id', () => {
    it('gets id', () => {
      expect(instance.getId()).to.equal('c3e1a4b6-2a8e-4d61-8b03-7d0a1d6b3201');
    });
  });

  describe('name', () => {
    it('gets name', () => {
      expect(instance.getName()).to.equal('Fixture Brand');
    });

    it('sets name', () => {
      instance.setName('Renamed Brand');
      expect(instance.getName()).to.equal('Renamed Brand');
    });
  });

  describe('status', () => {
    it('gets status', () => {
      expect(instance.getStatus()).to.equal('active');
    });

    it('sets status', () => {
      instance.setStatus('pending');
      expect(instance.getStatus()).to.equal('pending');
    });
  });

  describe('semrushWorkspaceId', () => {
    it('gets semrushWorkspaceId', () => {
      expect(instance.getSemrushWorkspaceId()).to.equal('sub-ws-fixture');
    });

    it('sets a new subworkspace id (re-grant)', () => {
      instance.setSemrushWorkspaceId('sub-ws-fixture-v2');
      expect(instance.getSemrushWorkspaceId()).to.equal('sub-ws-fixture-v2');
    });

    it('clears the pointer (disconnects the brand from its subworkspace)', () => {
      instance.setSemrushWorkspaceId(null);
      expect(instance.getSemrushWorkspaceId()).to.equal(null);
    });
  });

  describe('STATUSES', () => {
    // Structural contract only — deep-equality against a re-declared literal
    // would just mirror the source and could never fail independently.
    it('is a frozen, non-empty list of unique non-empty strings', () => {
      expect(Brand.STATUSES).to.be.an('array').that.is.not.empty;
      expect(Object.isFrozen(Brand.STATUSES)).to.be.true;
      expect(Brand.STATUSES.every((s) => typeof s === 'string' && s.length > 0)).to.be.true;
      expect(new Set(Brand.STATUSES).size).to.equal(Brand.STATUSES.length);
    });

    it('includes the statuses the serenity lifecycle writes', () => {
      // activate -> 'active', deactivate -> 'pending' (behavioural dependency).
      expect(Brand.STATUSES).to.include('active');
      expect(Brand.STATUSES).to.include('pending');
    });
  });
});
