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

export interface WorkerBinding {
  name: string;
  type: string;
  text?: string;
}

export interface DeployOptions {
  compatibilityDate?: string;
  observability?: boolean;
  overwrite?: boolean;
  tags?: string[];
}

export interface CloudflareAccount {
  id: string;
  name: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
}

export interface WorkerRoute {
  id: string;
  pattern: string;
  script: string;
}

export interface CloudflareClientConfig {
  token: string;
  apiBase?: string;
}

export interface PaginationOptions {
  page?: number;
  perPage?: number;
}

export interface ZoneListOptions extends PaginationOptions {
  accountId?: string;
}

export interface LogpushOwnershipChallenge {
  filename: string;
  valid: boolean;
  message?: string;
}

export interface LogpushOutputOptions {
  field_names?: string[];
  timestamp_format?: string;
  sample_rate?: number;
  [key: string]: unknown;
}

export interface LogpushJob {
  id: number;
  dataset: string;
  enabled: boolean;
  name?: string;
  destination_conf: string;
  output_options?: LogpushOutputOptions;
  frequency?: string;
  last_complete?: string;
  last_error?: string;
  error_message?: string;
  [key: string]: unknown;
}

export interface CreateLogpushJobPayload {
  dataset: string;
  destination_conf: string;
  ownership_challenge: string;
  name?: string;
  output_options?: LogpushOutputOptions;
  enabled?: boolean;
}

export default class CloudflareClient {
  static createFrom(context: object): CloudflareClient;

  constructor(config: CloudflareClientConfig, log?: object);

  listAccounts(options?: PaginationOptions): Promise<CloudflareAccount[]>;

  deployWorkerScript(
    accountId: string,
    scriptName: string,
    scriptContent: string,
    bindings?: WorkerBinding[],
    opts?: DeployOptions,
  ): Promise<object | null>;

  setWorkerSecret(
    accountId: string,
    scriptName: string,
    secretName: string,
    secretValue: string,
  ): Promise<object>;

  listZones(options?: ZoneListOptions): Promise<CloudflareZone[]>;

  getZone(zoneId: string): Promise<CloudflareZone>;

  listRoutes(zoneId: string): Promise<WorkerRoute[]>;

  addRoute(zoneId: string, pattern: string, scriptName: string): Promise<WorkerRoute>;

  deleteRoute(zoneId: string, routeId: string): Promise<object>;

  requestLogpushOwnership(
    zoneId: string,
    destinationConf: string,
  ): Promise<LogpushOwnershipChallenge>;

  listLogpushJobs(zoneId: string, dataset: string): Promise<LogpushJob[]>;

  createLogpushJob(zoneId: string, payload: CreateLogpushJobPayload): Promise<LogpushJob>;
}
