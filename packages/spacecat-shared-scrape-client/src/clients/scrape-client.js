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

import {
  isIsoDate, isObject, isValidUrl,
} from '@adobe/spacecat-shared-utils';
import { ScrapeJob as ScrapeJobModel } from '@adobe/spacecat-shared-data-access';
import { ScrapeJobDto } from './scrapeJobDto.js';
import ScrapeJobSupervisor from './scrape-job-supervisor.js';

export default class ScrapeClient {
  config = null;

  services = null;

  scrapeConfiguration = null;

  scrapeSupervisor = null;

  maxUrlsPerJob = 1;

  static validateIsoDates(startDate, endDate) {
    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      throw new Error('Invalid request: startDate and endDate must be in ISO 8601 format');
    }
  }

  validateRequestData(data) {
    if (!isObject(data)) {
      throw new Error('Invalid request: missing application/json request data');
    }

    if (!Array.isArray(data.urls) || !data.urls.length > 0) {
      throw new Error('Invalid request: urls must be provided as a non-empty array');
    }

    if (data.urls.length > this.maxUrlsPerJob) {
      throw new Error(`Invalid request: number of URLs provided (${data.urls.length}) exceeds the maximum allowed (${this.maxUrlsPerJob})`);
    }

    data.urls.forEach((url) => {
      if (!isValidUrl(url)) {
        throw new Error(`Invalid request: ${url} is not a valid URL`);
      }
    });

    if (data.options && !isObject(data.options)) {
      throw new Error('Invalid request: options must be an object');
    }

    if (data.customHeaders && !isObject(data.customHeaders)) {
      throw new Error('Invalid request: customHeaders must be an object');
    }
  }

  /**
   * Creates a new ScrapeClient from the context.
   * @param {object} context - The context object
   * @param {object} context.dataAccess - The data access client
   * @param {object} context.sqs - The SQS client
   * @param {object} context.log - The logger
   * @param {object} context.env - The environment variables
   * @returns {ScrapeClient} - The ScrapeClient instance
   */
  static createFrom(context) {
    function validateServices() {
      const requiredServices = ['dataAccess', 'sqs', 'log', 'env'];
      requiredServices.forEach((service) => {
        if (!context[service]) {
          throw new Error(`Invalid services: ${service} is required`);
        }
      });
    }
    validateServices(context);
    const {
      log,
      dataAccess,
      sqs,
      env,
    } = context;

    const config = {
      dataAccess,
      sqs,
      env,
      log,
    };
    return new ScrapeClient(config);
  }

  constructor(config) {
    this.config = config;

    let scrapeConfiguration = {};
    try {
      scrapeConfiguration = JSON.parse(this.config.env.SCRAPE_JOB_CONFIGURATION);
    } catch (error) {
      this.config.log.error(`Failed to parse scrape job configuration: ${error.message}`);
    }
    this.scrapeConfiguration = scrapeConfiguration;

    // default to 1 url per job
    this.maxUrlsPerJob = scrapeConfiguration.maxUrlsPerJob || 1;

    this.scrapeSupervisor = new ScrapeJobSupervisor(this.config, scrapeConfiguration);
  }

  /**
   * Create and start a new scrape job.
   * @param {object} data - json data for scrape job
   * @returns {Promise<Response>} newly created job object
   */
  async createScrapeJob(data) {
    try {
      this.validateRequestData(data);

      const {
        urls, options, customHeaders, processingType = ScrapeJobModel.ScrapeProcessingType.DEFAULT,
      } = data;

      this.config.log.info(`Creating a new scrape job with ${urls.length} URLs.`);

      // Merge the scrape configuration options with the request options allowing the user options
      // to override the defaults
      const mergedOptions = {
        ...this.scrapeConfiguration.options,
        ...options,
      };

      const job = await this.scrapeSupervisor.startNewJob(
        urls,
        processingType,
        mergedOptions,
        customHeaders,
      );
      return ScrapeJobDto.toJSON(job);
    } catch (error) {
      const msgError = `Failed to create a new scrape job: ${error.message}`;
      this.config.log.error(msgError);
      throw new Error(msgError);
    }
  }

  /**
   * Get all scrape jobs between startDate and endDate
   * @param {string} startDate - The start date of the range.
   * @param {string} endDate - The end date of the range.
   * @returns {Promise<Response>} JSON representation of the scrape jobs.
   */
  async getScrapeJobsByDateRange(startDate, endDate) {
    this.config.log.debug(`Fetching scrape jobs between startDate: ${startDate} and endDate: ${endDate}.`);

    ScrapeClient.validateIsoDates(startDate, endDate);
    try {
      const jobs = await this.scrapeSupervisor.getScrapeJobsByDateRange(startDate, endDate);
      return jobs.map((job) => ScrapeJobDto.toJSON(job));
    } catch (error) {
      const msgError = `Failed to fetch scrape jobs between startDate: ${startDate} and endDate: ${endDate}, ${error.message}`;
      this.config.log.error(msgError);
      throw new Error(msgError);
    }
  }

  /**
   * Get the status of an scrape job.
   * @param {string} jobId - The ID of the job to fetch.
   * @returns {Promise<Response>} JSON representation of the scrape job.
   */
  async getScrapeJobStatus(jobId) {
    if (!jobId) {
      throw new Error('Job ID is required');
    }
    try {
      const job = await this.scrapeSupervisor.getScrapeJob(jobId);
      if (!job) {
        return null;
      }
      return ScrapeJobDto.toJSON(job);
    } catch (error) {
      const msgError = `Failed to fetch scrape job status for jobId: ${jobId}, message: ${error.message}`;
      this.config.log.error(msgError);
      throw new Error(msgError);
    }
  }

  /**
   * Get the result of a scrape job
   * @param {string} jobId - The ID of the job to fetch.
   * @returns {Promise<Response>} all results for all urls scrape jobs.
   */
  async getScrapeJobUrlResults(jobId) {
    try {
      const job = await this.scrapeSupervisor.getScrapeJob(jobId);
      if (!job) {
        return null;
      }
      const { ScrapeUrl } = this.config.dataAccess;
      const scrapeUrls = await ScrapeUrl.allByScrapeJobId(job.getId());
      const results = scrapeUrls.map((url) => ({
        url: url.getUrl(),
        status: url.getStatus(),
        reason: url.getReason(),
        path: url.getPath(),
      }));

      return results;
    } catch (error) {
      const msgError = `Failed to fetch the scrape job result: ${error.message}`;
      this.config.log.error(msgError);
      throw new Error(msgError);
    }
  }

  /**
   * Get all scrape jobs by baseURL and processing type
   * @param {string} baseURL - The baseURL of the jobs to fetch.
   * @param {string} processingType - (optional) The processing type of the jobs to fetch.
   * @returns {Promise<Response>} JSON representation of the scrape jobs
   */
  async getScrapeJobsByBaseURL(baseURL, processingType = undefined) {
    let decodedBaseURL = baseURL;
    try {
      decodedBaseURL = decodeURIComponent(baseURL);

      if (!isValidUrl(decodedBaseURL)) {
        throw new Error('Invalid request: baseURL must be a valid URL');
      }

      let jobs = [];
      if (processingType) {
        jobs = await this.scrapeSupervisor.getScrapeJobsByBaseURLAndProcessingType(
          decodedBaseURL,
          processingType,
        );
      } else {
        jobs = await this.scrapeSupervisor.getScrapeJobsByBaseURL(decodedBaseURL);
      }

      if (!jobs || jobs.length === 0) {
        return [];
      }
      return jobs.map((job) => ScrapeJobDto.toJSON(job));
    } catch (error) {
      const procType = processingType ? ` and processing type: ${processingType}` : '';
      const msgError = `Failed to fetch scrape jobs by baseURL: ${decodedBaseURL}${procType}, ${error.message}`;
      this.config.log.error(msgError);
      throw new Error(msgError);
    }
  }
}
