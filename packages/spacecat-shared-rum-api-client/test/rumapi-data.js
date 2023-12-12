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

export const emptyResponse = {
  ':names': ['results', 'meta'],
  ':type': 'multi-sheet',
  ':version': 3,
  results: {
    limit: 1,
    offset: 0,
    total: 0,
    data: [],
    columns: ['key', 'hostname_prefix', 'status', 'revoke_date'],
  },
  meta: {
    limit: 9, offset: 0, total: 9, columns: ['name', 'value', 'type'], data: [{ name: 'description', value: 'Rotate domain keys', type: 'query description' }, { name: 'timezone', value: 'UTC', type: 'request parameter' }, { name: 'url', value: '-', type: 'request parameter' }, { name: 'newkey', value: '-', type: 'request parameter' }, { name: 'graceperiod', value: '-1', type: 'request parameter' }, { name: 'expiry', value: '-', type: 'request parameter' }, { name: 'readonly', value: true, type: 'request parameter' }, { name: 'note', value: '-', type: 'request parameter' }, { name: 'limit', value: null, type: 'request parameter' }],
  },
};
export const nullKeyResponse = {
  ':names': ['results', 'meta'],
  ':type': 'multi-sheet',
  ':version': 3,
  results: {
    limit: 1,
    offset: 0,
    total: 1,
    data: [
      {
        key: null,
        hostname_prefix: 'www.adobe.com',
        status: 'success',
        revoke_date: '2023-11-29T12:22:00.340Z',
      },
    ],
    columns: ['key', 'hostname_prefix', 'status', 'revoke_date'],
  },
  meta: {
    limit: 9, offset: 0, total: 9, columns: ['name', 'value', 'type'], data: [{ name: 'description', value: 'Rotate domain keys', type: 'query description' }, { name: 'timezone', value: 'UTC', type: 'request parameter' }, { name: 'url', value: 'www.adobe.com', type: 'request parameter' }, { name: 'newkey', value: '-', type: 'request parameter' }, { name: 'graceperiod', value: '-1', type: 'request parameter' }, { name: 'expiry', value: '2023-11-29T12:22:00.340Z', type: 'request parameter' }, { name: 'readonly', value: true, type: 'request parameter' }, { name: 'note', value: 'spacecat on the fly test', type: 'request parameter' }, { name: 'limit', value: null, type: 'request parameter' }],
  },
};
export const wrongKeyResponse = {
  ':names': ['results', 'meta'],
  ':type': 'multi-sheet',
  ':version': 3,
  results: {
    limit: 1,
    offset: 0,
    total: 1,
    data: [{
      key: null,
      hostname_prefix: '',
      status: 'failure',
      revoke_date: null,
    }],
    columns: ['key', 'hostname_prefix', 'status', 'revoke_date'],
  },
  meta: {
    limit: 9, offset: 0, total: 9, columns: ['name', 'value', 'type'], data: [{ name: 'description', value: 'Rotate domain keys', type: 'query description' }, { name: 'timezone', value: 'UTC', type: 'request parameter' }, { name: 'url', value: '-', type: 'request parameter' }, { name: 'newkey', value: '-', type: 'request parameter' }, { name: 'graceperiod', value: '-1', type: 'request parameter' }, { name: 'expiry', value: '-', type: 'request parameter' }, { name: 'readonly', value: true, type: 'request parameter' }, { name: 'note', value: '-', type: 'request parameter' }, { name: 'limit', value: null, type: 'request parameter' }],
  },
};

export const successKeyResponse = {
  ':names': ['results', 'meta'],
  ':type': 'multi-sheet',
  ':version': 3,
  results: {
    limit: 1,
    offset: 0,
    total: 1,
    data: [
      {
        key: 'scoped-domain-key',
        hostname_prefix: 'www.space.cat',
        status: 'success',
        revoke_date: '2023-12-04T12:30:01.123Z',
      },
    ],
    columns: ['key', 'hostname_prefix', 'status', 'revoke_date'],
  },
  meta: {
    limit: 9, offset: 0, total: 9, columns: ['name', 'value', 'type'], data: [{ name: 'description', value: 'Rotate domain keys', type: 'query description' }, { name: 'timezone', value: 'UTC', type: 'request parameter' }, { name: 'url', value: '-', type: 'request parameter' }, { name: 'newkey', value: '-', type: 'request parameter' }, { name: 'graceperiod', value: '-1', type: 'request parameter' }, { name: 'expiry', value: '-', type: 'request parameter' }, { name: 'readonly', value: true, type: 'request parameter' }, { name: 'note', value: '-', type: 'request parameter' }, { name: 'limit', value: null, type: 'request parameter' }],
  },
};
