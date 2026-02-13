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

import { createDataAccess } from './service/index.js';

export * from './service/index.js';

const POSTGREST_URL = 'http://localhost:3000';

/**
 * Wrapper for data access layer
 * @param {function} fn - The function to wrap
 * @returns {function} - The wrapped function
 */
export default function dataAccessWrapper(fn) {
  /**
   * Wrapper for data access layer. This wrapper will create a data access layer if it is not
   * already created. It requires the context to have a log object. It will also use the
   * POSTGREST_URL environment variable to create the data access layer.
   * Optionally, it will use the ENV and AWS_REGION environment variables
   *
   * @param {object} request - The request object
   * @param {object} context - The context object
   * @returns {Promise<object>} - The wrapped function
   */
  return async (request, context) => {
    if (!context.dataAccess) {
      const { log } = context;

      const {
        POSTGREST_URL: postgrestUrl = POSTGREST_URL,
        POSTGREST_SCHEMA: postgrestSchema,
        POSTGREST_API_KEY: postgrestApiKey,
        S3_CONFIG_BUCKET: s3Bucket,
        AWS_REGION: region,
      } = context.env;

      context.dataAccess = createDataAccess({
        postgrestUrl,
        postgrestSchema,
        postgrestApiKey,
        s3Bucket,
        region,
      }, log);
    }

    return fn(request, context);
  };
}
