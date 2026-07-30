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
import {
  composeBaseURL, hasText, instrumentAWSClient, isObject, resolveCustomerSecretsName, tracingFetch,
} from '@adobe/spacecat-shared-utils';
import { Graph, hasCycle } from 'graph-data-structure';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const CONTENT_SOURCE_TYPE_DRIVE_GOOGLE = 'drive.google';
const CONTENT_SOURCE_TYPE_ONEDRIVE = 'onedrive';

/**
 * @typedef {{
 *   getId: () => string,
 *   getBaseURL: () => string,
 *   getHlxConfig: () => any
 * }} Site
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

const validateImageAltText = (imageAltText) => {
  if (!Array.isArray(imageAltText)) {
    throw new Error(`${imageAltText} must be an array`);
  }
  for (const item of imageAltText) {
    if (!isObject(item)) {
      throw new Error(`${item} must be an object`);
    }
    if (!item.imageUrl) {
      throw new Error(`No imageUrl found for ${item}`);
    }
    if (!item.altText) {
      throw new Error(`No altText found for ${item}`);
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
      log.debug(`Duplicate redirect rule detected: ${strRedirectRule}`);
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
      log.debug(`Redirect loop detected: ${r.from} -> ${r.to}`);
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

// Google Drive returns 404 "File not found" when the folder is NOT SHARED with the service
// account (not only when a document is genuinely missing), and 403 / "does not have permission"
// when shared read-only. So both 403 and 404 signal a possible sharing problem and must trigger
// the fallback (verified on prod: the old SA got "File not found" for a folder shared only with
// the new SA). Accepted side effect: a genuinely missing document also triggers one extra
// fallback attempt before the error propagates. Keep in sync with the spacecat-auth-service
// `categorizeError` predicate (src/google-drive/handler.js).
const GDRIVE_SHARING_ERROR = /\b(403|404)\b|forbidden|not found|access denied|insufficient|does not have permission|not shared/i;

/**
 * True when a Google Drive error looks like a folder-sharing / permission problem (the service
 * account cannot see or edit the folder) — the signal to retry with the fallback SA.
 * @param {Error & {code?: any, status?: any}} error
 * @returns {boolean}
 */
const isGDriveSharingError = (error) => GDRIVE_SHARING_ERROR.test(
  `${error?.message || ''} ${error?.code || ''} ${error?.status || ''}`,
);

/**
 * Build the fallback Google Drive service-account config, or null when no fallback is configured.
 * A customer's Drive folder may be shared with only one of the two SAs during the migration, so we
 * keep a second SA to retry with. Any GDRIVE_*_FALLBACK env var overrides the matching SA field;
 * fields without a _FALLBACK (the Google-universal constants) are reused from the primary config.
 * Mirrors the dual-SA convention already live in spacecat-auth-service and mystique.
 * @param {Record<string, any>} env
 * @param {{[key: string]: string}} envMapping
 * @param {{[key: string]: string}} primaryConfig
 * @returns {{[key: string]: string} | null}
 */
const buildGDriveFallbackConfig = (env, envMapping, primaryConfig) => {
  if (!hasText(env.GDRIVE_EMAIL_FALLBACK) || !hasText(env.GDRIVE_PRIVATE_KEY_FALLBACK)) {
    return null;
  }
  // Spread the primary so the fallback inherits the Google-universal constants (and any non-gdrive
  // keys already on it, which the gdrive SDK ignores); the loop then overrides the per-SA fields
  // that have a _FALLBACK value.
  const fallback = { ...primaryConfig };
  for (const [configVar, envVar] of Object.entries(envMapping)) {
    const fallbackValue = env[`${envVar}_FALLBACK`];
    if (hasText(fallbackValue)) {
      // The primary GDRIVE_PRIVATE_KEY is newline-unescaped by the consumer (e.g. autofix-worker
      // run.js); the fallback key is not, so normalize it here. Idempotent for real newlines.
      fallback[configVar] = configVar === 'private_key'
        ? fallbackValue.replace(/\\n/g, '\n')
        : fallbackValue;
    }
  }
  return fallback;
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
      const client = instrumentAWSClient(secretsManagerClient);
      const command = new GetSecretValueCommand({ SecretId: customerSecret });
      const response = await client.send(command);
      const secrets = JSON.parse(response.SecretString);
      config.domainId = secrets.onedrive_domain_id || config.domainId;
      config.helixAdminToken = secrets.helix_admin_token || config.helixAdminToken;
      config.clientId = secrets.onedrive_client_id || config.clientId;
      config.clientSecret = secrets.onedrive_client_secret || config.clientSecret;
      config.authority = secrets.onedrive_authority || config.authority;
    } catch (e) {
      log.debug(`Customer ${site.getBaseURL()} secrets containing onedrive domain id not configured: ${e.message}`);
    }
    let fallbackConfig = null;
    if (contentSourceType === CONTENT_SOURCE_TYPE_DRIVE_GOOGLE && envMapping) {
      fallbackConfig = buildGDriveFallbackConfig(env, envMapping, config);
    }
    return new ContentClient(config, site, log, fallbackConfig);
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
  constructor(config, site, log, fallbackConfig = null) {
    validateSite(site);
    validateConfiguration(config, site.getHlxConfig()?.content.source?.type);

    this.log = log;
    this.config = config;
    this.fallbackConfig = fallbackConfig;
    this.usingFallback = false;
    this.contentSource = site.getHlxConfig()?.content?.source;
    this.site = site;
    this.rawClient = null;
  }

  async #initClient() {
    if (!this.rawClient) {
      const config = this.usingFallback ? this.fallbackConfig : this.config;
      this.rawClient = await createContentSDKClient(config, this.contentSource, this.log);
    }
  }

  /**
   * TODO(SITES-47990): remove after the EDS Google Drive SA migration completes, together with
   * `fallbackConfig`, `usingFallback`, `buildGDriveFallbackConfig` and the `GDRIVE_*_FALLBACK` env.
   *
   * Run a Google Drive `op` against the current service account. If it fails with a folder-sharing
   * / permission error (see `isGDriveSharingError`) and a fallback SA is set, rebuild the SDK
   * client with the fallback SA, retry `op` once, then keep using the fallback SA for the rest of
   * this instance's lifetime (a ContentClient is per-site, so the winning SA is stable; a transient
   * primary error also pins to the fallback, which is acceptable for the not-shared case this
   * targets). A no-op passthrough for OneDrive or when no fallback is configured.
   *
   * Retry safety: a sharing/permission failure surfaces on the FIRST Drive access (resolving the
   * document / redirects file), i.e. before any write in a compound read-then-write op, so
   * re-running the whole `op` on the fallback does not double-apply a write. A future write op that
   * can throw a sharing-matching error AFTER a partial mutation would break that assumption — wrap
   * only its read then.
   * @template T
   * @param {() => Promise<T>} op
   * @returns {Promise<T>}
   */
  async #withGDriveFallback(op) {
    await this.#initClient();
    try {
      return await op();
    } catch (e) {
      const canFallback = this.fallbackConfig && !this.usingFallback
        && this.contentSource?.type === CONTENT_SOURCE_TYPE_DRIVE_GOOGLE
        && isGDriveSharingError(e);
      if (!canFallback) {
        throw e;
      }
      // Keep the raw SDK error out of the warn line (it can carry request URLs / token material and
      // warn logs are long-retained); the detail goes to debug.
      this.log.warn(`ContentClient: primary Google Drive SA (${this.config.client_email}) cannot access content for ${this.site.getId()}; retrying with fallback SA (${this.fallbackConfig.client_email})`);
      this.log.debug(`ContentClient: primary Google Drive SA failure detail for ${this.site.getId()}: ${e.message}`);
      this.usingFallback = true;
      this.rawClient = null;
      await this.#initClient();
      return op();
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

  async #getHelixResourceStatus(path, includeEditUrl = false) {
    const { rso } = this.site.getHlxConfig();
    // https://www.aem.live/docs/admin.html#tag/status,
    let adminEndpointUrl = `https://admin.hlx.page/status/${rso.owner}/${rso.site}/${rso.ref}/${path.replace(/^\/+/, '')}`;
    // ?editUrl=auto for URL of the edit (authoring) document
    adminEndpointUrl = includeEditUrl ? `${adminEndpointUrl}?editUrl=auto` : adminEndpointUrl;
    const response = await fetch(adminEndpointUrl, {
      headers: {
        Authorization: `token ${this.config.helixAdminToken}`,
      },
    });
    if (response.ok) {
      return response.json();
    } else {
      const errorMessage = await response.text();
      throw new Error(`Failed to fetch document path for ${path}: ${errorMessage}`);
    }
  }

  /**
   * @param {string} path
   * @returns {Promise<string>}
   */
  async getResourcePath(path) {
    const helixResourceStatus = await this.#getHelixResourceStatus(path);
    return helixResourceStatus?.resourcePath;
  }

  /**
   * @param {string} path
   * @returns {Promise<{liveURL: string, previewURL: string}>}
   */
  async getLivePreviewURLs(path) {
    const helixResourceStatus = await this.#getHelixResourceStatus(path);
    return {
      liveURL: helixResourceStatus?.live?.url,
      previewURL: helixResourceStatus?.preview?.url,
    };
  }

  /**
   * @param {string} path
   * @returns {Promise<string>}
   */
  async getEditURL(path) {
    const helixResourceStatus = await this.#getHelixResourceStatus(path, true);
    return helixResourceStatus?.edit?.url;
  }

  async getPageMetadata(path) {
    const startTime = process.hrtime.bigint();

    validatePath(path);

    this.log.debug(`Getting page metadata for ${this.site.getId()} and path ${path}`);

    const docPath = this.#resolveDocPath(path);
    const metadata = await this.#withGDriveFallback(async () => {
      const document = await this.rawClient.getDocument(docPath);
      return document.getMetadata();
    });

    this.#logDuration('getPageMetadata', startTime);

    return metadata;
  }

  async updatePageMetadata(path, metadata, options = {}) {
    const { overwrite = true } = options;
    const startTime = process.hrtime.bigint();

    validatePath(path);
    validateMetadata(metadata);

    this.log.debug(`Updating page metadata for ${this.site.getId()} and path ${path}`);

    const docPath = this.#resolveDocPath(path);
    const mergedMetadata = await this.#withGDriveFallback(async () => {
      const document = await this.rawClient.getDocument(docPath);
      const originalMetadata = await document.getMetadata();

      const merged = overwrite
        ? new Map([...originalMetadata, ...metadata])
        : new Map([...metadata, ...originalMetadata]);

      const response = await document.updateMetadata(merged);
      if (response?.status !== 200) {
        throw new Error(`Failed to update metadata for path ${path}: ${response.statusText}`);
      }
      return merged;
    });

    this.#logDuration('updatePageMetadata', startTime);

    return mergedMetadata;
  }

  async getRedirects() {
    const startTime = process.hrtime.bigint();

    this.log.debug(`Getting redirects for ${this.site.getId()}`);

    const redirects = await this.#withGDriveFallback(async () => {
      const redirectsFile = await this.rawClient.getRedirects();
      return redirectsFile.get();
    });
    this.#logDuration('getRedirects', startTime);

    return redirects;
  }

  async updateRedirects(redirects) {
    const startTime = process.hrtime.bigint();

    validateLinks(redirects, 'Redirect');

    this.log.debug(`Updating redirects for ${this.site.getId()}`);

    await this.#withGDriveFallback(async () => {
      const redirectsFile = await this.rawClient.getRedirects();
      const currentRedirects = await redirectsFile.get();
      // validate combination of existing and new redirects
      const cleanNewRedirects = removeDuplicatedRedirects(currentRedirects, redirects, this.log);
      if (cleanNewRedirects.length === 0) {
        this.log.debug('No valid redirects to update');
        return;
      }
      const noCycleRedirects = removeRedirectLoops(currentRedirects, cleanNewRedirects, this.log);
      if (noCycleRedirects.length === 0) {
        this.log.debug('No valid redirects to update');
        return;
      }

      const response = await redirectsFile.append(noCycleRedirects);
      if (response.status !== 200) {
        throw new Error('Failed to update redirects');
      }
    });

    this.#logDuration('updateRedirects', startTime);
  }

  async getDocumentLinks(path) {
    const startTime = process.hrtime.bigint();

    this.log.debug(`Getting document links for ${this.site.getId()} and path ${path}`);

    const docPath = this.#resolveDocPath(path);
    const links = await this.#withGDriveFallback(async () => {
      const document = await this.rawClient.getDocument(docPath);
      return document.getLinks();
    });

    this.#logDuration('getDocumentLinks', startTime);

    return links;
  }

  async updateBrokenInternalLink(path, brokenLink) {
    const startTime = process.hrtime.bigint();

    validateLinks([brokenLink], 'URL');
    validatePath(path);

    this.log.debug(`Updating page link for ${this.site.getId()} and path ${path}`);

    const docPath = this.#resolveDocPath(path);
    await this.#withGDriveFallback(async () => {
      const document = await this.rawClient.getDocument(docPath);

      this.log.debug('Updating link from', brokenLink.from, 'to', brokenLink.to);
      const response = await document.updateLink(brokenLink.from, brokenLink.to);

      if (response.status !== 200) {
        throw new Error(`Failed to update link from ${brokenLink.from} to ${brokenLink.to} // ${brokenLink}`);
      }
    });

    this.#logDuration('updateBrokenInternalLink', startTime);
  }

  async updateImageAltText(path, imageAltText) {
    const startTime = process.hrtime.bigint();

    validatePath(path);
    validateImageAltText(imageAltText);

    this.log.debug(`Updating image alt text for ${this.site.getId()} and path ${path}`);

    const docPath = this.#resolveDocPath(path);
    this.log.debug(`Doc path: ${docPath}`);
    await this.#withGDriveFallback(async () => {
      const document = await this.rawClient.getDocument(docPath);
      this.log.debug(`Document: ${document}`);
      const response = await document.updateImageAltText(imageAltText);
      if (response?.status !== 200) {
        throw new Error(`Failed to update image alt text for path ${path}`);
      }
    });

    this.#logDuration('updateImageAltText', startTime);
  }
}
