/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { createDataAccess } from './v2/index.js';

const TABLE_NAME_DATA = 'spacecat-services-data-dev';

export default function dataAccessWrapper(fn) {
  return async (request, context) => {
    if (!context.dataAccess) {
      const { log } = context;

      const {
        DYNAMO_TABLE_NAME_DATA = TABLE_NAME_DATA,
      } = context.env;

      context.dataAccess = createDataAccess({
        tableNameData: DYNAMO_TABLE_NAME_DATA,
      }, log);
    }

    return fn(request, context);
  };
}

export * from './v2/index.js';
