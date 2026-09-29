/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect } from 'chai';
import {
  OPPORTUNITY_SEMANTIC_SOURCE_TYPES,
  OPPORTUNITY_SEMANTIC_ENTITY_TYPES,
  SUGGESTION_SEMANTIC_SOURCE_TYPES,
  SUGGESTION_SEMANTIC_ENTITY_TYPES,
} from '../src/constants.js';

describe('semantic lookup type registries', () => {
  it('lists the opportunity source and entity types', () => {
    expect(OPPORTUNITY_SEMANTIC_SOURCE_TYPES).to.deep.equal({ TOPIC: 'topic' });
    expect(OPPORTUNITY_SEMANTIC_ENTITY_TYPES).to.deep.equal({
      CITED_ANALYSIS: 'cited-analysis',
      REDDIT_ANALYSIS: 'reddit-analysis',
      YOUTUBE_ANALYSIS: 'youtube-analysis',
    });
  });

  it('lists the suggestion source and entity types', () => {
    expect(SUGGESTION_SEMANTIC_SOURCE_TYPES).to.deep.equal({ TOPIC: 'topic', TITLE: 'title' });
    expect(SUGGESTION_SEMANTIC_ENTITY_TYPES).to.deep.equal({
      CITED_ANALYSIS: 'cited-analysis',
      REDDIT_ANALYSIS: 'reddit-analysis',
      YOUTUBE_ANALYSIS: 'youtube-analysis',
    });
  });

  it('freezes every registry', () => {
    [
      OPPORTUNITY_SEMANTIC_SOURCE_TYPES,
      OPPORTUNITY_SEMANTIC_ENTITY_TYPES,
      SUGGESTION_SEMANTIC_SOURCE_TYPES,
      SUGGESTION_SEMANTIC_ENTITY_TYPES,
    ].forEach((registry) => expect(Object.isFrozen(registry)).to.equal(true));
  });
});
