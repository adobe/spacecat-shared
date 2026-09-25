# Spacecat Shared - CloudFront Client

## Overview

`@adobe/spacecat-shared-cloudfront-client` is a client for the
[AWS CloudFront](https://docs.aws.amazon.com/cloudfront/latest/APIReference/)
control plane used by Spacecat's Optimize-at-Edge onboarding.

> **Status: initial skeleton (Phase 1).**
> This first release exists to establish the published package and its npm
> OIDC trusted-publisher binding. The operational API (distribution, cache
> behavior, and function-association management) is being migrated in from
> [`@adobe/spacecat-shared-tokowaka-client`](../spacecat-shared-tokowaka-client)
> in a follow-up (Phase 2). Until then, no CDN operations are exposed here and
> `@adobe/spacecat-shared-tokowaka-client` remains the source of truth.

## Installation

```bash
npm install @adobe/spacecat-shared-cloudfront-client
```

## Usage

### Creating a client

#### From a Universal context (recommended)

Reads the target AWS region from `context.env.AWS_REGION`:

```javascript
import CloudFrontClient from '@adobe/spacecat-shared-cloudfront-client';

const client = CloudFrontClient.createFrom(context);
```

#### Direct constructor

```javascript
import CloudFrontClient from '@adobe/spacecat-shared-cloudfront-client';

const client = new CloudFrontClient({ region: 'us-east-1' }, log);
```

Credentials are resolved by the ambient AWS credential chain (IAM role); explicit
credential configuration is added in Phase 2 alongside the AWS SDK client.

## License

Apache-2.0
