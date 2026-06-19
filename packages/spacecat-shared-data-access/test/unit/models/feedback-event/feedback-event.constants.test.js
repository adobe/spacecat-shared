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

/* eslint-env mocha */

import { expect } from 'chai';

import {
  REVIEW_SOURCES,
  REVIEW_VERDICTS,
  REVIEW_SIGNALS,
  REJECTION_CATEGORIES,
  FEEDBACK_TIERS,
  EXPORT_EXCLUDED_REJECTION_CATEGORIES,
  OPT_OUT_STRIPPED_FIELDS,
  verdictToSignal,
  signalToVerdict,
  toReviewView,
} from '../../../../src/models/feedback-event/index.js';

describe('feedback-event constants', () => {
  it('exposes the review source enum (frozen)', () => {
    expect(REVIEW_SOURCES).to.deep.equal({
      BACKOFFICE: 'backoffice',
      ASO_UI: 'aso_ui',
      AEMY_PR: 'aemy_pr',
    });
    expect(Object.isFrozen(REVIEW_SOURCES)).to.equal(true);
  });

  it('exposes the verdict enum (frozen)', () => {
    expect(REVIEW_VERDICTS).to.deep.equal({ UP: 'up', DOWN: 'down' });
    expect(Object.isFrozen(REVIEW_VERDICTS)).to.equal(true);
  });

  it('exposes the signal enum (frozen)', () => {
    expect(REVIEW_SIGNALS).to.deep.equal({ POSITIVE: 'positive', NEGATIVE: 'negative' });
    expect(Object.isFrozen(REVIEW_SIGNALS)).to.equal(true);
  });

  it('exposes the rejection-category enum (frozen)', () => {
    expect(REJECTION_CATEGORIES).to.deep.equal({
      PRODUCT_BUG: 'product_bug',
      BAD_RECOMMENDATION: 'bad_recommendation',
      OTHER: 'other',
    });
    expect(Object.isFrozen(REJECTION_CATEGORIES)).to.equal(true);
  });

  it('exposes the tier enum (frozen)', () => {
    expect(FEEDBACK_TIERS).to.deep.equal({ PAID: 'paid', FREE: 'free' });
    expect(Object.isFrozen(FEEDBACK_TIERS)).to.equal(true);
  });

  it('excludes only product_bug from export', () => {
    expect(EXPORT_EXCLUDED_REJECTION_CATEGORIES).to.deep.equal(['product_bug']);
    expect(Object.isFrozen(EXPORT_EXCLUDED_REJECTION_CATEGORIES)).to.equal(true);
  });

  it('lists the opt-out stripped fields', () => {
    expect(OPT_OUT_STRIPPED_FIELDS).to.deep.equal(['previousFix', 'editedFix', 'detailMarkdown']);
    expect(Object.isFrozen(OPT_OUT_STRIPPED_FIELDS)).to.equal(true);
  });
});

describe('verdictToSignal', () => {
  it('maps up -> positive', () => {
    expect(verdictToSignal('up')).to.equal('positive');
  });

  it('maps down -> negative', () => {
    expect(verdictToSignal('down')).to.equal('negative');
  });

  it('throws on an invalid verdict', () => {
    expect(() => verdictToSignal('maybe')).to.throw('Invalid review verdict: maybe');
  });
});

describe('signalToVerdict', () => {
  it('maps positive -> up', () => {
    expect(signalToVerdict('positive')).to.equal('up');
  });

  it('maps negative -> down', () => {
    expect(signalToVerdict('negative')).to.equal('down');
  });

  it('throws on an invalid signal', () => {
    expect(() => signalToVerdict('neutral')).to.throw('Invalid review signal: neutral');
  });
});

describe('toReviewView', () => {
  const fullRow = {
    event_id: '9beae43f-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
    event_time: '2026-06-19T18:00:00.000Z',
    source: 'backoffice',
    signal: 'negative',
    reviewer_id: 'ese.name@adobe.com',
    detail_markdown: 'targets the wrong property',
    rejection_category: 'bad_recommendation',
    state_transition: 'PENDING_VALIDATION->REJECTED',
    tier: 'paid',
    previous_fix: { patch: 'before' },
    edited_fix: { patch: 'after' },
  };

  it('maps a full row to the review view, omitting patches by default', () => {
    const view = toReviewView(fullRow);
    expect(view).to.deep.equal({
      eventId: '9beae43f-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
      eventTime: '2026-06-19T18:00:00.000Z',
      source: 'backoffice',
      verdict: 'down',
      signal: 'negative',
      reviewerId: 'ese.name@adobe.com',
      detailMarkdown: 'targets the wrong property',
      rejectionCategory: 'bad_recommendation',
      stateTransition: 'PENDING_VALIDATION->REJECTED',
      tier: 'paid',
    });
    expect(view).to.not.have.property('previousFix');
    expect(view).to.not.have.property('editedFix');
  });

  it('includes patch fields when includePatches is set', () => {
    const view = toReviewView(fullRow, { includePatches: true });
    expect(view.previousFix).to.deep.equal({ patch: 'before' });
    expect(view.editedFix).to.deep.equal({ patch: 'after' });
  });

  it('defaults missing optional fields to null (incl. absent patches when requested)', () => {
    const view = toReviewView({
      event_id: 'id-1',
      event_time: '2026-06-19T18:00:00.000Z',
      source: 'backoffice',
      signal: 'positive',
      tier: 'free',
    }, { includePatches: true });
    expect(view.verdict).to.equal('up');
    expect(view.reviewerId).to.equal(null);
    expect(view.detailMarkdown).to.equal(null);
    expect(view.rejectionCategory).to.equal(null);
    expect(view.stateTransition).to.equal(null);
    expect(view.previousFix).to.equal(null);
    expect(view.editedFix).to.equal(null);
  });
});
