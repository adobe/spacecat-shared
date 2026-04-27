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

function validateBrandPresenceExecution(row) {
  const errors = [];

  for (const field of ['site_id', 'platform', 'week', 'execution_date', 'category', 'topic', 'prompt', 'region', 'answer']) {
    if (!row[field] || typeof row[field] !== 'string') {
      errors.push({ field, message: 'is required and must be a string' });
    }
  }

  if (typeof row.visibility_score === 'number' && (row.visibility_score < 0 || row.visibility_score > 100)) {
    errors.push({ field: 'visibility_score', message: 'must be between 0 and 100' });
  }

  if (row.sentiment && !['positive', 'neutral', 'negative'].includes(row.sentiment)) {
    errors.push({ field: 'sentiment', message: 'must be positive, neutral, or negative' });
  }

  if (row.origin && !['HUMAN', 'AI'].includes(row.origin)) {
    errors.push({ field: 'origin', message: 'must be HUMAN or AI' });
  }

  return errors;
}

function validateBrandPresenceCompetitorData(row) {
  const errors = [];

  for (const field of ['site_id', 'platform', 'week', 'category', 'competitor', 'region']) {
    if (!row[field] || typeof row[field] !== 'string') {
      errors.push({ field, message: 'is required and must be a string' });
    }
  }

  return errors;
}

export const VALIDATORS = {
  brand_presence_executions: validateBrandPresenceExecution,
  brand_presence_competitor_data: validateBrandPresenceCompetitorData,
};
