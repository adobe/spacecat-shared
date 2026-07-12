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

import BaseTicketClient from './base-ticket-client.js';
import markdownToAdf from '../adf/markdown-to-adf.js';

// ── Routing ───────────────────────────────────────────────────────────────────
const JIRA_GATEWAY = 'https://api.atlassian.com/ex/jira';

// ── Validation ────────────────────────────────────────────────────────────────
// Case-insensitive: Atlassian accessible-resources API returns lowercase UUIDs, but the
// Jira gateway accepts both casings — /i prevents spurious rejections if an admin tool
// or migration ever produces uppercase IDs. UUID_REGEX in ticket-client-factory.js is
// case-sensitive because DB-sourced IDs are always lowercase.
const CLOUD_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Jira project keys are 2-10 chars — [A-Z][A-Z0-9_]+ enforces the 2-char minimum intentionally.
// Single-letter project keys (e.g. A-1) are not supported.
const TICKET_KEY_REGEX = /^[A-Z][A-Z0-9_]+-\d+$/;
const DUE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// Jira Cloud enforced limit for summary field (server returns HTTP 400 when exceeded;
// not formally specified in the OpenAPI spec but consistently enforced in production)
const SUMMARY_MAX_LENGTH = 255;

// ── Attachment Rules (PR #150) ─────────────────────────────────────────────────
const ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024; // 3 MB — Lambda 6 MB sync limit with headroom
const ATTACHMENT_FILENAME_MAX_LENGTH = 255;
// Allowed MIME types only — blocks executables and active content
const ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/csv',
  'text/plain',
]);

// Magic-byte signatures for each allowed binary MIME type (extension spoofing prevention).
// Source: https://en.wikipedia.org/wiki/List_of_file_signatures
// Text types (text/csv, text/plain) have no reliable binary signature and are allowed
// through the MIME allowlist check; they rely on filename sanitization + Jira's AV scan.
const MAGIC_BYTES = {
  'image/png': [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  'image/gif': [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF8 (GIF87a or GIF89a)
  // WEBP: 'RIFF' at offset 0 AND 'WEBP' at offset 8
  'image/webp': [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // WEBP
  ],
  'application/pdf': [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
};

/**
 * Verifies that the raw file bytes match the expected MIME type's magic bytes.
 * Prevents extension spoofing (e.g. a .html file renamed to .png).
 *
 * Text types (text/csv, text/plain) have no reliable binary signature; this check
 * is skipped for them — the MIME allowlist remains the primary control.
 *
 * @param {string} mimeType
 * @param {Buffer|Uint8Array} content
 * @returns {boolean}
 */
function hasMagicBytes(mimeType, content) {
  const checks = MAGIC_BYTES[mimeType];
  if (!checks) {
    return true; // text/* — no magic-byte check
  }
  return checks.every(({ offset, bytes }) => {
    if (offset + bytes.length > content.length) {
      return false;
    }
    return bytes.every((b, i) => content[offset + i] === b);
  });
}

// ── ADF helpers ───────────────────────────────────────────────────────────────

/**
 * Truncates summary to Jira's 255-char hard limit.
 * Input is treated as plain text — no markup parsing.
 *
 * @param {string|null|undefined} text
 * @returns {string}
 */
function sanitizeSummary(text) {
  const plain = String(text ?? '').replace(/[\r\n]/g, ' ').trim();
  // Spread to code points (not UTF-16 chars) to avoid splitting surrogate pairs (emoji, etc.)
  return [...plain].slice(0, SUMMARY_MAX_LENGTH).join('');
}

/**
 * Sanitizes an attachment filename per PR #150 rules:
 * - Strips path separators (primary traversal vector)
 * - Removes null bytes and ASCII control characters
 * - Truncates to ATTACHMENT_FILENAME_MAX_LENGTH
 * - Falls back to "attachment" if result is empty
 *
 * @param {string} filename
 * @returns {string}
 */
function sanitizeFilename(filename) {
  const safe = String(filename ?? '')
    // Strip path separators — primary traversal vector (foo/../bar → foobar after this)
    .replace(/[/\\]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  // Spread to code points to avoid splitting surrogate pairs (emoji filenames).
  // Consistent with sanitizeSummary which uses the same pattern.
  const truncated = [...safe].slice(0, ATTACHMENT_FILENAME_MAX_LENGTH).join('');
  return truncated || 'attachment';
}

/**
 * Jira Cloud provider client (REST API v3 with ADF support).
 *
 * SSRF protection: all API calls route through the fixed Atlassian gateway
 * https://api.atlassian.com/ex/jira/{cloudId}/... — cloudId is validated as UUID.
 * instance_url / siteUrl are display-only (used to build the browse link) and never
 * used as request targets. siteUrl is validated as a parseable https URL but its
 * hostname is intentionally unrestricted: Premium/Enterprise sites may use a custom
 * domain (e.g. go.jira.acme.com) rather than *.atlassian.net.
 *
 * Content sanitization: suggestion-derived text is placed as plain-text leaf nodes only.
 * Summary is truncated to 255 chars (Jira hard limit).
 */
export default class JiraCloudClient extends BaseTicketClient {
  constructor(config, credentialManager, httpClient, log) {
    super(config, credentialManager, log);

    if (!CLOUD_ID_REGEX.test(config.cloudId)) {
      throw new Error(`Invalid cloudId format: ${config.cloudId}`);
    }

    // siteUrl is display-only — used to build the browse link (never an API target;
    // API calls route through the fixed api.atlassian.com gateway). Enterprise/Premium
    // sites may use a custom domain (e.g. go.jira.acme.com) instead of *.atlassian.net,
    // so the hostname is not restricted here. Still require a parseable https URL to keep
    // http:/javascript: and other unsafe schemes out of the returned ticketUrl.
    let siteUrlParsed;
    try {
      siteUrlParsed = new URL(config.siteUrl);
    } catch {
      throw new Error(`Invalid siteUrl: must be a valid https URL, got: ${config.siteUrl}`);
    }
    if (siteUrlParsed.protocol !== 'https:') {
      throw new Error(`Invalid siteUrl: must be a valid https URL, got: ${config.siteUrl}`);
    }

    this.httpClient = httpClient;
    this.baseUrl = `${JIRA_GATEWAY}/${config.cloudId}/rest/api/3`;
  }

  /**
   * Creates a Jira issue and returns identifiers for the created ticket.
   *
   * @param {object} ticketData
   * @param {string} ticketData.projectKey - Jira project key (e.g. "ASO")
   * @param {string} ticketData.issueType - Jira issue type name (e.g. "Task", "Bug").
   *   Required — Jira has no server-side default and not every project defines "Task".
   *   Resolve a valid type for the project via listIssueTypes() before calling.
   * @param {string} ticketData.summary - Issue summary (truncated to 255 chars)
   * @param {string} [ticketData.description] - Plain-text description (no ADF markup).
   *   Converted to ADF internally as plain-text leaf nodes only — callers MUST NOT
   *   pass pre-built ADF objects. This is a deliberate security contract: untrusted
   *   suggestion content is never rendered as structured markup (spec §13).
   * @param {string[]} [ticketData.labels=[]] - Labels to apply to the issue
   * @param {string} [ticketData.priority] - Jira priority name (e.g. "High"). Omitted if not
   *   provided — Jira uses the project default. Names are instance-specific; passed as-is.
   * @param {string} [ticketData.dueDate] - Due date in "YYYY-MM-DD" format.
   * @param {string[]} [ticketData.components] - Component names (e.g. ["Frontend", "API"]).
   * @param {string} [ticketData.parent] - Parent issue key (e.g. "ASO-42") for epic linking.
   *   Uses the unified `parent` field per Atlassian's deprecation of Epic Link / Parent Link.
   * **Idempotency:** Jira's issue creation endpoint is not idempotent. Retrying on
   * transient failure can create duplicate tickets. Callers requiring idempotency
   * should store the returned `ticketKey` and check for existing tickets before calling.
   * @returns {Promise<{ticketId: string, ticketKey: string,
   *   ticketUrl: string, ticketStatus: string|null}>}
   */
  async createTicket(ticketData) {
    this.#validateTicketInput(ticketData);
    const body = this.#buildTicketBody(ticketData);

    const response = await this.#withAuthRetry(
      (authHeaders) => this.httpClient.fetch(`${this.baseUrl}/issue`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        redirect: 'error',
        body: JSON.stringify(body),
      }),
    );

    await this.#requireOk(response, 'createTicket');
    const created = await response.json();
    const ticketStatus = await this.#fetchTicketStatus(created.key);
    return this.#buildTicketResult(created, ticketStatus);
  }

  /**
   * Returns all accessible Jira projects for the configured cloud instance.
   * Paginates automatically until Jira signals isLast: true.
   *
   * @returns {Promise<Array<{id: string, key: string, name: string}>>}
   */
  async listProjects() {
    const allProjects = [];
    let startAt = 0;
    const MAX_PAGES = 100; // Safety bound: 100 pages × 50 results = 5,000 projects max
    let pageCount = 0;

    // First page uses #withAuthRetry for 401 retry; subsequent pages reuse the
    // token validated on page 1 — a mid-pagination 401 is not retried (unlikely
    // given the token was just confirmed valid).
    const firstResponse = await this.#withAuthRetry(
      (authHeaders) => this.httpClient.fetch(
        `${this.baseUrl}/project/search?maxResults=50&orderBy=name&startAt=0`,
        { method: 'GET', headers: { ...authHeaders, Accept: 'application/json' }, redirect: 'error' },
      ),
    );
    await this.#requireOk(firstResponse, 'listProjects');
    const firstData = await firstResponse.json();
    const firstPage = (firstData.values ?? []).map(({ id, key, name }) => ({ id, key, name }));
    allProjects.push(...firstPage);
    pageCount += 1;

    if (firstData.isLast !== false || firstPage.length === 0) {
      return allProjects;
    }
    startAt += firstPage.length;

    // Paginate remaining pages with standard auth (token was just validated).
    // Jira /project/search caps maxResults at 50 per page — enterprise instances
    // routinely have 100+ projects, so pagination is required to avoid silent truncation.
    // Read auth headers once before the loop — avoids an SM round-trip per page.
    const paginationAuthHeaders = await this.credentialManager.getAuthHeaders();
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const response = await this.httpClient.fetch(
        `${this.baseUrl}/project/search?maxResults=50&orderBy=name&startAt=${startAt}`,
        { method: 'GET', headers: { ...paginationAuthHeaders, Accept: 'application/json' }, redirect: 'error' },
      );
      // eslint-disable-next-line no-await-in-loop
      await this.#requireOk(response, 'listProjects');
      // eslint-disable-next-line no-await-in-loop
      const data = await response.json();

      const page = (data.values ?? []).map(({ id, key, name }) => ({ id, key, name }));
      allProjects.push(...page);

      pageCount += 1;

      // isLast is explicitly false only when more pages follow; any other value means done.
      if (data.isLast !== false || page.length === 0 || pageCount >= MAX_PAGES) {
        break;
      }
      startAt += page.length;
    }

    return allProjects;
  }

  /**
   * Returns the creatable non-subtask issue types for a given project.
   *
   * Uses GET /issue/createmeta/{projectIdOrKey}/issuetypes (REST v3). Unlike the
   * /project/{id}/hierarchy endpoint (which Atlassian documents only for
   * team-managed / next-gen projects), createmeta carries no project-style
   * restriction, so it works uniformly across team-managed and company-managed
   * projects. It is permission-filtered: it returns the issue types the calling
   * user has the "Create issues" project permission for, so per-user differences
   * are handled by Jira rather than by this client.
   * (OAuth scope: read:jira-work.)
   *
   * The response is paginated ({ issueTypes, startAt, maxResults, total }) with
   * no isLast flag, so we page until an empty batch or startAt >= total.
   *
   * Each issue type carries a documented `subtask` boolean. Subtask types
   * (subtask: true) are excluded; all other types (standard + Epic) are
   * returned as { id, name }.
   *
   * @param {string} projectId - Jira project numeric ID (e.g. "10000") or key (e.g. "ASO")
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async listIssueTypes(projectId) {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('projectId is required to list issue types');
    }

    const pageSize = 50;
    const maxPages = 100;
    const issueTypes = [];
    let startAt = 0;

    for (let page = 0; page < maxPages; page += 1) {
      const url = `${this.baseUrl}/issue/createmeta/${encodeURIComponent(projectId)}/issuetypes`
        + `?startAt=${startAt}&maxResults=${pageSize}`;
      // eslint-disable-next-line no-await-in-loop
      const response = await this.#withAuthRetry(
        (authHeaders) => this.httpClient.fetch(
          url,
          { method: 'GET', headers: { ...authHeaders, Accept: 'application/json' }, redirect: 'error' },
        ),
      );
      // eslint-disable-next-line no-await-in-loop
      await this.#requireOk(response, 'listIssueTypes');
      // eslint-disable-next-line no-await-in-loop
      const data = await response.json();

      const batch = data.issueTypes ?? [];
      for (const { id, name, subtask } of batch) {
        // `subtask` (boolean) is the documented field on createmeta issue types;
        // hierarchyLevel is not part of this response schema. Keep everything
        // that is not a subtask (standard types + Epic).
        if (!subtask) {
          issueTypes.push({ id: String(id), name });
        }
      }

      startAt += batch.length;
      if (batch.length === 0 || startAt >= (data.total ?? 0)) {
        break;
      }
    }

    return issueTypes;
  }

  /**
   * Uploads a file attachment to an existing Jira issue.
   *
   * Validates file size, MIME type, and filename before sending.
   * Uses multipart/form-data with X-Atlassian-Token: no-check (required by Jira).
   *
   * PR #150 reference: "Attachment Validation" section — 3 MB limit, MIME whitelist,
   * filename sanitization, X-Atlassian-Token header.
   *
   * @param {string} ticketKey - Jira issue key, e.g. "ASO-123"
   * @param {object} attachment
   * @param {Buffer|Uint8Array} attachment.content - Raw file bytes
   * @param {string} attachment.mimeType - MIME type (must be in allowlist)
   * @param {string} attachment.filename - Original filename (will be sanitized)
   * @returns {Promise<void>}
   */
  async uploadAttachment(ticketKey, attachment) {
    this.#validateAttachment(ticketKey, attachment);

    const { content, mimeType, filename } = attachment;
    const safeFilename = sanitizeFilename(filename);

    // FormData / Blob are available in Node 18+ (Lambda runtime)
    const formData = new FormData();
    formData.append('file', new Blob([content], { type: mimeType }), safeFilename);

    const response = await this.#withAuthRetry(
      (authHeaders) => this.httpClient.fetch(
        `${this.baseUrl}/issue/${encodeURIComponent(ticketKey)}/attachments`,
        {
          method: 'POST',
          headers: {
            ...authHeaders,
            // Required by Jira to disable its own CSRF check on the attachments endpoint
            'X-Atlassian-Token': 'no-check',
          },
          redirect: 'error',
          body: formData,
        },
      ),
    );

    await this.#requireOk(response, 'uploadAttachment');
  }

  // ── Auth retry ──────────────────────────────────────────────────────────────

  /**
   * Wraps a Jira API call with retry-once on 401.
   *
   * If getAuthHeaders() throws REQUIRES_REAUTH, the error propagates
   * immediately — no Jira call is attempted.
   *
   * On first 401: re-reads SM via getAuthHeaders(). If a concurrent caller
   * (e.g. auth-service ensure-tokens) already refreshed and SM holds a
   * different valid token, retries once with it. If SM still holds the same
   * revoked token, throws TOKEN_REFRESH_REQUIRED so the caller can trigger
   * a refresh via ensure-tokens.
   *
   * NOTE: this does NOT consume a refresh token or write to SM. Token
   * rotation is the auth-service's responsibility.
   *
   * @param {Function} requestFn - async (authHeaders) => Response
   * @returns {Promise<Response>}
   * @throws {Error} TOKEN_REFRESH_REQUIRED - SM still holds the rejected token; caller must
   *   trigger ensure-tokens. The error carries `code: 'TOKEN_REFRESH_REQUIRED'` and
   *   `status: 401` (the HTTP status returned by Jira).
   * @throws {Error} REQUIRES_REAUTH - credential manager flagged the connection as revoked.
   *   Also thrown if a concurrent caller flags the connection during the retry window.
   */
  async #withAuthRetry(requestFn) {
    const authHeaders = await this.credentialManager.getAuthHeaders();
    const response = await requestFn(authHeaders);

    if (response.status === 401) {
      this.log.debug('Jira API returned 401 — re-reading SM for a concurrent refresh');
      // 401 means Jira revoked the access token (refresh-token rotation window
      // closed). Re-read SM to pick up tokens written by a concurrent caller
      // (e.g. auth-service ensure-tokens).
      // NOTE: this Lambda does NOT refresh tokens itself — token rotation is
      // the auth-service's responsibility (it has SM PUT + Atlassian credentials).
      const freshHeaders = await this.credentialManager.getAuthHeaders();
      if (freshHeaders.Authorization === authHeaders.Authorization) {
        // SM still holds the same revoked token — caller must trigger a refresh
        // via ensure-tokens (auth-service).
        throw Object.assign(
          new Error('Jira rejected the access token'),
          { code: 'TOKEN_REFRESH_REQUIRED', status: 401 },
        );
      }
      return requestFn(freshHeaders);
    }

    return response;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Validates a ticket key, MIME type, file size, and magic bytes before uploading.
   * Throws with a descriptive message on the first failing rule.
   *
   * Validation order mirrors the spec §Attachment Validation:
   *   1. ticketKey format
   *   2. MIME type allowlist
   *   3. Content byte length (1 byte ≤ size ≤ 3 MB)
   *   4. Magic bytes — prevents extension spoofing (e.g. .html renamed to .png)
   */
  // eslint-disable-next-line class-methods-use-this
  #validateAttachment(ticketKey, { mimeType, content }) {
    if (!TICKET_KEY_REGEX.test(ticketKey)) {
      throw new Error(`Invalid ticketKey format: ${ticketKey}`);
    }

    if (!ATTACHMENT_ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(`Attachment MIME type not allowed: ${mimeType}`);
    }

    // Normalize ArrayBuffer → Uint8Array so byte-length and magic-byte checks work uniformly.
    // Buffer.byteLength throws a TypeError on ArrayBuffer, and indexed access (content[n])
    // returns undefined on raw ArrayBuffer — normalization avoids both pitfalls.
    const bytes = content instanceof ArrayBuffer ? new Uint8Array(content) : content;
    const byteLength = Buffer.isBuffer(bytes) || bytes instanceof Uint8Array
      ? bytes.length
      : Buffer.byteLength(bytes ?? '');
    if (byteLength === 0 || byteLength > ATTACHMENT_MAX_BYTES) {
      throw new Error(
        `Attachment size must be between 1 byte and ${ATTACHMENT_MAX_BYTES} bytes, got ${byteLength}`,
      );
    }

    if (!hasMagicBytes(mimeType, bytes)) {
      throw new Error(
        `Attachment content does not match declared MIME type '${mimeType}' (magic bytes mismatch)`,
      );
    }
  }

  /**
   * Validates all createTicket input fields and throws on the first failing rule.
   * Separated from createTicket() so validation logic has a single reason to change.
   *
   * @param {object} ticketData - same shape as createTicket() parameter
   */
  // eslint-disable-next-line class-methods-use-this
  #validateTicketInput({
    projectKey, issueType, summary, labels = [], dueDate, parent,
  }) {
    if (!projectKey || typeof projectKey !== 'string') {
      throw new Error('projectKey is required to create a ticket');
    }

    // issueType is required — Jira create needs fields.issuetype and there is no
    // server-side default. Not every project has a "Task" type (team-managed / custom
    // schemes), so the caller must resolve a valid type via listIssueTypes() first
    // rather than relying on a hard-coded fallback that could 400 at create time.
    if (!issueType || typeof issueType !== 'string' || !issueType.trim()) {
      throw new Error('issueType is required to create a ticket');
    }

    if (!summary || !String(summary).trim()) {
      throw new Error('summary is required to create a ticket');
    }

    const invalidLabel = labels.find((l) => /\s/.test(String(l)));
    if (invalidLabel !== undefined) {
      throw new Error(`Label must not contain whitespace, got: '${invalidLabel}'`);
    }

    if (dueDate) {
      if (!DUE_DATE_REGEX.test(dueDate)) {
        throw new Error(`Invalid dueDate format: expected YYYY-MM-DD, got: ${dueDate}`);
      }
      // Reject format-valid but impossible dates like 2026-02-31.
      // V8's Date constructor overflows silently (Feb 31 → Mar 3) instead of returning NaN,
      // so isNaN-check is not enough — use component round-trip to catch impossible dates.
      // Date.UTC + getUTC* avoids local-timezone skew in non-Lambda environments.
      const [y, m, d] = dueDate.split('-').map(Number);
      const parsed = new Date(Date.UTC(y, m - 1, d));
      const dateValid = parsed.getUTCFullYear() === y
        && parsed.getUTCMonth() === m - 1
        && parsed.getUTCDate() === d;
      if (!dateValid) {
        throw new Error(`Invalid dueDate: not a real calendar date, got: ${dueDate}`);
      }
    }

    if (parent && !TICKET_KEY_REGEX.test(parent)) {
      throw new Error(`Invalid parent format: expected Jira issue key, got: ${parent}`);
    }
  }

  /**
   * Builds the Jira REST API request body for issue creation.
   * Handles ADF conversion and optional field spreading.
   * Separated from createTicket() so field-mapping has a single reason to change.
   *
   * @param {object} ticketData - same shape as createTicket() parameter
   * @returns {object} Jira issue creation request body
   */
  // eslint-disable-next-line class-methods-use-this
  #buildTicketBody({
    projectKey,
    issueType,
    summary,
    description,
    labels = [],
    priority,
    dueDate,
    components,
    parent,
  }) {
    // markdownToAdf returns null for blank input — omit the field rather than
    // sending an empty ADF document (some Jira issue types treat them differently).
    const adfDescription = markdownToAdf(description);
    return {
      fields: {
        project: { key: projectKey },
        issuetype: { name: issueType },
        summary: sanitizeSummary(summary),
        ...(adfDescription && { description: adfDescription }),
        labels: labels.map((l) => String(l)),
        ...(priority && { priority: { name: priority } }),
        ...(dueDate && { duedate: dueDate }),
        ...(components?.length > 0 && { components: components.map((c) => ({ name: c })) }),
        ...(parent && { parent: { key: parent } }),
      },
    };
  }

  /**
   * Fetches the current status of an issue via GET /rest/api/3/issue/{key}?fields=status.
   * Called immediately after create — Jira POST /issue response does not include fields.
   * Returns null on any non-fatal error so ticket creation is never blocked.
   *
   * @param {string} ticketKey
   * @returns {Promise<string|null>}
   */
  async #fetchTicketStatus(ticketKey) {
    try {
      const authHeaders = await this.credentialManager.getAuthHeaders();
      const response = await this.httpClient.fetch(
        `${this.baseUrl}/issue/${encodeURIComponent(ticketKey)}?fields=status`,
        { method: 'GET', headers: { ...authHeaders, Accept: 'application/json' }, redirect: 'error' },
      );
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data.fields?.status?.name ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Extracts and validates the Jira API response body into a TicketResult.
   * Validates ticketKey format and ticketUrl host as defensive invariants.
   */
  #buildTicketResult(data, ticketStatus = null) {
    // Jira internal numeric ID — API service uses this to persist the Ticket entity
    const ticketId = String(data.id);
    const ticketKey = data.key;
    const ticketUrl = `${this.config.siteUrl}/browse/${ticketKey}`;

    if (!TICKET_KEY_REGEX.test(ticketKey)) {
      throw new Error(`Unexpected ticketKey format returned from Jira: ${ticketKey}`);
    }

    // Defensive invariant: ticketUrl is built from siteUrl, so hosts must match.
    // Unreachable in practice but guards against future refactors that could skew this.
    const expectedHost = new URL(this.config.siteUrl).host;
    const actualHost = new URL(ticketUrl).host;
    // c8 ignore next 3 — unreachable by construction: ticketUrl is always built from
    // this.config.siteUrl, so hosts always match. Guard remains as a defence against
    // future refactors that could accidentally decouple the two URLs.
    /* c8 ignore next 3 */
    if (expectedHost !== actualHost) {
      throw new Error(`ticketUrl host mismatch: expected ${expectedHost}, got ${actualHost}`);
    }

    return {
      ticketId,
      ticketKey,
      ticketUrl,
      ticketStatus,
    };
  }

  /**
   * Throws a structured error if the Jira API response is not OK.
   * Never logs the raw response body — it may contain tokens, PII, or internal hosts.
   */
  async #requireOk(response, operation) {
    if (!response.ok) {
      this.log.error(`Jira API error in ${operation}`, {
        status: response.status,
        operation,
      });
      throw Object.assign(new Error(`Jira API error: ${response.status}`), {
        status: response.status,
      });
    }
  }
}
