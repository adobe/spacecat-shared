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

export function normalizeDomain(domain: string): string;

export function defaultRuleHasCaching(ruleTree: object): boolean;

export interface DefaultOriginSsl {
  verificationMode?: string;
  originCertsToHonor?: string;
  standardCertificateAuthorities?: string[];
}

export function getDefaultOriginSsl(ruleTree: object): DefaultOriginSsl | null;

export interface AkamaiClientConfig {
  host: string;
  clientToken: string;
  clientSecret: string;
  accessToken: string;
  accountSwitchKey?: string;
  notifyEmails?: string[];
  /** Timeout (ms) for calls whose latency scales with rule-tree size (getRuleTree,
   * updateRuleTree, patchRuleTree). Defaults to 60000, above tracingFetch's generic 10s default
   * used by every other (cheap, metadata-only) call. */
  ruleTreeTimeoutMs?: number;
}

export interface PropertyMatch {
  propertyId: string;
  propertyName?: string;
  contractId?: string;
  groupId?: string;
  propertyVersion?: number;
  productionStatus?: string;
  stagingStatus?: string;
  matchedOn: string[];
  matchedValues: string[];
}

export interface RuleTreeResult {
  ruleTree: object;
  ruleFormat?: string;
  etag?: string;
  /** Present when getRuleTree is called with { validateRules: true }. */
  errors?: object[];
  warnings?: object[];
}

export type Network = 'STAGING' | 'PRODUCTION';

export interface Activation {
  activationId: string;
  network: Network;
  propertyVersion: number;
  status: string;
  submitDate?: string;
  updateDate?: string;
  note?: string;
  notifyEmails?: string[];
  [key: string]: unknown;
}

export default class AkamaiClient {
  static createFrom(context: object): AkamaiClient;

  static activationIdFromLink(link: string): string;

  constructor(config: AkamaiClientConfig, log?: object);

  host: string;

  accountSwitchKey?: string;

  notifyEmails?: string[];

  ruleTreeTimeoutMs: number;

  searchBy(key: 'hostname' | 'edgeHostname' | 'propertyName', value: string): Promise<object[]>;

  findPropertiesByDomain(domain: string): Promise<PropertyMatch[]>;

  getLatestVersion(propertyId: string, contractId: string, groupId: string): Promise<number>;

  getRuleTree(
    propertyId: string,
    version: number,
    contractId: string,
    groupId: string,
    options?: { validateRules?: boolean },
  ): Promise<RuleTreeResult>;

  createVersion(
    propertyId: string,
    baseVersion: number,
    contractId: string,
    groupId: string,
  ): Promise<number>;

  updateRuleTree(
    propertyId: string,
    version: number,
    contractId: string,
    groupId: string,
    ruleTree: object,
    ruleFormat?: string,
    options?: { dryRun?: boolean },
  ): Promise<object>;

  patchRuleTree(
    propertyId: string,
    version: number,
    contractId: string,
    groupId: string,
    ops: object[],
    etag?: string,
    options?: { dryRun?: boolean },
  ): Promise<object>;

  activate(
    propertyId: string,
    version: number,
    contractId: string,
    groupId: string,
    network: Network,
    note?: string,
  ): Promise<string>;

  getActivation(
    propertyId: string,
    activationId: string,
    contractId: string,
    groupId: string,
  ): Promise<Activation | undefined>;

  listActivations(
    propertyId: string,
    contractId: string,
    groupId: string,
  ): Promise<Activation[]>;

  latestActivation(
    propertyId: string,
    contractId: string,
    groupId: string,
    network: Network,
  ): Promise<Activation | undefined>;
}
