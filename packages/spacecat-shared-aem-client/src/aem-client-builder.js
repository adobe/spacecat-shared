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

import { AemBaseClient } from './aem-client-base.js';
import { FragmentManagement, FragmentVersioning, FragmentTagging } from './sites/index.js';

/**
 * @typedef {Object} BuiltAemClient
 * @property {AemBaseClient} client - The base client for direct API access.
 * @property {FragmentManagement|null} management - Fragment management capability or null.
 * @property {FragmentVersioning|null} versioning - Fragment versioning capability or null.
 * @property {FragmentTagging|null} tagging - Fragment tagging capability or null.
 */

/**
 * Builder for creating AEM client instances with selected capabilities.
 *
 * Provides a interface for constructing an AEM client with only
 * the required functionality.
 *
 * @example
 * const client = AemClientBuilder.create(context)
 *   .withManagement()
 *   .withVersioning()
 *   .build();
 *
 * const id = await client.management.resolveFragmentId('/content/dam/fragment');
 * await client.versioning.createVersion(id, { label: 'v1' });
 */
export class AemClientBuilder {
  #client;

  #management = null;

  #versioning = null;

  #tagging = null;

  /**
   * Creates a new AemClientBuilder instance.
   * @param {AemBaseClient} client - The client providing request capabilities.
   */
  constructor(client) {
    this.#client = client;
  }

  /**
   * Factory method to create an AemClientBuilder from a context object.
   * @param {object} context - The execution context.
   * @param {object} context.site - Site object with getDeliveryConfig() method.
   * @param {object} context.env - Environment variables containing IMS configuration.
   * @param {object} [context.log=console] - Logger instance.
   * @returns {AemClientBuilder} A new builder instance.
   */
  static create(context) {
    return new AemClientBuilder(AemBaseClient.createFrom(context));
  }

  /**
   * Adds fragment management capabilities.
   * @returns {AemClientBuilder} This builder for chaining.
   */
  withManagement() {
    this.#management = new FragmentManagement(this.#client);
    return this;
  }

  /**
   * Adds fragment versioning capabilities.
   * @returns {AemClientBuilder} This builder for chaining.
   */
  withVersioning() {
    this.#versioning = new FragmentVersioning(this.#client);
    return this;
  }

  /**
   * Adds fragment tagging capabilities.
   * @returns {AemClientBuilder} This builder for chaining.
   */
  withTagging() {
    this.#tagging = new FragmentTagging(this.#client);
    return this;
  }

  /**
   * Builds the AEM client with the selected capabilities.
   * @returns {BuiltAemClient} The built client with client and capability properties.
   */
  build() {
    return {
      client: this.#client,
      management: this.#management,
      versioning: this.#versioning,
      tagging: this.#tagging,
    };
  }
}
