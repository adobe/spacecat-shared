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

import { AWSAthenaClient } from '@adobe/spacecat-shared-athena-client';
import {
  getS3Config,
  loadSql,
  getWeekRange,
} from './utils.js';
import {
  buildDateFilter,
  buildWhereClause,
  buildWeeklyColumns,
  buildOrderBy,
} from './query-builder.js';

const AVAILABLE_TEMPLATES = [
  'user-agent-weekly-breakdown',
  'top-urls-weekly-breakdown',
  'url-analysis-weekly',
];

export class CdnAnalyticsService {
  constructor(context, site = null) {
    this.context = context;
    this.site = site;
    this.s3Config = site ? getS3Config(site) : null;
  }

  async #ensureInitialized() {
    if (!this.site) {
      throw new Error('Site is required for CDN analytics');
    }

    if (!this.athenaClient) {
      this.athenaClient = AWSAthenaClient.fromContext(
        this.context,
        this.s3Config.getAthenaTempLocation(),
      );
    }
  }

  /**
   * Execute analysis by type
   * @param {string} analysisType - User-friendly analysis type
   * @param {Object} parameters - Analysis parameters
   * @returns {Promise<Object>} Analysis results
   */
  async executeAnalysis(analysisType, parameters = {}) {
    const typeMapping = {
      'agentic-traffic': 'user-agent-weekly-breakdown',
      'popular-content': 'top-urls-weekly-breakdown',
      'url-patterns': 'url-analysis-weekly',
      'error-analysis': 'url-analysis-weekly',
      'country-patterns': 'url-analysis-weekly',
    };

    const templateName = typeMapping[analysisType];
    if (!templateName) {
      throw new Error(`Unknown analysis type: ${analysisType}. Available types: ${Object.keys(typeMapping).join(', ')}`);
    }

    return this.executeTemplate(templateName, parameters);
  }

  async executeTemplate(templateName, parameters = {}) {
    await this.#ensureInitialized();

    try {
      const periods = CdnAnalyticsService.generatePeriods(parameters);
      const conditions = CdnAnalyticsService.buildConditions(periods, parameters);
      // TODO: add site filters to the query once we have enough data
      // const { filters } = this.site.getConfig().getCdnLogsConfig() || {};

      const finalParameters = {
        databaseName: this.s3Config.databaseName,
        tableName: this.s3Config.tableName,
        whereClause: buildWhereClause(conditions, parameters.agentFilter),
        weekColumns: buildWeeklyColumns(periods),
        orderBy: buildOrderBy(periods),
        weeks: periods.weeks,
      };

      const sql = await loadSql(templateName, finalParameters, 'weekly-analysis');
      const results = await this.athenaClient.query(
        sql,
        this.s3Config.databaseName,
        `CDN Template: ${templateName}`,
      );

      return {
        templateName,
        parameters: finalParameters,
        results,
        resultCount: results?.length || 0,
        executedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.context.log.error(`CDN Template execution error: ${error.message}`);
      throw new Error(`Failed to execute template ${templateName}: ${error.message}`);
    }
  }

  /**
   * Generate periods for analytics queries.
   * @param {Object} parameters - Configuration parameters
   * @param {number} [parameters.numberOfWeeks=2] - Number of weeks to include
   * @returns {Object} Object containing weeks array with period information
   */
  static generatePeriods({ numberOfWeeks = 2 } = {}) {
    const weeks = Array.from({ length: numberOfWeeks }, (_, i) => {
      const weekOffset = numberOfWeeks - i;
      const { weekStart, weekEnd } = getWeekRange(-weekOffset);
      return {
        startDate: weekStart,
        endDate: weekEnd,
        weekNumber: weekOffset,
        weekLabel: `week_${i + 1}`,
      };
    });

    return { weeks };
  }

  static buildConditions(periods, { statusFilter } = {}) {
    const conditions = [];

    // Add date conditions
    if (periods.weeks?.length) {
      const dateConditions = periods.weeks.map(
        ({ startDate, endDate }) => buildDateFilter(startDate, endDate),
      );
      conditions.push(dateConditions.length === 1
        ? dateConditions[0]
        : `(${dateConditions.join(' OR ')})`);
    }

    // Add status filter
    if (statusFilter && statusFilter !== 'all') {
      conditions.push(`status = ${statusFilter}`);
    }

    return conditions;
  }

  static getAvailableTemplates() {
    return AVAILABLE_TEMPLATES;
  }
}
