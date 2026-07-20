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

import {
  CHANGE_DETAILS_SCHEMA_VERSION,
  CHANGE_DETAILS,
  SURFACES,
  ACTOR_TYPES,
  CALL_STATUSES,
  APPLIED,
  CHANGE_RESULT_STATUSES,
  VERIFY_VERDICTS,
  DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES,
  changeDetailsV2Schema,
  validateChangeDetails,
} from '../../../../src/models/fix-entity/change-details.schema.js';
import FixEntity from '../../../../src/models/fix-entity/fix-entity.model.js';

// Minimal valid v2 record (result is optional at create time).
const minimal = () => ({
  schemaVersion: 2,
  surface: SURFACES.ASO,
  actorType: ACTOR_TYPES.IMS_USER,
  target: {
    changeType: 'alt-text',
    changes: [{ targetPath: '/content/p', property: 'alt', intendedValue: 'Mia, lawyer.' }],
  },
});

// Full valid v2 record with a result block + verify verdicts.
const full = () => ({
  ...minimal(),
  target: {
    system: 'aem_cs',
    changeType: 'alt-text',
    siteId: 'site-1',
    pageId: 'page-1',
    documentPath: '/edit/p',
    detectedPageAuthorUrl: 'https://author/p',
    changes: [{ targetPath: '/content/p', property: 'alt', intendedValue: 'Mia, lawyer.' }],
  },
  result: {
    callStatus: CALL_STATUSES.SUCCESS,
    applied: APPLIED.ALL,
    deployResponsePayload: { status: 200, body: 'ok' },
    deployResponseSha256: 'a'.repeat(64),
    changeResults: [{
      targetPath: '/content/p',
      property: 'alt',
      previousValue: '',
      appliedValue: 'Mia, lawyer.',
      status: CHANGE_RESULT_STATUSES.APPLIED,
    }],
    preVerify: { verdict: VERIFY_VERDICTS.VERIFIED, reasonCode: 'ok', preVerifiedAt: new Date().toISOString() },
    postVerify: {
      verdict: VERIFY_VERDICTS.VERIFIED,
      evidence: { rendered: true },
      revert: { snapshot: 'x' },
      postVerifiedAt: new Date().toISOString(),
    },
  },
});

describe('FixEntity changeDetails v2 schema', () => {
  describe('enums + constants', () => {
    it('exposes the schema version', () => {
      expect(CHANGE_DETAILS_SCHEMA_VERSION).to.equal(2);
    });

    it('bundles enums + limits on CHANGE_DETAILS', () => {
      expect(CHANGE_DETAILS).to.deep.equal({
        SCHEMA_VERSION: CHANGE_DETAILS_SCHEMA_VERSION,
        SURFACES,
        ACTOR_TYPES,
        CALL_STATUSES,
        APPLIED,
        CHANGE_RESULT_STATUSES,
        VERIFY_VERDICTS,
        DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES,
      });
    });

    it('is attached to the FixEntity model as a static', () => {
      expect(FixEntity.CHANGE_DETAILS).to.equal(CHANGE_DETAILS);
      expect(FixEntity.CHANGE_DETAILS.SURFACES.ASO).to.equal('ASO');
    });

    it('caps the deploy response payload at 4 KB', () => {
      expect(DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES).to.equal(4096);
    });
  });

  describe('validateChangeDetails - reader tolerance', () => {
    [null, undefined, '', 0, [], {}].forEach((value) => {
      it(`returns false for non-object / empty value: ${JSON.stringify(value)}`, () => {
        expect(validateChangeDetails(value)).to.equal(false);
      });
    });

    it('passes a legacy freeform record (no schemaVersion) unchanged', () => {
      expect(validateChangeDetails({ system: 'aem_cs', targetChanges: [] })).to.equal(true);
    });

    it('passes a v1 record (schemaVersion: 1) without v2 validation', () => {
      expect(validateChangeDetails({ schemaVersion: 1, anything: 'goes' })).to.equal(true);
    });

    it('passes a v1 record with a string schemaVersion "1"', () => {
      expect(validateChangeDetails({ schemaVersion: '1', anything: 'goes' })).to.equal(true);
    });

    it('does NOT treat a string schemaVersion "2" as legacy — it is validated as v2', () => {
      // regression: a stray '2' (int-vs-string drift) must not silently skip validation.
      expect(() => validateChangeDetails({ schemaVersion: '2', surface: 'BOGUS', junk: true }))
        .to.throw(/changeDetails \(v2\) invalid/);
      // a well-formed record with a coercible string version still validates.
      expect(validateChangeDetails({ ...minimal(), schemaVersion: '2' })).to.equal(true);
    });

    it('rejects an unknown future schemaVersion (e.g. 3) rather than passing it', () => {
      expect(() => validateChangeDetails({ ...minimal(), schemaVersion: 3 }))
        .to.throw(/changeDetails \(v2\) invalid/);
    });
  });

  describe('validateChangeDetails - v2 happy path', () => {
    it('accepts a minimal v2 record (no result yet)', () => {
      expect(validateChangeDetails(minimal())).to.equal(true);
    });

    it('accepts a full v2 record with result + verify verdicts', () => {
      expect(validateChangeDetails(full())).to.equal(true);
    });
  });

  describe('validateChangeDetails - v2 rejections', () => {
    const rejects = (record, match) => {
      expect(() => validateChangeDetails(record)).to.throw(/changeDetails \(v2\) invalid/);
      expect(() => validateChangeDetails(record)).to.throw(match);
    };

    // Each case builds its own record so we never mutate a shared/param object.
    const withResult = (result) => ({ ...minimal(), result });

    it('rejects an unknown top-level key (strict)', () => {
      rejects({ ...minimal(), bogus: true }, /bogus/);
    });

    it('rejects a bad surface', () => {
      rejects({ ...minimal(), surface: 'NOPE' }, /surface/);
    });

    it('rejects a bad actorType', () => {
      rejects({ ...minimal(), actorType: 'NOPE' }, /actorType/);
    });

    it('rejects a missing target', () => {
      const record = minimal();
      delete record.target;
      rejects(record, /target/);
    });

    it('rejects a target with no changeType', () => {
      rejects({
        ...minimal(),
        target: { changes: [{ targetPath: '/p', property: 'alt', intendedValue: 'x' }] },
      }, /changeType/);
    });

    it('rejects an empty target.changes array', () => {
      rejects({ ...minimal(), target: { changeType: 'alt-text', changes: [] } }, /changes/);
    });

    it('rejects a target change missing property', () => {
      rejects({
        ...minimal(),
        target: { changeType: 'alt-text', changes: [{ targetPath: '/p', intendedValue: 'x' }] },
      }, /property/);
    });

    it('rejects a target change missing intendedValue', () => {
      rejects({
        ...minimal(),
        target: { changeType: 'alt-text', changes: [{ targetPath: '/p', property: 'alt' }] },
      }, /intendedValue/);
    });

    it('rejects a bad result.callStatus', () => {
      rejects(withResult({ callStatus: 'boom', applied: APPLIED.ALL }), /callStatus/);
    });

    it('rejects a bad result.applied value', () => {
      rejects(withResult({ callStatus: CALL_STATUSES.SUCCESS, applied: 'MOSTLY' }), /applied/);
    });

    it('rejects a bad changeResults status', () => {
      rejects(withResult({
        callStatus: CALL_STATUSES.SUCCESS,
        applied: APPLIED.ALL,
        changeResults: [{ targetPath: '/content/p', property: 'alt', status: 'weird' }],
      }), /status/);
    });

    it('rejects a malformed deployResponseSha256', () => {
      rejects(withResult({
        callStatus: CALL_STATUSES.SUCCESS,
        applied: APPLIED.ALL,
        deployResponseSha256: 'xyz',
      }), /deployResponseSha256/);
    });

    it('rejects a bad preVerify verdict', () => {
      rejects(withResult({
        callStatus: CALL_STATUSES.SUCCESS,
        applied: APPLIED.ALL,
        preVerify: { verdict: 'meh' },
      }), /verdict/);
    });

    it('rejects a non-iso postVerify timestamp', () => {
      rejects(withResult({
        callStatus: CALL_STATUSES.SUCCESS,
        applied: APPLIED.ALL,
        postVerify: { verdict: VERIFY_VERDICTS.VERIFIED, postVerifiedAt: 'yesterday' },
      }), /postVerifiedAt/);
    });

    it('rejects a deployResponsePayload string over the 4 KB cap', () => {
      rejects(withResult({
        callStatus: CALL_STATUSES.SUCCESS,
        applied: APPLIED.ALL,
        deployResponsePayload: 'x'.repeat(DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES + 1),
      }), /deployResponsePayload/);
    });

    it('rejects a deployResponsePayload object over the 4 KB cap', () => {
      rejects(withResult({
        callStatus: CALL_STATUSES.SUCCESS,
        applied: APPLIED.ALL,
        deployResponsePayload: { blob: 'y'.repeat(DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES) },
      }), /deployResponsePayload/);
    });

    it('rejects changeResults with no matching target.changes (key mismatch)', () => {
      rejects(withResult({
        callStatus: CALL_STATUSES.SUCCESS,
        applied: APPLIED.PARTIAL,
        changeResults: [{ targetPath: '/other', property: 'title', status: CHANGE_RESULT_STATUSES.APPLIED }],
      }), /no matching target\.changes/);
    });

    // The key-match cross-check only runs once both sides are arrays; when
    // target.changes is absent the required-field rule rejects the record first,
    // so a record with changeResults but no changes still throws (on `changes`).
    it('falls back to the required-field error when changeResults exist but changes do not', () => {
      rejects({
        schemaVersion: 2,
        surface: SURFACES.ASO,
        actorType: ACTOR_TYPES.IMS_USER,
        target: { changeType: 'alt-text' },
        result: {
          callStatus: CALL_STATUSES.SUCCESS,
          applied: APPLIED.PARTIAL,
          changeResults: [{ targetPath: '/p', property: 'alt', status: CHANGE_RESULT_STATUSES.APPLIED }],
        },
      }, /changes/);
    });

    it('rejects applied:ALL when a proposed change has no recorded outcome', () => {
      rejects({
        schemaVersion: 2,
        surface: SURFACES.ASO,
        actorType: ACTOR_TYPES.IMS_USER,
        target: {
          changeType: 'alt-text',
          changes: [
            { targetPath: '/a', property: 'alt', intendedValue: 'x' },
            { targetPath: '/b', property: 'alt', intendedValue: 'y' },
          ],
        },
        result: {
          callStatus: CALL_STATUSES.SUCCESS,
          applied: APPLIED.ALL,
          changeResults: [{ targetPath: '/a', property: 'alt', status: CHANGE_RESULT_STATUSES.APPLIED }],
        },
      }, /applied is ALL/);
    });
  });

  describe('deployResponsePayload edge cases', () => {
    it('accepts a null payload (nullish coalesces to empty)', () => {
      const record = minimal();
      record.result = {
        callStatus: CALL_STATUSES.SUCCESS,
        applied: APPLIED.NONE,
        deployResponsePayload: null,
      };
      expect(validateChangeDetails(record)).to.equal(true);
    });

    it('accepts a payload exactly at the cap', () => {
      const record = minimal();
      record.result = {
        callStatus: CALL_STATUSES.SUCCESS,
        applied: APPLIED.ALL,
        deployResponsePayload: 'z'.repeat(DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES),
      };
      expect(validateChangeDetails(record)).to.equal(true);
    });

    it('rejects an un-serializable (circular) payload instead of throwing a raw error', () => {
      const circular = {};
      circular.self = circular;
      const record = minimal();
      record.result = {
        callStatus: CALL_STATUSES.SUCCESS,
        applied: APPLIED.NONE,
        deployResponsePayload: circular,
      };
      expect(() => validateChangeDetails(record)).to.throw(/deployResponsePayload/);
    });
  });

  describe('applied roll-up completeness', () => {
    it('accepts applied:PARTIAL that records only the changes that landed', () => {
      const record = {
        schemaVersion: 2,
        surface: SURFACES.ASO,
        actorType: ACTOR_TYPES.IMS_USER,
        target: {
          changeType: 'alt-text',
          changes: [
            { targetPath: '/a', property: 'alt', intendedValue: 'x' },
            { targetPath: '/b', property: 'alt', intendedValue: 'y' },
          ],
        },
        result: {
          callStatus: CALL_STATUSES.SUCCESS,
          applied: APPLIED.PARTIAL,
          changeResults: [{ targetPath: '/a', property: 'alt', status: CHANGE_RESULT_STATUSES.APPLIED }],
        },
      };
      expect(validateChangeDetails(record)).to.equal(true);
    });
  });

  describe('changeDetailsV2Schema (direct)', () => {
    it('validates a full record with no error', () => {
      const { error } = changeDetailsV2Schema.validate(full());
      expect(error).to.equal(undefined);
    });

    it('collects multiple errors with abortEarly:false', () => {
      const { error } = changeDetailsV2Schema.validate(
        { schemaVersion: 2, surface: 'NOPE', actorType: 'NOPE' },
        { abortEarly: false },
      );
      expect(error).to.not.equal(undefined);
      expect(error.details.length).to.be.greaterThan(1);
    });
  });
});
