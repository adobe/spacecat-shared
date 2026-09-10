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

export const TARGET_USER_AGENTS_CATEGORIES = {
  AI_BOTS: 'ai-bots',
  BOTS: 'bots',
  ALL: 'all',
};

// Response headers that prove a request was routed through the Edge Optimize layer -- either
// name means the same thing (x-tokowaka-request-id is the older name, x-edgeoptimize-request-id
// the current one; both are still set by real edge configs). Checked independently in
// RoutingValidator, verifyRouting, and index.js's edge-optimize-status probe -- all three must
// stay in sync since they answer the same question ("is this URL routed through the edge-optimize
// layer?").
export const EDGE_OPTIMIZE_REQUEST_ID_HEADERS = ['x-tokowaka-request-id', 'x-edgeoptimize-request-id'];
