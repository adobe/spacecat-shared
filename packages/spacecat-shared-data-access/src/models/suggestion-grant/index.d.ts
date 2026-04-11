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

import type { BaseCollection, BaseModel } from '../index';

export interface SuggestionGrant extends BaseModel {
  getGrantId(): string;
  getSuggestionId(): string;
  getSiteId(): string;
  getTokenId(): string;
  getTokenType(): string;
  getGrantedAt(): string;
}

export interface SuggestionGrantCollection extends BaseCollection<SuggestionGrant> {
  findBySuggestionIds(suggestionIds: string[]): Promise<{ data: Array<{ suggestion_id: string; grant_id: string }>; error: object | null }>;
  invokeGrantSuggestionsRpc(suggestionIds: string[], siteId: string, tokenType: string, cycle: string): Promise<{ data: Array | null; error: object | null }>;
  splitSuggestionsByGrantStatus(suggestionIds: string[]): Promise<{ grantedIds: string[]; notGrantedIds: string[]; grantIds: string[] }>;
  isSuggestionGranted(suggestionId: string): Promise<boolean>;
  grantSuggestions(suggestionIds: string[], siteId: string, tokenType: string): Promise<{ success: boolean; reason?: string; grantedSuggestions?: Array }>;
}
