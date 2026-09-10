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

import crypto from 'crypto';

// Dispatch type spacecat-import-worker's HANDLERS map routes on -- always this constant,
// regardless of which validator (`type`) the job actually runs.
export const OAE_VALIDATION_IMPORT_TYPE = 'oae-validation';

/**
 * Creates a new OAE validation job: generates a jobId and dispatches a message to
 * spacecat-import-worker via SQS. Callers (an HTTP controller, an in-process edge-deploy flow,
 * or a service calling this directly with no HTTP involved at all) are responsible for their own
 * input validation before calling this -- it trusts `siteId`/`type`/`suggestionIds` as given.
 *
 * @param {Object} params
 * @param {Object} params.dataAccess - Data access layer (needs Configuration.findLatest())
 * @param {Object} params.sqs - SQS client (needs sendMessage(queueUrl, message))
 * @param {string} params.siteId
 * @param {string} params.type - Validation type (e.g. 'routing')
 * @param {string[]} params.suggestionIds
 * @param {Object} [log] - Logger, defaults to console
 * @returns {Promise<{jobId: string}>}
 */
export async function createOaeValidationJob({
  dataAccess, sqs, siteId, type, suggestionIds,
}, log = console) {
  const jobId = crypto.randomUUID();

  const configuration = await dataAccess.Configuration.findLatest();
  await sqs.sendMessage(configuration.getQueues().imports, {
    type: OAE_VALIDATION_IMPORT_TYPE,
    jobId,
    siteId,
    validationType: type,
    suggestionIds,
  });

  log.info(`[oae-validation] queued job=${jobId} siteId=${siteId} type=${type} suggestions=${suggestionIds.length}`);

  return { jobId };
}

/**
 * Gets the full per-suggestion data for a job.
 *
 * @param {Object} params
 * @param {Object} params.dataAccess - Data access layer (needs OaeValidation.allByJobId())
 * @param {string} params.jobId
 * @returns {Promise<{jobId: string, suggestions: Array}|null>} null if no rows exist for the job
 */
export async function getOaeValidationJob({ dataAccess, jobId }) {
  const rows = await dataAccess.OaeValidation.allByJobId(jobId);

  if (rows.length === 0) {
    return null;
  }

  return {
    jobId,
    suggestions: rows.map((row) => ({
      suggestionId: row.getSuggestionId(),
      status: row.getStatus(),
      outcome: row.getOutcome(),
      completedAt: row.getCompletedAt(),
      metadata: row.getMetadata(),
    })),
  };
}
