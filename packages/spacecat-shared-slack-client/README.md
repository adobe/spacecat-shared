# Spacecat Shared - Slack Client

A library utility to manage to interact with different Slack organizations.

## Installation

```
npm install @adobe/spacecat-shared-slack-client
```

## Usage
### Creating and instance from Helix UniversalContext

```js
const context = {}; // Your Helix UniversalContext object
const target = 'ADOBE_INTERNAL';
const slackClient = SlackClient.createFrom(context, target);
```

**Required env variables in Helix UniversalContext**

At least one of the following environment variables should exist in Helix UniversalContext

```
SLACK_TOKEN_ADOBE_INTERNAL="slack bot token for the adobe internal org"
SLACK_TOKEN_ADOBE_EXTERNAL="slack bot token for the adobe external org"
```

**Note**: if Helix UniversalContext object already contains a `slackClients` field, then `createFrom` factory method returns the previously created instance instead of creating a new one.

### Constructor

`SlackClient` class needs a slack bot token and a logger object:

```js
const token = 'slack bot token';
const slackClient = new SlackClient(token, console);
```

### Posting a message

#### Posting a text message

```js
import { SlackClient, SLACK_TARGETS } from '@adobe/spacecat-shared-slack-client';

const channelId = 'channel-id'; // channel to send the message to
const threadId = 'thread-id'; // thread id to send the message under (optional)

const internalSlackClient = SlackClient.createFrom(context, SLACK_TARGETS.ADOBE_INTERNAL);

await internalSlackClient.postMessage({
  text: 'HELLO WORLD!',
  channel: 'channel-id',
  thread_ts: threadId, // (optional)
});
```

#### Posting a simple text message using Slack Block Builder (recommended)

```js
import { SlackClient, SLACK_TARGETS } from '@adobe/spacecat-shared-slack-client';
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
import { SlackClient, SLACK_TARGETS } from '@adobe/spacecat-shared-slack-client';
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
import { SlackClient, SLACK_TARGETS } from '@adobe/spacecat-shared-slack-client';

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
