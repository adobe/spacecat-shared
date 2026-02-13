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

import PostgresBaseModel from '../base/postgres-base.model.js';

class PostgresSentimentTopicModel extends PostgresBaseModel {
  static ENTITY_NAME = 'SentimentTopic';

  addSubPrompt(prompt) {
    const subPrompts = this.getSubPrompts?.() ?? this.subPrompts ?? [];
    const updated = [...subPrompts, prompt];
    if (this.setSubPrompts) {
      this.setSubPrompts(updated);
    } else {
      this.subPrompts = updated;
    }
    return this;
  }

  removeSubPrompt(prompt) {
    const subPrompts = this.getSubPrompts?.() ?? this.subPrompts ?? [];
    const filtered = subPrompts.filter((p) => p !== prompt);
    if (this.setSubPrompts) {
      this.setSubPrompts(filtered);
    } else {
      this.subPrompts = filtered;
    }
    return this;
  }

  generateCompositeKeys() {
    return {
      siteId: this.getSiteId(),
      topicId: this.getTopicId(),
    };
  }
}

export default PostgresSentimentTopicModel;
