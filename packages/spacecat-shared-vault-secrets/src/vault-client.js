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

const TOKEN_RENEW_BUFFER = 5 * 60 * 1000;

export default class VaultClient {
  #vaultAddr;

  #mountPoint;

  #token;

  #tokenExpiry;

  #tokenRenewable;

  constructor({ vaultAddr, mountPoint } = {}) {
    if (!vaultAddr) {
      throw new Error('vaultAddr is required');
    }
    if (!mountPoint) {
      throw new Error('mountPoint is required');
    }
    this.#vaultAddr = vaultAddr.replace(/\/+$/, '');
    this.#mountPoint = mountPoint;
    this.#token = null;
    this.#tokenExpiry = null;
    this.#tokenRenewable = false;
  }

  get vaultAddr() {
    return this.#vaultAddr;
  }

  get mountPoint() {
    return this.#mountPoint;
  }

  get token() {
    return this.#token;
  }

  get tokenRenewable() {
    return this.#tokenRenewable;
  }

  get tokenExpiry() {
    return this.#tokenExpiry;
  }

  isAuthenticated() {
    if (!this.#token) return false;
    if (this.#tokenExpiry && Date.now() >= this.#tokenExpiry) return false;
    return true;
  }

  async authenticate(roleId, secretId) {
    let response;
    try {
      response = await fetch(`${this.#vaultAddr}/v1/auth/approle/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
      });
    } catch (err) {
      throw new Error(`Vault authentication request failed: ${err.message}`);
    }

    if (!response.ok) {
      throw new Error(`Vault authentication failed: ${response.status}`);
    }

    const body = await response.json();
    const { auth } = body;
    this.#token = auth.client_token;
    this.#tokenRenewable = auth.renewable;
    this.#tokenExpiry = Date.now() + auth.lease_duration * 1000;
  }

  async #request(method, path) {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }
    const url = `${this.#vaultAddr}/v1/${this.#mountPoint}/${path}`;
    return fetch(url, {
      method,
      headers: { 'X-Vault-Token': this.#token },
    });
  }

  async readSecret(path) {
    const response = await this.#request('GET', `data/${path}`);

    if (response.status === 404) {
      throw new Error(`Secret not found: ${path}`);
    }
    if (!response.ok) {
      throw new Error(`Vault read failed: ${response.status}`);
    }

    const body = await response.json();
    return body.data.data;
  }

  isTokenExpiringSoon() {
    if (!this.isAuthenticated()) return false;
    return (this.#tokenExpiry - Date.now()) <= TOKEN_RENEW_BUFFER;
  }

  async renewToken() {
    try {
      const response = await fetch(`${this.#vaultAddr}/v1/auth/token/renew-self`, {
        method: 'POST',
        headers: { 'X-Vault-Token': this.#token },
      });
      if (response.ok) {
        const body = await response.json();
        const { auth } = body;
        this.#tokenExpiry = Date.now() + auth.lease_duration * 1000;
        this.#tokenRenewable = auth.renewable;
      }
    } catch {
      // Silent failure - renewal is best-effort
    }
  }

  async getLastChangedDate(path) {
    try {
      const response = await this.#request('GET', `metadata/${path}`);
      if (!response.ok) {
        return 0;
      }
      const body = await response.json();
      return new Date(body.data.updated_time).getTime();
    } catch {
      return 0;
    }
  }
}
