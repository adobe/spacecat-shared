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
  SCHEMA_VERSION,
  verdictToSignal,
  signalToVerdict,
  toReviewView,
  shouldExport,
  toJsonlRow,
  buildJsonl,
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

  it('lists only the HUMAN-authored opt-out stripped fields (AI-generated guidance + generated patch are always exported)', () => {
    expect(OPT_OUT_STRIPPED_FIELDS).to.deep.equal(['detail_markdown', 'edited_fix']);
    expect(OPT_OUT_STRIPPED_FIELDS).to.not.include('previous_fix');
    expect(OPT_OUT_STRIPPED_FIELDS).to.not.include('guidance_markdown');
    expect(Object.isFrozen(OPT_OUT_STRIPPED_FIELDS)).to.equal(true);
  });

  it('exposes the current JSONL schema version', () => {
    expect(SCHEMA_VERSION).to.equal(1);
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
    feedback_subject_id: 'issue-42',
    previous_fix: { patch: 'before' },
    edited_fix: { patch: 'after' },
    guidance_markdown: '# Slow hero image\n\nLCP element is a 1.2 MB PNG.',
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
      // feedbackSubjectId is in the base view (the UI filters on it)
      feedbackSubjectId: 'issue-42',
    });
    expect(view).to.not.have.property('previousFix');
    expect(view).to.not.have.property('editedFix');
  });

  it('includes patch fields + guidance when includePatches is set', () => {
    const view = toReviewView(fullRow, { includePatches: true });
    expect(view.previousFix).to.deep.equal({ patch: 'before' });
    expect(view.editedFix).to.deep.equal({ patch: 'after' });
    expect(view.guidanceMarkdown).to.equal('# Slow hero image\n\nLCP element is a 1.2 MB PNG.');
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
    expect(view.guidanceMarkdown).to.equal(null);
    expect(view.feedbackSubjectId).to.equal(null);
  });

  it('returns null when no row is given', () => {
    expect(toReviewView(undefined)).to.equal(null);
    expect(toReviewView(null)).to.equal(null);
  });
});

describe('shouldExport', () => {
  const patch = { content: 'diff --git a/x b/x' };

  it('excludes product_bug rows (even with a patch)', () => {
    expect(shouldExport({ rejection_category: 'product_bug', previous_fix: patch })).to.equal(false);
  });

  it('includes bad_recommendation rows that have a code patch', () => {
    expect(shouldExport({ rejection_category: 'bad_recommendation', previous_fix: patch })).to.equal(true);
  });

  it('includes NULL-category rows (approvals) that have a code patch', () => {
    expect(shouldExport({ rejection_category: null, previous_fix: patch })).to.equal(true);
  });

  it('excludes rows with no code patch (text-guidance-only feedback stays in Postgres)', () => {
    expect(shouldExport({ rejection_category: 'bad_recommendation', previous_fix: null })).to.equal(false);
    expect(shouldExport({ rejection_category: null })).to.equal(false);
  });
});

describe('toJsonlRow', () => {
  const fullRow = {
    event_id: 'e1',
    event_time: '2026-06-19T18:00:00.000Z',
    organization_id: 'org1',
    site_id: 'site1',
    suggestion_id: 'sug1',
    opportunity_type: 'cwv',
    source: 'backoffice',
    signal: 'negative',
    reviewer_id: 'ese@adobe.com',
    rejection_category: 'bad_recommendation',
    state_transition: 'PENDING_VALIDATION->REJECTED',
    tier: 'paid',
    detail_markdown: 'rationale',
    guidance_markdown: '# Slow hero image\n\nLCP element is a 1.2 MB PNG.',
    previous_fix: { patch: 'before' },
    edited_fix: { patch: 'after' },
  };

  it('maps a row to the snake_case JSONL shape, stamping schema_version + verdict', () => {
    const out = toJsonlRow(fullRow, { optedIn: true });
    expect(out.schema_version).to.equal(SCHEMA_VERSION);
    expect(out.verdict).to.equal('down');
    expect(out.signal).to.equal('negative');
    expect(out.detail_markdown).to.equal('rationale');
    expect(out.guidance_markdown).to.equal('# Slow hero image\n\nLCP element is a 1.2 MB PNG.');
    expect(out.previous_fix).to.deep.equal({ patch: 'before' });
    expect(out.edited_fix).to.deep.equal({ patch: 'after' });
  });

  it('strips only the human-authored fields on opt-out; guidance + generated patch still ship', () => {
    const out = toJsonlRow(fullRow, { optedIn: false });
    // human-authored → stripped
    expect(out.detail_markdown).to.equal(null);
    expect(out.edited_fix).to.equal(null);
    // AI-generated → always exported (the LA needs the issue + generated patch)
    expect(out.guidance_markdown).to.equal('# Slow hero image\n\nLCP element is a 1.2 MB PNG.');
    expect(out.previous_fix).to.deep.equal({ patch: 'before' });
    // metadata still ships
    expect(out.signal).to.equal('negative');
    expect(out.rejection_category).to.equal('bad_recommendation');
    expect(out.tier).to.equal('paid');
  });

  it('defaults to opted-out and nulls missing optional fields', () => {
    const out = toJsonlRow({
      event_id: 'e2',
      event_time: '2026-06-19T18:00:00.000Z',
      organization_id: 'org1',
      site_id: 'site1',
      suggestion_id: 'sug1',
      opportunity_type: 'cwv',
      source: 'backoffice',
      signal: 'positive',
      tier: 'free',
    });
    expect(out.verdict).to.equal('up');
    expect(out.reviewer_id).to.equal(null);
    expect(out.rejection_category).to.equal(null);
    expect(out.state_transition).to.equal(null);
    expect(out.detail_markdown).to.equal(null);
    expect(out.guidance_markdown).to.equal(null);
    expect(out.previous_fix).to.equal(null);
    expect(out.edited_fix).to.equal(null);
  });
});

describe('buildJsonl', () => {
  const row = (overrides = {}) => ({
    event_id: 'e',
    event_time: 't',
    organization_id: 'o',
    site_id: 's',
    suggestion_id: 'sg',
    opportunity_type: 'cwv',
    source: 'backoffice',
    signal: 'positive',
    tier: 'free',
    // exportable rows carry a generated code patch by default
    previous_fix: { content: 'diff --git a/x b/x' },
    ...overrides,
  });

  it('filters product_bug rows and joins the rest as NDJSON', () => {
    const jsonl = buildJsonl([
      row({ event_id: 'a', rejection_category: 'bad_recommendation' }),
      row({ event_id: 'b', rejection_category: 'product_bug' }),
      row({ event_id: 'c', rejection_category: null }),
    ], { optedIn: true });
    const lines = jsonl.split('\n').map((l) => JSON.parse(l));
    expect(lines).to.have.length(2);
    expect(lines.map((l) => l.event_id)).to.deep.equal(['a', 'c']);
  });

  it('filters out text-guidance-only rows (no code patch)', () => {
    const jsonl = buildJsonl([
      row({ event_id: 'a', rejection_category: 'bad_recommendation' }),
      row({ event_id: 'b', previous_fix: null }), // text-guidance only → not exported
    ], { optedIn: true });
    const lines = jsonl.split('\n').map((l) => JSON.parse(l));
    expect(lines.map((l) => l.event_id)).to.deep.equal(['a']);
  });

  it('returns an empty string when every row is filtered out', () => {
    expect(buildJsonl([row({ rejection_category: 'product_bug' })])).to.equal('');
  });
});
