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

import BaseModel from '../base/base.model.js';

class GeoExperiment extends BaseModel {
  static ENTITY_NAME = 'GeoExperiment';

  static DEFAULT_UPDATED_BY = 'spacecat';

  static TYPES = {
    ONSITE_OPPORTUNITY_DEPLOYMENT: 'onsite_opportunity_deployment',
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
  };

  /**
   * Kind of an `insightsLocation` entry. Window 0 is the baseline, window 1 the post-analysis
   * measurement, windows >= 2 are auto-extend windows.
   *
   * @type {{ BASELINE: string, POST_ANALYSIS: string, EXTENSION: string }}
   */
  static INSIGHTS_TYPES = {
    BASELINE: 'baseline',
    POST_ANALYSIS: 'post_analysis',
    EXTENSION: 'extension',
  };

  static INSIGHTS_WINDOWS = {
    BASELINE: 0,
    POST_ANALYSIS: 1,
  };

  /**
   * @param {object} entry - `{ window, type, label, location, runRange?, completedAt? }`.
   * @returns {boolean}
   */
  static isValidInsightsEntry(entry) {
    return isObject(entry)
      && isInteger(entry.window)
      && entry.window >= 0
      && Object.values(GeoExperiment.INSIGHTS_TYPES).includes(entry.type)
      && hasText(entry.label)
      && hasText(entry.location);
  }

  /**
   * Validator for the `insightsLocation` attribute: empty, a legacy S3 key string (transitional,
   * read as the window 1 entry), or an array of valid entries with unique windows.
   *
   * @param {*} value
   * @returns {boolean}
   */
  static isValidInsightsLocation(value) {
    if (!value) {
      return true;
    }
    if (typeof value === 'string') {
      return hasText(value);
    }
    if (!Array.isArray(value) || !value.every(GeoExperiment.isValidInsightsEntry)) {
      return false;
    }
    return new Set(value.map((entry) => entry.window)).size === value.length;
  }

  /**
   * The `insightsLocation` entries sorted by window. A legacy string is returned as the single
   * window 1 entry; an empty value as `[]`.
   *
   * @returns {object[]}
   */
  getInsightsEntries() {
    const value = this.getInsightsLocation();
    if (Array.isArray(value)) {
      return [...value].sort((a, b) => a.window - b.window);
    }
    if (hasText(value)) {
      return [{
        window: GeoExperiment.INSIGHTS_WINDOWS.POST_ANALYSIS,
        type: GeoExperiment.INSIGHTS_TYPES.POST_ANALYSIS,
        label: 'Post-analysis',
        location: value,
      }];
    }
    return [];
  }

  /**
   * Returns a new entries array with `entry` added, replacing any entry for the same window.
   * Does not mutate the model; pass the result to `setInsightsLocation`.
   *
   * @param {object} entry - A valid insights entry (see `isValidInsightsEntry`).
   * @returns {object[]}
   */
  upsertInsightsEntry(entry) {
    if (!GeoExperiment.isValidInsightsEntry(entry)) {
      throw new Error(`Invalid insights entry: ${JSON.stringify(entry)}`);
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
