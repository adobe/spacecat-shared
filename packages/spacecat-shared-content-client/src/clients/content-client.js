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

import { createFrom as createContentSDKClient } from '@adobe/spacecat-helix-content-sdk';
import { hasText, isObject } from '@adobe/spacecat-shared-utils';

const CONTENT_SOURCE_TYPE_DRIVE_GOOGLE = 'drive.google';
const CONTENT_SOURCE_TYPE_ONEDRIVE = 'onedrive';

/**
 * A list of supported content source types and their required configuration parameters.
 * @type {Map<string, object>}
 */
const SUPPORTED_CONTENT_SOURCES = new Map([
  [CONTENT_SOURCE_TYPE_DRIVE_GOOGLE, {
    auth_provider_x509_cert_url: 'GDRIVE_X509_AUTH_PROVIDER_CERT_URL',
    auth_uri: 'GDRIVE_AUTH_URI',
    client_email: 'GDRIVE_EMAIL',
    client_id: 'GDRIVE_CLIENT_ID',
    client_x509_cert_url: 'GDRIVE_X509_CLIENT_CERT_URL',
    private_key: 'GDRIVE_PRIVATE_KEY',
    private_key_id: 'GDRIVE_PRIVATE_KEY_ID',
    project_id: 'GDRIVE_PROJECT_ID',
    token_uri: 'GDRIVE_TOKEN_URI',
    type: 'GDRIVE_TYPE',
    universe_domain: 'GDRIVE_UNIVERSE_DOMAIN',
  }],
  [CONTENT_SOURCE_TYPE_ONEDRIVE, {
    authority: 'ONEDRIVE_AUTHORITY',
    clientId: 'ONEDRIVE_CLIENT_ID',
    clientSecret: 'ONEDRIVE_CLIENT_SECRET',
    domainId: 'ADOBE_ONEDRIVE_DOMAIN_ID',
  }],
]);

const validateConfiguration = (config, contentSourceType) => {
  const requiredParameters = SUPPORTED_CONTENT_SOURCES.get(contentSourceType);

  for (const [configVar] of Object.entries(requiredParameters)) {
    if (!hasText(config[configVar])) {
      throw new Error(`Configuration parameter ${configVar} is required for content source ${contentSourceType}`);
    }
  }
};

const validateSite = (site) => {
  if (!isObject(site)) {
    throw new Error('Site is required');
  }

  const contentSource = site.getConfig()?.content?.source;
  if (!isObject(contentSource)) {
    throw new Error('Site must have a valid content source');
  }

  if (!SUPPORTED_CONTENT_SOURCES.has(contentSource.type)) {
    throw new Error(`Unsupported content source type: ${contentSource.type}`);
  }
};

const validatePath = (path) => {
  if (!hasText(path)) {
    throw new Error('Path must be a string');
  }

  if (!path.startsWith('/')) {
    throw new Error('Path must start with a slash');
  }
};

const validateMetadata = (metadata) => {
  if (!(metadata instanceof Map)) {
    throw new Error('Metadata must be a map');
  }

  if (!metadata.size) {
    throw new Error('Metadata must not be empty');
  }

  for (const [key, value] of metadata) {
    if (!hasText(key)) {
      throw new Error(`Metadata key ${key} must be a string`);
    }

    if (!hasText(value)) {
      throw new Error(`Metadata value for key ${key} must be a string`);
    }
  }
};

const validateRedirects = (redirects) => {
  if (!Array.isArray(redirects)) {
    throw new Error('Redirects must be an array');
  }

  if (!redirects.length) {
    throw new Error('Redirects must not be empty');
  }

  for (const redirect of redirects) {
    if (!isObject(redirect)) {
      throw new Error('Redirect must be an object');
    }

    if (!hasText(redirect.from)) {
      throw new Error('Redirect must have a valid from path');
    }

    if (!hasText(redirect.to)) {
      throw new Error('Redirect must have a valid to path');
    }

    if (!redirect.from.startsWith('/')) {
      throw new Error('Redirect from path must start with a slash');
    }

    if (!redirect.to.startsWith('/')) {
      throw new Error('Redirect to path must start with a slash');
    }

    if (redirect.from === redirect.to) {
      throw new Error('Redirect from and to paths must be different');
    }
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const validateRedirectsUpdate = (currentRedirects, existingRedirects) => {
  // todo: detect conflicts, duplicates and cycles
};

export default class ContentClient {
  static createFrom(context, site) {
    const { log = console, env } = context;

    const config = {};
    const contentSourceType = site.getConfig().content?.source?.type;
    const envMapping = SUPPORTED_CONTENT_SOURCES.get(contentSourceType);

    if (envMapping) {
      for (const [configVar, envVar] of Object.entries(envMapping)) {
        config[configVar] = env[envVar];
      }
    }

    return new ContentClient(config, site, log);
  }

  constructor(config, site, log) {
    validateSite(site);
    validateConfiguration(config, site.getConfig().content.source.type);

    this.log = log;
    this.config = config;
    this.contentSource = site.getConfig().content.source;
    this.site = site;
    this.rawClient = null;
  }

  async #initClient() {
    if (!this.rawClient) {
      this.rawClient = await createContentSDKClient(this.config, this.contentSource, this.log);
    }
  }

  #logDuration(message, startTime) {
    const endTime = process.hrtime.bigint();
    const duration = (endTime - startTime) / BigInt(1e6);
    this.log.debug(`${message}: took ${duration}ms`);
  }

  #resolveDocPath(path) {
    let docPath = path.endsWith('/') ? `${path}index` : path;

    if (this.contentSource.type === CONTENT_SOURCE_TYPE_ONEDRIVE) {
      docPath += '.docx';
    }

    return docPath;
  }

  async getPageMetadata(path) {
    const startTime = process.hrtime.bigint();

    validatePath(path);

    await this.#initClient();

    this.log.info(`Getting page metadata for ${this.site.getId()} and path ${path}`);

    const docPath = this.#resolveDocPath(path);
    const metadata = await this.rawClient.getPageMetadata(docPath);

    this.#logDuration('getPageMetadata', startTime);

    return metadata;
  }

  async updatePageMetadata(path, metadata, options = {}) {
    const { overwrite = true } = options;
    const startTime = process.hrtime.bigint();

    validatePath(path);
    validateMetadata(metadata);

    await this.#initClient();

    this.log.info(`Updating page metadata for ${this.site.getId()} and path ${path}`);

    const docPath = this.#resolveDocPath(path);
    const originalMetadata = await this.getPageMetadata(docPath);

    let mergedMetadata;
    if (overwrite) {
      mergedMetadata = new Map([...originalMetadata, ...metadata]);
    } else {
      mergedMetadata = new Map([...metadata, ...originalMetadata]);
    }

    const response = await this.rawClient.updatePageMetadata(docPath, mergedMetadata);
    if (response.status !== 200) {
      throw new Error(`Failed to update metadata for path ${path}`);
    }

    this.#logDuration('updatePageMetadata', startTime);

    return mergedMetadata;
  }

  async getRedirects() {
    const startTime = process.hrtime.bigint();
    await this.#initClient();

    this.log.info(`Getting redirects for ${this.site.getId()}`);

    const redirects = await this.rawClient.getRedirects();
    this.#logDuration('getRedirects', startTime);

    return redirects;
  }

  async updateRedirects(redirects) {
    const startTime = process.hrtime.bigint();

    validateRedirects(redirects);

    await this.#initClient();

    this.log.info(`Updating redirects for ${this.site.getId()}`);

    const currentRedirects = await this.getRedirects();

    validateRedirectsUpdate(currentRedirects, redirects);

    const response = await this.rawClient.updateRedirects(redirects);
    if (response.status !== 200) {
      throw new Error('Failed to update redirects');
    }

    this.#logDuration('updateRedirects', startTime);
  }
}
