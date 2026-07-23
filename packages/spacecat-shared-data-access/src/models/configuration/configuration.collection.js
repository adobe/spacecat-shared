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

import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import DataAccessError from '../../errors/data-access.error.js';
import { sanitizeIdAndAuditFields } from '../../util/util.js';
import Configuration from './configuration.model.js';
import { checkConfiguration } from './configuration.schema.js';

const S3_CONFIG_KEY = 'config/spacecat/global-config.json';

// Cap on concurrent HeadObject calls during version enrichment. Bounds the
// fan-out regardless of page size so a large `listVersions({ detail: true })`
// can't fire hundreds of concurrent requests in one tick (socket-pool
// exhaustion / S3 503 SlowDown in Lambda).
const ENRICH_CONCURRENCY = 25;

/**
 * ConfigurationCollection - A standalone collection class for managing Configuration entities.
 * Unlike other collections, this uses S3 instead of PostgREST.
 * Configuration is stored as a versioned JSON object in S3.
 *
 * The S3Client is configured with a custom retry strategy (EbusyRetryStrategy) that extends
 * the AWS SDK's StandardRetryStrategy to also retry EBUSY DNS errors. This handles the chronic
 * DNS resolver exhaustion issue in Lambda without adding application-level retry logic.
 *
 * @class ConfigurationCollection
 */
class ConfigurationCollection {
  static COLLECTION_NAME = 'ConfigurationCollection';

  /**
   * Constructs an instance of ConfigurationCollection.
   * @constructor
   * @param {{s3Client: S3Client, s3Bucket: string}|null} s3Config - S3 configuration.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(s3Config, log) {
    this.log = log;

    if (s3Config) {
      this.s3Client = s3Config.s3Client;
      this.s3Bucket = s3Config.s3Bucket;
    }
  }

  /**
   * Validates that S3 is configured. Throws an error if not.
   * @private
   * @throws {DataAccessError} If S3 is not configured.
   */
  #requireS3() {
    if (!this.s3Client || !this.s3Bucket) {
      throw new DataAccessError(
        'S3 configuration is required for Configuration storage. '
        + 'Ensure S3_CONFIG_BUCKET environment variable is set.',
        this,
      );
    }
  }

  /**
   * Creates an instance of the Configuration model from data and versionId.
   * @private
   * @param {Object} data - The configuration data.
   * @param {string} versionId - The S3 VersionId.
   * @returns {Configuration} - The Configuration model instance.
   */
  #createInstance(data, versionId) {
    return new Configuration(data, versionId, this, this.log);
  }

  /**
   * Creates a new configuration version and stores it in S3.
   * S3 versioning handles the version history automatically.
   * The S3 VersionId is used as the configurationId.
   *
   * @param {Object} data - The configuration data to store.
   * @returns {Promise<Configuration>} - The created Configuration instance.
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async create(data) {
    this.#requireS3();

    try {
      const sanitizedData = sanitizeIdAndAuditFields('Configuration', data);

      const now = new Date().toISOString();
      const configData = {
        ...sanitizedData,
        createdAt: now,
        updatedAt: now,
        updatedBy: sanitizedData.updatedBy || 'system',
      };

      // Validate the configuration against the schema
      checkConfiguration(configData);

      const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: S3_CONFIG_KEY,
        Body: JSON.stringify(configData),
        ContentType: 'application/json',
        // Stamp the audit fields into S3 user-metadata so `listVersions` can
        // surface who/when for each version via a cheap metadata-only HeadObject
        // (no full-body download). Keys are lowercased by S3. We stamp the
        // already-normalized `configData` values (updatedBy defaults to 'system'
        // above, updatedAt is the ISO `now`) — both are guaranteed non-empty
        // strings, so no literal "undefined"/"null" can ever be persisted into
        // the immutable per-version metadata.
        Metadata: {
          updatedby: configData.updatedBy,
          updatedat: configData.updatedAt,
        },
      });

      const response = await this.s3Client.send(command);
      const { VersionId: versionId } = response;

      this.log.info(`Configuration stored in S3 with VersionId ${versionId}`);

      return this.#createInstance(configData, versionId);
    } catch (error) {
      if (error instanceof DataAccessError) {
        throw error;
      }
      const message = `Failed to create configuration in S3: ${error.message}`;
      this.log.error(message, error);
      throw new DataAccessError(message, this, error);
    }
  }

  /**
   * Finds a configuration by S3 VersionId.
   *
   * @param {string} version - The S3 VersionId.
   * @returns {Promise<Configuration|null>} - The Configuration instance or null if not found.
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async findByVersion(version) {
    this.#requireS3();

    const versionId = String(version);

    try {
      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: S3_CONFIG_KEY,
        VersionId: versionId,
      });

      const response = await this.s3Client.send(command);
      const bodyString = await response.Body.transformToString();
      const configData = JSON.parse(bodyString);

      return this.#createInstance(configData, versionId);
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NoSuchVersion') {
        this.log.info(`Configuration with version ${versionId} not found in S3`);
        return null;
      }

      if (error instanceof DataAccessError) {
        throw error;
      }

      const message = `Failed to retrieve configuration with version ${versionId} from S3: ${error.message}`;
      this.log.error(message, error);
      throw new DataAccessError(message, this, error);
    }
  }

  /**
   * Retrieves the latest configuration from S3.
   * S3 automatically returns the latest version when versioning is enabled.
   *
   * @returns {Promise<Configuration|null>} - The latest Configuration instance
   * or null if not found.
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async findLatest() {
    this.#requireS3();

    try {
      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: S3_CONFIG_KEY,
      });

      const response = await this.s3Client.send(command);
      const bodyString = await response.Body.transformToString();
      const configData = JSON.parse(bodyString);
      const { VersionId: versionId } = response;

      return this.#createInstance(configData, versionId);
    } catch (error) {
      // If the object doesn't exist, return null (first-time setup)
      if (error.name === 'NoSuchKey') {
        this.log.info('No configuration found in S3, returning null');
        return null;
      }

      if (error instanceof DataAccessError) {
        throw error;
      }

      const message = `Failed to retrieve configuration from S3: ${error.message}`;
      this.log.error(message, error);
      throw new DataAccessError(message, this, error);
    }
  }

  /**
   * Enriches a version row with `updatedBy`/`updatedAt` read from the object's
   * S3 user-metadata via a metadata-only HeadObject (no body download). Versions
   * written before user-metadata was introduced resolve to null so one missing
   * row never fails the whole page.
   *
   * A HeadObject on a version we *just listed* should only fail for a systemic
   * reason (missing `s3:GetObjectVersion` IAM, throttling) — NOT the expected
   * "object gone" cases. We still degrade to null (enrichment is best-effort and
   * must not sink the primary listing), but we log such failures at `error` so a
   * page that comes back all-null reads as an outage, not as "old versions".
   * @private
   * @param {Object} version - The base version row from `listVersions`.
   * @returns {Promise<Object>} The version row with `updatedBy`/`updatedAt`.
   */
  async #enrichVersion(version) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.s3Bucket,
        Key: S3_CONFIG_KEY,
        VersionId: version.versionId,
      });
      const response = await this.s3Client.send(command);
      const metadata = response.Metadata || {};
      return {
        ...version,
        updatedBy: metadata.updatedby || null,
        updatedAt: metadata.updatedat || null,
      };
    } catch (error) {
      // NoSuchKey/NoSuchVersion = the version was reaped between list and head;
      // benign. Anything else (AccessDenied, SlowDown, network) is systemic.
      const benign = error.name === 'NoSuchKey' || error.name === 'NoSuchVersion';
      const logAt = benign ? this.log.warn : this.log.error;
      logAt.call(
        this.log,
        `Failed to read metadata for configuration version ${version.versionId} `
        + `(${error.name || 'Error'}): ${error.message}`,
      );
      return { ...version, updatedBy: null, updatedAt: null };
    }
  }

  /**
   * Enriches version rows in bounded-concurrency batches of `ENRICH_CONCURRENCY`
   * so the HeadObject fan-out stays capped regardless of page size.
   * @private
   * @param {Array<Object>} rawVersions - The base version rows.
   * @returns {Promise<Array<Object>>} The enriched rows, in order.
   */
  async #enrichVersions(rawVersions) {
    const enriched = [];
    for (let i = 0; i < rawVersions.length; i += ENRICH_CONCURRENCY) {
      const batch = rawVersions.slice(i, i + ENRICH_CONCURRENCY);
      // Serialize batches to bound concurrency; within a batch calls run in parallel.
      // eslint-disable-next-line no-await-in-loop
      const results = await Promise.all(batch.map((version) => this.#enrichVersion(version)));
      enriched.push(...results);
    }
    return enriched;
  }

  /**
   * Lists configuration versions from S3 object versioning, newest first.
   *
   * S3 `ListObjectVersions` returns version-level metadata only (VersionId,
   * LastModified, IsLatest, Size); the human-facing `updatedBy`/`updatedAt`
   * live inside each version's body. When `detail` is true, each row is
   * enriched with a parallel metadata-only HeadObject (see `#enrichVersion`) —
   * cheap because it never downloads the (multi-MB) config body.
   *
   * Callers MUST page on `isTruncated` + the returned markers, NOT on
   * `versions.length`: `MaxKeys` bounds the raw S3 result (versions + any delete
   * markers + sibling-prefix keys) before we filter to the config object, so a
   * page can legitimately return fewer rows than `limit` — or even zero — while
   * `isTruncated` is true. (In practice the global config is PUT-only and never
   * deleted, so delete markers do not occur today.)
   *
   * @param {Object} [options] - Listing options.
   * @param {number} [options.limit=25] - Max versions to return (coerced to an
   *   integer and clamped to [1, 1000]). Enrichment concurrency is bounded
   *   separately by `ENRICH_CONCURRENCY`, independent of this page size.
   * @param {string} [options.keyMarker] - S3 KeyMarker for pagination.
   * @param {string} [options.versionIdMarker] - S3 VersionIdMarker for pagination.
   * @param {boolean} [options.detail=true] - Enrich rows with updatedBy/updatedAt.
   * @returns {Promise<{versions: Array<Object>, isTruncated: boolean,
   *   nextKeyMarker: (string|null), nextVersionIdMarker: (string|null)}>}
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async listVersions({
    limit = 25,
    keyMarker,
    versionIdMarker,
    detail = true,
  } = {}) {
    this.#requireS3();

    // Coerce + clamp: an unvalidated limit (NaN/negative/huge from a query
    // string) would otherwise flow straight to S3 MaxKeys. (The HeadObject
    // fan-out is bounded separately by #enrichVersions.)
    const parsedLimit = Number.parseInt(limit, 10);
    const maxKeys = Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 1000)
      : 25;

    try {
      const command = new ListObjectVersionsCommand({
        Bucket: this.s3Bucket,
        Prefix: S3_CONFIG_KEY,
        MaxKeys: maxKeys,
        ...(keyMarker ? { KeyMarker: keyMarker } : {}),
        ...(versionIdMarker ? { VersionIdMarker: versionIdMarker } : {}),
      });

      const response = await this.s3Client.send(command);

      // Defensive: the prefix is an exact key, but a shared prefix could in
      // theory match sibling keys — keep only the config object's versions.
      const rawVersions = (response.Versions || [])
        .filter((version) => version.Key === S3_CONFIG_KEY)
        .map((version) => ({
          versionId: version.VersionId,
          lastModified: version.LastModified instanceof Date
            ? version.LastModified.toISOString()
            : version.LastModified,
          isLatest: Boolean(version.IsLatest),
          size: version.Size,
        }));

      const versions = detail
        ? await this.#enrichVersions(rawVersions)
        : rawVersions;

      return {
        versions,
        isTruncated: Boolean(response.IsTruncated),
        nextKeyMarker: response.NextKeyMarker || null,
        nextVersionIdMarker: response.NextVersionIdMarker || null,
      };
    } catch (error) {
      if (error instanceof DataAccessError) {
        throw error;
      }
      const message = `Failed to list configuration versions from S3: ${error.message}`;
      this.log.error(message, error);
      throw new DataAccessError(message, this, error);
    }
  }
}

export default ConfigurationCollection;
