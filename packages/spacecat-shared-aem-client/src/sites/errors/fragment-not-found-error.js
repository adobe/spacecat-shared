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

import { AemClientError } from '../../errors/aem-client-error.js';

/**
 * Error thrown when a content fragment cannot be found at the specified path.
 */
export class FragmentNotFoundError extends AemClientError {
  /**
   * Creates a new FragmentNotFoundError.
   * @param {string} fragmentPath - The path where the fragment was expected.
   */
  constructor(fragmentPath) {
    super(`Fragment not found at path: ${fragmentPath}`, 404, 'FRAGMENT_NOT_FOUND');
    this.name = 'FragmentNotFoundError';
    this.fragmentPath = fragmentPath;
  }
}
