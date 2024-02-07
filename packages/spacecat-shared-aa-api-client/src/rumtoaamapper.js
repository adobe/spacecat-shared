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
import { EVARS_KEY, EVENTS_KEY } from './helpers.js';

export default class RUMToAAMapper {
  #config;

  constructor(config) {
    this.#config = config;
  }

  static getFieldValueOrDefault(field, defaultValue, data) {
    if (field in data) {
      return data[field];
    }
    return defaultValue || '';
  }

  static formatAsCSV(entries) {
    if (!entries || entries.length === 0) {
      return '';
    }

    const headerFields = Object.keys(entries[0]);

    const rows = entries.map((row) => headerFields.map((fieldName) => JSON.stringify(row[fieldName])).join(','));

    rows.unshift(headerFields.join(','));

    return rows.join('\r\n');
  }

  mapRUMPageViewsToAA(rumData, date, timezone) {
    const rumPagesList = rumData?.results?.data;
    if (!rumPagesList || rumPagesList.length === 0) {
      return [];
    }

    return rumPagesList.map((rumPageView) => {
      const mapping = this.#config.rum2aaMapping;

      const aaPageData = {};

      Object.keys(mapping).forEach((key) => {
        const keyMapping = mapping[key];

        if (key === EVARS_KEY) {
          Object.keys(keyMapping).forEach((evarKey) => {
            const { rumField: field, default: defaultVal } = keyMapping[evarKey];
            aaPageData[evarKey] = RUMToAAMapper
              .getFieldValueOrDefault(field, defaultVal, rumPageView);
          });
        } else if (key === EVENTS_KEY) {
          const events = [];
          Object.keys(keyMapping).forEach((eventKey) => {
            const { rumField: field, default: defaultVal } = keyMapping[eventKey];
            const fieldValue = RUMToAAMapper.getFieldValueOrDefault(field, defaultVal, rumPageView);
            if (fieldValue) {
              events.push(`${eventKey}=${fieldValue}`);
            }
          });

          aaPageData[key] = events.length > 0 ? events.join(',') : '';
        } else {
          const { rumField: field, default: defaultVal } = keyMapping;
          const fieldValue = RUMToAAMapper.getFieldValueOrDefault(field, defaultVal, rumPageView);

          if (fieldValue) {
            aaPageData[key] = fieldValue;
          }
        }
      });

      if (timezone === 'UTC') {
        aaPageData.timestamp = `${date}T00:00:00Z`;
      } else if (timezone.startsWith('UTC')) {
        const offset = timezone.replace('UTC', '');
        aaPageData.timestamp = `${date}T00:00:00${offset}`;
      } else {
        aaPageData.timestamp = `${date}T00:00:00`;
      }

      return aaPageData;
    }).filter((aaPageData) => !!aaPageData[EVENTS_KEY]); // Skip record is no metric will be set
  }
}
