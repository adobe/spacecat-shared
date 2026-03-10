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

import { expect } from 'chai';

import tokenSchema from '../../../../src/models/token/token.schema.js';

describe('Token Schema', () => {
  describe('tokenId attribute', () => {
    it('should have tokenId as required, readOnly, auto-generated, with postgrestField id', () => {
      const attributes = tokenSchema.getAttributes();
      const tokenIdAttr = attributes.tokenId;

      expect(tokenIdAttr).to.exist;
      expect(tokenIdAttr.required).to.be.true;
      expect(tokenIdAttr.readOnly).to.be.true;
      expect(tokenIdAttr.type).to.equal('string');
      expect(tokenIdAttr.postgrestField).to.equal('id');
      expect(tokenIdAttr.default).to.be.a('function');
      expect(tokenIdAttr.validate).to.be.a('function');
    });

    it('should generate a valid UUID as default', () => {
      const attributes = tokenSchema.getAttributes();
      const tokenIdAttr = attributes.tokenId;

      const value = tokenIdAttr.default();
      expect(tokenIdAttr.validate(value)).to.be.true;
      expect(value).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('siteId attribute', () => {
    it('should have siteId as required with UUID validation', () => {
      const attributes = tokenSchema.getAttributes();
      const siteIdAttr = attributes.siteId;

      expect(siteIdAttr).to.exist;
      expect(siteIdAttr.required).to.be.true;
      expect(siteIdAttr.type).to.equal('string');
      expect(siteIdAttr.validate).to.be.a('function');
      expect(siteIdAttr.postgrestField).to.equal('site_id');
    });

    it('should validate valid UUIDs', () => {
      const attributes = tokenSchema.getAttributes();
      const siteIdAttr = attributes.siteId;

      expect(siteIdAttr.validate('78fec9c7-2141-4600-b7b1-ea5c78752b91')).to.be.true;
      expect(siteIdAttr.validate('00000000-0000-0000-0000-000000000000')).to.be.true;
    });

    it('should reject invalid UUIDs', () => {
      const attributes = tokenSchema.getAttributes();
      const siteIdAttr = attributes.siteId;

      expect(siteIdAttr.validate('not-a-uuid')).to.be.false;
      expect(siteIdAttr.validate('')).to.be.false;
      expect(siteIdAttr.validate(123)).to.be.false;
      expect(siteIdAttr.validate(null)).to.be.false;
    });
  });

  describe('tokenType attribute', () => {
    it('should have tokenType as required string', () => {
      const attributes = tokenSchema.getAttributes();
      const tokenTypeAttr = attributes.tokenType;

      expect(tokenTypeAttr).to.exist;
      expect(tokenTypeAttr.required).to.be.true;
      expect(tokenTypeAttr.type).to.equal('string');
      expect(tokenTypeAttr.postgrestField).to.equal('token_type');
    });
  });

  describe('cycle attribute', () => {
    it('should have cycle as required string', () => {
      const attributes = tokenSchema.getAttributes();
      const cycleAttr = attributes.cycle;

      expect(cycleAttr).to.exist;
      expect(cycleAttr.required).to.be.true;
      expect(cycleAttr.type).to.equal('string');
    });
  });

  describe('total attribute', () => {
    it('should have total as required number', () => {
      const attributes = tokenSchema.getAttributes();
      const totalAttr = attributes.total;

      expect(totalAttr).to.exist;
      expect(totalAttr.required).to.be.true;
      expect(totalAttr.type).to.equal('number');
    });
  });

  describe('used attribute', () => {
    it('should have used as required number with default 0', () => {
      const attributes = tokenSchema.getAttributes();
      const usedAttr = attributes.used;

      expect(usedAttr).to.exist;
      expect(usedAttr.required).to.be.true;
      expect(usedAttr.type).to.equal('number');
      expect(usedAttr.default).to.equal(0);
    });
  });
});
