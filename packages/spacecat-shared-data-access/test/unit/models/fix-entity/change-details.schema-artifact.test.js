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

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import {
  buildChangeDetailsJsonSchema,
  ARTIFACT_PATH,
  SCHEMA_ID,
} from '../../../../scripts/generate-change-details-schema.js';

const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../../../../');

describe('changeDetails v2 JSON Schema artifact', () => {
  const committed = JSON.parse(readFileSync(path.join(packageRoot, ARTIFACT_PATH), 'utf8'));

  it('committed artifact is in sync with the Joi source of truth', () => {
    // Drift guard: if this fails, the Joi schema changed without regenerating —
    // run `npm run generate:schemas -w packages/spacecat-shared-data-access`.
    expect(committed).to.deep.equal(buildChangeDetailsJsonSchema());
  });

  it('carries the stable $id and draft-2019-09 discriminator so mystique can vendor it', () => {
    expect(committed.$id).to.equal(SCHEMA_ID);
    expect(committed.$schema).to.equal('https://json-schema.org/draft/2019-09/schema');
    expect(committed.properties.schemaVersion).to.deep.equal({ const: 2 });
    expect(committed.additionalProperties).to.equal(false);
  });

  it('emits a flag-free sha256 pattern (portable to Python re)', () => {
    expect(committed.properties.result.properties.deployResponseSha256.pattern)
      .to.equal('^[a-fA-F0-9]{64}$');
  });
});
