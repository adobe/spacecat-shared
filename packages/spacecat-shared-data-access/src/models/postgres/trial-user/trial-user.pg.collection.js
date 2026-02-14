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
import PostgresTrialUserModel from './trial-user.pg.model.js';

class PostgresTrialUserCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'TrialUserCollection';

  static MODEL_CLASS = PostgresTrialUserModel;
}

export default PostgresTrialUserCollection;
