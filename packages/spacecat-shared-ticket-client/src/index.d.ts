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

export interface TicketResult {
  ticketId: string;
  ticketKey: string;
  ticketUrl: string;
  ticketStatus: string | null;
}

export interface TicketData {
  projectKey: string;
  issueType?: string;
  summary: string;
  description?: string;
  labels?: string[];
  priority?: string;
  dueDate?: string;
  components?: string[];
  parent?: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
}

export interface IssueType {
  id: string;
  name: string;
}

export interface Attachment {
  content: Buffer | Uint8Array;
  mimeType: string;
  filename: string;
}

export declare class BaseTicketClient {
  createTicket(ticketData: TicketData): Promise<TicketResult>;
  listProjects(): Promise<Project[]>;
  listIssueTypes(projectId: string): Promise<IssueType[]>;
}

export declare class JiraCloudClient extends BaseTicketClient {
  listProjects(): Promise<Project[]>;
  listIssueTypes(projectId: string): Promise<IssueType[]>;
  uploadAttachment(ticketKey: string, attachment: Attachment): Promise<void>;
}

export declare class OAuthCredentialManager {
  getAuthHeaders(bypassCache?: boolean): Promise<Record<string, string>>;
  refreshAuthHeaders(): Promise<Record<string, string>>;
  forceRefreshAuthHeaders(usedAuthHeader?: string | null): Promise<Record<string, string>>;
  setRequiresReauth(): Promise<void>;
}

export declare class CredentialManagerFactory {
  static create(provider: string, smClient: object, secretPath: string, httpClient: object, log: object): OAuthCredentialManager;
}

export declare class TicketClientFactory {
  static create(connection: object, smClient: object, httpClient: object, log: object): BaseTicketClient;
}

export declare class RateLimitAwareHttpClient {
  constructor(httpClient: object, log: object);
  fetch(url: string, options?: object): Promise<Response>;
}
