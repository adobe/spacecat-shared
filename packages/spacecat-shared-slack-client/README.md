# Spacecat Shared - Slack Client

This package provides a set of tools for interacting with Slack workspaces, specifically designed to cater to different organizational needs. It facilitates message posting, channel management, user invitations, and file uploads, with support for both standard and elevated privileges.

## Installation

Install the package using npm:

```bash
npm install @adobe/spacecat-shared-slack-client
```

## Features

- **Client Creation**: Utilize a factory method to create Slack clients for different targets, with or without elevated privileges.
- **Message Posting**: Send messages to channels or threads, including advanced formatting with Slack Block Builder.
- **Channel Management**: Create Slack channels and manage their details.
- **User Invitations**: Invite users to channels via email.
- **File Uploading**: Upload files to Slack channels.

## Configuration

The package uses environment variables for configuration. Set the following variables in your environment:

### Configuring Tokens

To configure tokens for your application, follow these steps:

1. Visit the main page of your Slack app at [https://api.slack.com/apps](https://api.slack.com/apps).

2. Navigate to the "OAuth & Permissions" page and locate the "Scope" section. Here, you can add scopes to your Slack app based on the specific methods you intend to use from the Slack API. For example, if your app requires file upload functionality, ensure you add the `files:read` and `files:write` scopes.

3. Locate your Slack bot token under the "Bot User OAuth Token" section on the same page. You will need to provide this token to the `SlackClient` in your application.

4. For information on the scopes needed for each Slack API method, refer to the [documentation](https://api.slack.com/methods). The required scopes for each API method are listed in the "Bot tokens" row. As an example, to use the `postMessage` API method, the required scope is `chat:write`, as documented in [https://api.slack.com/methods/chat.postMessage](https://api.slack.com/methods/chat.postMessage).

### Scopes required for the current implementation
All Bot Tokens:
```
chat:write
files:read
files:write
team:read
```

Scopes needed for elevated Bot:
```
channels:manage (for public channels)
channels:read (check if user is in a channel or a channel exists)
channels:write.invites
channels:write.topic
groups:read (check if user is in a channel or a channel exists)
groups:write (for private channels)
groups:write.invites
groups:write.topic
users:read (to lookup users, required by users:read.email)
users:read.email (to lookup users by their emails)
```

### Standard Client

- `SLACK_TOKEN_ADOBE_INTERNAL`
- `SLACK_TOKEN_ADOBE_EXTERNAL`

### Elevated Client

- `SLACK_TOKEN_ADOBE_INTERNAL_ELEVATED`
- `SLACK_TOKEN_ADOBE_EXTERNAL_ELEVATED`
- `SLACK_OPS_CHANNEL_ADOBE_INTERNAL`
- `SLACK_OPS_CHANNEL_ADOBE_EXTERNAL`
- `SLACK_OPS_ADMINS_ADOBE_INTERNAL`
- `SLACK_OPS_ADMINS_ADOBE_EXTERNAL`

## Usage

### Client Creation

Create a Slack client instance:

```javascript
import { BaseSlackClient, ElevatedSlackClient, SLACK_TARGETS } from '@adobe/spacecat-shared-slack-client';

const context = {}; // Your context object
const target = SLACK_TARGETS.ADOBE_INTERNAL; // or ADOBE_EXTERNAL
const slackClient = BaseSlackClient.createFrom(context, target);
// elevated client:
const elevatedclient = ElevatedSlackClient.createFrom(context, target);
```

### Posting a Message

```javascript
await slackClient.postMessage({
  channel: 'channel-id',
  text: 'Hello, world!',
});
```

### Creating a Channel

```javascript
const channel = await slackClient.createChannel('channel-name', 'Topic', 'Description', true);
```

### Inviting Users

```javascript
await slackClient.inviteUsersByEmail('channel-id', [{ email: 'user@example.com' }]);
```

### Uploading a File

```javascript
await slackClient.fileUpload({
  file: 'path/to/file.png',
  filename: 'file.png',
  channel_id: 'channel-id',
});
```

## Testing

To run tests:

```bash
npm test
```

## Linting

Lint your code:

```bash
npm run lint
```

## Cleaning

To remove `node_modules` and `package-lock.json`:

```bash
npm run clean
```

## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0

---

This revised README provides a structured and straightforward guide to the package, ensuring users can quickly understand its capabilities and how to use them effectively.
