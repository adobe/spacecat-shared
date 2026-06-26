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
  ): Promise<object>;

  setWorkerSecret(
    accountId: string,
    scriptName: string,
    secretName: string,
    secretValue: string,
  ): Promise<object>;

  listZones(options?: ZoneListOptions): Promise<CloudflareZone[]>;

  listRoutes(zoneId: string): Promise<WorkerRoute[]>;

  addRoute(zoneId: string, pattern: string, scriptName: string): Promise<WorkerRoute>;

  deleteRoute(zoneId: string, routeId: string): Promise<object>;
}
