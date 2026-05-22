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

import { expect } from 'chai';

import brandSemrushProjectSchema from '../../../../src/models/brand-semrush-project/brand-semrush-project.schema.js';

describe('BrandSemrushProject Schema', () => {
  const attributes = brandSemrushProjectSchema.getAttributes();

  describe('semrushProjectId attribute', () => {
    it('is required with a hasText validator', () => {
      const attr = attributes.semrushProjectId;
      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.validate).to.be.a('function');
    });

    it('accepts a non-empty string', () => {
      expect(attributes.semrushProjectId.validate('proj-abc-123')).to.be.true;
    });

    it('rejects empty string', () => {
      expect(attributes.semrushProjectId.validate('')).to.be.false;
    });

    it('rejects nullish values', () => {
      expect(attributes.semrushProjectId.validate(null)).to.be.false;
      expect(attributes.semrushProjectId.validate(undefined)).to.be.false;
    });

    it('rejects non-string types', () => {
      expect(attributes.semrushProjectId.validate(123)).to.be.false;
      expect(attributes.semrushProjectId.validate({})).to.be.false;
    });
  });

  describe('semrushLocationId attribute', () => {
    it('is required with a positive-integer validator', () => {
      const attr = attributes.semrushLocationId;
      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.validate).to.be.a('function');
    });

    it('accepts positive integers', () => {
      expect(attributes.semrushLocationId.validate(2840)).to.be.true;
      expect(attributes.semrushLocationId.validate(1)).to.be.true;
    });

    it('rejects zero and negative integers', () => {
      expect(attributes.semrushLocationId.validate(0)).to.be.false;
      expect(attributes.semrushLocationId.validate(-1)).to.be.false;
    });

    it('rejects non-integer numbers', () => {
      expect(attributes.semrushLocationId.validate(1.5)).to.be.false;
      expect(attributes.semrushLocationId.validate(Number.NaN)).to.be.false;
      expect(attributes.semrushLocationId.validate(Infinity)).to.be.false;
    });

    it('rejects numeric strings (no coercion)', () => {
      expect(attributes.semrushLocationId.validate('2840')).to.be.false;
    });
  });

  describe('language attribute', () => {
    it('is required with a BCP-47-shaped validator', () => {
      const attr = attributes.language;
      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.validate).to.be.a('function');
    });

    it('accepts 2-letter lowercase ISO 639-1 tags', () => {
      expect(attributes.language.validate('en')).to.be.true;
      expect(attributes.language.validate('de')).to.be.true;
      expect(attributes.language.validate('it')).to.be.true;
    });

    it('accepts 3-letter lowercase ISO 639-3 tags', () => {
      expect(attributes.language.validate('zho')).to.be.true;
      expect(attributes.language.validate('cmn')).to.be.true;
    });

    it('accepts primary subtag with a 2-4 letter region/script subtag', () => {
      expect(attributes.language.validate('de-ch')).to.be.true;
      expect(attributes.language.validate('pt-br')).to.be.true;
      expect(attributes.language.validate('zh-hant')).to.be.true;
    });

    it('rejects uppercase and mixed case', () => {
      expect(attributes.language.validate('EN')).to.be.false;
      expect(attributes.language.validate('En')).to.be.false;
      expect(attributes.language.validate('en-US')).to.be.false;
      expect(attributes.language.validate('zh-Hant')).to.be.false;
    });

    it('rejects values that do not match the BCP-47 shape', () => {
      expect(attributes.language.validate('english')).to.be.false;
      expect(attributes.language.validate('e')).to.be.false;
      expect(attributes.language.validate('en-')).to.be.false;
      expect(attributes.language.validate('en-u')).to.be.false;
      expect(attributes.language.validate('en-toolong')).to.be.false;
      expect(attributes.language.validate('en_us')).to.be.false;
      expect(attributes.language.validate(' en')).to.be.false;
      expect(attributes.language.validate('en ')).to.be.false;
    });

    it('rejects empty string and whitespace-only strings', () => {
      expect(attributes.language.validate('')).to.be.false;
      expect(attributes.language.validate('   ')).to.be.false;
    });

    it('rejects nullish values', () => {
      expect(attributes.language.validate(null)).to.be.false;
      expect(attributes.language.validate(undefined)).to.be.false;
    });
  });

  describe('brandId attribute (explicit FK to brands table)', () => {
    it('is required with a UUID validator', () => {
      const attr = attributes.brandId;
      expect(attr).to.exist;
      expect(attr.required).to.be.true;
      expect(attr.validate).to.be.a('function');
    });

    it('accepts a valid UUID', () => {
      expect(attributes.brandId.validate('c3e1a4b6-2a8e-4d61-8b03-7d0a1d6b3201')).to.be.true;
    });

    it('rejects non-UUID strings', () => {
      expect(attributes.brandId.validate('not-a-uuid')).to.be.false;
      expect(attributes.brandId.validate('123')).to.be.false;
    });
  });
});
