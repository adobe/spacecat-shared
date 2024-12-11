/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */
import { expect } from 'chai';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createClient } from '../src/index.js';

describe('createClient', () => {
  let dbClient;
  let docClient;

  beforeEach(() => {
    dbClient = new DynamoDB();
    docClient = DynamoDBDocumentClient.from(dbClient);
  });

  it('should create a DynamoDB client with scan method', () => {
    const client = createClient(console, dbClient, docClient);
    expect(client).to.have.property('scan');
    expect(client.query).to.be.a('function');
  });

  it('should create a DynamoDB client with query method', () => {
    const client = createClient(console, dbClient, docClient);
    expect(client).to.have.property('query');
    expect(client.query).to.be.a('function');
  });

  it('should create a DynamoDB client with getItem method', () => {
    const client = createClient(console, dbClient, docClient);
    expect(client).to.have.property('getItem');
    expect(client.getItem).to.be.a('function');
  });

  it('should create a DynamoDB client with putItem method', () => {
    const client = createClient(console, dbClient, docClient);
    expect(client).to.have.property('putItem');
    expect(client.putItem).to.be.a('function');
  });

  it('should create a DynamoDB client with removeItem method', () => {
    const client = createClient(console, dbClient, docClient);
    expect(client).to.have.property('removeItem');
    expect(client.removeItem).to.be.a('function');
  });

  it('should use default parameters if none are provided', () => {
    const client = createClient();
    expect(client).to.have.all.keys('scan', 'query', 'getItem', 'putItem', 'removeItem');
  });
});
