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

import Joi from 'joi';
import { isNonEmptyObject } from '@adobe/spacecat-shared-utils';

/**
 * Canonical v2 shape for `FixEntity.changeDetails` — the structured, validated
 * "deploy action" record defined by ADR
 * adobe/mysticat-architecture#200 (platform/decisions/deploy-action-provenance-and-verify.md,
 * SITES-47997): *who* deployed/published, *when*, *what entity/property* is
 * proposed to change, *which pages* are affected, and *the result of the call*.
 *
 * The DB column stays `type: 'any'` (no destructive migration); this module is
 * the machine-readable schema the JS write chokepoint validates against, so the
 * freeform bag cannot silently drift across the two runtimes (autofix-worker JS
 * + mystique Python). Records without `schemaVersion === 2` are legacy freeform
 * (v1) and are intentionally NOT schema-validated — the migration is additive
 * and reader-tolerant (ADR "V1 / V2 backwards compatibility").
 */

export const CHANGE_DETAILS_SCHEMA_VERSION = 2;

// Deploy CHANNEL / "where" the fix went live.
export const SURFACES = {
  ASO: 'ASO',
  AUTHOR_PUBLISH: 'AUTHOR_PUBLISH',
  GIT_MERGE: 'GIT_MERGE',
  SYSTEM: 'SYSTEM',
};

// WHO acted. Orthogonal to `surface` — DETECTOR is an actor (an audit that
// observed a live fix), not a deploy channel, so it is an actorType not a surface.
export const ACTOR_TYPES = {
  IMS_USER: 'IMS_USER',
  SERVICE: 'SERVICE',
  GITHUB: 'GITHUB',
  DETECTOR: 'DETECTOR',
  UNKNOWN: 'UNKNOWN',
};

// Classified outcome of the deploy/apply call — transport-agnostic (JCR writes
// and git ops classify the same way HTTP does). Set independently by the
// transport adapter; NOT derived from `changeResults`. `no_op` is the case
// SITES-47077 / SITES-47078 silently mis-read as success.
export const CALL_STATUSES = {
  SUCCESS: 'success',
  NO_OP: 'no_op',
  CLIENT_ERROR: 'client_error',
  SERVER_ERROR: 'server_error',
  TIMEOUT: 'timeout',
};

// Whole-action roll-up of the per-change `changeResults[].status`. NOT a boolean
// — a deploy action may write >1 property, so "2-of-3" is first-class.
export const APPLIED = {
  ALL: 'ALL',
  PARTIAL: 'PARTIAL',
  NONE: 'NONE',
};

// Per-change outcome, key-matched to `target.changes` by (targetPath, property).
export const CHANGE_RESULT_STATUSES = {
  APPLIED: 'applied',
  UNCHANGED: 'unchanged',
  FAILED: 'failed',
};

// Verify verdict. Distinguishes NEGATIVE (`rejected` — verify ran, the change did
// not render as expected → revert-eligible) from ERRORED (`verify_failed` —
// verify could not complete → MUST NOT auto-revert). Mirrors the post-verify POC.
export const VERIFY_VERDICTS = {
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  INCONCLUSIVE: 'inconclusive',
  VERIFY_FAILED: 'verify_failed',
};

// `deployResponsePayload` size cap (bytes). MUST hold on a shared DB column — one
// runaway payload degrades read latency for every consumer. Writers hash-first,
// then cap/redact, so `deployResponseSha256` always covers the pre-redact payload.
export const DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES = 4096;

const enumValues = (obj) => Object.values(obj);

const byteLength = (value) => Buffer.byteLength(
  typeof value === 'string' ? value : JSON.stringify(value ?? ''),
  'utf8',
);

const verdictBase = {
  verdict: Joi.string().valid(...enumValues(VERIFY_VERDICTS)).required(),
  reasonCode: Joi.string(),
  evidence: Joi.any(),
};

const preVerifySchema = Joi.object({
  ...verdictBase,
  preVerifiedAt: Joi.string().isoDate(),
});

const postVerifySchema = Joi.object({
  ...verdictBase,
  revert: Joi.any(),
  postVerifiedAt: Joi.string().isoDate(),
});

// The PROPOSAL — intent only (`intendedValue`). Baseline (`previousValue`) and
// observed outcome (`appliedValue`, `status`) live per-change in `changeResults`.
const targetChangeSchema = Joi.object({
  targetPath: Joi.string().required(),
  property: Joi.string().required(),
  intendedValue: Joi.any().required(),
});

const changeResultSchema = Joi.object({
  targetPath: Joi.string().required(),
  property: Joi.string().required(),
  previousValue: Joi.any(),
  appliedValue: Joi.any(),
  status: Joi.string().valid(...enumValues(CHANGE_RESULT_STATUSES)).required(),
});

const targetSchema = Joi.object({
  system: Joi.string(),
  changeType: Joi.string().required(),
  siteId: Joi.string(),
  pageId: Joi.string(),
  documentPath: Joi.string(),
  detectedPageAuthorUrl: Joi.string(),
  changes: Joi.array().items(targetChangeSchema).min(1).required(),
});

const resultSchema = Joi.object({
  callStatus: Joi.string().valid(...enumValues(CALL_STATUSES)).required(),
  applied: Joi.string().valid(...enumValues(APPLIED)).required(),
  deployResponsePayload: Joi.any().custom((value, helpers) => {
    let size;
    try {
      size = byteLength(value);
    } catch {
      // Un-serializable payload (e.g. a circular reference) — it must be
      // serialized/truncated into deployResponseSha256 at the write chokepoint
      // before persist, so reject it here rather than throw a raw TypeError.
      return helpers.error('any.invalid');
    }
    if (size > DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES) {
      return helpers.error('any.invalid');
    }
    return value;
  })
    // Carried into the derived JSON Schema so the size-cap caveat travels with
    // the field for JSON-Schema-only (mystique) consumers — the cap itself is a
    // Joi `.custom()` rule and is NOT expressible/enforced in JSON Schema.
    .description(`Raw deploy/apply API response (body + status + relevant headers). MUST be <= ${DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES} bytes at the write chokepoint; larger payloads must be hashed into deployResponseSha256 and truncated. Size cap enforced by the Joi validator, not by this JSON Schema.`)
    .messages({
      'any.invalid': `result.deployResponsePayload exceeds ${DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES} bytes; hash it into deployResponseSha256 and truncate at the write chokepoint`,
    }),
  // Explicit case ranges (not the /i flag) so the derived JSON Schema `pattern`
  // stays flag-free and portable to Python's re-based validators.
  deployResponseSha256: Joi.string().pattern(/^[a-fA-F0-9]{64}$/),
  changeResults: Joi.array().items(changeResultSchema),
  preVerify: preVerifySchema,
  postVerify: postVerifySchema,
});

// Composite match key for (targetPath, property). JSON.stringify gives an
// unambiguous, collision-safe delimiter regardless of what the strings contain.
const changeKey = (change) => JSON.stringify([change.targetPath, change.property]);

/**
 * Canonical Joi schema for a v2 `changeDetails` record. Strict (unknown keys are
 * rejected) so v2 writers cannot re-introduce freeform drift.
 */
export const changeDetailsV2Schema = Joi.object({
  // `.strict()` — no type coercion: writers MUST pass the integer 2, never the
  // string '2'. A coerced-then-persisted '2' would read as legacy (!= 2) in
  // mystique's Python runtime, the exact cross-runtime divergence this
  // discriminator exists to prevent.
  schemaVersion: Joi.number().valid(CHANGE_DETAILS_SCHEMA_VERSION).strict().required(),
  surface: Joi.string().valid(...enumValues(SURFACES)).required(),
  actorType: Joi.string().valid(...enumValues(ACTOR_TYPES)).required(),
  target: targetSchema.required(),
  result: resultSchema,
}).custom((value, helpers) => {
  // Blocking constraint: `result.changeResults` and `target.changes` MUST
  // key-match by (targetPath, property) — not positional — so a writer that
  // skips or reorders an entry cannot silently misalign the proposal (intent)
  // against the observed outcome. When either side is absent the required-field
  // rules already reject the record, so we only cross-check once both are arrays.
  const changeResults = value.result?.changeResults;
  const changes = value.target?.changes;
  const appliedAll = value.result?.applied === APPLIED.ALL;
  // (a) `applied: ALL` claims every proposed change landed, so it MUST carry the
  // per-change evidence — an ALL with no changeResults is an unfalsifiable claim.
  if (appliedAll && !Array.isArray(changeResults)) {
    return helpers.message('result.applied is ALL but result.changeResults is missing');
  }
  if (Array.isArray(changeResults) && Array.isArray(changes)) {
    const intentKeys = new Set(changes.map(changeKey));
    // (b) no orphan outcome — every changeResult maps to a proposed change.
    if (changeResults.some((r) => !intentKeys.has(changeKey(r)))) {
      return helpers.message('result.changeResults contains an entry with no matching target.changes (targetPath, property)');
    }
    // (c) completeness for a whole-action success — every proposed change MUST
    // have a recorded outcome. PARTIAL/NONE legitimately omit entries.
    if (appliedAll) {
      const resultKeys = new Set(changeResults.map(changeKey));
      if (changes.some((c) => !resultKeys.has(changeKey(c)))) {
        return helpers.message('result.applied is ALL but a target.changes entry has no matching result.changeResults');
      }
    }
  }
  return value;
});

/**
 * Validator for the `FixEntity.changeDetails` attribute. Reader-tolerant:
 * legacy freeform records (schemaVersion absent or !== 2) keep the pre-existing
 * non-empty-object guard; v2 records are validated against {@link changeDetailsV2Schema}.
 *
 * @param {*} value - the changeDetails value being persisted.
 * @returns {boolean} true when valid (schema builders treat `false` as a failure).
 * @throws {Error} with a descriptive message when a v2 record is invalid.
 */
export function validateChangeDetails(value) {
  if (!isNonEmptyObject(value)) {
    return false;
  }
  // Only an ABSENT schemaVersion (or an explicit v1) is legacy freeform, per the
  // ADR ("absent/1 ⇒ legacy freeform"). Anything else is claiming to be
  // structured, so it MUST run through the v2 schema — a stray `schemaVersion:
  // '2'` (int-vs-string drift) or a future version must never silently pass.
  const { schemaVersion } = value;
  if (schemaVersion === undefined || schemaVersion === null
    || schemaVersion === 1 || schemaVersion === '1') {
    return true;
  }
  const { error } = changeDetailsV2Schema.validate(value, { abortEarly: false });
  if (error) {
    throw new Error(`changeDetails (v2) invalid: ${error.message}`);
  }
  return true;
}

/**
 * Bundle of the v2 changeDetails enums + limits, attached to the FixEntity model
 * as `FixEntity.CHANGE_DETAILS` (mirrors `FixEntity.STATUSES`). Kept off the
 * package root barrel to avoid collisions on these generic names.
 */
export const CHANGE_DETAILS = {
  SCHEMA_VERSION: CHANGE_DETAILS_SCHEMA_VERSION,
  SURFACES,
  ACTOR_TYPES,
  CALL_STATUSES,
  APPLIED,
  CHANGE_RESULT_STATUSES,
  VERIFY_VERDICTS,
  DEPLOY_RESPONSE_PAYLOAD_MAX_BYTES,
};
