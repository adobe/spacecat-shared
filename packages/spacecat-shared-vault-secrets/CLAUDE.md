# spacecat-shared-vault-secrets

Drop-in replacement for `@adobe/helix-shared-secrets`. Loads secrets from HashiCorp Vault instead of AWS Secrets Manager.

## Development

### Unit Tests

```bash
cd packages/spacecat-shared-vault-secrets
npm test
```

54 tests with full HTTP mocking (nock). No external dependencies needed.

### Lint

```bash
npm run lint
```

## Architecture

### Secret Loading Pipeline

```
Lambda/ECS start (e.g. api-service)
  -> AWS Secrets Manager: read /mysticat/bootstrap/api-service (per-service AppRole creds)
  -> Vault: POST /v1/auth/approle/login (get token)
  -> Vault: GET /v1/dx_mysticat/data/{env}/api-service (read secrets)
  -> Merge into ctx.env + process.env
```

Bootstrap path auto-resolves from `ctx.func.name` -> `/mysticat/bootstrap/{func.name}`. Override with `bootstrapPath` option.

### Two-tier Caching

- **Hard expiration**: 1 hour (full re-fetch)
- **Metadata check**: every 60 seconds (compare updated_time, re-fetch only if changed)
- **Token renewal**: proactive renewal when within 5 minutes of expiry

### Key Files

| File | Purpose |
|------|---------|
| `src/index.js` | Exports: default (middleware), `loadSecrets`, `reset` |
| `src/vault-secrets-wrapper.js` | Main logic: caching, path resolution, middleware wrapper |
| `src/vault-client.js` | Low-level Vault HTTP client (AppRole auth, KV read, metadata) |
| `src/bootstrap.js` | Reads AppRole creds from AWS Secrets Manager via aws4 SigV4 |

## Vault Configuration

### Namespace and Mount

| Field | Value |
|-------|-------|
| Vault address | `https://vault-amer.adobe.net` |
| KV v2 mount | `dx_mysticat` |
| Secret path convention | `{env}/{service-name}` (e.g. `dev/api-service`) |

### AppRole Details

**Naming convention:** `dx_mysticat_{service_name}_{env}`

Each core SpaceCat service has its own AppRole per environment. Each policy grants read access to `dx_mysticat/data/{env}/{service-name}/*` and metadata list on the same path.

Provisioned via PRs to `cst-vault/vault_policies` on git.corp.adobe.com.

**data-service role_id** (dev): `06bcea05-36d8-fada-7b25-52966940d819`

### Bootstrap Secret (AWS Secrets Manager)

**Path convention**: `/mysticat/bootstrap/{service-name}` (auto-resolved from `ctx.func.name`)

**Format**:
```json
{
  "role_id": "<service-specific-approle-role-id>",
  "secret_id": "<service-specific-secret-id>",
  "vault_addr": "https://vault-amer.adobe.net",
  "mount_point": "dx_mysticat",
  "environment": "dev"
}
```

The `environment` field is required - it determines the Vault secret path prefix.

Empty secret containers are created via Terraform in `spacecat-infrastructure`.

### Secret-ID Lifecycle

- Generate: `vault write -f auth/approle/role/dx_mysticat_{service_name}_{env}/secret-id`
- Secret-IDs can expire (Adobe enforcing 100-day max TTL via VEP6)
- Rotation requires updating the service's SM bootstrap secret with the new secret_id

## E2E Validation Procedure

Validates the full pipeline: SM bootstrap -> AppRole auth -> Vault KV read.

### Prerequisites

1. **Vault session**: `vldj` (Okta auth, 4h TTL)
2. **AWS credentials**: `klam login` then `klsa` for spacecat-dev (account 682033462621)
3. **Bootstrap secret** at `/mysticat/vault-bootstrap` with valid secret_id

### Step 1: Write test secret to Vault

```bash
vault kv put dx_mysticat/dev/data-service/e2e-vault-test E2E_TEST_KEY=vault-secrets-e2e-ok
```

Note: Must be under `dev/data-service/*` to match the AppRole policy.

### Step 2: Ensure bootstrap secret is current

```bash
# Verify the secret_id is valid
SM_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id /mysticat/vault-bootstrap \
  --profile spacecat-dev \
  --query SecretString --output text)
echo "$SM_SECRET" | python3 -m json.tool

# Test AppRole login with the stored secret_id
ROLE_ID=$(echo "$SM_SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin)['role_id'])")
SECRET_ID=$(echo "$SM_SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin)['secret_id'])")
vault write auth/approle/login role_id="$ROLE_ID" secret_id="$SECRET_ID"
```

If the login fails with 403, the secret_id is expired. Generate a fresh one:

```bash
vault write -f auth/approle/role/dx_mysticat_data_service_dev/secret-id
# Then update SM with the new secret_id (keep all other fields)
```

### Step 3: Add temporary IAM permission

The `spacecat-role-lambda-generic` only allows SM access to `/helix-deploy/spacecat-services/*`.
Add a temporary inline policy for the bootstrap path:

```bash
aws iam put-role-policy \
  --role-name spacecat-role-lambda-generic \
  --policy-name vault-bootstrap-e2e-temp \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-1:682033462621:secret:/mysticat/vault-bootstrap*"
    }]
  }' \
  --profile spacecat-dev
```

### Step 4: Bundle and deploy Lambda

```bash
cd packages/spacecat-shared-vault-secrets

# Bundle
npx esbuild test/e2e/handler.mjs --bundle --platform=node --target=node22 \
  --format=esm --outfile=dist/e2e.mjs \
  --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);"

# ZIP
mkdir -p dist && cd dist && zip e2e-lambda.zip e2e.mjs && cd ..

# Create Lambda in SpaceCat VPC (MUST be in VPC - Vault rejects non-Adobe IPs)
aws lambda create-function \
  --function-name vault-secrets-e2e-test \
  --runtime nodejs22.x \
  --handler e2e.handler \
  --zip-file fileb://dist/e2e-lambda.zip \
  --role arn:aws:iam::682033462621:role/spacecat-role-lambda-generic \
  --timeout 30 \
  --vpc-config SubnetIds=subnet-052fec4fa471efefa,subnet-07b53318ac4bd7a51,SecurityGroupIds=sg-01a3594167b2f9229 \
  --profile spacecat-dev
```

### Step 5: Invoke and verify

```bash
# Wait ~15s for Lambda to become active after creation
aws lambda invoke \
  --function-name vault-secrets-e2e-test \
  --log-type Tail \
  --profile spacecat-dev \
  /dev/stdout
```

Expected response:
```json
{"statusCode":200,"body":"{\"success\":true,\"keys\":[\"E2E_TEST_KEY\"]}"}
```

If it fails, check CloudWatch:
```bash
aws logs tail /aws/lambda/vault-secrets-e2e-test --follow --profile spacecat-dev
```

### Step 6: Clean up

```bash
# Delete Lambda
aws lambda delete-function --function-name vault-secrets-e2e-test --profile spacecat-dev

# Remove temporary IAM policy
aws iam delete-role-policy \
  --role-name spacecat-role-lambda-generic \
  --policy-name vault-bootstrap-e2e-temp \
  --profile spacecat-dev

# Delete test secret
vault kv delete dx_mysticat/dev/data-service/e2e-vault-test

# Remove build artifacts
rm -rf dist/
```

## Findings from E2E Validation (2026-02-18)

### Issues Discovered

1. **VPC required for Vault access**: Lambda must run in the SpaceCat VPC (`vpc-0bf03289d46b647c7`, private subnets with NAT gateway). Vault rejects AppRole login from non-Adobe IPs with a 403.

2. **IAM policy gap**: `spacecat-policy-secrets-ro` only covers `/helix-deploy/spacecat-services/*`. The Vault bootstrap secret at `/mysticat/vault-bootstrap` is not included. Before production integration, either:
   - Update the Terraform-managed policy to include `/mysticat/vault-bootstrap*`
   - Or move the bootstrap secret under the existing allowed path

3. **Bootstrap secret missing `environment` field**: The original SM secret lacked the `environment` key, which the wrapper needs for default path resolution (`{env}/{func.name}`). Fixed during validation.

4. **AppRole policy restricts secret paths**: The `dx_mysticat_data_service_dev` policy only allows reads under `dev/data-service/*`. Services using this AppRole must store secrets under that path convention.

5. **Secret-ID expiration**: The secret_id from Jan 26 was already invalid by Feb 18 (23 days). Adobe's VEP6 enforces 100-day max TTL. Need automated rotation.

### Production Integration Blocklist

Before `vault-secrets` can be used in SpaceCat Lambda services:
- [x] Update IAM policies in Terraform to include `/mysticat/bootstrap/*` (spacecat-infrastructure PR #336)
- [x] Create per-service AppRoles via vault_policies PRs
- [x] Create per-service SM bootstrap secret containers in Terraform (spacecat-infrastructure PR #336)
- [ ] Populate bootstrap secrets with AppRole credentials (Phase 2)
- [ ] Copy service secrets from SM to Vault (Phase 3)
- [ ] Plan secret_id rotation strategy (SITES-40736)
