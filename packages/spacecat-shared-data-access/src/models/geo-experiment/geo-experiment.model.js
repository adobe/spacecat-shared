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

import { hasText, isInteger, isObject } from '@adobe/spacecat-shared-utils';

import { ValidationError } from '../../errors/index.js';
import BaseModel from '../base/base.model.js';

class GeoExperiment extends BaseModel {
  static ENTITY_NAME = 'GeoExperiment';

  static DEFAULT_UPDATED_BY = 'spacecat';

  static TYPES = {
    ONSITE_OPPORTUNITY_DEPLOYMENT: 'onsite_opportunity_deployment',
    OPTIMIZE_AT_SOURCE: 'optimize_at_source',
  };

  static STATUSES = {
    GENERATING_BASELINE: 'GENERATING_BASELINE',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  };

  static PHASES = {
    INITIATED: 'initiated',
    ROUTING_VALIDATION: 'routing_validation',
    PROMPT_GENERATION_STARTED: 'prompt_generation_started',
    PROMPT_GENERATION_COMPLETED: 'prompt_generation_completed',
    PRE_ANALYSIS_STARTED: 'pre_analysis_started',
    PRE_ANALYSIS_DONE: 'pre_analysis_done',
    PRE_ANALYSIS_MEASUREMENT_STARTED: 'pre_analysis_measurement_started',
    PRE_ANALYSIS_MEASUREMENT_DONE: 'pre_analysis_measurement_done',
    DEPLOYMENT_STARTED: 'deployment_started',
    DEPLOYMENT_DONE: 'deployment_done',
    POST_ANALYSIS_STARTED: 'post_analysis_started',
    POST_ANALYSIS_DONE: 'post_analysis_done',
    IMPACT_MEASUREMENT_STARTED: 'impact_measurement_started',
    IMPACT_MEASUREMENT_DONE: 'impact_measurement_done',
    // optimize-at-source (OAS) strategy phases
    OAS_INITIATED: 'oas_initiated',
    OAS_BASELINE_STARTED: 'oas_baseline_started',
    OAS_BASELINE_DONE: 'oas_baseline_done',
    OAS_AWAITING_PUBLISH: 'oas_awaiting_publish',
    OAS_PUBLISH_VERIFIED: 'oas_publish_verified',
    OAS_POST_SNAPSHOT: 'oas_post_snapshot',
    OAS_COMPLETED: 'oas_completed',
  };

  /**
   * Name of the environment variable that holds per-strategy schedule configuration.
   * The value is a JSON string keyed by strategy type, each with 'pre' and 'post' phase configs.
   * Both the API service (writes config into experiment metadata) and the experimentation engine
   * (reads config from metadata) reference this constant so the name stays in sync.
   *
   * @type {string}
   */
  static SCHEDULE_CONFIG_ENV_VAR = 'EXPERIMENT_SCHEDULE_CONFIG';

  /**
   * Well-known keys used within a GeoExperiment's metadata object.
   * Centralised here so all consumers reference the same key names.
   *
   * @type {{
   *   SCHEDULE_CONFIG: string,
   *   IMPACT_MEASUREMENT_TASK_ID: string,
   *   VALIDATION: string,
   *   ROUTING_VALIDATION: string,
   *   OAE_VALIDATION_JOBS: string,
   *   BASELINE_MEASUREMENT: string,
   * }}
   */
  static METADATA_KEYS = {
    SCHEDULE_CONFIG: 'scheduleConfig',
    IMPACT_MEASUREMENT_TASK_ID: 'impactMeasurementTaskId',
    VALIDATION: 'validation',
    ROUTING_VALIDATION: 'routingValidation',
    // Value is an object keyed by oae-validation job `type` (e.g. 'routing'), so multiple
    // validation jobs of different types can be tracked against the same experiment without
    // colliding, e.g. { routing: '<jobId>', prerender: '<jobId>' }.
    OAE_VALIDATION_JOBS: 'oaeValidationJobs',
    // Baseline (window 0) measurement bookkeeping, e.g. { taskId, startedAt, retryCount }.
    BASELINE_MEASUREMENT: 'baselineMeasurement',
    // optimize-at-source bookkeeping.
    // URLs the external UI deployed, to be publish-checked, e.g. ['https://example.com/a'].
    DEPLOYED_URLS: 'deployedUrls',
    // Publish-check progress, e.g. { verifiedUrls: [...], lastCheckedAt }.
    PUBLISH_CHECK: 'publishCheck',
    // 14-day post window bookkeeping, e.g. { startedAt, lastSnapshotAt, snapshotCount }.
    POST_WINDOW: 'postWindow',
    // S3 location (key) of the raw daily SEO-metric snapshots.
    SNAPSHOTS_LOCATION: 'snapshotsLocation',
  };

  /**
   * Kind of an `insightsList` entry. Window 0 is the baseline, window 1 the post-analysis
   * measurement, windows >= 2 are auto-extend windows.
   *
   * @type {{ BASELINE: string, POST_ANALYSIS: string, EXTENSION: string }}
   */
  static INSIGHTS_TYPES = {
    BASELINE: 'baseline',
    POST_ANALYSIS: 'post_analysis',
    EXTENSION: 'extension',
  };

  /**
   * Fixed windows of `insightsList`; every window >= 2 is an `extension`.
   *
   * @type {{ BASELINE: number, POST_ANALYSIS: number }}
   */
  static INSIGHTS_WINDOWS = {
    BASELINE: 0,
    POST_ANALYSIS: 1,
  };

  /** Label of the window 1 entry synthesized from the legacy `insightsLocation`. */
  static LEGACY_POST_ANALYSIS_LABEL = 'Post-analysis';

  /**
   * The `type` an entry at `window` must have.
   *
   * @param {number} window
   * @returns {string}
   */
  static insightsTypeForWindow(window) {
    if (window === GeoExperiment.INSIGHTS_WINDOWS.BASELINE) {
      return GeoExperiment.INSIGHTS_TYPES.BASELINE;
    }
    return window === GeoExperiment.INSIGHTS_WINDOWS.POST_ANALYSIS
      ? GeoExperiment.INSIGHTS_TYPES.POST_ANALYSIS
      : GeoExperiment.INSIGHTS_TYPES.EXTENSION;
  }

  /**
   * Why `entry` is not a valid insights entry, or `null` when it is.
   *
   * @param {object} entry - `{ window, type, label, location, runRange?, completedAt? }`.
   * @returns {string|null}
   */
  static getInsightsEntryError(entry) {
    if (!isObject(entry)) {
      return 'entry must be an object';
    }
    const {
      window, type, label, location, runRange, completedAt,
    } = entry;
    if (!isInteger(window) || window < 0) {
      return 'window must be a non-negative integer';
    }
    if (type !== GeoExperiment.insightsTypeForWindow(window)) {
      return `type must be '${GeoExperiment.insightsTypeForWindow(window)}' for window ${window}`;
    }
    if (!hasText(label)) {
      return 'label must be a non-empty string';
    }
    if (!hasText(location) || location.includes('..') || location.includes('://')) {
      return 'location must be a relative S3 key';
    }
    if (runRange !== undefined && !(isObject(runRange)
      && isInteger(runRange.from) && isInteger(runRange.to) && runRange.from <= runRange.to)) {
      return 'runRange must be { from, to } integers with from <= to';
    }
    const isDate = hasText(completedAt) && !Number.isNaN(Date.parse(completedAt));
    if (completedAt !== undefined && !isDate) {
      return 'completedAt must be an ISO date string';
    }
    return null;
  }

  /**
   * @param {object} entry - `{ window, type, label, location, runRange?, completedAt? }`.
   * @returns {boolean}
   */
  static isValidInsightsEntry(entry) {
    return GeoExperiment.getInsightsEntryError(entry) === null;
  }

  /**
   * Why `value` is not a valid `insightsList`, or `null` when it is: empty, or an array of valid
   * entries with unique windows.
   *
   * @param {*} value
   * @returns {string|null}
   */
  static getInsightsListError(value) {
    if (value === undefined || value === null) {
      return null;
    }
    if (!Array.isArray(value)) {
      return 'insightsList must be an array';
    }
    for (const [index, entry] of value.entries()) {
      const error = GeoExperiment.getInsightsEntryError(entry);
      if (error) {
        return `insightsList[${index}]: ${error}`;
      }
    }
    if (new Set(value.map((entry) => entry.window)).size !== value.length) {
      return 'insightsList windows must be unique';
    }
    return null;
  }

  /**
   * Validator for the `insightsList` attribute (see `getInsightsListError`).
   *
   * @param {*} value
   * @returns {boolean}
   */
  static isValidInsightsList(value) {
    return GeoExperiment.getInsightsListError(value) === null;
  }

  /**
   * Sets `insightsList`. Validated here because the generated setter for an `any` attribute
   * skips the schema validator, which otherwise only runs on create.
   *
   * @param {object[]|null|undefined} insightsList
   * @returns {GeoExperiment}
   * @throws {ValidationError} When the list is invalid.
   */
  setInsightsList(insightsList) {
    const error = GeoExperiment.getInsightsListError(insightsList);
    if (error) {
      throw new ValidationError(`Invalid insightsList: ${error}`);
    }
    this.patcher.patchValue('insightsList', insightsList);
    return this;
  }

  /**
   * The insights entries sorted by window, as shallow copies. When there is no window 1 entry,
   * the legacy `insightsLocation` key (written by older writers, e.g. during a rollback) is
   * returned as the window 1 entry.
   *
   * @returns {object[]}
   */
  getInsightsEntries() {
    const list = this.getInsightsList();
    const entries = Array.isArray(list) ? list.map((entry) => ({ ...entry })) : [];
    const location = this.getInsightsLocation();
    const hasPostAnalysis = entries.some(
      (entry) => entry.window === GeoExperiment.INSIGHTS_WINDOWS.POST_ANALYSIS,
    );
    if (!hasPostAnalysis && hasText(location)) {
      entries.push({
        window: GeoExperiment.INSIGHTS_WINDOWS.POST_ANALYSIS,
        type: GeoExperiment.INSIGHTS_TYPES.POST_ANALYSIS,
        label: GeoExperiment.LEGACY_POST_ANALYSIS_LABEL,
        location,
      });
    }
    return entries.sort((a, b) => a.window - b.window);
  }

  /**
   * Returns a new entries array with `entry` added, replacing any entry for the same window.
   * Does not mutate the model; pass the result to `setInsightsList`. This is a read-modify-write
   * of the whole array, so it assumes a single writer per experiment (the experimentation engine).
   *
   * @param {object} entry - A valid insights entry (see `isValidInsightsEntry`).
   * @returns {object[]}
   * @throws {ValidationError} When the entry is invalid.
   */
  upsertInsightsEntry(entry) {
    const error = GeoExperiment.getInsightsEntryError(entry);
    if (error) {
      throw new ValidationError(`Invalid insights entry: ${error}`);
    }
    return [
      ...this.getInsightsEntries().filter((existing) => existing.window !== entry.window),
      entry,
    ].sort((a, b) => a.window - b.window);
  }

  /**
   * Field names within a schedule config block (pre or post phase).
   * Both the API service (writes) and the experimentation engine (reads) import
   * these so a rename in one place propagates automatically to the other.
   *
   * @type {{ CRON_EXPRESSION: string, EXPIRY_MS: string, PLATFORMS: string, PROVIDER_IDS: string }}
   */
  static SCHEDULE_CONFIG_KEYS = {
    CRON_EXPRESSION: 'cronExpression',
    EXPIRY_MS: 'expiryMs',
    PLATFORMS: 'platforms',
    PROVIDER_IDS: 'providerIds',
  };
}

export default GeoExperiment;
