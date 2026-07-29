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
  composeAuditURL,
  hasText,
  isValidUrl,
  DELIVERY_TYPES,
  AUTHORING_TYPES,
} from '@adobe/spacecat-shared-utils';
import BaseModel from '../base/base.model.js';
import { validateConfiguration } from './config.js';
import { guardConfigValidation } from '../../util/config-validation-guard.js';

const HLX_HOST = /\.(?:aem|hlx)\.(?:page|live)$/i;
export const AEM_CS_HOST = /^author-p(\d+)-e(\d+)/i;

/**
 * Computes external IDs based on delivery type and configuration
 */
export const computeExternalIds = (attrs, authoringTypes) => {
  const { authoringType, hlxConfig, deliveryConfig } = attrs;

  if (hlxConfig && (authoringType === authoringTypes.DA)) {
    const rso = hlxConfig.rso ?? {};
    const { owner, site } = rso;

    return {
      externalOwnerId: owner || undefined,
      externalSiteId: site || undefined,
    };
  }

  if (deliveryConfig
    && (authoringType === authoringTypes.CS || authoringType === authoringTypes.CS_CW)) {
    const { programId, environmentId } = deliveryConfig;

    return {
      externalOwnerId: programId ? `p${programId}` : undefined,
      externalSiteId: environmentId ? `e${environmentId}` : undefined,
    };
  }

  return { externalOwnerId: undefined, externalSiteId: undefined };
};

/**
 * Determines the authoring type based on hostname
 */
export const getAuthoringType = (hostname, authoringTypes) => {
  if (HLX_HOST.test(hostname)) {
    return authoringTypes.DA;
  }
  if (AEM_CS_HOST.test(hostname)) {
    return authoringTypes.CS;
  }
  return null;
};

/**
 * A class representing a Site entity. Provides methods to access and manipulate Site-specific data.
 * @class Site
 * @extends BaseModel
 */
class Site extends BaseModel {
  static ENTITY_NAME = 'Site';

  static DELIVERY_TYPES = DELIVERY_TYPES;

  static DEFAULT_DELIVERY_TYPE = DELIVERY_TYPES.AEM_EDGE;

  static AUTHORING_TYPES = AUTHORING_TYPES;

  async toggleLive() {
    const newIsLive = !this.getIsLive();
    this.setIsLive(newIsLive);
    return this;
  }

  /**
   * Sets the site config, guarding it against the config schema
   * (`validateConfiguration`). Overrides the auto-generated setter so every
   * writer (e.g. the `PATCH /sites/{id}` config merge) is checked at one
   * chokepoint. Behavior is governed by `CONFIG_VALIDATION_ENFORCEMENT`
   * (default `warn`; `enforce` throws; `off` skips) — see
   * config-validation-guard.js for the rollout rationale.
   *
   * Note: this only guards writes. Reads still go through the lenient
   * `Config()` getter (attribute `get:` transform), which intentionally
   * tolerates legacy invalid config already stored on existing sites so a
   * bad historical record doesn't break every read of that site.
   *
   * @param {object} value - candidate config object
   * @returns {this}
   */
  setConfig(value) {
    guardConfigValidation({
      entityName: Site.ENTITY_NAME,
      entityId: this.getId(),
      value,
      validate: validateConfiguration,
      log: this.log,
    });
    this.patcher.patchValue('config', value, false);
    return this;
  }

  /**
   * Resolves the site's base URL to a final URL by fetching the URL,
   * following the redirects and returning the final URL.
   *
   * If the site has a configured overrideBaseURL, that one will be returned.
   * Otherwise, the site's base URL will be used.
   *
   * If the site has a configured User-Agent, it will be used to resolve the URL.
   *
   * @returns a promise that resolves the final URL.
   * @throws {Error} if the final URL cannot be resolved.
   */
  async resolveFinalURL() {
    const overrideBaseURL = this.getConfig()?.getFetchConfig()?.overrideBaseURL;
    if (isValidUrl(overrideBaseURL)) {
      return overrideBaseURL.replace(/^https?:\/\//, '');
    }

    const userAgentConfigured = this.getConfig()?.getFetchConfig()?.headers?.['User-Agent'];
    if (hasText(userAgentConfigured)) {
      return composeAuditURL(this.getBaseURL(), userAgentConfigured);
    }

    return composeAuditURL(this.getBaseURL());
  }
}

export default Site;
