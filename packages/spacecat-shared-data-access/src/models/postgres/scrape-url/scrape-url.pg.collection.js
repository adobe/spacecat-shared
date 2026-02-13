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

import PostgresBaseCollection from '../base/postgres-base.collection.js';

class PostgresScrapeUrlCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'ScrapeUrlCollection';

  async allRecentByUrlAndProcessingType(url, processingType, maxAgeInHours = 168) {
    const now = new Date();
    const pastDate = new Date(now.getTime() - maxAgeInHours * 60 * 60 * 1000);
    const pastDateIso = pastDate.toISOString();
    const nowIso = now.toISOString();

    return this.allByIndexKeys({ url, isOriginal: true, processingType }, {
      between: {
        attribute: 'createdAt',
        start: pastDateIso,
        end: nowIso,
      },
    });
  }
}

export default PostgresScrapeUrlCollection;
