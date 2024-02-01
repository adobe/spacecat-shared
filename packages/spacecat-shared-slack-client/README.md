# Spacecat Shared - Slack Client

A library utility to manage to interact with different Slack organizations.

## Installation

```
npm install @adobe/spacecat-shared-slack-client
```

## Usage

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

### Creating and instance from Helix UniversalContext

```js
import createFrom from '@adobe/spacecat-shared-slack-client';

const context = {}; // Your Helix UniversalContext object
const target = 'ADOBE_INTERNAL';
const isElevated = false; // optional, defaults to false
const slackClient = createFrom(context, target, isElevated);
```

**Required env variables in Helix UniversalContext**

At least one of the following environment variables should exist in Helix UniversalContext

```
SLACK_TOKEN_ADOBE_INTERNAL="slack bot token for the adobe internal org"
SLACK_TOKEN_ADOBE_EXTERNAL="slack bot token for the adobe external org"
```

Additionally, when using the elevated slack client, the following environment variables are required:

```
SLACK_TOKEN_ADOBE_INTERNAL_ELEVATED="slack bot token for the adobe internal org"
SLACK_TOKEN_ADOBE_EXTERNAL_ELEVATED="slack bot token for the adobe external org"
SLACK_OPS_CHANNEL_ADOBE_INTERNAL="slack channel id for the ops channel to which status and action required messages are sent"
SLACK_OPS_CHANNEL_ADOBE_EXTERNAL="slack channel id for the ops channel to which status and action required messages are sent"
SLACK_OPS_ADMINS_ADOBE_INTERNAL="comma separated list of slack user ids who are invited to created channels"
SLACK_OPS_ADMINS_ADOBE_EXTERNAL="comma separated list of slack user ids who are invited to created channels"
```

**Note**: if Helix UniversalContext object already contains a `slackClients` field, then `createFrom` factory method returns the previously created instance instead of creating a new one.

### Constructor

`ElevatedSlackClient` or `BaseSlackClient` need a slack bot token, an ops config and a logger object:

```js
const token = 'slack bot token';
const opsConfig = {
  channel: 'mandatory slack channel id for the ops channel to which status and action required messages are sent',
  admins: 'optional comma separated list of slack user ids who are invited to created channels',
};
const slackClient = new SlackClient(token, opsConfig, console);
```

### Channel Creation && Invitation

#### Creating a channel

```js
import createFrom, { SLACK_TARGETS } from '@adobe/spacecat-shared-slack-client';

const elevatedClient = createFrom(context, SLACK_TARGETS.ADOBE_EXTERNAL, true);
const channel = await elevatedClient.createChannel(
  channelName,
  'This is a test topic',
  'This is a test description',
  false, // public vs private channel
);
```

#### Inviting a user to a channel

```js
import createFrom, { SLACK_TARGETS } from '@adobe/spacecat-shared-slack-client';

const elevatedClient = createFrom(context, SLACK_TARGETS.ADOBE_EXTERNAL, true);

const result = await elevatedClient.inviteUsersByEmail(channel.getId(), [
  {
    email: 'user1@email.com',
    realName: 'User 1',
  },
  {
    email: 'user3@acme.com',
    realName: 'User 2',
  },
]);
```

### Posting a message

#### Posting a text message

```js
import createFrom, { SLACK_TARGETS } from '@adobe/spacecat-shared-slack-client';

const channelId = 'channel-id'; // channel to send the message to
const threadId = 'thread-id'; // thread id to send the message under (optional)

const internalSlackClient = createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL);

await internalSlackClient.postMessage({
  text: 'HELLO WORLD!',
  channel: 'channel-id',
  thread_ts: threadId, // (optional)
});
```

#### Posting a simple text message using Slack Block Builder (recommended)

```js
import createFrom, { SLACK_TARGETS } from '@adobe/spacecat-shared-slack-client';
import { Message, Blocks, Elements } from 'slack-block-builder';

const channelId = 'channel-id'; // channel to send the message to
const threadId = 'thread-id'; // thread id to send the message under (optional)

// Create a SlackClient instance from a helix universal context object
const internalSlackClient = SlackClient.createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL);

// build the message to be sent to Slack
const message = Message()
  .text('Alas, my friend.')
  .channel(channelId)
  .threadTs(threadId) //optional
  .buildToObject();

await internalSlackClient.postMessage(message);

```

#### Posting a non-trivial message using Slack Block Builder (recommended)

```js
import createFrom, { SLACK_TARGETS } from '@adobe/spacecat-shared-slack-client';
import { Message, Blocks, Elements } from 'slack-block-builder';

const channelId = 'channel-id'; // channel to send the message to
const threadId = 'thread-id'; // thread id to send the message under (optional)

// Create a SlackClient instance from a helix universal context object
const internalSlackClient = SlackClient.createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL);

// build the message to be sent to Slack
const message = Message()
  .channel(channelId)
  .threadTs(threadId) //optional
  .text('Alas, my friend.')
  .blocks(
    Blocks.Section()
      .text('One does not simply walk into Slack and click a button.'),
    Blocks.Section()
      .text('At least that\'s what my friend Slackomir said :crossed_swords:'),
    Blocks.Divider(),
    Blocks.Actions()
      .elements(
        Elements.Button()
          .text('Sure One Does')
          .actionId('gotClicked')
          .danger(dangerLevel > 42), // Optional argument, defaults to 'true'
        Elements.Button()
          .text('One Does Not')
          .actionId('scaredyCat')
          .primary()))
  .asUser()
  .buildToObject();

await internalSlackClient.postMessage(message);

```

### Uploading a file

```js
import createFrom, { SLACK_TARGETS } from '@adobe/spacecat-shared-slack-client';

const channelId = 'channel-id'; // channel to send the message to
const threadId = 'thread-id'; // thread id to send the message under (optional)

const internalSlackClient = SlackClient.createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL);

await internalSlackClient.fileUpload({
  file: './path/to/logo.png',  // also accepts Buffer or ReadStream
  filename: 'logo.png',
  initial_comment: 'Here is the new company logo',
  channel_id: channelId,
  thread_ts: threadId, // (optional)
});
```

## Testing
Run the included tests with the following command:
```
npm test
```

## Linting
Lint the codebase using:
```
npm run lint
```

## Cleaning
To clean the package (remove `node_modules` and `package-lock.json`):
```
npm run clean
```

## Repository
Find the source code and contribute [here](https://github.com/adobe/spacecat-shared.git).

## Issues
Report issues or bugs [here](https://github.com/adobe/spacecat-shared/issues).

## License
This project is licensed under the Apache-2.0 License.
