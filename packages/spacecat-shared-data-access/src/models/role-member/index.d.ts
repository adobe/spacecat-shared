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

import type { BaseCollection, BaseModel } from '../base';

export interface RoleMember extends BaseModel {
  getImsOrgId(): string;
  getIdentity(): string;
  getRoleId(): string;
  getRoleMemberId(): string;
  getRole(): Promise<Role>;
  setImsOrgId(id: string): RoleMember;
  setIdentity(identity: string): RoleMember;
  setRoleId(id: string): RoleMember;
}

export interface RoleMemberCollection extends BaseCollection<RoleMember> {
  allRoleMembershipByIdentities(imsOrgId: string, identities: string[]): Promise<RoleMember[]>;
  allByImsOrgId(imsOrgId: string): Promise<RoleMember[]>;
  allByImsOrgIdAndIdentity(imsOrgId: string, identity: string): Promise<RoleMember[]>;
  allByRoleId(roleId: string): Promise<RoleMember[]>;
  findByImsOrgId(imsOrgId: string): Promise<RoleMember | null>;
  findByImsOrgIdAndIdentity(imsOrgId: string, identity: string): Promise<RoleMember | null>;
  findByRoleId(roleId: string): Promise<RoleMember | null>;
}
