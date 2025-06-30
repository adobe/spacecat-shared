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

import { UniversalContext } from '@adobe/helix-universal';

export default class ScrapeClient {
  /**
   * Static factory method to create an instance of ScrapeClient.
   * @param {UniversalContext} context - An object containing the AWS Lambda context information
   * @returns An instance of ScrapeClient.
   */
  static createFrom(context: UniversalContext): ScrapeClient;

  /**
   * Constructor for creating an instance of ScrapeClient.
   * @param config - Configuration object for the ScrapeClient.
   * @param log - Optional logger instance for logging messages.
   */
  constructor(config: object, log?: Console);

  /**
   * Create and start a new scrape job.
   * @param {object} data - json data for scrape job
   * @returns {Promise<Response>} new job object
   */
  async createScrapeJob(data: object): Promise<object>;

  /**
   * Get all scrape jobs between startDate and endDate
   * @param {string} startDate - The start date of the range.
   * @param {string} endDate - The end date of the range.
   * @returns {Promise<Response>} JSON representation of the scrape jobs.
   */
  async getScrapeJobsByDateRange(startDate: string, endDate: string): Promise<object[]>;

  /**
   * Get the status of an scrape job.
   * @param {string} jobId - The ID of the job to fetch.
   * @returns {Promise<Response>} JSON representation of the scrape job.
   */
  async getScrapeJobStatus(jobId: string): Promise<object>;

  /**
   * Get the result of a scrape job
   * @param {string} jobId - The ID of the job to fetch.
   * @returns {Promise<Response>} all results for all urls scrape jobs.
   */
  async getScrapeJobUrlResults(jobId: string): Promise<object[]>;

  /**
   * Get all scrape jobs by baseURL and processing type
   * @param {string} baseURL - The baseURL of the jobs to fetch.
   * @param {string} processingType - (optional) The processing type of the jobs to fetch.
   * @returns {Promise<Response>} JSON representation of the scrape jobs
   */
  async getScrapeJobsByBaseURL(baseURL: string, processingType?: string): Promise<object[]>;
}
