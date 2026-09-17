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
import { Config, validateConfiguration } from './config.js';
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
   * Safe partial-update path for the site's `config` JSONB, guarding against
   * the lost-update race (LLMO-7588). `config` is a single JSONB column with
   * no server-side merge, so a plain read-config -> mutate-one-field -> save()
   * cycle persists the WHOLE in-memory config blob. A writer holding a config
   * snapshot loaded earlier (e.g. a long-lived request handler or a periodic
   * job) therefore silently clobbers any sibling field a concurrent writer
   * changed in the meantime -- the mechanism behind sunlife.ca's recurring
   * `llmo.dataFolder` wipes.
   *
   * This method re-reads the freshest persisted config immediately before
   * applying the caller's mutation, so the change is rebased onto current DB
   * state instead of onto a stale snapshot. Any sibling field committed before
   * this re-read survives. Callers express their change by mutating the passed
   * Config through its existing (already-validated) single-field setters, e.g.:
   *
   *   await site.updateConfig((config) => config.updateLlmoDataFolder(folder));
   *
   * This is NOT a fully atomic compare-and-swap: a writer that commits between
   * this re-read and the subsequent save() can still be lost. It shrinks the
   * window from "snapshot age" (minutes/hours) to "read+write latency"
   * (milliseconds), which removes the real-world trigger class. A true
   * optimistic-concurrency guard (reject a stale-blob save) is the follow-up
   * for the residual window and needs backend conditional-write support.
   *
   * Fail-open: if the fresh re-read fails, the mutation is applied to the
   * in-memory config and the write proceeds (a transient read error must not
   * block a legitimate config write). This restores the wider lost-update
   * window for that one write, so it is logged.
   *
   * @param {(config: object) => (void | Promise<void>)} mutator - receives the
   *   freshest Config wrapper; mutate it via its setters.
   * @returns {Promise<this>}
   */
  async updateConfig(mutator) {
    if (typeof mutator !== 'function') {
      throw new TypeError('Site.updateConfig requires a mutator function');
    }

    let latest;
    try {
      const fresh = await this.collection.findById(this.getId());
      latest = fresh?.getConfig();
    } catch (error) {
      this.log?.warn?.(
        `Site.updateConfig: failed to re-read latest config for site ${this.getId()}; `
        + 'applying mutation to in-memory config (lost-update window reopened)',
        error,
      );
    }

    // In real usage findById hydrates `config` into a Config wrapper; normalize
    // defensively so the fallback (or a non-hydrated record) is wrapped too.
    const candidate = latest ?? this.getConfig();
    const baseConfig = candidate && typeof candidate.getSlackConfig === 'function'
      ? candidate
      : Config(candidate); // Config() defaults a nullish arg to an empty config

    await mutator(baseConfig);

    this.setConfig(Config.toDynamoItem(baseConfig));
    await this.save();
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
