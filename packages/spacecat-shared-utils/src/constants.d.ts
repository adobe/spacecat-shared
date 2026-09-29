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

export { OPPORTUNITY_TYPES, DEFAULT_CPC_VALUE } from './index.js';

export const OPPORTUNITY_SEMANTIC_SOURCE_TYPES: Readonly<{
  TOPIC: 'topic';
}>;

export const OPPORTUNITY_SEMANTIC_ENTITY_TYPES: Readonly<{
  CITED_ANALYSIS: 'cited-analysis';
  REDDIT_ANALYSIS: 'reddit-analysis';
  YOUTUBE_ANALYSIS: 'youtube-analysis';
}>;

export const SUGGESTION_SEMANTIC_SOURCE_TYPES: Readonly<{
  TOPIC: 'topic';
  TITLE: 'title';
}>;

export const SUGGESTION_SEMANTIC_ENTITY_TYPES: Readonly<{
  CITED_ANALYSIS: 'cited-analysis';
  REDDIT_ANALYSIS: 'reddit-analysis';
  YOUTUBE_ANALYSIS: 'youtube-analysis';
}>;
