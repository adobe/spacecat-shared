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

import type { BaseCollection, BaseModel } from '../index';

export interface OAuthNonce extends BaseModel {
  getNonce(): string;
  getExpiresAt(): string;
}

export interface OAuthNonceCollection extends BaseCollection<OAuthNonce> {
  /**
   * Atomically deletes a nonce by its value.
   * Returns the number of rows deleted (1 = consumed, 0 = not found or already consumed).
   */
  delete(keys: { nonce: string }): Promise<number>;
}
