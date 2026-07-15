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

import { hasText, tracingFetch as fetch } from '@adobe/spacecat-shared-utils';
import { ImsClient } from '@adobe/spacecat-shared-ims-client';

/**
 * Client for the Adobe Cloud Manager (SSG) Management API.
 *
 * This is distinct from the git-operations {@link CloudManagerClient}: it does
 * not clone/push repositories. It performs read-only lookups against the CM
 * Management API — pipelines, repositories, and programs — to resolve a site's
 * source-code coordinates (owner/repo/ref/type) and IMS org during onboarding.
 *
 * Auth is OAuth Server-to-Server (client_credentials): the CM API client
 * credentials are exchanged with Adobe IMS for a short-lived access token via
 * {@link ImsClient#getServiceAccessTokenV3}. Every request carries the Bearer
 * token plus `x-api-key` (client id) and `x-gw-ims-org-id` headers.
 *
 * The Management API is reachable from SpaceCat only over the private
 * `*.private.adobe.io` endpoint via MCT (SITES-41140) — configure `CM_API_BASE`
 * to the environment's private endpoint (e.g.
 * `https://ssg-stage.private.adobe.io/api` for dev/stage,
 * `https://ssg.private.adobe.io/api` for prod).
 */
export default class CloudManagerApiClient {
  /**
   * Creates a CloudManagerApiClient from a Universal context.
   *
   * Required `context.env` (names match the CM credentials bundle in Vault):
   * - `CM_CLIENT_ID`        — CM API OAuth client id (also sent as `x-api-key`)
   * - `CM_CLIENT_SECRET`    — CM API OAuth client secret
   * - `CM_SCOPES`           — CM API OAuth scopes (space/comma separated)
   * - `CM_IMS_ORG_ID`       — IMS org id (sent as `x-gw-ims-org-id`)
   * - `CM_PRIVATE_API_URL`  — CM Management API base URL (host only, no `/api`;
   *                           e.g. `https://ssg-stage.private.adobe.io` for
   *                           dev/stage, `https://ssg.private.adobe.io` for prod)
   * - `IMS_HOST`            — IMS host for the token exchange
   *
   * @param {Object} context - Universal function context
   * @returns {CloudManagerApiClient}
   */
  static createFrom(context) {
    const { log = console } = context;
    const {
      CM_CLIENT_ID: clientId,
      CM_CLIENT_SECRET: clientSecret,
      CM_SCOPES: scopes,
      CM_IMS_ORG_ID: imsOrgId,
      CM_PRIVATE_API_URL: baseUrl,
      IMS_HOST: imsHost,
    } = context.env;

    if (!hasText(clientId) || !hasText(clientSecret) || !hasText(scopes)
      || !hasText(imsOrgId) || !hasText(baseUrl) || !hasText(imsHost)) {
      throw new Error('CloudManagerApiClient requires CM_CLIENT_ID, CM_CLIENT_SECRET,'
        + ' CM_SCOPES, CM_IMS_ORG_ID, CM_PRIVATE_API_URL, and IMS_HOST.');
    }

    // Dedicated ImsClient for the CM API credentials (client_credentials grant).
    // Constructed directly (not via ImsClient.createFrom) because that flow is
    // authorization_code and requires an IMS_CLIENT_CODE we do not have here.
    const imsClient = new ImsClient({
      imsHost,
      clientId,
      clientSecret,
      scope: scopes,
    }, log);

    return new CloudManagerApiClient({
      clientId,
      imsOrgId,
      baseUrl: baseUrl.replace(/\/+$/, ''),
    }, imsClient, log);
  }

  constructor(config, imsClient, log = console) {
    this.config = config;
    this.imsClient = imsClient;
    this.log = log;
  }

  /**
   * Performs an authenticated GET against the CM Management API.
   * @param {string} pathSuffix - Path appended to the API base (e.g. `/program/123`)
   * @returns {Promise<Object>} Parsed JSON response
   */
  async #get(pathSuffix) {
    const { access_token: token } = await this.imsClient.getServiceAccessTokenV3();
    // CM_PRIVATE_API_URL is the host only; the Management API lives under `/api`.
    const url = `${this.config.baseUrl}/api${pathSuffix}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': this.config.clientId,
        'x-gw-ims-org-id': this.config.imsOrgId,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const body = await response.text();
      const detail = hasText(body) ? ` - ${body.slice(0, 200)}` : '';
      throw new Error(`CM API request failed: GET ${pathSuffix} -> HTTP ${response.status}${detail}`);
    }
    return response.json();
  }

  /**
   * Finds the production pipeline (CI/CD with buildTarget STAGE_PROD, else PROD)
   * and returns the repository id and branch from its BUILD phase.
   * @param {string} programId - CM Program ID
   * @returns {Promise<{repositoryId: string, branch: string}>}
   */
  async getProductionPipeline(programId) {
    const data = await this.#get(`/program/${programId}/pipelines`);
    // eslint-disable-next-line no-underscore-dangle
    const pipelines = data?._embedded?.pipelines || [];
    const prod = pipelines.find((p) => p.type === 'CI_CD' && p.buildTarget === 'STAGE_PROD')
      || pipelines.find((p) => p.type === 'CI_CD' && p.buildTarget === 'PROD');
    if (!prod) {
      throw new Error(`No production pipeline (CI_CD/STAGE_PROD|PROD) found for program ${programId}`);
    }
    const buildPhase = (prod.phases || []).find((ph) => ph.type === 'BUILD');
    if (!buildPhase) {
      throw new Error(`No BUILD phase found in production pipeline for program ${programId}`);
    }
    const { repositoryId, branch } = buildPhase;
    if (!repositoryId || !branch) {
      throw new Error(`repositoryId or branch missing in BUILD phase for program ${programId}`);
    }
    return { repositoryId: String(repositoryId), branch };
  }

  /**
   * Fetches repository details.
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @returns {Promise<{url: string, type: string}>}
   */
  async getRepository(programId, repositoryId) {
    const data = await this.#get(`/program/${programId}/repository/${repositoryId}`);
    return { url: data?.repositoryUrl || '', type: data?.type || '' };
  }

  /**
   * Fetches program details (used for the customer's IMS org id).
   * @param {string} programId - CM Program ID
   * @returns {Promise<{imsOrgId: string}>}
   */
  async getProgram(programId) {
    const data = await this.#get(`/program/${programId}`);
    return { imsOrgId: data?.imsOrgId || '' };
  }

  /**
   * Resolves the full code config for a program: production pipeline repo/branch
   * plus repository url/type. Returned shape matches `site.code`.
   * @param {string} programId - CM Program ID
   * @returns {Promise<{owner: string, repo: string, type: string, url: string, ref: string}>}
   */
  async resolveCodeConfig(programId) {
    const { repositoryId, branch } = await this.getProductionPipeline(programId);
    const { url, type } = await this.getRepository(programId, repositoryId);
    return {
      owner: String(programId),
      repo: repositoryId,
      type,
      url,
      ref: branch,
    };
  }
}
