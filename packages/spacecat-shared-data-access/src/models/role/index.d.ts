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

export interface Role extends BaseModel {
  /**
   * @returns the ACL (Access Control List) for the role.
   * Each object in the array has a path property, which may contain single '*' wildcards
   * to represent a wildcard in a path segment, or a souble '**' wildcard at the end to
   * represent anything starting with the specified path.
   * The object also contains an actions property, which is an array of strings each
   * representing a permitted action. Typically 'C', 'R', 'U', 'D', but could also be other
   * values, not restricted to a single letter.
   */
  getAcl(): object[];
  getImsOrgId(): string;
  getName(): string;
  getRoleId(): string;
  setImsOrgId(id: string): Role;
  setName(name: string): Role;
  setAcl(acl: object[]): Role;
}

export interface RoleCollection extends BaseCollection<Role> {
  allByImsOrgId(imsOrgId: string): Promise<Role[]>;
  allByImsOrgIdAndName(imsOrgId: string, name: string): Promise<Role[]>;
  findByImsOrgId(imsOrgId: string): Promise<Role | null>;
  findByImsOrgIdAndName(imsOrgId: string, name: string): Promise<Role | null>;
}
