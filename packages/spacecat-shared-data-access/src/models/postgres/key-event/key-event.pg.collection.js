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

import PostgresBaseCollection from '../base/postgres-base.collection.js';
import DataAccessError from '../../../errors/data-access.error.js';

class PostgresKeyEventCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'KeyEventCollection';

  #throwDeprecated() {
    throw new DataAccessError('KeyEvent is deprecated in data-access v3', this);
  }

  async all() { return this.#throwDeprecated(); }

  async allByIndexKeys() { return this.#throwDeprecated(); }

  async findById() { return this.#throwDeprecated(); }

  async findByIndexKeys() { return this.#throwDeprecated(); }

  async create() { return this.#throwDeprecated(); }

  async createMany() { return this.#throwDeprecated(); }

  async removeByIds() { return this.#throwDeprecated(); }

  async removeByIndexKeys() { return this.#throwDeprecated(); }
}

export default PostgresKeyEventCollection;
