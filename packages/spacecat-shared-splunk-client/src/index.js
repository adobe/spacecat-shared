/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { isValidUrl } from '@adobe/spacecat-shared-utils';
import { context as h2, h1 } from '@adobe/fetch';
import { xml2json } from 'xml-js';

/* c8 ignore next 3 */
export const { fetch } = process.env.HELIX_FETCH_FORCE_HTTP1
  ? h1()
  : h2();

export default class SplunkAPIClient {
  static createFrom(context) {
    const {
      SPLUNK_API_BASE_URL: apiBaseUrl,
      SPLUNK_API_USER: apiUser,
      SPLUNK_API_PASS: apiPass,
    } = context.env;
    return new SplunkAPIClient({ apiBaseUrl, apiUser, apiPass }, fetch, context.log);
  }

  constructor(config, fetchAPI, log = console) {
    const { apiBaseUrl, apiUser, apiPass } = config;

    if (!isValidUrl(apiBaseUrl)) {
      throw new Error(`Invalid Splunk API Base URL: ${apiBaseUrl}`);
    }

    if (typeof fetchAPI !== 'function') {
      throw Error('"fetchAPI" must be a function');
    }

    this.apiBaseUrl = apiBaseUrl;
    this.apiUser = apiUser;
    this.apiPass = apiPass;
    this.fetchAPI = fetchAPI;
    this.log = log;
  }

  async login(username = this.apiUser, password = this.apiPass) {
    let returnObj = {};

    try {
      // authenticate and return the session id and cookie for subsequent query
      const loginBody = new URLSearchParams({
        username,
        password,
      });
      const url = `${this.apiBaseUrl}/services/auth/login`;
      const response = await this.fetchAPI(url, {
        method: 'POST',
        headers: { accept: '*/*' },
        body: loginBody,
      });

      if (response.status !== 200) {
        // failed login
        let error = '';
        const responseXML = await response.text();
        const responseJson = xml2json(responseXML, { compact: true });
        // eslint-disable-next-line no-underscore-dangle
        error = JSON.parse(responseJson).response.messages.msg._text;
        // this.log.error(`${loginBody}::${responseXML}`);
        returnObj = { error };
      } else {
        // successful login
        const cookieHeader = response.headers.get('Set-Cookie');
        const cookie = cookieHeader.split(';')[0];

        const responseXML = await response.text();
        const responseJson = xml2json(responseXML, { compact: true });
        // eslint-disable-next-line no-underscore-dangle
        const sessionId = JSON.parse(responseJson).response.sessionKey._text;

        returnObj = {
          sessionId,
          cookie,
        };
      }
    } catch (err) {
      returnObj = { error: err };
    }

    return returnObj;
  }

  // TODO consider changing default duration
  // TODO currently set to last 10 minutes
  // TODO to make it run relatively quickly
  async getNotFounds(minutes = 10, username = this.apiUser, password = this.apiPass) {
    let returnObj = {};

    // login
    const loginObj = await this.login(username, password);

    if (loginObj && loginObj.error) {
      // failed login, do not proceed
      returnObj = loginObj;
      return returnObj;
    } else {
      // successful login, prepare query
      try {
        // query looks for error pages which return a status code of 200
        // which means customers are charged content requests
        // and we can recommend an optimization to change the status code
        const query = 'search (index="dx_aem_engineering" OR index="dx_aem_edge_prod") '
          + `earliest=-${minutes}m@m `
          + 'latest=@m '
          + 'status<300 '
          + 'sourcetype=cdn '
          + 'request!="HEAD" '
          + 'aem_tier=publish '
          + 'aem_envtype IN ("prod",  "") '
          + 'content_type IN ("*html*", "*json*") '
          + 'url IN ("*/403*", "*/404*", "*/error-404", "*/erro-404", "*notfound*", "*not-found*") '
          + '| stats count by aem_service, request_x_forwarded_host, url '
          + '| sort by count desc';

        const queryBody = new URLSearchParams({
          search: query,
          adhoc_search_level: 'fast',
          exec_mode: 'oneshot',
          output_mode: 'json',
        });

        const url = `${this.apiBaseUrl}/servicesNS/admin/search/search/jobs`;
        const response = await this.fetchAPI(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Splunk ${loginObj.sessionId}`,
            Cookie: loginObj.cookie,
          },
          body: queryBody,
        });

        // prepare results
        const responseJson = await response.json();

        returnObj = { results: responseJson.results };
      } catch (err) {
        returnObj = { error: err };
      }
    }

    return returnObj;
  }
}
