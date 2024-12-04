/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { ValidationError } from '../../errors';

export interface BaseModel {
  getCreatedAt(): string;
  getId(): string;
  getUpdatedAt(): string;
  remove(): Promise<this>;
  save(): Promise<this>;
}

export interface MultiStatusCreateResult<T> {
  createdItems: T[],
  errorItems: { item: object, error: ValidationError }[],
}

export interface QueryOptions {
  index?: string;
  limit?: number;
  sort?: string;
}

export interface BaseCollection<T extends BaseModel> {
  allByIndexKeys(keys: object, options?: QueryOptions): Promise<T[]>;
  create(item: object): Promise<T>;
  createMany(items: object[]): Promise<MultiStatusCreateResult<T>>;
  findById(id: string): Promise<T>;
  findByIndexKeys(indexKeys: object): Promise<T>;
}

export interface ModelFactory {
  getCollection<T extends BaseModel>(collectionName: string): BaseCollection<T>;
}
