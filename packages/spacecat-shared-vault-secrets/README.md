# @adobe/spacecat-shared-vault-secrets

Middleware wrapper for loading secrets from HashiCorp Vault into SpaceCat Lambda functions.

Drop-in replacement for `@adobe/helix-shared-secrets` - same interface, backed by Vault instead of AWS Secrets Manager.

## Usage

### As middleware (Universal Functions)

```js
import wrap from '@adobe/helix-shared-wrap';
import vaultSecrets from '@adobe/spacecat-shared-vault-secrets';

async function run(request, context) {
  // Secrets are available in context.env and process.env
  const apiKey = context.env.MY_API_KEY;
  // ...
}

export const main = wrap(run)
  .with(vaultSecrets)
  .with(helixStatus);
```

### Direct API

```js
import { loadSecrets } from '@adobe/spacecat-shared-vault-secrets';

const secrets = await loadSecrets(context, {
  name: 'dev/my-service',  // explicit Vault path
});
```

## How It Works

```
Lambda cold start (e.g. api-service)
  |
  +-> AWS Secrets Manager: read /mysticat/bootstrap/api-service
  |     (retrieves per-service AppRole role_id + secret_id)
  |
  +-> Vault: POST /v1/auth/approle/login
  |     (exchanges AppRole creds for a Vault token)
  |
  +-> Vault: GET /v1/dx_mysticat/data/{env}/api-service
  |     (reads KV v2 secrets using the token)
  |
  +-> Merges all key-value pairs into context.env and process.env
```

On subsequent invocations (warm Lambda), secrets are served from an in-memory cache with two-tier freshness checks:

- **Metadata check** (every 60s) - queries the Vault metadata endpoint for `updated_time`. If the secret hasn't changed, no full read is performed.
- **Hard refresh** (every 1h) - unconditionally re-reads the full secret regardless of metadata.

Token renewal is proactive: when the Vault token is within 5 minutes of expiry, a renewal request is attempted before the next secret read.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bootstrapPath` | string | `/mysticat/bootstrap/{ctx.func.name}` | AWS Secrets Manager secret ID for bootstrap config |
| `name` | string or function | auto | Vault secret path or resolver `(ctx) => path` |
| `expiration` | number | `3600000` (1h) | Hard cache expiration in ms |
| `checkDelay` | number | `60000` (1min) | Metadata check interval in ms |

### Path Resolution

Two paths are resolved automatically from `ctx.func.name`:

1. **Bootstrap path** (AWS SM): `/mysticat/bootstrap/{ctx.func.name}` - where to find the AppRole credentials
2. **Vault secret path**: `{environment}/{ctx.func.name}` - where to read the actual secrets

For example, a function named `api-service` with `environment: "dev"` in the bootstrap config:
- Bootstrap: `/mysticat/bootstrap/api-service`
- Vault: `dx_mysticat/data/dev/api-service`

Both paths can be overridden via options:

```js
// Override bootstrap path (e.g. data-service's shell entrypoint)
.with(vaultSecrets, { bootstrapPath: '/mysticat/bootstrap/data-service' })

// Override Vault secret path
.with(vaultSecrets, { name: 'prod/data-service/config' })

// Dynamic Vault path based on context
.with(vaultSecrets, { name: (ctx) => `${ctx.env.ENV}/my-svc` })
```

## Setup

### Prerequisites

This package requires three things to be in place before it can load secrets:

1. **A Vault AppRole** with a policy granting read access to your secrets
2. **A bootstrap secret in AWS Secrets Manager** containing the AppRole credentials
3. **Network access to Vault** from the Lambda execution environment (VPC required)
4. **IAM permissions** for the Lambda role to read the bootstrap secret

### 1. Vault AppRole

Each service environment needs a Vault AppRole under the `dx_mysticat` mount. The AppRole provides two credentials:

- **role_id** - stable identifier (like a username), does not change
- **secret_id** - rotatable credential (like a password), has a TTL

To generate a new secret_id (requires Vault CLI with appropriate permissions):

```bash
vault write -f auth/approle/role/<approle-name>/secret-id
```

The AppRole's policy determines which Vault paths the service can read. For example, a policy granting access to `dx_mysticat/data/dev/data-service/*` means secrets must be stored under that path hierarchy.

**AppRole naming convention:** `dx_mysticat_{service_name}_{env}`

Each core SpaceCat service has its own AppRole per environment (e.g. `dx_mysticat_api_service_dev`, `dx_mysticat_audit_worker_prod`). This provides credential isolation - a compromised service credential can only read that service's secrets.

AppRoles are provisioned via PRs to the `cst-vault/vault_policies` repo on git.corp.adobe.com.

### 2. Bootstrap Secret (AWS Secrets Manager)

Each service in each AWS account (dev/stage/prod) needs a bootstrap secret containing its AppRole credentials.

**Path convention:** `/mysticat/bootstrap/{service-name}`

The wrapper auto-resolves this from `ctx.func.name`. For example, `api-service` reads from `/mysticat/bootstrap/api-service`.

**Required format:**

```json
{
  "role_id": "<service-specific-approle-role-id>",
  "secret_id": "<service-specific-secret-id>",
  "vault_addr": "https://vault-amer.adobe.net",
  "mount_point": "dx_mysticat",
  "environment": "dev"
}
```

| Field | Description |
|-------|-------------|
| `role_id` | Vault AppRole role ID (stable, does not rotate) |
| `secret_id` | Vault AppRole secret ID (rotatable, has TTL) |
| `vault_addr` | Vault cluster URL. Use `https://vault-amer.adobe.net` for AMER |
| `mount_point` | KV v2 mount name in Vault |
| `environment` | Environment name (`dev`, `stage`, `prod`). Used for Vault secret path resolution |

All fields are required. If `environment` is missing, Vault path resolution will fail.

The empty secret containers are created via Terraform in `spacecat-infrastructure`. To populate values:

```bash
aws secretsmanager put-secret-value \
  --secret-id /mysticat/bootstrap/api-service \
  --secret-string '{"role_id":"...","secret_id":"...","vault_addr":"https://vault-amer.adobe.net","mount_point":"dx_mysticat","environment":"dev"}' \
  --profile spacecat-dev
```

### 3. VPC Configuration

Lambda functions using this package **must** run inside the SpaceCat VPC. Vault (`vault-amer.adobe.net`) rejects AppRole authentication requests from non-Adobe IP addresses with HTTP 403.

The SpaceCat VPC routes outbound traffic through NAT gateways with Adobe-registered IPs, which Vault accepts.

**Required VPC resources (dev account):**

| Resource | ID |
|----------|----|
| VPC | `vpc-0bf03289d46b647c7` (spacecat-vpc) |
| Private subnets | `subnet-052fec4fa471efefa`, `subnet-07b53318ac4bd7a51` |
| Security group | `sg-01a3594167b2f9229` (spacecat-lambda-sg) |

When creating or configuring a Lambda function:

```bash
aws lambda create-function \
  --function-name my-service \
  --vpc-config SubnetIds=subnet-052fec4fa471efefa,subnet-07b53318ac4bd7a51,SecurityGroupIds=sg-01a3594167b2f9229 \
  ...
```

For Terraform-managed services, add the VPC configuration to the Lambda resource or module.

### 4. IAM Permissions

The Lambda execution role must have `secretsmanager:GetSecretValue` permission on the bootstrap secret ARN.

The following IAM policies include `/mysticat/bootstrap/*` (managed in `spacecat-infrastructure`):

- `spacecat-policy-secrets-ro` (Lambda read access)
- `spacecat-policy-secrets-rw` (CI/CD read-write access)
- `spacecat-policy-service-basic` (basic service permissions)

The package reads credentials from the Lambda environment's standard AWS variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`) and signs requests with SigV4 via the `aws4` library. No AWS SDK is required.

## Storing Secrets in Vault

Write secrets to Vault using the CLI:

```bash
vault kv put dx_mysticat/dev/api-service \
  DATABASE_URL="postgres://user:pass@host:5432/db" \
  API_KEY="sk-..." \
  ANOTHER_SECRET="value"
```

The path must match what the AppRole policy allows. For the existing `dx_mysticat_data_service_dev` AppRole, secrets must be stored under `dev/data-service/*`.

To verify a secret is readable:

```bash
vault kv get dx_mysticat/dev/data-service/my-config
```

## Secret-ID Rotation

Vault AppRole secret_ids have a TTL. Adobe is enforcing a maximum TTL of 100 days (VEP6). When a secret_id expires, the service using that bootstrap config loses access to Vault.

**To rotate (per-service):**

1. Generate a new secret_id:
   ```bash
   vault write -f auth/approle/role/dx_mysticat_{service_name}_{env}/secret-id
   ```

2. Update the service's bootstrap secret in AWS Secrets Manager with the new secret_id.

3. Lambda functions will pick up the new credentials on next cold start (or after cache expiration).

**To verify a secret_id is still valid:**

```bash
vault write auth/approle/login \
  role_id="<role-id>" \
  secret_id="<secret-id>"
```

A successful response returns a Vault token. A 403 means the secret_id has expired or been revoked.

## Local Development

When `ctx.runtime.name` is `simulate` (local dev via `aem up` or similar), the wrapper returns `{}` without contacting Vault or AWS. Secrets should come from `.env` files instead.

## Error Handling

When used as middleware, secret loading failures return an HTTP 502 response with header `x-error: error fetching secrets.` and the wrapped function is not called.

When using `loadSecrets` directly, errors are thrown and must be caught by the caller.

Common failure modes:

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing AWS credentials for Vault bootstrap` | Lambda has no AWS creds in env | Check IAM role is attached |
| `Failed to load Vault bootstrap config: 400` | IAM policy doesn't allow reading the SM secret | Add SM permission for bootstrap path |
| `Failed to load Vault bootstrap config: 404` | Bootstrap secret doesn't exist in SM | Create the secret (see Setup) |
| `Vault authentication failed: 403` | secret_id expired, or Lambda not in VPC | Rotate secret_id; check VPC config |
| `Vault read failed: 403` | AppRole policy doesn't cover the secret path | Check path matches policy pattern |
| `Secret not found: <path>` | No secret at the resolved Vault path | Write the secret with `vault kv put` |
