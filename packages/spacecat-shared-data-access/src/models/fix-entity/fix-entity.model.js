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
import BaseModel from '../base/base.model.js';
import { guardTransition } from '../../util/status-transition-guard.js';
import { isAllowedFixTransition } from './fix-entity.transitions.js';

/**
 * FixEntity - A class representing a FixEntity for a Suggestion.
 * Provides methods to access and manipulate FixEntity-specific data.
 *
 * @class FixEntity
 * @extends BaseModel
 */
class FixEntity extends BaseModel {
  static ENTITY_NAME = 'FixEntity';

  static DEFAULT_UPDATED_BY = 'spacecat';

  static STATUSES = {
    PENDING: 'PENDING', // the fix is pending to be deployed
    DEPLOYED: 'DEPLOYED', // the fix was successfully applied
    PUBLISHED: 'PUBLISHED', // the fix is live in production
    FAILED: 'FAILED', // failed to apply the fix
    ROLLED_BACK: 'ROLLED_BACK', // the fix has been rolled_back
  };

  // reporting is a new origin which is used
  // to denote the fix entities created by the reporting team
  static ORIGINS = {
    SPACECAT: 'spacecat',
    ASO: 'aso',
    REPORTING: 'reporting',
  };

  /**
   * Sets the fix status, guarding the transition against the canonical table
   * (fix-entity.transitions.js). Overrides the auto-generated setter so EVERY
   * writer is checked at one chokepoint. Behavior is governed by
   * STATUS_TRANSITION_ENFORCEMENT (default `warn` — logs violations, still
   * applies; `enforce` — throws ValidationError; `off` — no check).
   *
   * @param {string} value - target status
   * @returns {this}
   */
  setStatus(value) {
    guardTransition({
      entityName: FixEntity.ENTITY_NAME,
      entityId: this.getId(),
      from: this.getStatus(),
      to: value,
      isAllowed: isAllowedFixTransition,
      log: this.log,
    });
    this.patcher.patchValue('status', value, false);
    return this;
  }

  /**
   * Explicit, intention-revealing alias for setStatus for new callers that want
   * to signal a guarded lifecycle transition. Same behavior as setStatus.
   *
   * @param {string} to - target status
   * @returns {this}
   */
  transitionStatus(to) {
    return this.setStatus(to);
  }

  async getSuggestions() {
    const fixEntityCollection = this.entityRegistry.getCollection('FixEntityCollection');
    return fixEntityCollection
      .getSuggestionsByFixEntityId(this.getId());
  }

  /**
   * Removes this FixEntity. When the fix is bound to a specific issue (granular CWV
   * model — `changeDetails.issueId` is set), also rewinds every linked Suggestion so
   * the issue is reopenable: clears `data.issues[issueId].fixEntityId` and resets
   * that issue's status to NEW. The fix row and its junction rows are deleted by the
   * inherited remove flow.
   *
   * Skipped when the fix has no issueId (legacy / non-CWV fixes) — same behavior as
   * before. Also skipped when this method is reached as a dependent cascade (parent
   * removal goes through `_remove()` directly), since the parent teardown moots the
   * per-issue rewind.
   */
  async remove() {
    const issueId = this.record?.changeDetails?.issueId;
    if (issueId) {
      await this.#resetLinkedIssues(issueId);
    }
    return super.remove();
  }

  async #resetLinkedIssues(issueId) {
    const suggestions = await this.getSuggestions();

    await Promise.all(suggestions.map(async (suggestion) => {
      const data = suggestion.getData();
      if (!data || !Array.isArray(data.issues)) {
        return;
      }
      let mutated = false;
      const nextIssues = data.issues.map((issue) => {
        if (issue && issue.id === issueId) {
          mutated = true;
          return { ...issue, status: 'NEW', fixEntityId: null };
        }
        return issue;
      });
      if (!mutated) {
        return;
      }
      suggestion.setData({ ...data, issues: nextIssues });
      await suggestion.save();
    }));
  }
}

export default FixEntity;
