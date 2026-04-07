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

/**
 * Computes which audit types are pending vs completed from already-fetched audit records.
 *
 * The onboardStartTime anchor is the same value written to onboardConfig.lastStartTime
 * in the site config by the api-service and passed via SQS/step function message to the
 * task-processor. Callers supply it from whichever source is available to them.
 *
 * An audit is pending if:
 *   - No DB record exists for it yet, OR
 *   - Its auditedAt timestamp predates or ties with onboardStartTime (<=).
 *     An exact match indicates an in-flight audit captured before the run completed.
 *
 * If onboardStartTime is absent (site onboarded before this feature), any existing
 * record is treated as completed — only a missing record counts as pending.
 *
 * Pure function — no DB calls.
 *
 * @param {string[]} auditTypes - Audit types to check
 * @param {number|undefined} onboardStartTime - Onboard start timestamp in ms
 * @param {Array} latestAudits - Already-fetched audit records (getAuditType, getAuditedAt)
 * @returns {{ pendingAuditTypes: string[], completedAuditTypes: string[] }}
 */
export function computeAuditCompletion(auditTypes, onboardStartTime, latestAudits) {
  const pendingAuditTypes = [];
  const completedAuditTypes = [];
  const auditsByType = {};

  if (latestAudits) {
    for (const audit of latestAudits) {
      auditsByType[audit.getAuditType()] = audit;
    }
  }

  for (const auditType of auditTypes) {
    const audit = auditsByType[auditType];
    if (!audit) {
      pendingAuditTypes.push(auditType);
    } else if (onboardStartTime) {
      const auditedAt = new Date(audit.getAuditedAt()).getTime();
      // NaN or timestamp predating/matching trigger → pending
      if (Number.isNaN(auditedAt) || auditedAt <= onboardStartTime) {
        pendingAuditTypes.push(auditType);
      } else {
        completedAuditTypes.push(auditType);
      }
    } else {
      // No onboard start time — treat existing record as completed.
      completedAuditTypes.push(auditType);
    }
  }

  return { pendingAuditTypes, completedAuditTypes };
}
