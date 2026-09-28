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

import { createUrl } from '@adobe/fetch';
import { hasText, isObject, isValidUrl } from '@adobe/spacecat-shared-utils';

import { fetch as httpFetch, sanitizeHeaders } from '../utils.js';

/**
 * Provider-agnostic embedding contract, so consumers don't depend on the Azure client.
 * @typedef {Object} EmbeddingProvider
 * @property {(inputs: string[], options?: { dimensions?: number }) => Promise<number[][]>}
 *   createEmbeddings - one vector per input, in input order.
 */

function validateEmbeddingResponse(response, expectedCount) {
  return isObject(response)
    && Array.isArray(response?.data)
    && response.data.length === expectedCount
    && response.data.every(
      (item) => isObject(item)
        && Number.isInteger(item.index)
        && Array.isArray(item.embedding)
        && item.embedding.length > 0,
    );
}

/** Cap on any single retry sleep, so a large `Retry-After` can't stall the invocation. */
const DEFAULT_MAX_RETRY_DELAY_MS = 30_000;

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/** Numeric `Retry-After` (seconds) if present, else exponential backoff with jitter; capped. */
function retryDelayMs(response, attempt, baseDelayMs, maxDelayMs) {
  const retryAfter = Number(response.headers.get('retry-after'));
  const raw = (Number.isFinite(retryAfter) && retryAfter > 0)
    ? retryAfter * 1000
    : Math.round((2 ** attempt) * baseDelayMs * (0.5 + Math.random()));
  return Math.min(raw, maxDelayMs);
}

/**
 * Azure OpenAI embeddings client. Implements {@link EmbeddingProvider}.
 */
export default class AzureEmbeddingClient {
  /**
   * Creates a client from a UniversalContext. Endpoint/key/api-version fall back to the
   * `AZURE_OPENAI_*` values; `AZURE_EMBEDDING_DEPLOYMENT` is required.
   *
   * @param {object} context - UniversalContext (`env`, optional `log`).
   * @returns {AzureEmbeddingClient}
   */
  static createFrom(context) {
    const { log = console } = context;

    const {
      AZURE_EMBEDDING_ENDPOINT,
      AZURE_EMBEDDING_KEY,
      AZURE_EMBEDDING_API_VERSION,
      AZURE_EMBEDDING_DEPLOYMENT: deploymentName,
      AZURE_EMBEDDING_MAX_RETRIES,
      AZURE_OPENAI_ENDPOINT,
      AZURE_OPENAI_KEY,
      AZURE_API_VERSION,
    } = context.env;

    const apiEndpoint = AZURE_EMBEDDING_ENDPOINT || AZURE_OPENAI_ENDPOINT;
    const apiKey = AZURE_EMBEDDING_KEY || AZURE_OPENAI_KEY;
    const apiVersion = AZURE_EMBEDDING_API_VERSION || AZURE_API_VERSION;

    if (!isValidUrl(apiEndpoint)) {
      throw new Error('Missing Azure OpenAI embedding endpoint');
    }

    if (!hasText(apiKey)) {
      throw new Error('Missing Azure OpenAI embedding API key');
    }

    if (!hasText(apiVersion)) {
      throw new Error('Missing Azure OpenAI embedding API version');
    }

    if (!hasText(deploymentName)) {
      throw new Error('Missing Azure OpenAI embedding deployment name');
    }

    const maxRetries = Number.isInteger(Number(AZURE_EMBEDDING_MAX_RETRIES))
      ? Number(AZURE_EMBEDDING_MAX_RETRIES)
      : undefined;

    return new AzureEmbeddingClient({
      apiEndpoint,
      apiKey,
      apiVersion,
      deploymentName,
      ...(maxRetries !== undefined ? { maxRetries } : {}),
    }, log);
  }

  /** Private so the API key is never readable off the instance. */
  #config;

  /**
   * @param {object} config
   * @param {string} config.apiEndpoint - Azure OpenAI resource endpoint.
   * @param {string} config.apiKey - Azure OpenAI API key.
   * @param {string} config.apiVersion - Azure OpenAI API version.
   * @param {string} config.deploymentName - The embeddings deployment name.
   * @param {number} [config.maxRetries=3] - Retries on 429/5xx (0 disables).
   * @param {number} [config.retryBaseDelayMs=500] - Backoff base delay.
   * @param {number} [config.retryMaxDelayMs=30000] - Cap on any single retry sleep.
   * @param {object} log - Logger.
   */
  constructor(config, log) {
    this.#config = config;
    this.log = log;
  }

  #logDuration(message, startTime) {
    const endTime = process.hrtime.bigint();
    const duration = (endTime - startTime) / BigInt(1e6);
    this.log.debug(`${message}: took ${duration}ms`);
  }

  /** POST with bounded retry on 429/5xx; other errors throw immediately. */
  async #post(body, path) {
    const url = createUrl(`${this.#config.apiEndpoint}${path}?api-version=${this.#config.apiVersion}`);
    const headers = {
      'Content-Type': 'application/json',
      'api-key': this.#config.apiKey,
    };

    this.log.debug(`[Azure OpenAI Embedding Call]: ${url}, Headers: ${JSON.stringify(sanitizeHeaders(headers))}`);

    const maxRetries = Math.max(0, this.#config.maxRetries ?? 3);
    const baseDelayMs = this.#config.retryBaseDelayMs ?? 500;
    const maxDelayMs = Math.max(1, this.#config.retryMaxDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS);

    for (let attempt = 0; ; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await httpFetch(url, { method: 'POST', headers, body });

      if (response.ok) {
        return response.json();
      }

      // Truncated: Azure error payloads can carry the deployment name / request id.
      // eslint-disable-next-line no-await-in-loop
      const errorBody = (await response.text()).slice(0, 512);
      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        const delay = retryDelayMs(response, attempt, baseDelayMs, maxDelayMs);
        this.log.info(`[Azure OpenAI Embedding] status ${response.status}, retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
        // eslint-disable-next-line no-await-in-loop
        await sleep(delay);
      } else {
        throw new Error(`API call failed with status code ${response.status} and body: ${errorBody}`);
      }
    }
  }

  /**
   * Embeds each input, returning one vector per input in input order.
   *
   * @param {string[]} inputs - Non-empty array of non-empty strings.
   * @param {object} [options]
   * @param {number} [options.dimensions] - Output dimension; omit for the model's native one.
   * @returns {Promise<number[][]>}
   */
  async createEmbeddings(inputs, options = {}) {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new Error('inputs must be a non-empty array');
    }
    if (!inputs.every((input) => hasText(input))) {
      throw new Error('each input must be a non-empty string');
    }

    const { dimensions } = options || {};

    const body = { input: inputs };
    if (dimensions !== undefined) {
      body.dimensions = dimensions;
    }

    let response;
    try {
      const startTime = process.hrtime.bigint();
      response = await this.#post(
        JSON.stringify(body),
        `/openai/deployments/${encodeURIComponent(this.#config.deploymentName)}/embeddings`,
      );
      this.#logDuration('Azure OpenAI API Embeddings call', startTime);
    } catch (error) {
      this.log.error('Error while fetching data from Azure OpenAI embeddings API: ', error.message);
      throw error;
    }

    if (!validateEmbeddingResponse(response, inputs.length)) {
      this.log.error('Could not obtain embeddings from Azure OpenAI: Invalid response format.');
      throw new Error('Invalid response format.');
    }

    // Response order isn't guaranteed; re-align by each item's input `index`.
    return [...response.data]
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}
