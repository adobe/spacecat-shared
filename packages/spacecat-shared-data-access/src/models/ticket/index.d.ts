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

import type {
  BaseCollection, BaseModel, Organization, Opportunity, TaskManagementConnection, TicketSuggestion,
} from '../index';

export interface Ticket extends BaseModel {
  getCreatedBy(): string;
  getOpportunity(): Promise<Opportunity | null>;
  getOpportunityId(): string | undefined;
  getOrganization(): Promise<Organization>;
  getOrganizationId(): string;
  getTaskManagementConnection(): Promise<TaskManagementConnection>;
  getTaskManagementConnectionId(): string;
  getExternalTicketId(): string;
  getTicketKey(): string;
  getTicketProvider(): string;
  getTicketStatus(): string;
  getTicketSuggestions(): Promise<TicketSuggestion[]>;
  getTicketUrl(): string;

  setTicketStatus(status: string): Ticket;
}

export interface TicketCollection extends BaseCollection<Ticket> {
  allByOrganizationId(organizationId: string): Promise<Ticket[]>;
  allByTaskManagementConnectionId(connectionId: string): Promise<Ticket[]>;
  findByOpportunityId(opportunityId: string): Promise<Ticket | null>;
  findByOpportunityIdAndTicketKey(opportunityId: string, ticketKey: string): Promise<Ticket | null>;
}
