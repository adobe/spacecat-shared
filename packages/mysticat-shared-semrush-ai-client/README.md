# @adobe/mysticat-shared-semrush-ai-client

Shared Semrush AI SEO gRPC client for SpaceCat services.

Wraps `@quazar/ai-seo-ts` protobuf definitions and `@connectrpc/connect-node` transport into a
singleton-per-process client factory used by audit workers and API services.

## Usage

```js
import { getGrpcClients } from '@adobe/mysticat-shared-semrush-ai-client';

const {
  brandClient,
  topicClient,
  promptClient,
} = getGrpcClients(process.env);
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SEO_CLIENT_ID` | Yes | Semrush OAuth2 client ID |
| `SEO_CLIENT_SECRET` | Yes | Semrush OAuth2 client secret |
| `SEO_OAUTH_SCOPES` | No | Space-separated OAuth2 scopes (defaults to full set) |
| `SEO_OAUTH_TOKEN_URL` | No | Override OAuth2 token endpoint |
