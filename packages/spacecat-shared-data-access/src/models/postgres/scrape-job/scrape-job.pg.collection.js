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

import { isIsoDate } from '@adobe/spacecat-shared-utils';

import { ValidationError } from '../../../errors/index.js';
import PostgresBaseCollection from '../base/postgres-base.collection.js';
import PostgresScrapeJobModel from './scrape-job.pg.model.js';

class PostgresScrapeJobCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'ScrapeJobCollection';

  static MODEL_CLASS = PostgresScrapeJobModel;

  async allByDateRange(startDate, endDate) {
    if (!isIsoDate(startDate)) {
      throw new ValidationError(`Invalid start date: ${startDate}`);
    }

    if (!isIsoDate(endDate)) {
      throw new ValidationError(`Invalid end date: ${endDate}`);
    }

    return this.all({}, {
      between: {
        attribute: 'startedAt',
        start: startDate,
        end: endDate,
      },
    });
  }
}

export default PostgresScrapeJobCollection;
