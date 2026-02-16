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

import { isValidUrl, isValidUUID, composeBaseURL } from '@adobe/spacecat-shared-utils';

/**
 * Scrape Supervisor provides functionality to start and manage scrape jobs.
 * @param {object} services - The services required by the handler.
 * @param {DataAccess} services.dataAccess - Data access.
 * @param {object} services.sqs - AWS Simple Queue Service client.
 * @param {object} services.s3 - AWS S3 client and related helpers.
 * @param {object} services.log - Logger.
 * @param {object} config - Scrape configuration details.
 * @param {Array<string>} config.queues - Array of available scrape queues.
 * @param {string} config.scrapeWorkerQueue - URL of the scrape worker queue.
 * @returns {object} Scrape Supervisor.
 */
function ScrapeJobSupervisor(services, config) {
  const {
    dataAccess, sqs, log,
  } = services;

  const { ScrapeJob, ScrapeUrl } = dataAccess;

  const {
    scrapeWorkerQueue, // URL of the scrape worker queue
    maxUrlsPerMessage,
  } = config;

  /**
   * Create a new scrape job by claiming one of the free scrape queues, persisting the scrape job
   * metadata, and setting the job status to 'RUNNING'.
   * @param {Array<string>} urls - The list of URLs to scrape.
   * @param {string} processingType - The scrape handler to be used for the scrape job.
   * @param {object} options - Client provided options for the scrape job.
   * @param {object} customHeaders - Custom headers to be sent with each request.
   * @returns {Promise<ScrapeJob>}
   */
  async function createNewScrapeJob(
    urls,
    processingType,
    options,
    customHeaders = null,
  ) {
    const jobData = {
      baseURL: composeBaseURL(new URL(urls[0]).host),
      processingType,
      options,
      urlCount: urls.length,
      status: dataAccess.ScrapeJob.ScrapeJobStatus.RUNNING,
      customHeaders,
    };
    log.debug(`Creating a new scrape job. Job data: ${JSON.stringify(jobData)}`);
    return ScrapeJob.create(jobData);
  }

  /**
   * Get all scrape jobs between the specified start and end dates.
   * @param {string} startDate - The start date of the range.
   * @param {string} endDate - The end date of the range.
   * @returns {Promise<ScrapeJob[]>}
   */
  async function getScrapeJobsByDateRange(startDate, endDate) {
    return ScrapeJob.allByDateRange(startDate, endDate);
  }

  /**
   * Get all scrape jobs by baseURL
   * @param {string} baseURL - The baseURL of the jobs to fetch.
   * @returns {Promise<ScrapeJob[]>}
   */
  async function getScrapeJobsByBaseURL(baseURL) {
    return ScrapeJob.allByBaseURL(baseURL);
  }

  /**
   * Get all scrape jobs by baseURL and processing type
   * @param {string} baseURL - The baseURL of the jobs to fetch.
   * @param {string} processingType - The processing type of the jobs to fetch.
   * @returns {Promise<ScrapeJob[]>}
   */
  async function getScrapeJobsByBaseURLAndProcessingType(baseURL, processingType) {
    return ScrapeJob.allByBaseURLAndProcessingType(baseURL, processingType);
  }

  /**
   * Split an array of URLs into batches of a specified size.
   * @param urls
   * @param batchSize
   * @returns {*[]}
   */
  function splitUrlsIntoBatches(urls, batchSize = 1000) {
    const batches = [];
    for (let i = 0; i < urls.length; i += batchSize) {
      batches.push(urls.slice(i, i + batchSize));
    }
    log.debug(`Split ${urls.length} URLs into ${batches.length} batches of size ${batchSize}.`);
    return batches;
  }

  /**
   * Queue all URLs for processing by another function. Splits URL-Arrays > 1000 into multiple
   * messages. This will enable the controller to respond with a new job ID ASAP, while the
   * individual URLs are queued up asynchronously.
   * @param {Array<string>} urls - Array of URL records to queue.
   * @param {object} scrapeJob - The scrape job record.
   * @param {object} customHeaders - Optional custom headers to be sent with each request.
   * @param {string} maxScrapeAge - The maximum age of the scrape job
   * @param {object} auditData - Step-Audit specific data
   */
  // eslint-disable-next-line max-len
  async function queueUrlsForScrapeWorker(urls, scrapeJob, customHeaders, maxScrapeAge, metaData) {
    log.info(`Starting a new scrape job of baseUrl: ${scrapeJob.getBaseURL()} with ${urls.length}`
      + ' URLs.'
      + `(jobId: ${scrapeJob.getId()})`);

    const options = scrapeJob.getOptions();
    const processingType = scrapeJob.getProcessingType();
    const totalUrlCount = urls.length;
    const baseUrl = scrapeJob.getBaseURL();
    let urlBatches = [];

    // If there are more than 1000 URLs, split them into multiple messages
    if (totalUrlCount > maxUrlsPerMessage) {
      urlBatches = splitUrlsIntoBatches(urls, maxUrlsPerMessage);
      log.debug(`Queuing ${totalUrlCount} URLs for scrape in ${urlBatches.length} messages.`);
    } else {
      // If there are 1000 or fewer URLs, we can send them all in a single message
      log.debug(`Queuing ${totalUrlCount} URLs for scrape in a single message.`);
      urlBatches = [urls]; // Wrap in an array to maintain consistent structure
    }

    for (const [index, batch] of urlBatches.entries()) {
      // Calculate the offset for numbering the URLs in the batch
      const offset = index * maxUrlsPerMessage;
      const message = {
        processingType,
        jobId: scrapeJob.getId(),
        batch,
        batchOffset: offset,
        customHeaders,
        options,
        maxScrapeAge,
        metaData,
      };

      // eslint-disable-next-line no-await-in-loop
      await sqs.sendMessage(scrapeWorkerQueue, message, baseUrl);
    }
  }

  /**
   * Starts a new scrape job.
   * @param {Array<string>} urls - The URLs to scrape.
   * @param {string} processingType - The type of processing to perform.
   * @param {object} options - Optional configuration params for the scrape job.
   * @param {object} customHeaders - Optional custom headers to be sent with each request.
   * @param {number} maxScrapeAge - The maximum age of the scrape job
   * @param auditContext
   * @returns {Promise<ScrapeJob>} newly created job object
   */
  async function startNewJob(
    urls,
    processingType,
    options,
    customHeaders,
    maxScrapeAge,
    metaData,
  ) {
    const newScrapeJob = await createNewScrapeJob(
      urls,
      processingType,
      options,
      customHeaders,
    );

    log.info( // debug?
      'New scrape job created:\n'
      + `- baseUrl: ${newScrapeJob.getBaseURL()}\n`
      + `- urlCount: ${urls.length}\n`
      + `- jobId: ${newScrapeJob.getId()}\n`
      + `- customHeaders: ${JSON.stringify(customHeaders)}\n`
      + `- options: ${JSON.stringify(options)}`,
    );

    // Queue all URLs for scrape as a single message. This enables the controller to respond with
    // a job ID ASAP, while the individual URLs are queued up asynchronously by another function.
    await queueUrlsForScrapeWorker(urls, newScrapeJob, customHeaders, maxScrapeAge, metaData);

    return newScrapeJob;
  }

  /**
   * Get an scrape job from the data layer.
   * used to start the job.
   * @param {string} jobId - The ID of the job.
   * @returns {Promise<ScrapeJob>} requested scrape job object
   */
  async function getScrapeJob(jobId) {
    if (!isValidUUID(jobId)) {
      throw new Error('jobId must be a valid UUID');
    }

    try {
      return ScrapeJob.findById(jobId);
    } catch (error) {
      if (error.message.includes('Not found')) {
        return null;
      }
      throw error;
    }
  }

  async function getScrapeUrlsByProcessingType(url, processingType, maxScrapeAge) {
    if (!isValidUrl(url)) {
      throw new Error(`${url} must be a valid URL`);
    }
    try {
      return ScrapeUrl.allRecentByUrlAndProcessingType(url, processingType, maxScrapeAge);
    } catch (error) {
      if (error.message.includes('Not found')) {
        return null;
      }
      throw error;
    }
  }

  return {
    startNewJob,
    getScrapeJob,
    getScrapeJobsByDateRange,
    getScrapeJobsByBaseURL,
    getScrapeJobsByBaseURLAndProcessingType,
    getScrapeUrlsByProcessingType,
  };
}

export default ScrapeJobSupervisor;
