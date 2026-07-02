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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import JiraCloudClient from '../src/clients/jira-cloud-client.js';

use(chaiAsPromised);

const VALID_CLOUD_ID = '11111111-2222-3333-4444-555555555555';
const VALID_CONFIG = {
  cloudId: VALID_CLOUD_ID,
  siteUrl: 'https://example.atlassian.net',
};

function makeCredentialManager() {
  return { getAuthHeaders: sinon.stub().resolves({ Authorization: 'Bearer test-token' }) };
}

function makeHttpClient(responseBody, status = 200) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: sinon.stub().resolves(responseBody),
  };
  return { fetch: sinon.stub().resolves(response) };
}

/**
 * HTTP client for createTicket tests: first call = POST /issue (201 create),
 * second call = GET /issue/{key}?fields=status.
 */
function makeCreateWithStatusHttpClient(createBody, statusName) {
  const stub = sinon.stub();
  stub.onFirstCall().resolves({
    ok: true, status: 201, json: sinon.stub().resolves(createBody),
  });
  stub.onSecondCall().resolves({
    ok: true,
    status: 200,
    json: sinon.stub().resolves({ fields: { status: { name: statusName } } }),
  });
  return { fetch: stub };
}

function makeLog() {
  return {
    info: sinon.stub(), error: sinon.stub(), warn: sinon.stub(), debug: sinon.stub(),
  };
}

describe('JiraCloudClient', () => {
  describe('constructor', () => {
    it('throws if cloudId is not a valid UUID', () => {
      expect(() => new JiraCloudClient(
        { cloudId: 'not-a-uuid', siteUrl: 'https://example.atlassian.net' },
        makeCredentialManager(),
        makeHttpClient({}),
        makeLog(),
      )).to.throw('Invalid cloudId format');
    });

    it('accepts mixed-case cloudId (RFC 4122 allows both cases)', () => {
      expect(() => new JiraCloudClient(
        { cloudId: '11111111-2222-3333-4444-AABBCCDDEEFF', siteUrl: 'https://example.atlassian.net' },
        makeCredentialManager(),
        makeHttpClient({}),
        makeLog(),
      )).to.not.throw();
    });

    it('throws if siteUrl is not https://*.atlassian.net', () => {
      const invalidUrls = [
        'http://example.atlassian.net',
        'https://example.atlassian.com',
        'https://example.com',
        'not-a-url',
        undefined,
        // hostname spoofing attempts that pass naive string checks
        'https://evil.com/https://foo.atlassian.net',
        'https://foo.atlassian.net.evil.com',
      ];
      for (const siteUrl of invalidUrls) {
        expect(() => new JiraCloudClient(
          { cloudId: VALID_CLOUD_ID, siteUrl },
          makeCredentialManager(),
          makeHttpClient({}),
          makeLog(),
        )).to.throw('Invalid siteUrl');
      }
    });

    it('constructs successfully with valid config', () => {
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        makeHttpClient({}),
        makeLog(),
      );
      expect(client).to.be.instanceOf(JiraCloudClient);
    });
  });

  describe('createTicket', () => {
    it('throws when projectKey is missing', async () => {
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        makeHttpClient({}),
        makeLog(),
      );
      await expect(client.createTicket({ summary: 'x', description: '' }))
        .to.be.rejectedWith('projectKey is required');
    });

    it('creates a ticket and fetches ticketStatus via GET after create', async () => {
      // POST /issue returns { id, key } only — no fields.
      // GET /issue/{key}?fields=status returns the real initial status.
      const httpClient = makeCreateWithStatusHttpClient({ id: '10042', key: 'ASO-42' }, 'To Do');

      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      const result = await client.createTicket({
        projectKey: 'ASO',
        summary: 'Test ticket',
        description: 'First paragraph\n\nSecond paragraph',
        labels: ['AEM-Sites-Optimizer'],
      });

      expect(result.ticketId).to.equal('10042');
      expect(result.ticketKey).to.equal('ASO-42');
      expect(result.ticketUrl).to.equal('https://example.atlassian.net/browse/ASO-42');
      expect(result.ticketStatus).to.equal('To Do');
      // Two calls: POST /issue then GET /issue/{key}?fields=status
      expect(httpClient.fetch.callCount).to.equal(2);
      expect(httpClient.fetch.secondCall.args[0]).to.include('ASO-42').and.include('fields=status');
    });

    it('returns null ticketStatus when status fetch returns no fields', async () => {
      const stub = sinon.stub();
      const createRes = { ok: true, status: 201, json: sinon.stub().resolves({ id: '1', key: 'ASO-1' }) };
      const statusRes = { ok: true, status: 200, json: sinon.stub().resolves({}) }; // no fields
      stub.onFirstCall().resolves(createRes);
      stub.onSecondCall().resolves(statusRes);
      const httpClient = { fetch: stub };

      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const result = await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '' });
      expect(result.ticketStatus).to.be.null;
    });

    it('returns null ticketStatus when status fetch fails (non-fatal — ticket creation succeeds)', async () => {
      const stub = sinon.stub();
      const createRes = { ok: true, status: 201, json: sinon.stub().resolves({ id: '1', key: 'ASO-1' }) };
      const statusRes = { ok: false, status: 403, json: sinon.stub().resolves({}) };
      stub.onFirstCall().resolves(createRes);
      stub.onSecondCall().resolves(statusRes);
      const httpClient = { fetch: stub };

      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const result = await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '' });
      // Status fetch failure must not throw — ticket was already created
      expect(result.ticketStatus).to.be.null;
      expect(result.ticketKey).to.equal('ASO-1');
    });

    it('truncates summary to 255 characters', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });

      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      const longSummary = 'A'.repeat(300);
      await client.createTicket({ projectKey: 'ASO', summary: longSummary, description: '' });

      const callBody = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      expect(callBody.fields.summary).to.have.length(255);
    });

    it('routes create call through Atlassian gateway, not siteUrl', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });

      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      await client.createTicket({ projectKey: 'ASO', summary: 'test', description: '' });

      const calledUrl = httpClient.fetch.firstCall.args[0];
      expect(calledUrl).to.include(`https://api.atlassian.com/ex/jira/${VALID_CLOUD_ID}`);
      expect(calledUrl).to.not.include('example.atlassian.net');
    });

    it('throws when Jira returns an invalid ticketKey format', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'INVALID KEY!' });

      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      await expect(client.createTicket({ projectKey: 'ASO', summary: 'x', description: '' }))
        .to.be.rejectedWith('Unexpected ticketKey format returned from Jira');
    });

    it('handles null description without throwing', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const result = await client.createTicket({ projectKey: 'ASO', summary: null, description: null });
      expect(result.ticketKey).to.equal('ASO-1');
    });

    it('omits description field entirely for blank input (not an empty ADF doc)', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      expect(body.fields).to.not.have.property('description');
    });

    it('includes priority in Jira fields when provided', async () => {
      const httpClient = makeCreateWithStatusHttpClient({ id: '1', key: 'ASO-1' }, 'To Do');
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({
        projectKey: 'ASO',
        summary: 'x',
        description: '',
        priority: 'High',
      });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      expect(body.fields.priority).to.deep.equal({ name: 'High' });
    });

    it('includes duedate in Jira fields when provided', async () => {
      const httpClient = makeCreateWithStatusHttpClient({ id: '1', key: 'ASO-1' }, 'To Do');
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({
        projectKey: 'ASO',
        summary: 'x',
        description: '',
        dueDate: '2026-12-31',
      });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      expect(body.fields.duedate).to.equal('2026-12-31');
    });

    it('rejects invalid dueDate format', async () => {
      const httpClient = makeCreateWithStatusHttpClient({ id: '1', key: 'ASO-1' }, 'To Do');
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await expect(client.createTicket({
        projectKey: 'ASO',
        summary: 'x',
        description: '',
        dueDate: '31-12-2026',
      })).to.be.rejectedWith('Invalid dueDate format');
    });

    it('includes components in Jira fields when provided', async () => {
      const httpClient = makeCreateWithStatusHttpClient({ id: '1', key: 'ASO-1' }, 'To Do');
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({
        projectKey: 'ASO',
        summary: 'x',
        description: '',
        components: ['Frontend', 'API'],
      });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      expect(body.fields.components).to.deep.equal([{ name: 'Frontend' }, { name: 'API' }]);
    });

    it('includes parent in Jira fields when provided (epic link)', async () => {
      const httpClient = makeCreateWithStatusHttpClient({ id: '1', key: 'ASO-1' }, 'To Do');
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({
        projectKey: 'ASO',
        summary: 'x',
        description: '',
        parent: 'ASO-42',
      });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      expect(body.fields.parent).to.deep.equal({ key: 'ASO-42' });
    });

    it('throws on invalid parent format', async () => {
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        { fetch: sinon.stub() },
        makeLog(),
      );
      await expect(client.createTicket({
        projectKey: 'ASO',
        summary: 'x',
        parent: 'not-a-valid-key',
      })).to.be.rejectedWith('Invalid parent format');
    });

    it('omits priority, duedate, components, and parent when not provided', async () => {
      const httpClient = makeCreateWithStatusHttpClient({ id: '1', key: 'ASO-1' }, 'To Do');
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      expect(body.fields).to.not.have.property('priority');
      expect(body.fields).to.not.have.property('duedate');
      expect(body.fields).to.not.have.property('components');
      expect(body.fields).to.not.have.property('parent');
    });

    it('returns null ticketStatus when status fetch throws (network error — non-fatal)', async () => {
      const stub = sinon.stub();
      const createRes = { ok: true, status: 201, json: sinon.stub().resolves({ id: '1', key: 'ASO-1' }) };
      stub.onFirstCall().resolves(createRes);
      stub.onSecondCall().rejects(new Error('network error'));
      const httpClient = { fetch: stub };

      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const result = await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '' });
      expect(result.ticketStatus).to.be.null;
      expect(result.ticketKey).to.equal('ASO-1');
    });

    it('inserts hardBreak nodes for markdown line breaks (two trailing spaces)', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // Markdown hard break: two trailing spaces + newline
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: 'line1  \nline2' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      expect(nodes.find((n) => n.type === 'hardBreak')).to.exist;
    });

    it('renders bare URLs as clickable link marks', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      const url = 'https://www.adobe.com/learn/firefly';
      await client.createTicket({
        projectKey: 'ASO',
        summary: 'x',
        description: `URL: ${url}`,
      });

      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;

      // marked auto-links bare URLs — they now render as clickable links in Jira
      const linkNode = nodes.find((n) => n.marks?.some((m) => m.type === 'link'));
      expect(linkNode).to.exist;
      expect(linkNode.marks[0].attrs.href).to.equal(url);
    });

    it('keeps plain text nodes for lines without URLs', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: 'No links here' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;

      expect(nodes).to.have.length(1);
      expect(nodes[0].type).to.equal('text');
      expect(nodes[0].text).to.equal('No links here');
      expect(nodes[0].marks).to.be.undefined;
    });

    it('renders fenced code block as ADF codeBlock node', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const description = '```html\n<div class="foo">bar</div>\n```';
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const node = body.fields.description.content[0];
      expect(node.type).to.equal('codeBlock');
      expect(node.attrs).to.deep.equal({ language: 'html' });
      expect(node.content[0].text).to.equal('<div class="foo">bar</div>');
    });

    it('renders fenced code block without language as codeBlock with empty attrs', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const description = '```\nsome code\n```';
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const node = body.fields.description.content[0];
      expect(node.type).to.equal('codeBlock');
      expect(node.attrs).to.deep.equal({});
      expect(node.content[0].text).to.equal('some code');
    });

    it('renders bullet list lines as ADF bulletList node', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const description = '- item one\n- item two\n- item three';
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const node = body.fields.description.content[0];
      expect(node.type).to.equal('bulletList');
      expect(node.content).to.have.length(3);
      expect(node.content[0].type).to.equal('listItem');
      expect(node.content[0].content[0].content[0].text).to.equal('item one');
      expect(node.content[1].content[0].content[0].text).to.equal('item two');
      expect(node.content[2].content[0].content[0].text).to.equal('item three');
    });

    it('renders heading markdown as ADF heading node', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '## Accessibility Issues' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const node = body.fields.description.content[0];
      expect(node.type).to.equal('heading');
      expect(node.attrs.level).to.equal(2);
      expect(node.content[0].text).to.equal('Accessibility Issues');
    });

    it('renders ordered list as ADF orderedList node', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '1. First\n2. Second\n3. Third' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const node = body.fields.description.content[0];
      expect(node.type).to.equal('orderedList');
      expect(node.attrs.order).to.equal(1);
      expect(node.content).to.have.length(3);
      expect(node.content[0].type).to.equal('listItem');
      expect(node.content[0].content[0].content[0].text).to.equal('First');
    });

    it('renders blockquote as ADF blockquote node', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '> Important note here' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const node = body.fields.description.content[0];
      expect(node.type).to.equal('blockquote');
      expect(node.content[0].type).to.equal('paragraph');
      expect(node.content[0].content[0].text).to.equal('Important note here');
    });

    it('renders horizontal rule as ADF rule node', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: 'Before\n\n---\n\nAfter' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content;
      expect(nodes[1].type).to.equal('rule');
    });

    it('renders markdown table as ADF table node', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const description = '| Col A | Col B |\n|-------|-------|\n| data1 | data2 |';
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const table = body.fields.description.content[0];
      expect(table.type).to.equal('table');
      expect(table.content).to.have.length(2);
      expect(table.content[0].content[0].type).to.equal('tableHeader');
      expect(table.content[0].content[0].content[0].content[0].text).to.equal('Col A');
      expect(table.content[1].content[0].type).to.equal('tableCell');
      expect(table.content[1].content[0].content[0].content[0].text).to.equal('data1');
    });

    it('renders bold text with strong mark', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: 'This is **bold** text' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      const boldNode = nodes.find((n) => n.marks?.some((m) => m.type === 'strong'));
      expect(boldNode).to.exist;
      expect(boldNode.text).to.equal('bold');
    });

    it('renders italic text with em mark', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: 'This is *italic* text' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      const emNode = nodes.find((n) => n.marks?.some((m) => m.type === 'em'));
      expect(emNode).to.exist;
      expect(emNode.text).to.equal('italic');
    });

    it('renders inline code with code mark', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: 'Use `aria-label` attribute' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      const codeNode = nodes.find((n) => n.marks?.some((m) => m.type === 'code'));
      expect(codeNode).to.exist;
      expect(codeNode.text).to.equal('aria-label');
    });

    it('renders markdown link with link mark', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: 'Visit [Adobe](https://adobe.com)' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      const linkNode = nodes.find((n) => n.marks?.some((m) => m.type === 'link'));
      expect(linkNode).to.exist;
      expect(linkNode.text).to.equal('Adobe');
      expect(linkNode.marks[0].attrs.href).to.equal('https://adobe.com');
    });

    it('renders link text as plain nodes when href is empty', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '[no href]()' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      expect(nodes.some((n) => n.marks?.some((m) => m.type === 'link'))).to.be.false;
      expect(nodes[0].text).to.equal('no href');
    });

    it('strips unsafe link schemes and renders link text as plain nodes (XSS defense)', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '[click me](javascript:alert(1))' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      // Link text rendered as plain text — no link mark, no href
      expect(nodes.some((n) => n.marks?.some((m) => m.type === 'link'))).to.be.false;
      expect(nodes[0].text).to.equal('click me');
    });

    it('renders strikethrough with strike mark', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: 'This is ~~removed~~ text' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      const strikeNode = nodes.find((n) => n.marks?.some((m) => m.type === 'strike'));
      expect(strikeNode).to.exist;
      expect(strikeNode.text).to.equal('removed');
    });

    it('renders nested bold+italic marks', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '***bold italic***' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      const markedNode = nodes.find((n) => n.marks?.length >= 2);
      expect(markedNode).to.exist;
      const markTypes = markedNode.marks.map((m) => m.type);
      expect(markTypes).to.include('strong');
      expect(markTypes).to.include('em');
    });

    it('renders inline code inside link with both marks', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '[`code`](https://example.com)' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      const codeLink = nodes.find((n) => n.marks?.some((m) => m.type === 'code') && n.marks?.some((m) => m.type === 'link'));
      expect(codeLink).to.exist;
    });

    it('handles HTML entities in markdown description as paragraph fallback', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // Raw HTML produces an 'html' token type which hits the default branch in tokensToAdf
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '<div>custom html</div>' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content;
      // HTML token hits default branch — should produce a paragraph with raw text
      expect(nodes.length).to.be.greaterThan(0);
    });

    it('renders inline marks inside bullet list items (nested text tokens)', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // List items produce text tokens with nested .tokens containing inline marks
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '- foo **bar** baz' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const listItem = body.fields.description.content[0].content[0];
      const paragraph = listItem.content[0];
      const boldNode = paragraph.content.find((n) => n.marks?.some((m) => m.type === 'strong'));
      expect(boldNode).to.exist;
      expect(boldNode.text).to.equal('bar');
    });

    it('renders inline image as text fallback in ADF', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // Image token hits the default branch in inlineToAdf
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: 'text with ![alt text](img.png) inside' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      // Image token has text="alt text" which is rendered as plain text via default branch
      const altNode = nodes.find((n) => n.text === 'alt text');
      expect(altNode).to.exist;
    });

    it('renders escaped markdown characters as plain text', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: 'Not \\*bold\\*' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      const boldNode = nodes.find((n) => n.marks?.some((m) => m.type === 'strong'));
      expect(boldNode).to.not.exist;
    });

    it('handles escaped chars inside bold (escape token with parent marks)', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '**bold \\* star**' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      // Escape token inside bold should have strong mark
      const starNode = nodes.find((n) => n.text === '*' && n.marks?.some((m) => m.type === 'strong'));
      expect(starNode).to.exist;
    });

    it('handles image inside bold text (default inline with parent marks)', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '**text ![alt](img.png) more**' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const nodes = body.fields.description.content[0].content;
      // Image alt text inside bold should get strong mark via default branch
      const imgNode = nodes.find((n) => n.text === 'alt' && n.marks?.some((m) => m.type === 'strong'));
      expect(imgNode).to.exist;
    });

    it('returns null for whitespace-only description (empty tokensToAdf result)', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // Whitespace-only is trimmed to empty, returns null (omits field)
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '   ' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      expect(body.fields).to.not.have.property('description');
    });

    it('renders plain bullet list items without inline tokens', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // Single word list items may produce text tokens without .tokens
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '- alpha\n- beta' });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const list = body.fields.description.content[0];
      expect(list.type).to.equal('bulletList');
      expect(list.content[0].content[0].content[0].text).to.equal('alpha');
    });

    it('pads empty table cells with a space to satisfy ADF minimum-content', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // Markdown table with an empty cell
      const description = '| A | B |\n|---|---|\n| data |  |';
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const dataRow = body.fields.description.content[0].content[1];
      const emptyCell = dataRow.content[1];
      expect(emptyCell.type).to.equal('tableCell');
      // Empty cell should be padded with a space
      expect(emptyCell.content[0].content[0].text).to.equal(' ');
    });

    it('renders complex markdown document with multiple block types', async () => {
      const httpClient = makeHttpClient({ id: '1', key: 'ASO-1' });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const description = [
        '## Issues Found',
        '',
        'The following **accessibility** issues were detected:',
        '',
        '- Missing `alt` text on hero image',
        '- Low contrast ratio on CTA',
        '',
        '> These affect WCAG 2.1 compliance',
        '',
        '```html',
        '<img src="hero.jpg">',
        '```',
      ].join('\n');
      await client.createTicket({ projectKey: 'ASO', summary: 'x', description });
      const body = JSON.parse(httpClient.fetch.firstCall.args[1].body);
      const types = body.fields.description.content.map((n) => n.type);
      expect(types).to.include('heading');
      expect(types).to.include('paragraph');
      expect(types).to.include('bulletList');
      expect(types).to.include('blockquote');
      expect(types).to.include('codeBlock');
    });

    it('throws on non-2xx response without leaking response body', async () => {
      const httpClient = makeHttpClient({ errorMessages: ['Not found'] }, 404);
      const log = makeLog();

      const client = new JiraCloudClient(VALID_CONFIG, makeCredentialManager(), httpClient, log);

      await expect(client.createTicket({ projectKey: 'ASO', summary: 'x', description: '' }))
        .to.be.rejectedWith('Jira API error: 404');

      // Must not log response body (may contain PII/tokens)
      expect(log.error.firstCall.args[1]).to.not.have.property('body');
    });
  });

  describe('listProjects', () => {
    it('returns projects from Jira response', async () => {
      const httpClient = makeHttpClient({
        values: [{ id: '10001', key: 'ASO', name: 'AEM Sites Optimizer' }],
      });

      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      const projects = await client.listProjects();
      expect(projects).to.deep.equal([{ id: '10001', key: 'ASO', name: 'AEM Sites Optimizer' }]);
    });

    it('returns empty array when Jira response omits values', async () => {
      const httpClient = makeHttpClient({}); // no values key
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const projects = await client.listProjects();
      expect(projects).to.deep.equal([]);
    });

    it('paginates across multiple pages until isLast is true', async () => {
      const stub = sinon.stub();
      stub.onFirstCall().resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({
          values: [{ id: '10001', key: 'ASO', name: 'Project A' }], isLast: false,
        }),
      });
      stub.onSecondCall().resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({
          values: [{ id: '10002', key: 'SITES', name: 'Project B' }], isLast: true,
        }),
      });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        { fetch: stub },
        makeLog(),
      );
      const projects = await client.listProjects();
      expect(projects).to.deep.equal([
        { id: '10001', key: 'ASO', name: 'Project A' },
        { id: '10002', key: 'SITES', name: 'Project B' },
      ]);
      expect(stub.callCount).to.equal(2);
    });

    it('stops when subsequent page returns empty values (page.length === 0 branch)', async () => {
      const stub = sinon.stub();
      stub.onCall(0).resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({ values: [{ id: '10001', key: 'A', name: 'A' }], isLast: false }),
      });
      stub.onCall(1).resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({ values: [], isLast: false }),
      });
      // eslint-disable-next-line max-len
      const client = new JiraCloudClient(VALID_CONFIG, makeCredentialManager(), { fetch: stub }, makeLog());
      const projects = await client.listProjects();
      expect(projects).to.deep.equal([{ id: '10001', key: 'A', name: 'A' }]);
    });

    it('throws on non-2xx response without leaking response body', async () => {
      const httpClient = makeHttpClient({ errorMessages: ['Forbidden'] }, 403);
      const log = makeLog();
      const client = new JiraCloudClient(VALID_CONFIG, makeCredentialManager(), httpClient, log);
      await expect(client.listProjects()).to.be.rejectedWith('Jira API error: 403');
      expect(log.error.firstCall.args[1]).to.not.have.property('body');
    });
  });

  describe('listIssueTypes', () => {
    const hierarchyResponse = {
      hierarchy: [
        { level: 0, issueTypes: [{ id: 10001, name: 'Story' }, { id: 10002, name: 'Bug' }] },
        { level: 1, issueTypes: [{ id: 10003, name: 'Epic' }] },
        { level: -1, issueTypes: [{ id: 10004, name: 'Subtask' }] },
      ],
    };

    it('returns non-subtask issue types from hierarchy (level >= 0)', async () => {
      const httpClient = makeHttpClient(hierarchyResponse);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const issueTypes = await client.listIssueTypes('10000');
      expect(issueTypes).to.deep.equal([
        { id: '10001', name: 'Story' },
        { id: '10002', name: 'Bug' },
        { id: '10003', name: 'Epic' },
      ]);
    });

    it('returns empty array when hierarchy is absent', async () => {
      const httpClient = makeHttpClient({});
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const issueTypes = await client.listIssueTypes('10000');
      expect(issueTypes).to.deep.equal([]);
    });

    it('handles hierarchy level with missing issueTypes array', async () => {
      const httpClient = makeHttpClient({ hierarchy: [{ level: 0 }] });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const issueTypes = await client.listIssueTypes('10000');
      expect(issueTypes).to.deep.equal([]);
    });

    it('throws when projectId is missing', async () => {
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        makeHttpClient({}),
        makeLog(),
      );
      await expect(client.listIssueTypes('')).to.be.rejectedWith('projectId is required');
    });

    it('throws on non-2xx response without leaking response body', async () => {
      const httpClient = makeHttpClient({ errorMessages: ['Forbidden'] }, 403);
      const log = makeLog();
      const client = new JiraCloudClient(VALID_CONFIG, makeCredentialManager(), httpClient, log);
      await expect(client.listIssueTypes('10000')).to.be.rejectedWith('Jira API error: 403');
    });
  });

  // Magic-byte prefixes for each binary MIME type (PNG, JPEG, GIF, WEBP, PDF).
  // Using minimal valid headers padded to 16 bytes so content passes both size
  // and magic-bytes checks without needing real file data in tests.
  const MAGIC_CONTENT = {
    'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(92).fill(0)]),
    'image/jpeg': Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(96).fill(0)]),
    'image/gif': Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...Array(94).fill(0)]),
    // WEBP: RIFF at [0] and WEBP at [8]
    'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, ...Array(88).fill(0)]),
    'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, ...Array(95).fill(0)]),
    'text/csv': Buffer.alloc(100, 'a'), // no magic bytes required for text types
    'text/plain': Buffer.alloc(100, 'a'),
  };

  describe('uploadAttachment', () => {
    let validAttachment;

    beforeEach(() => {
      validAttachment = {
        content: MAGIC_CONTENT['text/plain'],
        mimeType: 'text/plain',
        filename: 'a11y-fix-143.diff',
      };
    });

    it('uploads attachment successfully and calls the correct Jira endpoint', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      await client.uploadAttachment('ASO-123', validAttachment);

      const [calledUrl, options] = httpClient.fetch.firstCall.args;
      expect(calledUrl).to.include('/issue/ASO-123/attachments');
      expect(calledUrl).to.include('api.atlassian.com/ex/jira');
      expect(options.method).to.equal('POST');
      expect(options.headers['X-Atlassian-Token']).to.equal('no-check');
    });

    it('throws for invalid ticketKey format', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      await expect(client.uploadAttachment('invalid key!', validAttachment))
        .to.be.rejectedWith('Invalid ticketKey format');
    });

    it('throws for disallowed MIME type', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      await expect(client.uploadAttachment('ASO-1', {
        ...validAttachment,
        mimeType: 'application/javascript',
      })).to.be.rejectedWith('MIME type not allowed');
    });

    it('throws when content exceeds 3 MB', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      const oversized = Buffer.alloc(3 * 1024 * 1024 + 1, 'x');
      await expect(client.uploadAttachment('ASO-1', {
        ...validAttachment,
        content: oversized,
      })).to.be.rejectedWith('Attachment size');
    });

    it('throws when content is empty', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      await expect(client.uploadAttachment('ASO-1', {
        ...validAttachment,
        content: Buffer.alloc(0),
      })).to.be.rejectedWith('Attachment size');
    });

    it('strips path separators from filename', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      const formDataSpy = [];
      const origAppend = FormData.prototype.append;
      FormData.prototype.append = function appendSpy(name, blob, filename) {
        formDataSpy.push(filename);
        return origAppend.call(this, name, blob, filename);
      };

      try {
        await client.uploadAttachment('ASO-1', {
          ...validAttachment,
          filename: '../../etc/passwd.diff',
        });
        // Path separators stripped — traversal neutralized; '..' alone is harmless
        expect(formDataSpy[0]).to.not.include('/');
        expect(formDataSpy[0]).to.not.include('\\');
      } finally {
        FormData.prototype.append = origAppend;
      }
    });

    it('throws on Jira error response without leaking body', async () => {
      const httpClient = makeHttpClient({ errorMessages: ['Forbidden'] }, 403);
      const log = makeLog();
      const client = new JiraCloudClient(VALID_CONFIG, makeCredentialManager(), httpClient, log);

      await expect(client.uploadAttachment('ASO-1', validAttachment))
        .to.be.rejectedWith('Jira API error: 403');

      expect(log.error.firstCall.args[1]).to.not.have.property('body');
    });

    it('falls back to "attachment" filename when filename is undefined', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // Should not throw — undefined filename gets sanitized to "attachment"
      await expect(client.uploadAttachment('ASO-1', { ...validAttachment, filename: undefined }))
        .to.not.be.rejected;
    });

    it('falls back to "attachment" filename when filename is empty string', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // Should not throw — empty filename gets sanitized to "attachment"
      await expect(client.uploadAttachment('ASO-1', { ...validAttachment, filename: '' }))
        .to.not.be.rejected;
    });

    it('throws when content is null', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      await expect(client.uploadAttachment('ASO-1', { ...validAttachment, content: null }))
        .to.be.rejectedWith('Attachment size');
    });

    it('accepts all allowed MIME types with valid content', async () => {
      const allowedTypes = [
        'image/png', 'image/jpeg', 'image/gif', 'image/webp',
        'application/pdf', 'text/csv', 'text/plain',
      ];

      for (const mimeType of allowedTypes) {
        const httpClient = makeHttpClient({}, 200);
        const client = new JiraCloudClient(
          VALID_CONFIG,
          makeCredentialManager(),
          httpClient,
          makeLog(),
        );
        // eslint-disable-next-line no-await-in-loop
        await expect(client.uploadAttachment('ASO-1', {
          ...validAttachment,
          mimeType,
          content: MAGIC_CONTENT[mimeType],
        })).to.not.be.rejected;
      }
    });

    it('throws when content magic bytes do not match declared MIME type', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );

      // PNG MIME type but content is plain text bytes — magic bytes mismatch
      const fakeContent = Buffer.alloc(100, 'a');
      await expect(
        client.uploadAttachment('ASO-1', { ...validAttachment, mimeType: 'image/png', content: fakeContent }),
      ).to.be.rejectedWith('magic bytes mismatch');
    });

    it('rejects content shorter than magic-byte signature (bounds check)', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // PNG magic bytes need 8 bytes at offset 0; provide only 4 bytes
      const shortContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      await expect(
        client.uploadAttachment('ASO-1', { content: shortContent, mimeType: 'image/png', filename: 'x.png' }),
      ).to.be.rejectedWith('magic bytes mismatch');
    });

    it('accepts text/plain with arbitrary bytes (no magic-byte check for text types)', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      const randomContent = Buffer.alloc(100, 0x42);
      await expect(
        client.uploadAttachment('ASO-1', { ...validAttachment, mimeType: 'text/plain', content: randomContent }),
      ).to.not.be.rejected;
    });

    it('accepts ArrayBuffer content and validates size and magic bytes correctly', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // PNG magic bytes in an ArrayBuffer — should pass both size and magic-byte validation
      const pngBytes = new Uint8Array(MAGIC_CONTENT['image/png']);
      await expect(
        client.uploadAttachment('ASO-1', { content: pngBytes.buffer, mimeType: 'image/png', filename: 'test.png' }),
      ).to.not.be.rejected;
    });

    it('throws a descriptive size error for ArrayBuffer input (not a TypeError)', async () => {
      const httpClient = makeHttpClient({}, 200);
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        httpClient,
        makeLog(),
      );
      // Zero-length ArrayBuffer — should get the Attachment size error, not a Node TypeError
      await expect(
        client.uploadAttachment('ASO-1', { content: new ArrayBuffer(0), mimeType: 'text/plain', filename: 'f.txt' }),
      ).to.be.rejectedWith('Attachment size');
    });
  });

  // ── Auth retry (#withAuthRetry) ────────────────────────────────────────────

  describe('auth retry on 401', () => {
    /**
     * Credential manager that simulates a concurrent auth-service refresh:
     * first getAuthHeaders call returns a stale token, second returns a fresh one.
     * No forceRefreshAuthHeaders — #withAuthRetry uses getAuthHeaders (GET-only).
     */
    function makeRetryCredentialManager() {
      return {
        getAuthHeaders: sinon.stub()
          .onFirstCall()
          .resolves({ Authorization: 'Bearer stale-token' })
          .onSecondCall()
          .resolves({ Authorization: 'Bearer fresh-token' }),
      };
    }

    it('retries listIssueTypes on 401 when SM has a newer token (concurrent refresh)', async () => {
      const fetchStub = sinon.stub();
      fetchStub.onFirstCall().resolves({
        ok: false, status: 401, json: sinon.stub().resolves({}),
      });
      fetchStub.onSecondCall().resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({
          hierarchy: [{ level: 0, issueTypes: [{ id: 10, name: 'Bug' }] }],
        }),
      });
      const credMgr = makeRetryCredentialManager();
      const client = new JiraCloudClient(VALID_CONFIG, credMgr, { fetch: fetchStub }, makeLog());

      const result = await client.listIssueTypes('10000');
      expect(result).to.deep.equal([{ id: '10', name: 'Bug' }]);
      // getAuthHeaders called twice: before first attempt + re-read after 401
      expect(credMgr.getAuthHeaders.callCount).to.equal(2);
      // First attempt used stale-token; retry used fresh-token
      expect(fetchStub.firstCall.args[1].headers.Authorization).to.equal('Bearer stale-token');
      expect(fetchStub.secondCall.args[1].headers.Authorization).to.equal('Bearer fresh-token');
    });

    it('retries listProjects on 401 when SM has a newer token', async () => {
      const fetchStub = sinon.stub();
      fetchStub.onFirstCall().resolves({
        ok: false, status: 401, json: sinon.stub().resolves({}),
      });
      fetchStub.onSecondCall().resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({
          values: [{ id: '10001', key: 'ASO', name: 'Optimizer' }], isLast: true,
        }),
      });
      const credMgr = makeRetryCredentialManager();
      const client = new JiraCloudClient(VALID_CONFIG, credMgr, { fetch: fetchStub }, makeLog());

      const result = await client.listProjects();
      expect(result).to.deep.equal([{ id: '10001', key: 'ASO', name: 'Optimizer' }]);
      expect(credMgr.getAuthHeaders.callCount).to.equal(2);
    });

    it('retries createTicket on 401 when SM has a newer token', async () => {
      const fetchStub = sinon.stub();
      // First call: POST /issue → 401
      fetchStub.onFirstCall().resolves({
        ok: false, status: 401, json: sinon.stub().resolves({}),
      });
      // Second call: POST /issue retry → 201
      fetchStub.onSecondCall().resolves({
        ok: true, status: 201, json: sinon.stub().resolves({ id: '1', key: 'ASO-1' }),
      });
      // Third call: GET /issue/{key}?fields=status
      fetchStub.onThirdCall().resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({ fields: { status: { name: 'To Do' } } }),
      });
      const credMgr = makeRetryCredentialManager();
      const client = new JiraCloudClient(VALID_CONFIG, credMgr, { fetch: fetchStub }, makeLog());

      const result = await client.createTicket({ projectKey: 'ASO', summary: 'x', description: '' });
      expect(result.ticketKey).to.equal('ASO-1');
      // 3 calls: (1) before POST, (2) re-read after 401, (3) #fetchTicketStatus after create
      expect(credMgr.getAuthHeaders.callCount).to.equal(3);
    });

    it('retries uploadAttachment on 401 when SM has a newer token', async () => {
      const fetchStub = sinon.stub();
      fetchStub.onFirstCall().resolves({
        ok: false, status: 401, json: sinon.stub().resolves({}),
      });
      fetchStub.onSecondCall().resolves({
        ok: true, status: 200, json: sinon.stub().resolves({}),
      });
      const credMgr = makeRetryCredentialManager();
      const client = new JiraCloudClient(VALID_CONFIG, credMgr, { fetch: fetchStub }, makeLog());

      await expect(client.uploadAttachment('ASO-1', {
        content: Buffer.alloc(100, 'a'),
        mimeType: 'text/plain',
        filename: 'test.txt',
      })).to.not.be.rejected;
      expect(credMgr.getAuthHeaders.callCount).to.equal(2);
    });

    it('throws TOKEN_REFRESH_REQUIRED on 401 when SM still has the same token', async () => {
      // SM re-read returns the same stale token — retrying Jira would fail again.
      // #withAuthRetry must signal the caller to trigger an auth-service refresh.
      const fetchStub = sinon.stub().resolves({
        ok: false, status: 401, json: sinon.stub().resolves({}),
      });
      const credMgr = {
        getAuthHeaders: sinon.stub().resolves({ Authorization: 'Bearer stale-token' }),
      };
      const client = new JiraCloudClient(VALID_CONFIG, credMgr, { fetch: fetchStub }, makeLog());

      const err = await client.listIssueTypes('10000').catch((e) => e);
      expect(err.code).to.equal('TOKEN_REFRESH_REQUIRED');
      expect(fetchStub.callCount).to.equal(1); // no retry with same token
    });

    it('propagates REQUIRES_REAUTH when SM re-read shows requiresReauth', async () => {
      // Concurrent Lambda wrote requiresReauth:true while we were in-flight.
      const fetchStub = sinon.stub().onFirstCall().resolves({
        ok: false, status: 401, json: sinon.stub().resolves({}),
      });
      const reauthError = Object.assign(
        new Error('OAuth connection requires re-authorization'),
        { code: 'REQUIRES_REAUTH' },
      );
      const credMgr = {
        getAuthHeaders: sinon.stub()
          .onFirstCall()
          .resolves({ Authorization: 'Bearer stale-token' })
          .onSecondCall()
          .rejects(reauthError),
      };
      const client = new JiraCloudClient(VALID_CONFIG, credMgr, { fetch: fetchStub }, makeLog());

      const err = await client.listIssueTypes('10000').catch((e) => e);
      expect(err.code).to.equal('REQUIRES_REAUTH');
    });

    it('throws on 401 if retry also returns 401', async () => {
      const fetchStub = sinon.stub().resolves({
        ok: false, status: 401, json: sinon.stub().resolves({}),
      });
      const credMgr = makeRetryCredentialManager();
      const client = new JiraCloudClient(VALID_CONFIG, credMgr, { fetch: fetchStub }, makeLog());

      await expect(client.listIssueTypes('ASO')).to.be.rejectedWith('Jira API error: 401');
      expect(fetchStub.callCount).to.equal(2);
    });

    it('does not retry on non-401 errors (e.g. 403)', async () => {
      const fetchStub = sinon.stub().resolves({
        ok: false, status: 403, json: sinon.stub().resolves({}),
      });
      const credMgr = {
        getAuthHeaders: sinon.stub().resolves({ Authorization: 'Bearer token' }),
      };
      const client = new JiraCloudClient(VALID_CONFIG, credMgr, { fetch: fetchStub }, makeLog());

      await expect(client.listIssueTypes('ASO')).to.be.rejectedWith('Jira API error: 403');
      expect(credMgr.getAuthHeaders.callCount).to.equal(1);
      expect(fetchStub.callCount).to.equal(1);
    });
  });

  describe('listProjects pagination (3+ pages)', () => {
    it('handles missing values key on a pagination page', async () => {
      const stub = sinon.stub();
      stub.onCall(0).resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({
          values: [{ id: '10001', key: 'A', name: 'A' }], isLast: false,
        }),
      });
      // Page 2 returns no values key — defensive guard
      stub.onCall(1).resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({ isLast: true }),
      });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        { fetch: stub },
        makeLog(),
      );
      const projects = await client.listProjects();
      expect(projects).to.deep.equal([{ id: '10001', key: 'A', name: 'A' }]);
    });

    it('paginates across three pages to cover loop continuation', async () => {
      const stub = sinon.stub();
      // Page 1 (via #withAuthRetry)
      stub.onCall(0).resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({
          values: [{ id: '10001', key: 'A', name: 'A' }], isLast: false,
        }),
      });
      // Page 2 (loop iteration 1 — continues loop, covering startAt += page.length)
      stub.onCall(1).resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({
          values: [{ id: '10002', key: 'B', name: 'B' }], isLast: false,
        }),
      });
      // Page 3 (loop iteration 2 — breaks)
      stub.onCall(2).resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({
          values: [{ id: '10003', key: 'C', name: 'C' }], isLast: true,
        }),
      });
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        { fetch: stub },
        makeLog(),
      );
      const projects = await client.listProjects();
      expect(projects).to.deep.equal([
        { id: '10001', key: 'A', name: 'A' },
        { id: '10002', key: 'B', name: 'B' },
        { id: '10003', key: 'C', name: 'C' },
      ]);
      expect(stub.callCount).to.equal(3);
    });

    it('stops at MAX_PAGES (100) even when Jira keeps returning isLast: false', async () => {
      const stub = sinon.stub();
      // All pages return isLast: false with one project each — simulates a runaway pagination
      for (let i = 0; i <= 100; i += 1) {
        stub.onCall(i).resolves({
          ok: true,
          status: 200,
          json: sinon.stub().resolves({
            values: [{ id: `1000${i}`, key: `P${i}`, name: `Project ${i}` }],
            isLast: false,
          }),
        });
      }
      const client = new JiraCloudClient(
        VALID_CONFIG,
        makeCredentialManager(),
        { fetch: stub },
        makeLog(),
      );
      const projects = await client.listProjects();
      // Page 1 is the first fetch (#withAuthRetry), pages 2-100 are loop iterations.
      // MAX_PAGES = 100 → loop breaks when pageCount reaches 100, so 100 fetches total.
      expect(stub.callCount).to.equal(100);
      expect(projects).to.have.length(100);
    });
  });
});
