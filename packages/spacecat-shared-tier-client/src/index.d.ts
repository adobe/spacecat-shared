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
 * Domain event name emitted when an entitlement's tier transitions
 * (including a fresh create). See the ADR for the target-architecture rationale.
 */
export declare const ENTITLEMENT_TIER_CHANGED: 'entitlement.tier_changed';

/**
 * Env key holding the SQS queue URL that `entitlement.tier_changed` events are
 * published to. When absent, emission is a no-op (opt-in).
 */
export declare const ENTITLEMENT_EVENTS_QUEUE_URL_KEY: 'ENTITLEMENT_EVENTS_QUEUE_URL';

/**
 * Payload published for the `entitlement.tier_changed` event.
 * `from` is null on a fresh create; `siteId`/`enrollmentId` are null for org-only scope.
 */
export interface EntitlementTierChangedEvent {
  type: typeof ENTITLEMENT_TIER_CHANGED;
  entitlementId: string;
  organizationId: string;
  productCode: string;
  siteId: string | null;
  enrollmentId: string | null;
  from: string | null;
  to: string;
  occurredAt: string;
}

/**
 * Minimal shape of the shared SQS helper (`context.sqs`) used to publish events.
 */
export interface TierClientSqs {
  sendMessage(queueUrl: string, message: object): Promise<void>;
}

export interface TierClientContext {
  dataAccess: {
    Entitlement: any;
    SiteEnrollment: any;
    Organization: any;
    Site: any;
    OrganizationIdentityProvider: any;
  };
  log: {
    info: (message: string) => void;
    error: (message: string) => void;
    warn?: (message: string) => void;
  };
  /**
   * Optional shared SQS helper. When present together with the
   * `ENTITLEMENT_EVENTS_QUEUE_URL` env var, `entitlement.tier_changed` events are published
   * best-effort. Absent → emission is a no-op.
   */
  sqs?: TierClientSqs;
  /** Optional env bag; `ENTITLEMENT_EVENTS_QUEUE_URL` opts into event emission. */
  env?: Record<string, string | undefined>;
}

export interface TierClientResult {
  entitlement?: any;
  siteEnrollment?: any;
}

export interface Organization {
  getId(): string;
}

export interface Site {
  getId(): string;
  getOrganizationId?(): string;
  getOrganization?(): Organization;
}

export declare class TierClient {
  constructor(context: TierClientContext, organization: Organization, site: Site | null | undefined, productCode: string);
  
  checkValidEntitlement(): Promise<TierClientResult>;
  createEntitlement(tier: string): Promise<TierClientResult>;
  revokeSiteEnrollment(): Promise<object>;
  
  static createForOrg(context: TierClientContext, organization: Organization, productCode: string): TierClient;
  static createForSite(context: TierClientContext, site: Site, productCode: string): Promise<TierClient>;
}
export { TierClient as default };
