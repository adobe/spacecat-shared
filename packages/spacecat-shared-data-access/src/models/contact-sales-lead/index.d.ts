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
  BaseCollection, BaseModel, Organization,
} from '../index';

export type ContactSalesLeadStatus = 'NEW' | 'CONTACTED' | 'CLOSED';

export interface ContactSalesLead extends BaseModel {
  getName(): string;
  getEmail(): string;
  getDomain(): string | null;
  getSiteId(): string | null;
  getNotes(): string | null;
  getStatus(): ContactSalesLeadStatus;
  getOrganization(): Promise<Organization>;
  setName(name: string): ContactSalesLead;
  setEmail(email: string): ContactSalesLead;
  setDomain(domain: string): ContactSalesLead;
  setSiteId(siteId: string): ContactSalesLead;
  setNotes(notes: string): ContactSalesLead;
  setStatus(status: ContactSalesLeadStatus): ContactSalesLead;
}

export interface ContactSalesLeadCollection extends BaseCollection<ContactSalesLead> {
  allByOrganizationId(organizationId: string): Promise<ContactSalesLead[]>;
  allByEmail(email: string): Promise<ContactSalesLead[]>;
  findByOrganizationId(organizationId: string): Promise<ContactSalesLead | null>;
  findByEmail(email: string): Promise<ContactSalesLead | null>;
}
