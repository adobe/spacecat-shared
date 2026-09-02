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

import { hasText } from '@adobe/spacecat-shared-utils';
import BaseCollection from '../base/base.collection.js';
import GeoExperiment from './geo-experiment.model.js';

class GeoExperimentCollection extends BaseCollection {
  static COLLECTION_NAME = 'GeoExperimentCollection';

  /**
   * Gets all geo experiments for a site, ordered by most recently updated.
   *
   * @param {string} siteId - The site ID.
   * @param {object} [options={}] - Query options (limit, cursor).
   * @returns {Promise<{data: GeoExperiment[], cursor: string|null}>} Paginated results.
   */
  async allBySiteId(siteId, options = {}) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    const result = await this.allByIndexKeys(
      { siteId },
      { ...options, returnCursor: true },
    );

    return {
      data: result.data || [],
      cursor: result.cursor,
    };
  }

  /**
   * Gets all geo experiments that are currently active (GENERATING_BASELINE or IN_PROGRESS).
   * Used by the experimentation engine to discover which experiments to process on each cron tick.
   *
   * @param {object} [options={}] - Query options (limit, cursor, order).
   * @returns {Promise<GeoExperiment[]>} Array of active experiments.
   */
  async allActive(options = {}) {
    const activeStatuses = [
      GeoExperiment.STATUSES.GENERATING_BASELINE,
      GeoExperiment.STATUSES.IN_PROGRESS,
    ];
    return this.all(
      {},
      {
        ...options,
        where: (attrs, op) => op.in(attrs.status, activeStatuses),
      },
    );
  }

  /**
   * Gets all geo experiments left at status COMPLETED / phase IMPACT_MEASUREMENT_STARTED — a
   * combination that only arises when a manual impact-measurement re-trigger leaves the
   * experiment COMPLETED (so it stays outside allActive()) but nobody has followed up with a
   * check of the re-submitted Mystique task. Used by the experimentation engine's bounded
   * stuck-check sweep to find and resolve abandoned re-triggers (see
   * llmo-experimentation-engine/docs/decisions/007-manual-impact-measurement-check-completed-
   * status.md). Same cost/indexing characteristic as allActive() above — a filtered query over
   * all GeoExperiment records, not a dedicated secondary index.
   *
   * @param {object} [options={}] - Query options (limit, cursor, order).
   * @returns {Promise<GeoExperiment[]>} Array of stuck experiments.
   */
  async allStuckImpactMeasurementChecks(options = {}) {
    return this.all(
      {},
      {
        ...options,
        where: (attrs, op) => op.and(
          op.eq(attrs.status, GeoExperiment.STATUSES.COMPLETED),
          op.eq(attrs.phase, GeoExperiment.PHASES.IMPACT_MEASUREMENT_STARTED),
        ),
      },
    );
  }
}

export default GeoExperimentCollection;
