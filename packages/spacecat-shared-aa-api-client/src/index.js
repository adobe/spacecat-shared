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
import { fetch } from './utils.js';
import { stringToUint8Array } from './helpers.js';

const AA_SCOPE = 'openid,AdobeID,additional_info.projectedProductContext';
const IMS_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const AA_URL = 'https://analytics-collection.adobe.io/aa/collect/v1';
function createBoundary() {
  return `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
}

function createMultipartBody(archiveBuffer, zipPath, boundary) {
  const uint8ArrayGzipData = new Uint8Array(archiveBuffer);
  const contentDisposition = `Content-Disposition: form-data; name="file"; filename="${zipPath}"`;
  const preData = `--${boundary}\r\n${contentDisposition}\r\nContent-Type: application/gzip\r\n\r\n`;
  const postData = `\r\n--${boundary}--`;

  const preDataArray = stringToUint8Array(preData);
  const postDataArray = stringToUint8Array(postData);

  const body = new Uint8Array(preDataArray.length + uint8ArrayGzipData.length
      + postDataArray.length);
  body.set(preDataArray);
  body.set(uint8ArrayGzipData, preDataArray.length);
  body.set(postDataArray, preDataArray.length + uint8ArrayGzipData.length);

  return body;
}
export default class AAAPIClient {
  #config;

  #token;

  #domain;

  constructor(config) {
    ['AA_CLIENT_ID', 'AA_CLIENT_SECRET', 'AA_DOMAIN'].forEach((key) => {
      if (!config[key]) {
        throw new Error(`Missing required config: ${key}`);
      }
    });
    this.#config = config;
    this.#token = null;
    this.#domain = config.AA_DOMAIN;
  }

  static async create(context) {
    if (context.aaApiClient) {
      return context.aaApiClient;
    }
    context.aaApiClient = new AAAPIClient({ ...context.env });
    await context.aaApiClient.#getIMSAccessToken();
    return context.aaApiClient;
  }

  // eslint-disable-next-line class-methods-use-this
  async #post(url, headers, body) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });
      if (!response.ok) {
        throw new Error(`POST request failed with status ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      throw new Error(`Error during POST request: ${err.message}`);
    }
  }

  async #getIMSAccessToken() {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const body = `client_id=${this.#config.AA_CLIENT_ID}&client_secret=${this.#config.AA_CLIENT_SECRET}&grant_type=client_credentials&scope=${AA_SCOPE}`;
    const token = await this.#post(IMS_URL, headers, body);
    this.#token = token.access_token;
    return this.#token;
  }

  async validateFileFormat(archiveBuffer, zipPath) {
    const boundary = createBoundary();
    const headers = {
      accept: 'application/json',
      Authorization: `Bearer ${this.#token}`,
      'x-api-key': this.#config.AA_CLIENT_ID,
      'x-adobe-vgid': `rum2aa_${this.#domain}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    };
    const multipartBody = createMultipartBody(archiveBuffer, zipPath, boundary);

    return this.#post(`${AA_URL}/events/validate`, headers, multipartBody);
  }

  async ingestEvents(archiveBuffer, zipPath) {
    const boundary = createBoundary();
    const headers = {
      accept: 'application/json',
      Authorization: `Bearer ${this.#token}`,
      'x-api-key': this.#config.AA_CLIENT_ID,
      'x-adobe-vgid': `rum2aa_${this.#domain}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    };
    const multipartBody = createMultipartBody(archiveBuffer, zipPath, boundary);
    return this.#post(`${AA_URL}/events`, headers, multipartBody);
  }
}
