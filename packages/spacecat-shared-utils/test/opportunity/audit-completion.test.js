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

import { expect } from 'chai';
import { computeAuditCompletion } from '../../src/opportunity/audit-completion.js';

function makeAudit(auditType, auditedAt) {
  return {
    getAuditType: () => auditType,
    getAuditedAt: () => auditedAt,
  };
}

describe('computeAuditCompletion', () => {
  const T0 = 1_700_000_000_000; // onboardStartTime anchor

  describe('when no latestAudits are provided', () => {
    it('marks all audit types as pending when latestAudits is undefined', () => {
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion(
        ['type-a', 'type-b'],
        T0,
        undefined,
      );
      expect(pendingAuditTypes).to.deep.equal(['type-a', 'type-b']);
      expect(completedAuditTypes).to.deep.equal([]);
    });

    it('marks all audit types as pending when latestAudits is an empty array', () => {
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion(
        ['type-a'],
        T0,
        [],
      );
      expect(pendingAuditTypes).to.deep.equal(['type-a']);
      expect(completedAuditTypes).to.deep.equal([]);
    });
  });

  describe('when onboardStartTime is provided', () => {
    it('marks an audit as completed when auditedAt is strictly after onboardStartTime', () => {
      const audits = [makeAudit('type-a', new Date(T0 + 1000).toISOString())];
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion(
        ['type-a'],
        T0,
        audits,
      );
      expect(pendingAuditTypes).to.deep.equal([]);
      expect(completedAuditTypes).to.deep.equal(['type-a']);
    });

    it('marks an audit as pending when auditedAt equals onboardStartTime (in-flight boundary)', () => {
      const audits = [makeAudit('type-a', new Date(T0).toISOString())];
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion(
        ['type-a'],
        T0,
        audits,
      );
      expect(pendingAuditTypes).to.deep.equal(['type-a']);
      expect(completedAuditTypes).to.deep.equal([]);
    });

    it('marks an audit as pending when auditedAt is before onboardStartTime', () => {
      const audits = [makeAudit('type-a', new Date(T0 - 5000).toISOString())];
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion(
        ['type-a'],
        T0,
        audits,
      );
      expect(pendingAuditTypes).to.deep.equal(['type-a']);
      expect(completedAuditTypes).to.deep.equal([]);
    });

    it('marks an audit as pending when auditedAt is an invalid date string (NaN guard)', () => {
      const audits = [makeAudit('type-a', 'not-a-date')];
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion(
        ['type-a'],
        T0,
        audits,
      );
      expect(pendingAuditTypes).to.deep.equal(['type-a']);
      expect(completedAuditTypes).to.deep.equal([]);
    });

    it('marks an audit as pending when no DB record exists for it', () => {
      const audits = [makeAudit('type-b', new Date(T0 + 1000).toISOString())];
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion(
        ['type-a', 'type-b'],
        T0,
        audits,
      );
      expect(pendingAuditTypes).to.deep.equal(['type-a']);
      expect(completedAuditTypes).to.deep.equal(['type-b']);
    });

    it('correctly classifies a mix of pending and completed audit types', () => {
      const audits = [
        makeAudit('type-a', new Date(T0 + 2000).toISOString()), // completed
        makeAudit('type-b', new Date(T0 - 1000).toISOString()), // pending (predates)
        makeAudit('type-c', new Date(T0).toISOString()), // pending (exact match)
        // type-d has no record — pending
      ];
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion(
        ['type-a', 'type-b', 'type-c', 'type-d'],
        T0,
        audits,
      );
      expect(completedAuditTypes).to.deep.equal(['type-a']);
      expect(pendingAuditTypes).to.deep.equal(['type-b', 'type-c', 'type-d']);
    });
  });

  describe('when onboardStartTime is absent (legacy sites)', () => {
    it('treats any existing audit record as completed', () => {
      const audits = [makeAudit('type-a', new Date(T0 - 99999).toISOString())];
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion(
        ['type-a', 'type-b'],
        undefined,
        audits,
      );
      // type-a has a record → completed; type-b has no record → pending
      expect(completedAuditTypes).to.deep.equal(['type-a']);
      expect(pendingAuditTypes).to.deep.equal(['type-b']);
    });

    it('marks audit as pending when no DB record exists, even without onboardStartTime', () => {
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion(
        ['type-a'],
        undefined,
        [],
      );
      expect(pendingAuditTypes).to.deep.equal(['type-a']);
      expect(completedAuditTypes).to.deep.equal([]);
    });
  });

  describe('edge cases', () => {
    it('returns empty arrays when auditTypes is empty', () => {
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion([], T0, []);
      expect(pendingAuditTypes).to.deep.equal([]);
      expect(completedAuditTypes).to.deep.equal([]);
    });

    it('ignores extra audit records not in auditTypes', () => {
      const audits = [
        makeAudit('type-a', new Date(T0 + 1000).toISOString()),
        makeAudit('type-extra', new Date(T0 + 1000).toISOString()),
      ];
      const { pendingAuditTypes, completedAuditTypes } = computeAuditCompletion(
        ['type-a'],
        T0,
        audits,
      );
      expect(completedAuditTypes).to.deep.equal(['type-a']);
      expect(pendingAuditTypes).to.deep.equal([]);
    });
  });
});
