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
  };
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
  
  static createForOrg(context: TierClientContext, organization: Organization, productCode: string): TierClient;
  static createForSite(context: TierClientContext, site: Site, productCode: string): TierClient;
}
export { TierClient as default };
