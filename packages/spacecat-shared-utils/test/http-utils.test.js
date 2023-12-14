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
import {
  ok, badRequest, notFound, internalServerError, noContent,
} from '../src/http-utils.js';

describe('http-utils', () => {
  it('ok should return a 200 response with JSON body', async () => {
    const body = { key: 'value' };
    const response = ok(body);
    expect(response.status).to.equal(200);
    expect(response.headers.get('content-type')).to.equal('application/json; charset=utf-8');
    const respJson = await response.json();
    expect(respJson).to.eql(body);
  });

  it('ok should return a 204 response with JSON body', async () => {
    const headers = { key: 'value' };
    const response = noContent(headers);
    expect(response.status).to.equal(204);
    expect(response.headers.get('content-type')).to.equal('application/json; charset=utf-8');
    expect(response.headers.get('key')).to.equal('value');
    const respJson = await response.json();
    expect(respJson).to.eql('');
  });

  it('badRequest should return a 400 response with JSON body', async () => {
    const response = badRequest('Bad Request');
    expect(response.status).to.equal(400);
    expect(response.headers.get('content-type')).to.equal('application/json; charset=utf-8');
    const respJson = await response.json();
    expect(respJson).to.eql({ message: 'Bad Request' });
  });

  it('notFound return a 404 response with JSON body', async () => {
    const response = notFound('Not Found');
    expect(response.status).to.equal(404);
    expect(response.headers.get('content-type')).to.equal('application/json; charset=utf-8');
    const respJson = await response.json();
    expect(respJson).to.eql({ message: 'Not Found' });
  });

  it('internalServerError should return a 500 response with JSON body', async () => {
    const response = internalServerError('uh oh');
    expect(response.status).to.equal(500);
    expect(response.headers.get('content-type')).to.equal('application/json; charset=utf-8');
    expect(response.headers.get('x-error')).to.equal('internal server error: uh oh');
    const respJson = await response.json();
    expect(respJson).to.eql({ message: 'uh oh' });
  });
});
