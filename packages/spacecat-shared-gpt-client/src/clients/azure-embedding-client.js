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
 * Minimal contract every embedding provider satisfies, so consumers depend on the
 * interface (not the concrete Azure client) and the model/provider stays swappable.
 * @typedef {Object} EmbeddingProvider
 * @property {(inputs: string[], options?: { dimensions?: number }) => Promise<number[][]>}
 *   createEmbeddings - embed each input string, returning one vector per input, in input order.
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

/** Upper bound on any single retry sleep, so a hostile `Retry-After` can't stall the invocation. */
const DEFAULT_MAX_RETRY_DELAY_MS = 30_000;

/** Transient statuses worth retrying: rate-limit (429) and server errors (5xx). */
function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * Backoff for a retryable response: honor a numeric `Retry-After` (seconds) when present, else
 * exponential backoff with full jitter. Always capped at `maxDelayMs` so an unbounded/hostile
 * `Retry-After` can never exceed the caller's execution budget.
 */
function retryDelayMs(response, attempt, baseDelayMs, maxDelayMs) {
  const retryAfter = Number(response.headers.get('retry-after'));
  const raw = (Number.isFinite(retryAfter) && retryAfter > 0)
    ? retryAfter * 1000
    : Math.round((2 ** attempt) * baseDelayMs * (0.5 + Math.random()));
  return Math.min(raw, maxDelayMs);
}

/**
 * Azure OpenAI embeddings client (e.g. text-embedding-3-small). Separate from
 * {@link AzureOpenAIClient} (chat/completions) but same vendor/auth: it reuses the
 * Azure OpenAI endpoint/key/api-version and adds its own embeddings deployment.
 * Implements {@link EmbeddingProvider}.
 */
export default class AzureEmbeddingClient {
  /**
   * Builds a client from a UniversalContext. Embeddings may share the chat resource, so the
   * endpoint/key/api-version fall back to the `AZURE_OPENAI_*` values; only the embeddings
   * deployment (`AZURE_EMBEDDING_DEPLOYMENT`) is distinct and required.
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
   * @param {number} [config.maxRetries=3] - Retries for transient 429/5xx responses (0 disables).
   * @param {number} [config.retryBaseDelayMs=500] - Base for exponential backoff with jitter.
   * @param {number} [config.retryMaxDelayMs=30000] - Upper bound on any single retry sleep,
   *   applied to the `Retry-After` and backoff paths alike.
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

  /**
   * POST with bounded retry on transient failures (429/5xx): honors a numeric `Retry-After`,
   * otherwise exponential backoff with jitter. Non-transient (4xx) errors throw immediately.
   */
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

      // Cap the body: Azure error payloads can carry deployment name / request-id.
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
   * Embeds each input string, returning one vector per input in input order.
   *
   * @param {string[]} inputs - Non-empty array of non-empty strings to embed.
   * @param {object} [options]
   * @param {number} [options.dimensions] - Optional output dimension (Matryoshka truncation);
   *   omit to use the model's native dimension. Must match the stored index's dimension.
   * @returns {Promise<number[][]>} One embedding vector per input, aligned to input order.
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

    // Azure returns each embedding with its input `index`; sort by it so the result
    // aligns to input order regardless of response ordering.
    return [...response.data]
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}
