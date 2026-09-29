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
 * Domain event emitted when an entitlement's tier transitions (including a fresh create).
 * See docs/adr/0002-entitlement-tier-changed-event.md for the target-architecture rationale.
 * @type {string}
 */
export const ENTITLEMENT_TIER_CHANGED = 'entitlement.tier_changed';

/**
 * Context key holding the SQS queue URL that `entitlement.tier_changed` events are published to.
 * When this env var is absent, emission is a no-op (opt-in).
 * @type {string}
 */
export const ENTITLEMENT_EVENTS_QUEUE_URL_KEY = 'ENTITLEMENT_EVENTS_QUEUE_URL';
