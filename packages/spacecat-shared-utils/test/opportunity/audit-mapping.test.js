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
import {
  AUDIT_OPPORTUNITY_MAP,
  getOpportunitiesForAudit,
  getAuditsForOpportunity,
  getAllOpportunityTypes,
  getAllAuditTypes,
} from '../../src/opportunity/audit-mapping.js';

describe('audit-mapping', () => {
  describe('AUDIT_OPPORTUNITY_MAP', () => {
    it('is a non-empty object', () => {
      expect(AUDIT_OPPORTUNITY_MAP).to.be.an('object');
      expect(Object.keys(AUDIT_OPPORTUNITY_MAP).length).to.be.greaterThan(0);
    });

    it('maps broken-backlinks to its opportunity type', () => {
      expect(AUDIT_OPPORTUNITY_MAP['broken-backlinks']).to.deep.equal(['broken-backlinks']);
    });

    it('maps forms-opportunities to multiple opportunity types', () => {
      expect(AUDIT_OPPORTUNITY_MAP['forms-opportunities']).to.deep.equal([
        'high-form-views-low-conversions',
        'high-page-views-low-form-nav',
        'high-page-views-low-form-views',
        'form-accessibility',
      ]);
    });
  });

  describe('getOpportunitiesForAudit', () => {
    it('returns opportunities for a known audit type', () => {
      expect(getOpportunitiesForAudit('cwv')).to.deep.equal(['cwv']);
    });

    it('returns multiple opportunities for forms-opportunities', () => {
      const opps = getOpportunitiesForAudit('forms-opportunities');
      expect(opps).to.include('high-form-views-low-conversions');
      expect(opps).to.include('form-accessibility');
    });

    it('returns empty array for unknown audit type', () => {
      expect(getOpportunitiesForAudit('unknown-audit')).to.deep.equal([]);
    });
  });

  describe('getAuditsForOpportunity', () => {
    it('returns the audit type that produces a given opportunity', () => {
      expect(getAuditsForOpportunity('cwv')).to.deep.equal(['cwv']);
    });

    it('returns the audit for a form opportunity type', () => {
      expect(getAuditsForOpportunity('high-form-views-low-conversions')).to.deep.equal(['forms-opportunities']);
    });

    it('returns empty array for an opportunity with no matching audit', () => {
      expect(getAuditsForOpportunity('nonexistent-opportunity')).to.deep.equal([]);
    });
  });

  describe('getAllOpportunityTypes', () => {
    it('returns a non-empty array', () => {
      const types = getAllOpportunityTypes();
      expect(types).to.be.an('array');
      expect(types.length).to.be.greaterThan(0);
    });

    it('contains no duplicates', () => {
      const types = getAllOpportunityTypes();
      expect(types.length).to.equal(new Set(types).size);
    });

    it('includes known opportunity types', () => {
      const types = getAllOpportunityTypes();
      expect(types).to.include('cwv');
      expect(types).to.include('broken-backlinks');
      expect(types).to.include('high-form-views-low-conversions');
    });
  });

  describe('getAllAuditTypes', () => {
    it('returns a non-empty array', () => {
      const types = getAllAuditTypes();
      expect(types).to.be.an('array');
      expect(types.length).to.be.greaterThan(0);
    });

    it('includes known audit types', () => {
      const types = getAllAuditTypes();
      expect(types).to.include('cwv');
      expect(types).to.include('broken-backlinks');
      expect(types).to.include('forms-opportunities');
    });
  });
});
