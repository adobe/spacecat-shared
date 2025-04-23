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
import AWSXray from 'aws-xray-sdk';
import { createFrom as createContentSDKClient } from '@adobe/spacecat-helix-content-sdk';
import {
  composeBaseURL, hasText, isObject, resolveCustomerSecretsName, tracingFetch,
} from '@adobe/spacecat-shared-utils';
import { Graph, hasCycle } from 'graph-data-structure';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const CONTENT_SOURCE_TYPE_DRIVE_GOOGLE = 'drive.google';
const CONTENT_SOURCE_TYPE_ONEDRIVE = 'onedrive';

/**
 * @import {type Site} from "@adobe/spacecat-shared-data-access/src/models/site/index.js"
 * @typedef {Pick<Console, 'debug' | 'info' | 'warn' | 'error'>} Logging
 */

/**
 * A list of supported content source types and their required configuration parameters.
 * @typedef {typeof CONTENT_SOURCE_TYPE_DRIVE_GOOGLE | typeof CONTENT_SOURCE_TYPE_ONEDRIVE} _CSKey
 * @type {Map<_CSKey, {[key: string]: string}>}
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

  const contentSource = site.getHlxConfig()?.content?.source;
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

    if (!hasText(value.value) || !hasText(value.type)) {
      throw new Error(`Metadata value for key ${key} must be a object that has a value and type`);
    }
  }
};

const validateLinks = (links, type) => {
  let pathRegex;
  if (type === 'URL') {
    pathRegex = /^(http:\/\/|https:\/\/)[a-zA-Z0-9\-._~%!$&'()*+,;=:@/]*$/;
  } else if (type === 'Redirect') {
    pathRegex = /^\/[a-zA-Z0-9\-._~%!$&'()*+,;=:@/]*$/;
  }

  if (!Array.isArray(links)) {
    throw new Error(`${type}s must be an array`);
  }

  if (!links.length) {
    throw new Error(`${type}s must not be empty`);
  }

  for (const link of links) {
    if (!isObject(link)) {
      throw new Error(`${type} must be an object`);
    }

    if (!hasText(link.from)) {
      throw new Error(`${type} must have a valid from path`);
    }

    if (!hasText(link.to)) {
      throw new Error(`${type} must have a valid to path`);
    }

    if (!pathRegex.test(link.from)) {
      throw new Error(`Invalid ${type} from path: ${link.from}`);
    }

    if (!pathRegex.test(link.to)) {
      throw new Error(`Invalid ${type} to path: ${link.to}`);
    }

    if (link.from === link.to) {
      throw new Error(`${type} from and to paths must be different`);
    }
  }
};

const removeDuplicatedRedirects = (currentRedirects, newRedirects, log) => {
  const redirectsSet = new Set(
    currentRedirects.map(({ from, to }) => `${from}:${to}`),
  );

  const newRedirectsClean = [];
  newRedirects.forEach((redirectRule) => {
    const { from, to } = redirectRule;
    const strRedirectRule = `${from}:${to}`;
    if (!redirectsSet.has(strRedirectRule)) {
      redirectsSet.add(strRedirectRule);
      newRedirectsClean.push(redirectRule);
    } else {
      log.info(`Duplicate redirect rule detected: ${strRedirectRule}`);
    }
  });
  return newRedirectsClean;
};

const removeRedirectLoops = (currentRedirects, newRedirects, log) => {
  const redirectsGraph = new Graph();
  const noCycleRedirects = [];
  currentRedirects.forEach((r) => redirectsGraph.addEdge(r.from, r.to));
  if (hasCycle(redirectsGraph)) {
    throw new Error('Redirect cycle detected in current redirects');
  }
  newRedirects.forEach((r) => {
    redirectsGraph.addEdge(r.from, r.to);
    if (hasCycle(redirectsGraph)) {
      log.info(`Redirect loop detected: ${r.from} -> ${r.to}`);
      redirectsGraph.removeEdge(r.from, r.to);
    } else {
      noCycleRedirects.push(r);
    }
  });
  if (newRedirects.length !== noCycleRedirects.length) {
    log.info(`Removed ${newRedirects.length - noCycleRedirects.length} redirect loops`);
  }
  return noCycleRedirects;
};

export default class ContentClient {
  /**
   * @param {{log: Logging, env: Record<string, any>}} context
   * @param {Site} site
   * @param {SecretsManagerClient} [secretsManagerClient]
   */
  static async createFrom(context, site, secretsManagerClient = new SecretsManagerClient({})) {
    const { log = console, env } = context;

    /** @type {{[key: string]: string}} */
    const config = {};
    const contentSourceType = site.getHlxConfig()?.content?.source?.type;
    const envMapping = SUPPORTED_CONTENT_SOURCES.get(contentSourceType);

    if (envMapping) {
      for (const [configVar, envVar] of Object.entries(envMapping)) {
        config[configVar] = env[envVar];
      }
    }

    try {
      const customerSecret = resolveCustomerSecretsName(site.getBaseURL(), context);
      const client = AWSXray.captureAWSv3Client(secretsManagerClient);
      const command = new GetSecretValueCommand({ SecretId: customerSecret });
      const response = await client.send(command);
      const secrets = JSON.parse(response.SecretString);
      config.domainId = secrets.onedrive_domain_id;
      config.helixAdminToken = secrets.helix_admin_token;
    } catch (e) {
      log.debug(`Customer ${site.getBaseURL()} secrets containing onedrive domain id not configured: ${e.message}`);
    }
    return new ContentClient(config, site, log);
  }

  static async createFromDomain(domain, env, log = console) {
    const baseUrl = composeBaseURL(domain);
    const siteBaseUrlEncoded = Buffer.from(baseUrl).toString('base64');
    let site;
    const sitesApiEndpoint = `${env.SPACECAT_API_ENDPOINT}/sites/by-base-url`;
    try {
      const response = await tracingFetch(`${sitesApiEndpoint}/${siteBaseUrlEncoded}`, {
        method: 'GET',
        headers: {
          'x-api-key': env.SPACECAT_API_KEY,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${domain}`);
      }
      site = await response.json();
      const siteDto = {
        getId: () => site.siteId,
        getHlxConfig: () => site.hlxConfig,
        getBaseURL: () => site.baseURL,
      };
      return ContentClient.createFrom({ log, env }, siteDto);
    } catch (e) {
      log.error(`Failed to fetch ${domain}: ${e.message}`);
      throw new Error(`Failed to fetch ${domain}`);
    }
  }

  /**
   * @param {{[key: string]: any}} config
   * @param {Site} site
   * @param {Logging} log
   */
  constructor(config, site, log) {
    validateSite(site);
    validateConfiguration(config, site.getHlxConfig()?.content.source?.type);

    this.log = log;
    this.config = config;
    this.contentSource = site.getHlxConfig()?.content?.source;
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

  /**
   * @param {string} path
   * @returns {Promise<string>}
   */
  async getResourcePath(path) {
    const { rso } = this.site.getHlxConfig();
    // https://www.aem.live/docs/admin.html#tag/status
    const adminEndpointUrl = `https://admin.hlx.page/status/${rso.owner}/${rso.site}/${rso.ref}/${path.replace(/^\/+/, '')}`;
    const response = await fetch(adminEndpointUrl, {
      headers: {
        Authorization: `token ${this.config.helixAdminToken}`,
      },
    });
    if (response.ok) {
      const responseJson = await response.json();
      return responseJson.resourcePath;
    } else {
      const errorMessage = await response.text();
      throw new Error(`Failed to fetch document path for ${path}: ${errorMessage}`);
    }
  }

  async getPageMetadata(path) {
    const startTime = process.hrtime.bigint();

    validatePath(path);

    await this.#initClient();

    this.log.info(`Getting page metadata for ${this.site.getId()} and path ${path}`);

    const docPath = this.#resolveDocPath(path);
    const document = await this.rawClient.getDocument(docPath);
    const metadata = await document.getMetadata();

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
    const document = await this.rawClient.getDocument(docPath);
    const originalMetadata = await document.getMetadata();

    let mergedMetadata;
    if (overwrite) {
      mergedMetadata = new Map([...originalMetadata, ...metadata]);
    } else {
      mergedMetadata = new Map([...metadata, ...originalMetadata]);
    }

    const response = await document.updateMetadata(mergedMetadata);
    if (response?.status !== 200) {
      throw new Error(`Failed to update metadata for path ${path}`);
    }

    this.#logDuration('updatePageMetadata', startTime);

    return mergedMetadata;
  }

  async getRedirects() {
    const startTime = process.hrtime.bigint();
    await this.#initClient();

    this.log.info(`Getting redirects for ${this.site.getId()}`);

    const redirectsFile = await this.rawClient.getRedirects();
    const redirects = await redirectsFile.get();
    this.#logDuration('getRedirects', startTime);

    return redirects;
  }

  async updateRedirects(redirects) {
    const startTime = process.hrtime.bigint();

    validateLinks(redirects, 'Redirect');

    await this.#initClient();

    this.log.info(`Updating redirects for ${this.site.getId()}`);

    const redirectsFile = await this.rawClient.getRedirects();
    const currentRedirects = await redirectsFile.get();
    // validate combination of existing and new redirects
    const cleanNewRedirects = removeDuplicatedRedirects(currentRedirects, redirects, this.log);
    if (cleanNewRedirects.length === 0) {
      this.log.info('No valid redirects to update');
      return;
    }
    const noCycleRedirects = removeRedirectLoops(currentRedirects, cleanNewRedirects, this.log);
    if (noCycleRedirects.length === 0) {
      this.log.info('No valid redirects to update');
      return;
    }

    const response = await redirectsFile.append(noCycleRedirects);
    if (response.status !== 200) {
      throw new Error('Failed to update redirects');
    }

    this.#logDuration('updateRedirects', startTime);
  }

  async updateBrokenInternalLink(path, brokenLink) {
    const startTime = process.hrtime.bigint();

    validateLinks([brokenLink], 'URL');
    validatePath(path);

    await this.#initClient();

    this.log.info(`Updating page link for ${this.site.getId()} and path ${path}`);

    const docPath = this.#resolveDocPath(path);
    const document = await this.rawClient.getDocument(docPath);

    this.log.info('Updating link from', brokenLink.from, 'to', brokenLink.to);
    const response = await document.updateLink(brokenLink.from, brokenLink.to);

    if (response.status !== 200) {
      throw new Error(`Failed to update link from ${brokenLink.from} to ${brokenLink.to} // ${brokenLink}`);
    }

    this.#logDuration('updateBrokenInternalLink', startTime);
  }
}
