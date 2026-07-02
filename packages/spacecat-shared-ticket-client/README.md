# Spacecat Shared - Ticket Client

## Overview

The `spacecat-shared-ticket-client` package provides a provider-agnostic interface for creating and managing tickets in external task-management systems. The v1 implementation ships a fully-featured Jira Cloud client (`JiraCloudClient`) that targets the Jira REST API v3, handling OAuth 2.0 token lifecycle, ADF description formatting, file attachments, and rate-limit backoff automatically.

## Architecture

```
TicketClientFactory.create(connection, smClient, httpClient, log)
  └─ JiraCloudClient          ← implements BaseTicketClient
       ├─ OAuthCredentialManager  ← reads/refreshes tokens from AWS Secrets Manager
       └─ RateLimitAwareHttpClient ← wraps httpClient with 429 retry + backoff
```

Adding a new provider (e.g. Zendesk) requires only:
1. Implement a class extending `BaseTicketClient`
2. Add one entry to `CLIENT_MAP` in `ticket-client-factory.js`
3. Implement a `CredentialManager` if the auth model differs from OAuth 3LO

## Environment Setup

The following environment variables must be present at Lambda runtime. They are stored in HashiCorp Vault and injected at deploy time.

| Variable | Description |
|---|---|
| `JIRA_OAUTH_CLIENT_ID` | Client ID of your Jira OAuth 2.0 (3LO) app |
| `JIRA_OAUTH_CLIENT_SECRET` | Client secret of your Jira OAuth 2.0 (3LO) app |

The constructor throws immediately if either variable is missing — fail-fast prevents silent 401 errors at call time.

Per-connection OAuth tokens (`access_token`, `refresh_token`, `expiresAt`) are stored separately in AWS Secrets Manager at:

```
/mysticat/task-management/{organizationId}/{connectionId}
```

## Installation

```bash
npm install @adobe/spacecat-shared-ticket-client
```

## Usage

### Creating a client via the factory

The factory resolves the correct client and credential manager for a connection record automatically.

```javascript
import { TicketClientFactory } from '@adobe/spacecat-shared-ticket-client';

const client = TicketClientFactory.create(
  connection,   // DB connection record: { id, organizationId, provider, metadata }
  smClient,     // AWS Secrets Manager client
  httpClient,   // fetch-compatible HTTP client (e.g. @adobe/fetch)
  log,          // logger
);
```

### Creating a ticket

```javascript
const result = await client.createTicket({
  projectKey: 'ASO',
  issueType: 'Task',            // optional, defaults to 'Task'
  summary: 'Fix colour contrast on homepage hero',
  description: 'The hero banner fails WCAG AA contrast ratio.\n\nSee https://example.com/audit for details.',
  labels: ['a11y', 'mysticat'],  // optional
});

console.log(result);
// {
//   ticketId: '10042',              ← Jira internal numeric ID
//   ticketKey: 'ASO-42',
//   ticketUrl: 'https://yourorg.atlassian.net/browse/ASO-42',
//   ticketStatus: 'To Do',
// }
```

`description` accepts **markdown**. The client converts it to Atlassian Document Format (ADF) automatically using `marked.lexer()` for tokenization and a built-in `tokensToAdf` converter.

#### Supported markdown features

| Markdown | Jira renders as |
|---|---|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | `inline code` |
| `[text](url)` | clickable link |
| `~~strike~~` | ~~strikethrough~~ |
| `***bold italic***` | ***bold italic*** |
| `# Heading` … `###### H6` | heading levels 1–6 |
| `- item` | bullet list |
| `1. item` | numbered list |
| `` ```lang … ``` `` | syntax-highlighted code block |
| `> quote` | blockquote |
| `---` | horizontal rule |
| `\| A \| B \|` | table with headers |

#### Example with rich formatting

```javascript
const result = await client.createTicket({
  projectKey: 'ASO',
  summary: 'Fix colour contrast on homepage hero',
  description: [
    '## Accessibility Issues',
    '',
    'The following **critical** issues were detected:',
    '',
    '- Missing `alt` text on hero image',
    '- Low contrast ratio on [CTA button](https://example.com/audit)',
    '',
    '> These affect WCAG 2.1 Level AA compliance',
    '',
    '```html',
    '<img src="hero.jpg">',
    '```',
  ].join('\n'),
});
```

#### Behaviour notes

- Blank or whitespace-only description omits the field entirely (Jira treats missing and empty-ADF differently)
- Bare URLs are auto-linked by the markdown parser
- Empty table cells are padded with a space (ADF requires non-empty cell content)
- Empty text nodes are filtered out before sending to Jira
- Marks follow ADF constraints — inline code disallows all marks except link

### Listing projects

```javascript
const projects = await client.listProjects();
// [{ id: '10001', key: 'ASO', name: 'ASO Project' }, ...]
```

### Uploading an attachment

`uploadAttachment` is available on `JiraCloudClient` only (not all providers support attachments).

```javascript
import { JiraCloudClient } from '@adobe/spacecat-shared-ticket-client';

// client must be a JiraCloudClient instance
await client.uploadAttachment('ASO-42', {
  content: Buffer.from('...'),          // raw file bytes, 1 byte – 3 MB
  mimeType: 'image/png',                // must be in the allowed list
  filename: 'screenshot.png',           // sanitized automatically
});
```

Allowed MIME types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `application/pdf`, `text/csv`, `text/plain`.

### Rate limiting

`RateLimitAwareHttpClient` is applied automatically by `TicketClientFactory`. It retries HTTP 429 responses up to 4 times, honouring the `Retry-After` header when present and falling back to exponential backoff (2 s, 4 s, 8 s, 16 s) with ±30% jitter. Transient 5xx responses are also retried. Per-attempt timeout: 30 s.

## Error Handling

All methods return promises and throw on failure. Errors include a `status` property for HTTP-level failures.

```javascript
try {
  const result = await client.createTicket(ticketData);
} catch (err) {
  if (err.status === 429) { /* rate limited beyond retries */ }
  if (err.message.includes('requires re-authorization')) {
    // OAuth refresh token is revoked — user must re-connect
  }
}
```

Sensitive response bodies (which may contain tokens or PII) are never logged. Only the HTTP status code and operation name are included in error logs.

## Development

### Testing

```bash
npm test
```

100% statement, function, and line coverage is enforced; 97% branch coverage per repo convention.

### Linting

```bash
npm run lint
```

### Cleaning

```bash
npm run clean
```

## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0
