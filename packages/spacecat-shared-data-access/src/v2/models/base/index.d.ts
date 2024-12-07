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
  attributes?: string[];
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

export interface SchemaBuilder {
  /**
   * Add an attribute to the schema. Attributes must be given a name
   * and a data object that describes the attribute as an ElectroDB attribute definition:
   * https://electrodb.dev/en/modeling/attributes/
   * @param name - The name of the attribute
   * @param data - The attribute definition
   */
  addAttribute(name: string, data: object): SchemaBuilder;

  /**
   * Add an index to the schema. Indexes must be given a name, a partition key, and a sort key.
   * The partition key and sort key must be defined as per the ElectroDB index definition:
   * https://electrodb.dev/en/modeling/indexes/
   * @param name - The name of the index
   * @param partitionKey - The partition key definition
   * @param sortKey - The sort key definition
   */
  addIndex(name: string, partitionKey: object, sortKey: object): SchemaBuilder;

  /**
   * Add a reference to the schema. References must be given a reference type, a target entity name,
   * and an optional array of sort keys. If no sort keys are provided, the reference will be created
   * with the 'updatedAt' attribute as the sort key.
   * If the reference type is 'belongs_to', this will also a foreign key attribute to the schema
   * (<entityName>Id) as well as an index on that attribute.
   * @param referenceType - The type of reference (belongs_to, has_many, has_one)
   * @param entityName - The name of the target entity
   * @param sortKeys - An optional array of sort keys
   */
  addReference(referenceType: string, entityName: string, sortKeys?: string[]): SchemaBuilder;

  /**
   * Build the schema object, returns the ElectroDB schema as an object.
   */
  build(): object;
}
