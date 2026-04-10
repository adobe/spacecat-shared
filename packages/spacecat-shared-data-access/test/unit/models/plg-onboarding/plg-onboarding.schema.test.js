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
import plgOnboardingSchema from '../../../../src/models/plg-onboarding/plg-onboarding.schema.js';

describe('PlgOnboarding Schema', () => {
  describe('reviews attribute', () => {
    let reviewsAttr;

    before(() => {
      const attributes = plgOnboardingSchema.getAttributes();
      reviewsAttr = attributes.reviews;
    });

    it('should have reviews as optional list', () => {
      expect(reviewsAttr).to.exist;
      expect(reviewsAttr.required).to.not.be.true;
      expect(reviewsAttr.type).to.equal('list');
    });

    it('should have a validate function', () => {
      expect(reviewsAttr.validate).to.be.a('function');
    });

    it('rejects non-array value', () => {
      expect(reviewsAttr.validate('not an array')).to.be.false;
    });

    it('rejects object value', () => {
      expect(reviewsAttr.validate({ decision: 'BYPASSED' })).to.be.false;
    });

    it('accepts valid reviews with BYPASSED decision', () => {
      const reviews = [{
        reason: 'test reason',
        decision: 'BYPASSED',
        reviewedBy: 'ese@adobe.com',
        reviewedAt: '2026-04-07T12:00:00.000Z',
        justification: 'test',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.true;
    });

    it('accepts valid reviews with UPHELD decision', () => {
      const reviews = [{
        reason: 'test reason',
        decision: 'UPHELD',
        reviewedBy: 'admin@adobe.com',
        reviewedAt: '2026-04-07T12:00:00.000Z',
        justification: 'not ready',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.true;
    });

    it('rejects invalid decision value', () => {
      const reviews = [{
        reason: 'test',
        decision: 'INVALID',
        reviewedBy: 'ese@adobe.com',
        reviewedAt: '2026-04-07T12:00:00.000Z',
        justification: 'test',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.false;
    });

    it('rejects invalid reviewedAt (not ISO date)', () => {
      const reviews = [{
        reason: 'test',
        decision: 'BYPASSED',
        reviewedBy: 'ese@adobe.com',
        reviewedAt: 'yesterday',
        justification: 'test',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.false;
    });

    it('rejects missing reviewedAt', () => {
      const reviews = [{
        reason: 'test',
        decision: 'BYPASSED',
        reviewedBy: 'ese@adobe.com',
        justification: 'test',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.false;
    });

    it('accepts multiple reviews', () => {
      const reviews = [
        {
          reason: 'first',
          decision: 'UPHELD',
          reviewedBy: 'admin@adobe.com',
          reviewedAt: '2026-04-07T12:00:00.000Z',
          justification: 'not yet',
        },
        {
          reason: 'second',
          decision: 'BYPASSED',
          reviewedBy: 'ese@adobe.com',
          reviewedAt: '2026-04-08T10:00:00.000Z',
          justification: 'now ready',
        },
      ];
      expect(reviewsAttr.validate(reviews)).to.be.true;
    });
  });
});
