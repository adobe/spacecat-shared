# @adobe/spacecat-shared-vault-secrets

Middleware wrapper for loading secrets from HashiCorp Vault into SpaceCat Lambda functions.

Drop-in replacement for `@adobe/helix-shared-secrets` - same interface, backed by Vault instead of AWS Secrets Manager.

## Usage

```js
import wrap from '@adobe/helix-shared-wrap';
import vaultSecrets from '@adobe/spacecat-shared-vault-secrets';

export const main = wrap(run)
  .with(vaultSecrets)
  .with(helixStatus);
```

## How It Works

1. On cold start, reads bootstrap config from AWS Secrets Manager (`/mysticat/vault-bootstrap`)
2. Authenticates to Vault via AppRole (role_id + secret_id from bootstrap)
3. Reads secrets from `dx_mysticat/{environment}/{service}` (KV V2)
4. Merges all key-value pairs into `context.env` and `process.env`
5. Caches secrets with two-tier strategy (1-minute metadata check, 1-hour hard refresh)

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bootstrap` | string | `/mysticat/vault-bootstrap` | AWS Secrets Manager path for AppRole credentials |
| `name` | string or function | auto | Custom Vault path or resolver function `(opts, ctx, defaultPath) => path` |
| `expiration` | number | 3600000 | Hard cache expiration in ms |
| `checkDelay` | number | 60000 | Metadata check interval in ms |

## Bootstrap Config

Each AWS account (dev/stage/prod) must have this secret in AWS Secrets Manager:

**Path:** `/mysticat/vault-bootstrap`

```json
{
  "role_id": "<VAULT_APPROLE_ROLE_ID>",
  "secret_id": "<VAULT_APPROLE_SECRET_ID>",
  "vault_addr": "https://vault-amer.adobe.net",
  "mount_point": "dx_mysticat",
  "environment": "prod"
}
```

## Local Development

On `simulate` runtime (local dev), the wrapper silently returns `{}` and secrets come from `.env` files instead.
