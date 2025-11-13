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
 * Generates S3 path for Tokowaka configuration
 * @param {string} apiKey - Tokowaka API key
 * @param {boolean} isPreview - Whether this is a preview path
 * @returns {string} - S3 path
 */
export function getTokowakaConfigS3Path(apiKey, isPreview = false) {
  if (isPreview) {
    return `preview/opportunities/${apiKey}`;
  }
  return `opportunities/${apiKey}`;
}
