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

import { incrementVersion, sanitizeIdAndAuditFields, zeroPad } from '../../util/util.js';
import BaseCollection from '../base/base.collection.js';

/**
 * ConfigurationCollection - A collection class responsible for managing Configuration entities.
 * Extends the BaseCollection to provide specific methods for interacting with
 * Configuration records.
 *
 * @class ConfigurationCollection
 * @extends BaseCollection
 */
class ConfigurationCollection extends BaseCollection {
  static MAX_VERSIONS = 500;

  static BATCH_SIZE = 25;

  async create(data) {
    const latestConfiguration = await this.findLatest();
    const version = latestConfiguration ? incrementVersion(latestConfiguration.getVersion()) : 1;
    const sanitizedData = sanitizeIdAndAuditFields('Organization', data);
    sanitizedData.version = version;

    const newConfig = await super.create(sanitizedData);

    setImmediate(() => {
      this.#enforceVersionLimit().catch((error) => {
        this.log.error('Failed to enforce configuration version limit', error);
      });
    });

    return newConfig;
  }

  async #enforceVersionLimit() {
    const { MAX_VERSIONS, BATCH_SIZE } = ConfigurationCollection;

    try {
      const allConfigs = await this.all({}, { order: 'desc' });

      if (allConfigs.length <= MAX_VERSIONS) {
        this.log.debug(`Configuration version count within limit: ${allConfigs.length}/${MAX_VERSIONS}`);
        return;
      }

      // Calculate versions to delete (keep newest 500, delete the rest)
      const versionsToDelete = allConfigs.slice(MAX_VERSIONS);
      const deleteCount = versionsToDelete.length;

      this.log.info(`Enforcing configuration version limit: deleting ${deleteCount} old versions (current: ${allConfigs.length}, target: ${MAX_VERSIONS})`);

      // Delete in batches (DynamoDB batch write limit is 25)
      for (let i = 0; i < versionsToDelete.length; i += BATCH_SIZE) {
        const batch = versionsToDelete.slice(i, i + BATCH_SIZE);
        const ids = batch.map((config) => config.getId());

        // eslint-disable-next-line no-await-in-loop
        await this.removeByIds(ids);

        this.log.debug(`Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(deleteCount / BATCH_SIZE)}: ${ids.length} versions`);
      }

      this.log.info(`Configuration version limit enforced successfully. Deleted ${deleteCount} versions. Remaining: ${MAX_VERSIONS}`);
    } catch (error) {
      this.log.error('Configuration version limit enforcement failed', error);
    }
  }

  async findByVersion(version) {
    return this.findByAll({ versionString: zeroPad(version, 10) });
  }

  async findLatest() {
    return this.findByAll({}, { order: 'desc' });
  }
}

export default ConfigurationCollection;
