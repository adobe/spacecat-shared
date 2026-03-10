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

import BaseModel from '../base/base.model.js';

/**
 * SentimentTopic - A class representing a sentiment analysis topic.
 * Topics define what to analyze (e.g., "BMW XM Latest", "2026 Corvette Stingray").
 *
 * @class SentimentTopic
 * @extends BaseModel
 */
class SentimentTopic extends BaseModel {
  static ENTITY_NAME = 'SentimentTopic';

  /**
   * Generates the composite keys for remove/update operations.
   * Required for entities with composite primary keys.
   * @returns {Object} - The composite keys (siteId + topicId).
   */
  generateCompositeKeys() {
    return {
      siteId: this.getSiteId(),
      topicId: this.getTopicId(),
    };
  }
}

export default SentimentTopic;
