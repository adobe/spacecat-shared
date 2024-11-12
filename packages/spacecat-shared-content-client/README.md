# Spacecat Shared - Content Client

## Overview


## Development

### Linting

Lint your code:

```bash
npm run lint
```

### Cleaning

To remove `node_modules` and `package-lock.json`:

```bash
npm run clean
```
## Usage

### Google Drive

```js
import { ContentClient } from '../src/index.js';

const context = {}; // Your AWS Lambda context object
const gdriveclient = await ContentClient.createFrom(context, { url: 'GOOGLE_DRIVE_URL', type: 'drive.google' });
const results = await client.getPageMetadata('/path1');
console.log(results);
```
```js
import { ContentClient } from '../src/index.js';

const env = {}; // Your env variables to connect to spacecat apis and google drive
const onedriveclient = await ContentClient.createFromDomain('example.com', env, log);

const results = await client.getPageMetadata('/path1');
console.log(results);
```

### Microsoft Sharepoint Drive

```js
import { ContentClient } from '../src/index.js';

const context = {}; // Your env variables to connect to spacecat apis and onedrive
const onedriveclient = await ContentClient.createFrom(context, { url: 'ONEDRIVE_URL', type: 'onedrive' });

const results = await client.getPageMetadata('/path1');
console.log(results);
```

```js
import { ContentClient } from '../src/index.js';

const env = {}; // Your AWS Lambda context object
const onedriveclient = await ContentClient.createFromDomain('example.com', env, log);

const results = await client.getPageMetadata('/path1');
console.log(results);
```
## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0
