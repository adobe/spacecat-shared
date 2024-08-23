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

import { createFrom as ContentSDK } from '@adobe/spacecat-helix-content-sdk';
import { hasText, isObject } from '@adobe/spacecat-shared-utils';

const CONTENT_SOURCE_TYPE_DRIVE_GOOGLE = 'drive.google';
const CONTENT_SOURCE_TYPE_ONEDRIVE = 'onedrive';

/**
 * A list of supported content source types and their required configuration parameters.
 * @type {Map<string, string[]>}
 */
const SUPPORTED_CONTENT_SOURCES = new Map([
  [CONTENT_SOURCE_TYPE_DRIVE_GOOGLE,
    [
      'GOOGLE_DRIVE_CLIENT_ID',
      'GOOGLE_DRIVE_CLIENT_SECRET',
    ],
  ],
  [CONTENT_SOURCE_TYPE_ONEDRIVE,
    [
      'ONEDRIVE_CLIENT_ID',
      'ONEDRIVE_CLIENT_SECRET',
    ],
  ],
]);

const validateConfiguration = (env, contentSourceType) => {
  const requiredParameters = SUPPORTED_CONTENT_SOURCES.get(contentSourceType);
  const config = {};

  requiredParameters.forEach((param) => {
    if (!hasText(env[param])) {
      throw new Error(`Configuration parameter ${param} is required for content source ${contentSourceType}`);
    }
    config[param] = env[param];
  });

  return config;
};

const validateSite = (site) => {
  if (!isObject(site)) {
    throw new Error('Site is required');
  }

  const siteConfig = site.getConfig();
  if (!isObject(siteConfig?.content?.source)) {
    throw new Error('Site must have a content source');
  }

  const contentSourceType = siteConfig.content.source.type;
  if (!SUPPORTED_CONTENT_SOURCES.has(contentSourceType)) {
    throw new Error(`Unsupported content source type: ${contentSourceType}`);
  }
};

const validatePath = (path) => {
  if (!hasText(path)) {
    throw new Error('Path must be a string');
  }

  if (path.startsWith('/')) {
    throw new Error('Path must not start with a slash');
  }
};

export default class ContentClient {
  static createFrom(context, site) {
    const { log = console, env } = context;
    return new ContentClient(env, site, log);
  }

  /**
   * Creates a new Ims client
   *
   * @param {Object} config - The configuration object.
   * @param {Object} site - The site object.
   * @param {Object} log - The Logger.
   * @returns {ImsClient} - the Ims client.
   */
  constructor(config, site, log) {
    validateSite(site);

    const contentSdkConfig = validateConfiguration(config, site.getConfig().content.source.type);

    this.log = log;
    this.contentSource = site.getConfig().content.source;
    this.site = site;
    this.rawClient = ContentSDK(contentSdkConfig, this.contentSource, log);
  }

  #logDuration(message, startTime) {
    const endTime = process.hrtime.bigint();
    const duration = (endTime - startTime) / BigInt(1e6);
    this.log.debug(`${message}: took ${duration}ms`);
  }

  #resolveDocPath(path) {
    let docPath = path;

    if (path.endsWith('/')) {
      docPath = `${path}index`;
    }

    if (this.contentSource.type === CONTENT_SOURCE_TYPE_ONEDRIVE) {
      docPath = `${docPath}.docx`;
    }

    return docPath;
  }

  async getPageMetadata(path) {
    validatePath(path);

    this.log.info(`Getting page metadata for ${this.site.getId()} and path ${path}`);

    const startTime = process.hrtime.bigint();

    const docPath = this.#resolveDocPath(path);
    const metadata = this.rawClient.getPageMetadata(docPath);

    this.#logDuration('getPageMetadata', startTime);

    return metadata;
  }
}
