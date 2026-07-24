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

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import parse from 'joi-to-json';

import {
  changeDetailsV2Schema,
  CHANGE_DETAILS_SCHEMA_VERSION,
} from '../src/models/fix-entity/change-details.schema.js';

// draft-2019-09 is the newest draft joi-to-json emits and is fully supported by
// Python's `jsonschema` (Draft201909Validator).
export const JSON_SCHEMA_DRAFT = 'json-draft-2019-09';
export const SCHEMA_ID = 'https://ns.adobe.com/spacecat/fix-entity/change-details/v2';
// Package-root-relative path of the generated artifact.
export const ARTIFACT_PATH = 'schemas/fix-entity-change-details.v2.schema.json';

/**
 * Build the portable JSON Schema artifact DERIVED from the canonical Joi schema
 * (`changeDetailsV2Schema`). The Joi schema is the single source of truth; this
 * artifact is what non-JS runtimes (mystique / Python) vendor and validate against.
 *
 * NOTE — JSON Schema captures structure + enums + required + patterns only. The
 * cross-field invariants enforced by the Joi `.custom()` rules are NOT expressible
 * here and must be ported by consumers that need them:
 *   - result.changeResults <-> target.changes (targetPath, property) key-match
 *   - applied:ALL completeness (every proposed change has a recorded outcome)
 *   - deployResponsePayload 4 KB size cap
 *
 * @returns {object} the JSON Schema document.
 */
export function buildChangeDetailsJsonSchema() {
  const body = parse(changeDetailsV2Schema, JSON_SCHEMA_DRAFT);
  return {
    $schema: 'https://json-schema.org/draft/2019-09/schema',
    $id: SCHEMA_ID,
    title: `FixEntity changeDetails v${CHANGE_DETAILS_SCHEMA_VERSION}`,
    description: 'Canonical v2 deploy-action record for FixEntity.changeDetails '
      + '(SITES-47997, ADR adobe/mysticat-architecture#200). GENERATED from the Joi '
      + 'source of truth (changeDetailsV2Schema in spacecat-shared-data-access) — DO NOT '
      + 'EDIT BY HAND; run `npm run generate:schemas -w packages/spacecat-shared-data-access`. '
      + 'Structure/enums/required/patterns only: the cross-field invariants '
      + '(changeResults<->target.changes key-match, applied:ALL completeness, '
      + 'deployResponsePayload 4KB cap) are Joi-enforced and NOT expressible in JSON Schema.',
    ...body,
  };
}

// When run directly (`node scripts/generate-change-details-schema.js`), (re)write
// the committed artifact. Consumed by the `generate:schemas` npm script.
// (This file lives under scripts/, outside the src/ coverage scope in .nycrc.json,
// so no c8-ignore is needed for the CLI block.)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outPath = path.join(packageRoot, ARTIFACT_PATH);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(buildChangeDetailsJsonSchema(), null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
}
