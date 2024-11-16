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

class Suggestion extends Base {
  async getOpportunity() {
    return this._getAssociation('OpportunityCollection', 'findById', this.getOpportunityId());
  }

  getOpportunityId() {
    return this.record.opportunityId;
  }

  setOpportunityId(opportunityId) {
    this.patcher.patchString('opportunityId', opportunityId);
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

  getRank() {
    return this.record.rank;
  }

  setRank(rank) {
    this.patcher.patchNumber('rank', rank);
    return this;
  }

  getData() {
    return this.record.data;
  }

  setData(data) {
    this.patcher.patchMap('data', data);
    return this;
  }

  getKpiDeltas() {
    return this.record.kpiDeltas;
  }

  setKpiDeltas(kpiDeltas) {
    this.patcher.patchMap('kpiDeltas', kpiDeltas);
    return this;
  }
}

export default Suggestion;
