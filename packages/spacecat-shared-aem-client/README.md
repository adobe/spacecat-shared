# Spacecat Shared - AEM Client

A client library for interacting with Adobe Experience Manager (AEM) Cloud Service APIs.

## Supported APIs

- **Content Fragment Management** - CRUD operations for content fragments
- **Content Fragment Versioning** - Create versions of content fragments
- **Content Fragment Tagging** - CRUD operations for tags on content fragments

## Installation

```bash
npm install @adobe/spacecat-shared-aem-client
```

## Usage

```javascript
import { AemClientBuilder } from '@adobe/spacecat-shared-aem-client';

const { management, versioning, tagging } = AemClientBuilder.create({
  site,  // Site object with getDeliveryConfig() returning { authorURL }
  env: {
    IMS_HOST: 'ims.example.com',
    IMS_CLIENT_ID: 'your-client-id',
    IMS_CLIENT_CODE: 'your-client-code',
    IMS_CLIENT_SECRET: 'your-client-secret',
  },
  log: console,
})
  .withManagement()
  .withVersioning()
  .withTagging()
  .build();

// Use capabilities
const fragmentId = await management.resolveFragmentId('/content/dam/fragment');
await versioning.createVersion(fragmentId, { label: 'v1' });
await tagging.addTags(fragmentId, ['tag-id']);
```

## Fragment Management

### Create a Fragment

```javascript
const newFragment = await management.createFragment('/content/dam/my-project', {
  title: 'My Fragment',
  name: 'my-fragment',
  modelId: '42',
  fields: [
    { name: 'title', type: 'text', multiple: false, values: ['My Title'] },
  ],
});
```

### Get a Fragment

```javascript
// By path
const fragment = await management.getFragment('/content/dam/my-project/fragment');

// By ID
const fragment = await management.getFragmentById('fragment-uuid');
```

### Patch a Fragment

```javascript
const patches = [
  { op: 'replace', path: '/title', value: 'Updated Title' },
];

// By path
const updated = await management.patchFragment('/content/dam/my-project/fragment', patches);

// By ID
const updated = await management.patchFragmentById('fragment-uuid', patches);
```

### Delete a Fragment

```javascript
// By path
await management.deleteFragment('/content/dam/my-project/fragment');

// By ID
await management.deleteFragmentById('fragment-uuid');
```

## Fragment Versioning

```javascript
const fragmentId = await management.resolveFragmentId('/content/dam/fragment');
await versioning.createVersion(fragmentId, {
  label: 'v1.0',
  comment: 'Initial version',
});
```

## Fragment Tagging

### Add Tags

```javascript
await tagging.addTags(fragmentId, ['tag-id-1', 'tag-id-2']);
```

### Get Tags

```javascript
const tags = await tagging.getTags(fragmentId);
```

### Replace Tags

```javascript
await tagging.replaceTags(fragmentId, ['new-tag-id']);
```

### Delete Tags

```javascript
await tagging.deleteTags(fragmentId);
```

## API Reference

- [Sites API](https://developer.adobe.com/experience-cloud/experience-manager-apis/api/stable/sites/)
