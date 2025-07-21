# PageIntent Entity

## Use Case

The `PageIntent` entity captures the intent and topical classification of individual pages within a site.

- **Page intent** (`INFORMATIONAL`, `NAVIGATIONAL`, `TRANSACTIONAL`, `COMMERCIAL`) helps determine how users interact with each page.
- **Topic** (arbitrary string, changes per site, like `firefly`, `photoshop`, `express`) groups pages into thematic buckets.

You can:
1. **Record page metadata** as pages are discovered or crawled.
2. **Query all pages** for a given site (`siteId`) to analyze overall content strategy.
3. **Fetch a single page** by its unique URL to inspect or update its intent/topic.

## PageIntent Schema Overview

The `PageIntent` entity persists each page’s metadata. Key attributes include:

- **`pageIntentId`** (UUID v4) – primary key for the record.
- **`siteId`** (UUID v4) – foreign key to the Site entity.
- **`url`** (string) – unique full URL of the page.
- **`pageIntent`** (enum) – one of:
    - `INFORMATIONAL`
    - `NAVIGATIONAL`
    - `TRANSACTIONAL`
    - `COMMERCIAL`
- **`topic`** (string) – arbitrary topic label for the page.
- **`createdAt`, `updatedAt`** (ISO timestamp) – automatically maintained by ElectroDB.

## Best Practices

- **Uniqueness**: enforce URL uniqueness to avoid duplicate page records.
- **Indexing**:
    - Use `siteId` index to fetch all pages in a site quickly.
    - Use unique `url` index to locate or upsert a specific page.
- **Defaults & Validation**:
    - Validate `url` format with a URL‐validator.
    - Validate `siteId` as UUID v4.
    - Default `updatedBy` to your automation user (e.g. `spacecat`).

## Usage Example

```js
const { PageIntent } = dataAccess;

// 1. Create a new page intent record
const pi = await PageIntent.create({
  siteId:     'b1ec63c4-87de-4500-bbc9-276039e4bc10',
  url:        'https://www.adobe.com/firefly/overview.html',
  pageIntent: 'INFORMATIONAL',
  topic:      'firefly',
});

// 2. Query all pages for a site
const all = await PageIntent.allBySiteId(pi.getSiteId());
console.log(`Found ${all.length} pages for this site`);

// 3. Fetch a single page by URL
const single = await PageIntent.findByUrl(pi.getUrl());
console.log(`Intent: ${single.getPageIntent()}, Topic: ${single.getTopic()}`);

// 4. Update a page’s intent/topic
single.setPageIntent('NAVIGATIONAL');
single.setTopic('firefly-navigation');
await single.save();
