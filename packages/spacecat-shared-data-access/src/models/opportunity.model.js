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

import Base from './base.model.js';

class Opportunity extends Base {
  async getSuggestions() {
    return this._getAssociation(
      'SuggestionCollection',
      'allByOpportunityId',
      this.getId(),
    );
  }

  getSiteId() {
    return this.record.siteId;
  }

  setSiteId(siteId) {
    this.patcher.patchString('siteId', siteId);
    return this;
  }

  getAuditId() {
    return this.record.auditId;
  }

  setAuditId(auditId) {
    this.patcher.patchId('auditId', auditId);
    return this;
  }

  getRunbook() {
    return this.record.runbook;
  }

  setRunbook(runbook) {
    this.patcher.patchString('runbook', runbook);
    return this;
  }

  getGuidance() {
    return this.record.guidance;
  }

  setGuidance(guidance) {
    this.patcher.patchString('guidance', guidance);
    return this;
  }

  getTitle() {
    return this.record.title;
  }

  setTitle(title) {
    this.patcher.patchString('title', title);
    return this;
  }

  getDescription() {
    return this.record.description;
  }

  setDescription(description) {
    this.patcher.patchString('description', description);
    return this;
  }

  getType() {
    return this.record.type;
  }

  getStatus() {
    return this.record.status;
  }

  setStatus(status) {
    this.patcher.patchEnum('status', status);
    return this;
  }

  getOrigin() {
    return this.record.origin;
  }

  setOrigin(origin) {
    this.patcher.patchString('origin', origin);
    return this;
  }

  getTags() {
    return this.record.tags;
  }

  setTags(tags) {
    this.patcher.patchSet('tags', tags);
    return this;
  }

  getData() {
    return this.record.data;
  }

  setData(data) {
    this.patcher.patchMap('data', data);
    return this;
  }
}

export default Opportunity;
