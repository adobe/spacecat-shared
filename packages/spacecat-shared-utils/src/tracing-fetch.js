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
import AWSXRay from 'aws-xray-sdk';

import { fetch as adobeFetch } from './adobe-fetch.js';

export async function fetch(url, options = {}) {
  const parentSegment = AWSXRay.getSegment();

  if (!parentSegment) {
    return adobeFetch(url, options);
  }

  const subsegment = parentSegment.addNewSubsegment(`HTTP ${options.method || 'GET'} ${url}`);

  try {
    subsegment.addAnnotation('url', url);
    subsegment.addAnnotation('method', options.method || 'GET');

    const response = await adobeFetch(url, options);

    subsegment.addMetadata('statusCode', response.status);

    subsegment.close();

    return response;
  } catch (error) {
    subsegment.addError(error);
    subsegment.close();

    throw error;
  }
}
