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

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

import DataAccessError from '../../errors/data-access.error.js';
import { incrementVersion, sanitizeIdAndAuditFields } from '../../util/util.js';
import BaseCollection from '../base/base.collection.js';
import Configuration from './configuration.model.js';

const S3_CONFIG_KEY = 'config/global/global-config.json';

/**
 * ConfigurationCollection - A collection class responsible for managing Configuration entities.
 * Extends the BaseCollection to provide specific methods for interacting with
 * Configuration records stored in S3.
 *
 * @class ConfigurationCollection
 * @extends BaseCollection
 */
class ConfigurationCollection extends BaseCollection {
  static COLLECTION_NAME = 'ConfigurationCollection';

  /**
   * Constructs an instance of ConfigurationCollection.
   * @constructor
   * @param {Object} electroService - The ElectroDB service used for managing entities.
   * @param {Object} entityRegistry - The registry holding entities, their schema and collection.
   * @param {Object} schema - The schema for the entity.
   * @param {Object} log - A logger for capturing logging information.
   * @param {{s3Client: S3Client, s3Bucket: string}|null} [s3Config] - Optional S3 configuration.
   */
  constructor(electroService, entityRegistry, schema, log, s3Config = null) {
    super(electroService, entityRegistry, schema, log);

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
        + 'Ensure ENV environment variable is set.',
        this,
      );
    }
  }

  /**
   * Creates an instance of the Configuration model from a record.
   * @private
   * @param {Object} record - The configuration data.
   * @returns {Configuration} - The Configuration model instance.
   */
  #createInstance(record) {
    return new Configuration(
      this.electroService,
      this.entityRegistry,
      this.schema,
      record,
      this.log,
    );
  }

  /**
   * Creates a new configuration version and stores it in S3.
   * S3 versioning handles the version history automatically.
   *
   * @param {Object} data - The configuration data to store.
   * @returns {Promise<Configuration>} - The created Configuration instance.
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async create(data) {
    this.#requireS3();

    try {
      const latestConfiguration = await this.findLatest();
      const version = latestConfiguration
        ? incrementVersion(latestConfiguration.getVersion())
        : 1;
      const sanitizedData = sanitizeIdAndAuditFields('Configuration', data);

      const now = new Date().toISOString();
      const configData = {
        ...sanitizedData,
        version,
        createdAt: now,
        updatedAt: now,
      };

      const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: S3_CONFIG_KEY,
        Body: JSON.stringify(configData),
        ContentType: 'application/json',
      });

      await this.s3Client.send(command);

      this.log.info(`Configuration version ${version} stored in S3`);

      return this.#createInstance(configData);
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
   * @param {number|string} version - The S3 VersionId (will be cast to string).
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

      return this.#createInstance(configData);
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NoSuchVersion') {
        this.log.info(`Configuration version ${versionId} not found in S3`);
        return null;
      }

      if (error instanceof DataAccessError) {
        throw error;
      }

      const message = `Failed to retrieve configuration version ${versionId} from S3: ${error.message}`;
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

      return this.#createInstance(configData);
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
}

export default ConfigurationCollection;
