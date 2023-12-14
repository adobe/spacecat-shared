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
} from '../src/index.js';

describe('HTTP Response Functions', () => {
  it('ok should return a 200 OK response with default body', async () => {
    const response = await ok();
    expect(response.status).to.equal(200);
    const responseBody = await response.text();
    expect(responseBody).to.equal('');
  });

  it('ok should return a 200 OK response with custom body', async () => {
    const response = await ok({ success: true });
    expect(response.status).to.equal(200);
    const responseBody = await response.json();
    expect(responseBody).to.deep.equal({ success: true });
  });

  it('noContent should return a 204 No Content response with default headers', async () => {
    const response = await noContent();
    expect(response.status).to.equal(204);
    expect(response.headers.get('content-type')).to.equal('application/json; charset=utf-8');
    const responseBody = await response.text();
    expect(responseBody).to.equal('');
  });

  it('noContent should return a 204 No Content response with custom headers', async () => {
    const response = await noContent({ 'custom-header': 'value' });
    expect(response.status).to.equal(204);
    const responseBody = await response.text();
    expect(responseBody).to.equal('');
  });

  it('badRequest should return a 400 Bad Request response with default message and headers', async () => {
    const response = await badRequest();
    expect(response.status).to.equal(400);
    expect(response.headers.get('x-error')).to.equal('bad request');
    const responseBody = await response.json();
    expect(responseBody).to.deep.equal({ message: 'bad request' });
  });

  it('badRequest should return a 400 Bad Request response with custom message and headers', async () => {
    const response = await badRequest('Invalid input', { 'custom-header': 'value' });
    expect(response.status).to.equal(400);
    expect(response.headers.get('x-error')).to.equal('Invalid input');
    expect(response.headers.get('custom-header')).to.equal('value');
    const responseBody = await response.json();
    expect(responseBody).to.deep.equal({ message: 'Invalid input' });
  });

  it('notFound should return a 404 Not Found response with default message and headers', async () => {
    const response = await notFound();
    expect(response.status).to.equal(404);
    expect(response.headers.get('x-error')).to.equal('not found');
    const responseBody = await response.json();
    expect(responseBody).to.deep.equal({ message: 'not found' });
  });

  it('notFound should return a 404 Not Found response with custom message and headers', async () => {
    const response = await notFound('Resource not found', { 'custom-header': 'value' });
    expect(response.status).to.equal(404);
    expect(response.headers.get('x-error')).to.equal('Resource not found');
    expect(response.headers.get('custom-header')).to.equal('value');
    const responseBody = await response.json();
    expect(responseBody).to.deep.equal({ message: 'Resource not found' });
  });

  it('internalServerError should return a 500 Internal Server Error response with default message and headers', async () => {
    const response = await internalServerError();
    expect(response.status).to.equal(500);
    expect(response.headers.get('x-error')).to.equal('internal server error');
    const responseBody = await response.json();
    expect(responseBody).to.deep.equal({ message: 'internal server error' });
  });

  it('internalServerError should return a 500 Internal Server Error response with custom message and headers', async () => {
    const response = await internalServerError('Server error occurred', { 'custom-header': 'value' });
    expect(response.status).to.equal(500);
    expect(response.headers.get('x-error')).to.equal('Server error occurred');
    expect(response.headers.get('custom-header')).to.equal('value');
    const responseBody = await response.json();
    expect(responseBody).to.deep.equal({ message: 'Server error occurred' });
  });
});
