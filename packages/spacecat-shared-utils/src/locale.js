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
 * (h1() or h2() based on HELIX_FETCH_FORCE_HTTP1) at module load time, before any
 * detectLocale() call is made. In a VPC Lambda with restricted egress or no NAT gateway,
 * this can cause a silent hang at import time. Ensure your Lambda has outbound internet
 * access before importing this module.
 */
export { detectLocale } from './locale-detect/locale-detect.js';
