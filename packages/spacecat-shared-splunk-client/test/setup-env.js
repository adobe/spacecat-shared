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

console.log('Forcing HTTP/1.1 for Adobe Fetch');
process.env.HELIX_FETCH_FORCE_HTTP1 = 'true';

console.log('Disabling AWS XRay');
process.env.AWS_XRAY_SDK_ENABLED = 'false';
process.env.AWS_XRAY_CONTEXT_MISSING = 'IGNORE_ERROR';
