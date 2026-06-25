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

import BaseModel from '../base/base.model.js';

/**
 * Ticket — one Jira issue created by ASO via a TaskManagementConnection.
 *
 * Preserves the provider-side identifiers needed for future operations:
 *   externalTicketId — Jira's internal numeric ID (data.id). Required for PATCH/update calls.
 *   ticketKey      — Human-readable issue key, e.g. 'ASO-42'. Used in UI links.
 *   ticketUrl      — Direct browser URL, e.g. 'https://acme.atlassian.net/browse/ASO-42'.
 *   ticketProvider — Provider that created the ticket (e.g. 'jira_cloud'). Denormalized from
 *                    the connection so the audit record is self-contained even if the connection
 *                    is later deleted.
 *   createdBy      — IMS user ID of the person who initiated ticket creation (JWT sub claim).
 *
 * ticketStatus mirrors the Jira column heading ('To Do', 'In Progress', 'Done').
 * It is updated asynchronously by a future status-sync job (v2); write directly via
 * setTicketStatus() + save() only from that job.
 *
 * v1 scope — intentional deviations from the architecture spec:
 *   - No status_synced_at: Jira webhook status sync is a v2 feature. UI links to ticketUrl
 *     for live status.
 *   - opportunityId is kept as an optional FK on Ticket in addition to the TicketSuggestion
 *     bridge so single-suggestion queries don't require a JOIN.
 *
 * @class Ticket
 * @extends BaseModel
 */
class Ticket extends BaseModel {
  static ENTITY_NAME = 'Ticket';
}

export default Ticket;
