/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { ValidationError } from '../../errors/index.js';

// UUID regex used by the spec for cloudId format validation.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Per-provider metadata schemas (mirrors spec §Metadata Validation Strategy).
 *
 * Each schema defines:
 *   required   — fields that MUST be present
 *   properties — per-field validators (functions that return an error string or null)
 *   allowed    — exhaustive list of permitted keys (enforces additionalProperties: false)
 *
 * Design: plain JS instead of ajv so no new production dependency is needed.
 * The logic is equivalent to the spec's JSON Schema: required fields, a UUID
 * pattern constraint, and additionalProperties: false.
 */
const METADATA_SCHEMAS = {
  jira_cloud: {
    required: ['cloudId', 'siteName'],
    allowed: new Set(['cloudId', 'siteName', 'siteUrl']),
    properties: {
      cloudId: (v) => (UUID_REGEX.test(v) ? null : 'cloudId must be a valid UUID'),
      siteName: (v) => (typeof v === 'string' && v.length > 0 ? null : 'siteName must be a non-empty string'),
      siteUrl: (v) => (v === undefined || (typeof v === 'string' && v.startsWith('https://')) ? null : 'siteUrl must start with https://'),
    },
  },
  jira_corp: {
    required: ['baseUrl'],
    allowed: new Set(['baseUrl', 'projectCategory']),
    properties: {
      baseUrl: (v) => (typeof v === 'string' && v.startsWith('https://') ? null : 'baseUrl must be a valid https:// URI'),
      projectCategory: (v) => (v === undefined || typeof v === 'string' ? null : 'projectCategory must be a string'),
    },
  },
};

/**
 * Validates provider-specific connection metadata before a DB write.
 *
 * Called on connection INSERT and UPDATE (auth-service path and future edit API).
 * Unknown providers are rejected — no silent passthrough.
 *
 * @param {string} provider - e.g. 'jira_cloud'
 * @param {object} metadata - The JSONB metadata object to validate
 * @throws {ValidationError} On missing fields, wrong types, unknown keys, or unknown provider
 */
export function validateMetadata(provider, metadata) {
  const schema = METADATA_SCHEMAS[provider];
  if (!schema) {
    // Providers without a schema (asana, workfront) are v2 placeholders — reject
    // all writes until a schema is defined so incomplete data never reaches the DB.
    throw new ValidationError(`No metadata schema for provider: ${provider}`);
  }

  const { required, allowed, properties } = schema;

  for (const field of required) {
    if (metadata[field] === undefined || metadata[field] === null) {
      throw new ValidationError(`metadata.${field} is required`);
    }
  }

  for (const [field, validate] of Object.entries(properties)) {
    if (metadata[field] !== undefined) {
      const err = validate(metadata[field]);
      if (err) {
        throw new ValidationError(`Invalid metadata: ${err}`);
      }
    }
  }

  // additionalProperties: false — reject any key not in the allowed set
  const extraKeys = Object.keys(metadata).filter((k) => !allowed.has(k));
  if (extraKeys.length > 0) {
    throw new ValidationError(`Unexpected metadata properties for ${provider}: ${extraKeys.join(', ')}`);
  }
}
