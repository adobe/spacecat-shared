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
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import DataAccessError from '../../errors/data-access.error.js';
import { sanitizeIdAndAuditFields } from '../../util/util.js';
import Configuration from './configuration.model.js';
import { checkConfiguration } from './configuration.schema.js';

const S3_CONFIG_KEY = 'config/spacecat/global-config.json';

/**
 * ConfigurationCollection - A standalone collection class for managing Configuration entities.
 * Unlike other collections, this does not use ElectroDB or DynamoDB.
 * Configuration is stored as a versioned JSON object in S3.
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
}

export default ConfigurationCollection;
