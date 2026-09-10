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
 * Creates and reads OAE validation jobs. Callers (an HTTP controller, an in-process
 * edge-deploy flow, or a service calling this directly with no HTTP involved at all) are
 * responsible for their own input validation before calling `createJob` -- it trusts
 * `siteId`/`type`/`suggestionIds` as given.
 */
export class OaeValidationJobs {
  /**
   * Creates an OaeValidationJobs instance from context, memoizing it on the context so
   * repeated calls within the same request/invocation reuse the same instance.
   * @param {Object} context - The context object
   * @returns {OaeValidationJobs} - The instance
   */
  static createFrom(context) {
    const { dataAccess, sqs, log = console } = context;

    if (context.oaeValidationJobs) {
      return context.oaeValidationJobs;
    }

    const instance = new OaeValidationJobs({ dataAccess, sqs }, log);
    context.oaeValidationJobs = instance;
    return instance;
  }

  /**
   * @param {Object} config
   * @param {Object} config.dataAccess - Data access layer (needs Configuration.findLatest()
   *   and OaeValidation.allByJobId())
   * @param {Object} config.sqs - SQS client (needs sendMessage(queueUrl, message))
   * @param {Object} log - Logger instance
   */
  constructor({ dataAccess, sqs }, log) {
    this.dataAccess = dataAccess;
    this.sqs = sqs;
    this.log = log;
  }

  /**
   * Creates a new OAE validation job: generates a jobId and dispatches a message to
   * spacecat-import-worker via SQS.
   *
   * @param {Object} params
   * @param {string} params.siteId
   * @param {string} params.type - Validation type (e.g. 'routing')
   * @param {string[]} params.suggestionIds
   * @param {Object} [log] - Logger for this call, defaults to the instance logger
   * @returns {Promise<{jobId: string}>}
   */
  async createJob({ siteId, type, suggestionIds }, log = this.log) {
    const jobId = crypto.randomUUID();

    const configuration = await this.dataAccess.Configuration.findLatest();
    if (!configuration) {
      throw new Error('No configuration found -- cannot determine import queue URL');
    }
    await this.sqs.sendMessage(configuration.getQueues().imports, {
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
   * @param {string} jobId
   * @returns {Promise<{jobId: string, suggestions: Array}|null>} null if no rows exist
   *   for the job
   */
  async getJob(jobId) {
    const rows = await this.dataAccess.OaeValidation.allByJobId(jobId);

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
}

export default OaeValidationJobs;
