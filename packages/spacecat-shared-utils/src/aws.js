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

/**
 * @sideeffect Importing this module initializes the @adobe/fetch HTTP connection pool
 * (h1() or h2() based on HELIX_FETCH_FORCE_HTTP1) at module load time via adobe-fetch.js,
 * before any fetch() call is made. In a VPC Lambda with restricted egress or no NAT gateway,
 * this can cause a silent hang at import time. Ensure your Lambda has outbound internet
 * access before importing this module.
 */
export { s3Wrapper, getObjectFromKey } from './s3.js';
export { sqsWrapper, sqsEventAdapter } from './sqs.js';
export { instrumentAWSClient, getTraceId, addTraceIdHeader } from './xray.js';
export { logWrapper } from './log-wrapper.js';
export { isAWSLambda } from './runtimes.js';
export { fetch, resetFetchContext, clearFetchCache } from './adobe-fetch.js';
export { tracingFetch, SPACECAT_USER_AGENT } from './tracing-fetch.js';
export { getStoredMetrics, storeMetrics, calculateCPCValue } from './metrics-store.js';
