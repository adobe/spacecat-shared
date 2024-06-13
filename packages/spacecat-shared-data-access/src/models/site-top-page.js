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
  hasText, isInteger, isIsoDate, isValidUrl,
} from '@adobe/spacecat-shared-utils';
import { Base } from './base.js';

export const DEFAULT_GEO = 'global';

const SiteTopPage = (data = {}) => {
  const self = Base(data);

  self.getSiteId = () => self.state.siteId;
  self.getURL = () => self.state.url;
  self.getTraffic = () => self.state.traffic;
  self.getTopKeyword = () => self.state.topKeyword;
  self.getSource = () => self.state.source.toLowerCase();
  self.getGeo = () => self.state.geo;
  self.getImportedAt = () => self.state.importedAt;

  return Object.freeze(self);
};

export const createSiteTopPage = (data) => {
  const newState = { ...data };

  if (!hasText(newState.siteId)) {
    throw new Error('Site ID must be provided');
  }

  if (!isValidUrl(newState.url)) {
    throw new Error('Valid Url must be provided');
  }

  if (!isInteger(newState.traffic)) {
    throw new Error('Traffic must be provided');
  }

  if (!hasText(newState.source)) {
    throw new Error('Source must be provided');
  }

  if (!hasText(newState.geo)) {
    newState.geo = DEFAULT_GEO;
  }

  if (!isIsoDate(newState.importedAt)) {
    throw new Error('Imported at must be a valid ISO date');
  }

  return SiteTopPage(newState);
};
