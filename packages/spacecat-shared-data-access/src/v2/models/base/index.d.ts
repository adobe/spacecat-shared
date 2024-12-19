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
  toJSON(): object;
}

export interface MultiStatusCreateResult<T> {
  createdItems: T[],
  errorItems: { item: object, error: ValidationError }[],
}

export interface QueryOptions {
  index?: string;
  limit?: number;
  sort?: string;
  attributes?: string[];
}

export interface BaseCollection<T extends BaseModel> {
  all(sortKeys?: object, options?: QueryOptions): Promise<T[]>;
  allByIndexKeys(keys: object, options?: QueryOptions): Promise<T[]>;
  create(item: object): Promise<T>;
  createMany(items: object[]): Promise<MultiStatusCreateResult<T>>;
  findByAll(sortKeys?: object, options?: QueryOptions): Promise<T>;
  findById(id: string): Promise<T>;
  findByIndexKeys(indexKeys: object): Promise<T>;
  removeByIds(ids: string[]): Promise<void>;
}

export interface EntityRegistry {
  getCollection<T extends BaseModel>(collectionName: string): BaseCollection<T>;
  getCollections(): BaseCollection<BaseModel>[];
  getEntities(): object;
  registerEntity(schema: object, collection: BaseCollection<BaseModel>): void;
}

export interface Reference {
  getSortKeys(): string[];
  getTarget(): string;
  getType(): string;
  isRemoveDependents(): boolean;
}

export interface IndexAccessor {
  indexName: string;
  keySets: string[][];
}

export interface Schema {
  findIndexBySortKeys(sortKeys: string[]): object | null;
  findIndexByType(type: string): object | undefined;
  getAttribute(name: string): object;
  getAttributes(): object;
  getCollectionName(): string;
  getEntityName(): string;
  getIdName(): string;
  getIndexAccessors(): Array<IndexAccessor>;
  getIndexes(): object;
  getIndexKeys(indexName: string): string[];
  getModelClass(): object;
  getModelName(): string;
  getReferences(): Reference[];
  getReferencesByType(referenceType: string): Reference[];
  getReferenceByTypeAndTarget(referenceType: string, target: string): Reference | undefined;
}

export interface SchemaBuilder {
  addAttribute(name: string, data: object): SchemaBuilder;
  addAllIndex(sortKeys: string[]): SchemaBuilder;
  addIndex(name: string, partitionKey: object, sortKey: object): SchemaBuilder;
  addReference(referenceType: string, entityName: string, sortKeys?: string[]): SchemaBuilder;
  build(): Schema;
}
