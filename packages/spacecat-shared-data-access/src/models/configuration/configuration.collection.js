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
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import DataAccessError from '../../errors/data-access.error.js';
import { sanitizeIdAndAuditFields } from '../../util/util.js';
import { DATASTORE_TYPE } from '../../util/index.js';
import BaseCollection from '../base/base.collection.js';
import Configuration from './configuration.model.js';
import { checkConfiguration } from './configuration.validator.js';

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

  static DATASTORE_TYPE = DATASTORE_TYPE.S3;

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
        version: 1,
        createdAt: now,
        updatedAt: now,
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

      // Use S3 VersionId as the configurationId
      configData.configurationId = response.VersionId;

      this.log.info(`Configuration stored in S3 with VersionId ${response.VersionId}`);

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
   * Finds a configuration by its ID (S3 VersionId).
   *
   * @param {string} id - The S3 VersionId.
   * @returns {Promise<Configuration|null>} - The Configuration instance or null if not found.
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async findById(id) {
    this.#requireS3();

    const versionId = String(id);

    try {
      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: S3_CONFIG_KEY,
        VersionId: versionId,
      });

      const response = await this.s3Client.send(command);
      const bodyString = await response.Body.transformToString();
      const configData = JSON.parse(bodyString);

      // Set the configurationId to the S3 VersionId
      configData.configurationId = versionId;

      return this.#createInstance(configData);
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NoSuchVersion') {
        this.log.info(`Configuration with ID ${versionId} not found in S3`);
        return null;
      }

      if (error instanceof DataAccessError) {
        throw error;
      }

      const message = `Failed to retrieve configuration with ID ${versionId} from S3: ${error.message}`;
      this.log.error(message, error);
      throw new DataAccessError(message, this, error);
    }
  }

  /**
   * Finds a configuration by S3 VersionId.
   * Alias for findById().
   *
   * @param {string} version - The S3 VersionId.
   * @returns {Promise<Configuration|null>} - The Configuration instance or null if not found.
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async findByVersion(version) {
    return this.findById(version);
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

      // Set the configurationId to the S3 VersionId
      configData.configurationId = response.VersionId;

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

  /**
   * Finds a single configuration from the collection.
   * Alias for findLatest() since Configuration is a singleton.
   *
   * @returns {Promise<Configuration|null>} - The latest Configuration instance or null.
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async findByAll() {
    return this.findLatest();
  }

  /**
   * Retrieves all configuration versions from S3.
   *
   * @returns {Promise<Configuration[]>} - Array of all Configuration versions.
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async all() {
    this.#requireS3();

    try {
      const command = new ListObjectVersionsCommand({
        Bucket: this.s3Bucket,
        Prefix: S3_CONFIG_KEY,
      });

      const response = await this.s3Client.send(command);

      if (!response.Versions?.length) {
        return [];
      }

      // Fetch each version's content (exclude delete markers)
      const configurations = await Promise.all(
        response.Versions
          .filter((v) => !v.IsDeleteMarker)
          .map((v) => this.findById(v.VersionId)),
      );

      return configurations.filter(Boolean);
    } catch (error) {
      if (error instanceof DataAccessError) {
        throw error;
      }

      const message = `Failed to list configuration versions from S3: ${error.message}`;
      this.log.error(message, error);
      throw new DataAccessError(message, this, error);
    }
  }

  /**
   * Checks if a configuration with the given ID (S3 VersionId) exists.
   *
   * @param {string} id - The S3 VersionId to check.
   * @returns {Promise<boolean>} - True if the configuration exists, false otherwise.
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async existsById(id) {
    const config = await this.findById(id);
    return config !== null;
  }

  /**
   * Checks if any configuration exists in S3.
   *
   * @returns {Promise<boolean>} - True if a configuration exists, false otherwise.
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async exists() {
    const config = await this.findLatest();
    return config !== null;
  }

  /**
   * Removes configuration versions by their IDs (S3 VersionIds).
   *
   * @param {string[]} ids - Array of S3 VersionIds to remove.
   * @returns {Promise<void>}
   * @throws {DataAccessError} If S3 is not configured or the operation fails.
   */
  async removeByIds(ids) {
    this.#requireS3();

    if (!Array.isArray(ids) || ids.length === 0) {
      const message = 'Failed to remove configurations: ids must be a non-empty array';
      this.log.error(message);
      throw new DataAccessError(message, this);
    }

    try {
      const command = new DeleteObjectsCommand({
        Bucket: this.s3Bucket,
        Delete: {
          Objects: ids.map((id) => ({
            Key: S3_CONFIG_KEY,
            VersionId: String(id),
          })),
        },
      });

      const response = await this.s3Client.send(command);

      if (response.Errors?.length) {
        this.log.warn(`Some configuration versions could not be deleted: ${JSON.stringify(response.Errors)}`);
      }

      this.log.info(`Deleted ${ids.length - (response.Errors?.length || 0)} configuration version(s)`);
    } catch (error) {
      if (error instanceof DataAccessError) {
        throw error;
      }

      const message = `Failed to delete configuration versions from S3: ${error.message}`;
      this.log.error(message, error);
      throw new DataAccessError(message, this, error);
    }
  }

  // ============================================================================
  // Unsupported methods - throw clear errors
  // ============================================================================

  /**
   * Not supported for Configuration. Use create() instead.
   * @throws {DataAccessError} Always throws.
   */
  async createMany() {
    throw new DataAccessError(
      'createMany() is not supported for Configuration. Use create() instead.',
      this,
    );
  }

  /**
   * Not supported for Configuration.
   * @throws {DataAccessError} Always throws.
   */
  async _saveMany() {
    throw new DataAccessError(
      '_saveMany() is not supported for Configuration.',
      this,
    );
  }

  /**
   * Not supported for Configuration. Use findById() instead.
   * @throws {DataAccessError} Always throws.
   */
  async batchGetByKeys() {
    throw new DataAccessError(
      'batchGetByKeys() is not supported for Configuration. Use findById() instead.',
      this,
    );
  }

  /**
   * Not supported for Configuration. Use findById() or findLatest() instead.
   * @throws {DataAccessError} Always throws.
   */
  async allByIndexKeys() {
    throw new DataAccessError(
      'allByIndexKeys() is not supported for Configuration. Use all() instead.',
      this,
    );
  }

  /**
   * Not supported for Configuration. Use findById() or findLatest() instead.
   * @throws {DataAccessError} Always throws.
   */
  async findByIndexKeys() {
    throw new DataAccessError(
      'findByIndexKeys() is not supported for Configuration. Use findById() or findLatest() instead.',
      this,
    );
  }

  /**
   * Not supported for Configuration. Use removeByIds() instead.
   * @throws {DataAccessError} Always throws.
   */
  async removeByIndexKeys() {
    throw new DataAccessError(
      'removeByIndexKeys() is not supported for Configuration. Use removeByIds() instead.',
      this,
    );
  }
}

export default ConfigurationCollection;
