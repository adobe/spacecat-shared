# Per-Service Vault AppRoles and Migration from AWS Secrets Manager

**JIRA:** [SITES-40735](https://jira.corp.adobe.com/browse/SITES-40735)
**Date:** 2026-02-19
**Status:** Draft

## Problem

SpaceCat services currently store secrets in AWS Secrets Manager at `/helix-deploy/spacecat-services/{service}/latest`. The `@adobe/spacecat-shared-vault-secrets` package was built to migrate these secrets to HashiCorp Vault, but the existing Vault AppRole policies are scoped to `{env}/data-service/*` - only usable by `mysticat-data-service`. Additionally, all services sharing one AppRole means no credential isolation between them.

## Design

### Per-Service Credential Isolation

Each SpaceCat service gets its own Vault AppRole, its own policy, and its own bootstrap secret. A compromised service credential can only read that service's secrets.

```
Lambda: api-service
  |
  +-> SM: /mysticat/bootstrap/api-service
  |     {role_id, secret_id, vault_addr, mount_point, environment}
  |
  +-> Vault AppRole: dx_mysticat_api_service_dev
  |     Policy: read dx_mysticat/data/dev/api-service/*
  |
  +-> Vault KV: dx_mysticat/dev/api-service
        {ADMIN_API_KEY, SLACK_BOT_TOKEN, ...}
```

### Path Conventions

| Resource | Old Convention | New Convention |
|----------|---------------|----------------|
| SM bootstrap | `/mysticat/vault-bootstrap` (shared) | `/mysticat/bootstrap/{service-name}` (per-service) |
| Vault secrets | `{env}/data-service/*` (data-service only) | `{env}/{service-name}/*` (per-service) |
| AppRole name | `dx_mysticat_data_service_{env}` | `dx_mysticat_{service_name}_{env}` |

The flat Vault layout (`{env}/{service-name}`) matches the `vault-secrets` wrapper's default path resolution (`{bootstrapEnvironment}/{ctx.func.name}`), so services need zero configuration.

### Wrapper Changes

The `vault-secrets` wrapper's default bootstrap path changes from a static string to auto-resolved:

```js
// Old
const DEFAULT_BOOTSTRAP_PATH = '/mysticat/vault-bootstrap';

// New
function resolveBootstrapPath(ctx, opts) {
  if (opts.bootstrapPath) return opts.bootstrapPath;
  return `/mysticat/bootstrap/${ctx.func.name}`;
}
```

Service integration becomes zero-config:

```js
// No options needed - bootstrapPath and Vault path both resolve from ctx.func.name
export const main = wrap(run)
  .with(vaultSecrets)
  .with(helixStatus);
```

The `bootstrapPath` option remains available for non-standard cases (e.g. data-service's shell entrypoint, testing).

### Vault Policy Structure

For each service, three HCL files (dev/stage/prod). Example for api-service:

```hcl
# dx_mysticat_api_service_dev.hcl

# AppRole self-service (read role-id, generate secret-id for rotation)
path "auth/approle/role/dx_mysticat_api_service_dev/role-id" {
    capabilities = ["read"]
}
path "auth/approle/role/dx_mysticat_api_service_dev/secret-id*" {
    capabilities = ["update"]
}

# Read secrets
path "dx_mysticat/data/dev/api-service/*" {
    capabilities = ["read"]
}

# Metadata (for two-tier cache invalidation)
path "dx_mysticat/metadata/dev/api-service/*" {
    capabilities = ["list"]
}
```

The `mappings.yaml` in `vault_policies/prod/dx_mysticat/` gets an `APPROLE_ROLE` entry per service/env:

```yaml
- role_name: dx_mysticat_api_service_dev
  token_ttl: 3600
  token_max_ttl: 3600
  policies:
    - dx_mysticat_api_service_dev
```

### Bootstrap Secret Format

Each service's SM secret at `/mysticat/bootstrap/{service-name}`:

```json
{
  "role_id": "<service-specific-approle-role-id>",
  "secret_id": "<service-specific-secret-id>",
  "vault_addr": "https://vault-amer.adobe.net",
  "mount_point": "dx_mysticat",
  "environment": "dev"
}
```

### Infrastructure Repo Changes (spacecat-infrastructure)

All changes below are in the `spacecat-infrastructure` repo. This repo manages SM secrets, IAM policies, and ECS config via Terraform.

**1. SM bootstrap secrets** (`modules/secrets_manager/secrets.tf`)

Add `aws_secretsmanager_secret` resources for each service. Terraform creates the empty secret containers; values are populated manually in Phase 2.

```hcl
# Per-service bootstrap secrets (13 services)
resource "aws_secretsmanager_secret" "mysticat_bootstrap_api_service" {
  name        = "/mysticat/bootstrap/api-service"
  description = "Vault AppRole bootstrap credentials for api-service"
}
# ... repeat for all core services
```

The existing `/mysticat/vault-bootstrap` secret is kept until data-service migration is confirmed stable.

**2. IAM policies** (`modules/iam/policies.tf`)

Three policies need `/mysticat/bootstrap/*` added to their Resource list:

- `spacecat-policy-secrets-ro` (read-only, used by Lambda execution roles)
- `spacecat-policy-secrets-rw` (read-write, used by CI/CD)
- `spacecat-policy-service-basic` (basic service policy, also has SM GetSecretValue)

```hcl
Resource = [
  "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:/helix-deploy/spacecat-services/*",
  "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:/mysticat/bootstrap/*",
]
```

**3. Data-service IAM** (`modules/mysticat_data_service/iam.tf`)

The `vault_bootstrap_access` policy currently uses `var.vault_bootstrap_secret_arn` pointing to `/mysticat/vault-bootstrap`. After migration, update to point to `/mysticat/bootstrap/data-service`.

```hcl
# Update variable default or environment-level value
vault_bootstrap_secret_arn = module.spacecat_secrets.mysticat_bootstrap_data_service_arn
```

**4. SM secret outputs** (`modules/secrets_manager/outputs.tf`)

Add output ARNs for the new bootstrap secrets so other modules can reference them:

```hcl
output "mysticat_bootstrap_data_service_arn" {
  value = aws_secretsmanager_secret.mysticat_bootstrap_data_service.arn
}
```

### Data-Service Migration

`mysticat-data-service` moves to the same convention:
- Bootstrap secret: `/mysticat/vault-bootstrap` -> `/mysticat/bootstrap/data-service`
- Vault path: unchanged (`{env}/data-service/*`)
- AppRole: unchanged (`dx_mysticat_data_service_{env}`)
- `entrypoint.sh`: update the `--secret-id` path from `/mysticat/vault-bootstrap` to `/mysticat/bootstrap/data-service`
- `spacecat-infrastructure`: update `vault_bootstrap_secret_arn` variable to point to new secret ARN

## Services in Scope

Core Lambda services that need AppRoles (based on `/latest` SM secrets):

| Service | SM Secret Exists | Key Count |
|---------|-----------------|-----------|
| api-service | yes | ~122 |
| audit-worker | yes | - |
| reporting-worker | yes | - |
| autofix-worker | yes | - |
| jobs-dispatcher | yes | - |
| auth-service | yes | - |
| fulfillment-worker | yes | - |
| content-processor | yes | - |
| content-scraper | yes | - |
| import-worker | yes | - |
| import-job-manager | yes | - |
| coralogix-feeder | yes | - |
| task-manager | yes | - |
| data-service (ECS) | yes (different path) | ~2 |

Secondary services (lower priority, migrate later):

| Service | Notes |
|---------|-------|
| audit-post-processor | May be deprecated |
| content-import-worker | May be deprecated |
| genai | Experimental |
| statistics-service | Legacy |
| statistics | Legacy |
| md-to-mdast-worker | Utility |
| scrape-job-manager | May be merged |
| cdn-logs-llmo-e2e-test | Test service |
| cdn-logs-infrastructure | Infrastructure |
| autofix | Legacy (replaced by autofix-worker) |

## Migration Plan

Each phase ends with a validation gate. Claude Code executes the migration and must pass all validation checks before proceeding. If any check fails, stop, diagnose, fix, and re-validate before moving on.

### Phase 1: Infrastructure (no service impact)

**1a. Vault policies PR (vault_policies repo)**

Create HCL files and mappings for all core services across all three environments. PR to `cst-vault/vault_policies` upstream via the `djaeggi` fork.

Files to create per service (3 envs x N services):
- `dx_mysticat_{service}_{env}.hcl`
- Update `mappings.yaml` with new `APPROLE_ROLE` entries

The existing `data-service` policies and AppRoles remain unchanged.

**1b. Infrastructure PR (spacecat-infrastructure repo)**

Single PR covering all Terraform changes:
- Add 13 `aws_secretsmanager_secret` resources for `/mysticat/bootstrap/{service-name}` (empty containers, values populated in Phase 2)
- Add corresponding outputs for the new secret ARNs
- Add `/mysticat/bootstrap/*` to three IAM policies: `spacecat-policy-secrets-ro`, `spacecat-policy-secrets-rw`, `spacecat-policy-service-basic`
- Do NOT update `vault_bootstrap_secret_arn` for data-service yet (Phase 2d)

**1c. Wrapper update (spacecat-shared repo)**

Update `vault-secrets-wrapper.js` to auto-resolve `bootstrapPath` from `ctx.func.name`. The static `DEFAULT_BOOTSTRAP_PATH` constant becomes dynamic. The `bootstrapPath` option still works for overrides.

#### Validation Gate 1: Infrastructure

```bash
# 1. Verify HCL files exist for every core service x env combination
for svc in api-service audit-worker reporting-worker autofix-worker jobs-dispatcher \
           auth-service fulfillment-worker content-processor content-scraper \
           import-worker import-job-manager coralogix-feeder task-manager; do
  for env in dev stage prod; do
    test -f "dx_mysticat_${svc//-/_}_${env}.hcl" || echo "MISSING: $svc $env"
  done
done

# 2. Verify mappings.yaml has APPROLE_ROLE entries for all new roles
grep -c "APPROLE_ROLE" mappings.yaml
# Expected: 13 services x 3 envs = 39 new entries (+ 3 existing data-service)

# 3. Verify SM bootstrap secrets exist in all AWS accounts (after Terraform apply)
for svc in api-service audit-worker reporting-worker autofix-worker jobs-dispatcher \
           auth-service fulfillment-worker content-processor content-scraper \
           import-worker import-job-manager coralogix-feeder task-manager data-service; do
  for profile in spacecat-dev spacecat-stage spacecat-prod; do
    aws secretsmanager describe-secret \
      --secret-id "/mysticat/bootstrap/$svc" \
      --profile "$profile" > /dev/null 2>&1 \
      && echo "OK: $svc ($profile)" \
      || echo "FAIL: $svc ($profile) - SM secret not created"
  done
done

# 4. Verify IAM policies include bootstrap path (all three policies)
for policy_name in spacecat-policy-secrets-ro spacecat-policy-secrets-rw spacecat-policy-service-basic; do
  POLICY_ARN=$(aws iam list-policies --query "Policies[?PolicyName=='$policy_name'].Arn" \
    --output text --profile spacecat-dev)
  VERSION=$(aws iam get-policy --policy-arn "$POLICY_ARN" --profile spacecat-dev \
    --query "Policy.DefaultVersionId" --output text)
  aws iam get-policy-version --policy-arn "$POLICY_ARN" --version-id "$VERSION" \
    --profile spacecat-dev --query "PolicyVersion.Document" --output text \
    | grep -q "/mysticat/bootstrap" \
    && echo "OK: $policy_name includes bootstrap path" \
    || echo "FAIL: $policy_name missing bootstrap path"
done

# 5. Verify wrapper unit tests pass with new bootstrapPath logic
cd packages/spacecat-shared-vault-secrets && npm test
# Expected: all tests pass

# 6. Verify wrapper correctly resolves bootstrap path
# Unit test should cover: ctx.func.name = "api-service" -> "/mysticat/bootstrap/api-service"
# Unit test should cover: explicit bootstrapPath option overrides auto-resolution

# 7. Verify Terraform plan is clean (no unexpected changes)
cd spacecat-infrastructure/environments/dev && terraform plan -no-color 2>&1 | tail -5
# Expected: only the expected new resources, no destructive changes
```

**Stop condition:** Do not proceed to Phase 2 until:
- The vault_policies PR is merged AND CES automation has provisioned the AppRoles (confirm via `vault read auth/approle/role/dx_mysticat_{service}_{env}/role-id` for at least one new service)
- The spacecat-infrastructure PR is merged and applied in all three accounts (SM secrets exist, IAM policies updated)

### Phase 2: Bootstrap secret provisioning (no service impact)

After the vault_policies PR is merged and AppRoles are provisioned by the CES automation:

**2a. Retrieve role_ids**

For each new AppRole:
```bash
vault read auth/approle/role/dx_mysticat_{service}_{env}/role-id
```

**2b. Generate secret_ids**

```bash
vault write -f auth/approle/role/dx_mysticat_{service}_{env}/secret-id
```

**2c. Create SM bootstrap secrets**

For each service, in each AWS account:
```bash
aws secretsmanager create-secret \
  --name /mysticat/bootstrap/{service-name} \
  --secret-string '{"role_id":"...","secret_id":"...","vault_addr":"https://vault-amer.adobe.net","mount_point":"dx_mysticat","environment":"{env}"}' \
  --profile spacecat-{env}
```

Create via Terraform first (empty secret containers), then populate values.

**2d. Migrate data-service bootstrap**

Create `/mysticat/bootstrap/data-service` with the same content as `/mysticat/vault-bootstrap`. Then:
1. Update `mysticat-data-service/docker/entrypoint.sh` to read from `/mysticat/bootstrap/data-service`
2. Update `spacecat-infrastructure`: change `vault_bootstrap_secret_arn` to point to the new `/mysticat/bootstrap/data-service` ARN (PR to spacecat-infrastructure)
3. Deploy data-service
4. Verify ECS health, then deprecate the old `/mysticat/vault-bootstrap` secret

#### Validation Gate 2: Bootstrap Secrets

```bash
# 1. Verify every AppRole exists and has a role_id
for svc in api-service audit-worker reporting-worker autofix-worker jobs-dispatcher \
           auth-service fulfillment-worker content-processor content-scraper \
           import-worker import-job-manager coralogix-feeder task-manager data-service; do
  for env in dev stage prod; do
    vault read -field=role_id "auth/approle/role/dx_mysticat_${svc//-/_}_${env}/role-id" \
      || echo "FAIL: $svc $env - AppRole not found"
  done
done

# 2. Verify every SM bootstrap secret exists and has valid structure
for svc in api-service audit-worker reporting-worker autofix-worker jobs-dispatcher \
           auth-service fulfillment-worker content-processor content-scraper \
           import-worker import-job-manager coralogix-feeder task-manager data-service; do
  for profile in spacecat-dev spacecat-stage spacecat-prod; do
    SECRET=$(aws secretsmanager get-secret-value \
      --secret-id "/mysticat/bootstrap/$svc" \
      --profile "$profile" \
      --query SecretString --output text 2>/dev/null)
    if [ $? -ne 0 ]; then
      echo "FAIL: $svc ($profile) - SM secret not found"
      continue
    fi
    # Validate required fields
    for field in role_id secret_id vault_addr mount_point environment; do
      echo "$SECRET" | python3 -c "import sys,json; d=json.load(sys.stdin); assert '$field' in d, 'missing $field'" \
        || echo "FAIL: $svc ($profile) - missing field: $field"
    done
  done
done

# 3. Verify AppRole login works for each service (proves secret_id is valid)
for svc in api-service audit-worker reporting-worker autofix-worker jobs-dispatcher \
           auth-service fulfillment-worker content-processor content-scraper \
           import-worker import-job-manager coralogix-feeder task-manager data-service; do
  for profile in spacecat-dev spacecat-stage spacecat-prod; do
    SECRET=$(aws secretsmanager get-secret-value \
      --secret-id "/mysticat/bootstrap/$svc" \
      --profile "$profile" \
      --query SecretString --output text)
    ROLE_ID=$(echo "$SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin)['role_id'])")
    SEC_ID=$(echo "$SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin)['secret_id'])")
    vault write auth/approle/login role_id="$ROLE_ID" secret_id="$SEC_ID" > /dev/null 2>&1 \
      && echo "OK: $svc ($profile)" \
      || echo "FAIL: $svc ($profile) - AppRole login failed"
  done
done

# 4. Verify data-service still works after bootstrap migration
# Check ECS service health (data-service uses the new bootstrap path)
AWS_PROFILE=spacecat-dev aws ecs describe-services \
  --cluster mysticat-cluster --services mysticat-data-service \
  --query "services[0].{status:status,running:runningCount,desired:desiredCount}"
# Expected: status=ACTIVE, running=desired
```

**Stop condition:** Every AppRole login must succeed. Every SM secret must have all required fields. Data-service must be healthy after entrypoint.sh update.

### Phase 3: Copy secrets to Vault (no service impact)

For each service, read secrets from the existing SM secret and write them to Vault:

```bash
# Read from SM
SECRETS=$(aws secretsmanager get-secret-value \
  --secret-id "/helix-deploy/spacecat-services/{service}/latest" \
  --profile spacecat-{env} \
  --query SecretString --output text)

# Write to Vault (all keys as KV pairs)
echo "$SECRETS" | vault kv put dx_mysticat/{env}/{service} -
```

Start with dev, validate, then stage, then prod.

#### Validation Gate 3: Vault Secrets

```bash
# 1. Verify secrets exist in Vault for every service x env
for svc in api-service audit-worker reporting-worker autofix-worker jobs-dispatcher \
           auth-service fulfillment-worker content-processor content-scraper \
           import-worker import-job-manager coralogix-feeder task-manager; do
  for env in dev stage prod; do
    vault kv get -format=json "dx_mysticat/$env/$svc" > /dev/null 2>&1 \
      && echo "OK: $env/$svc" \
      || echo "FAIL: $env/$svc - secret not found"
  done
done

# 2. Verify key counts match between SM and Vault
for svc in api-service audit-worker reporting-worker autofix-worker jobs-dispatcher \
           auth-service fulfillment-worker content-processor content-scraper \
           import-worker import-job-manager coralogix-feeder task-manager; do
  for env_profile in "dev spacecat-dev" "stage spacecat-stage" "prod spacecat-prod"; do
    env=$(echo $env_profile | cut -d' ' -f1)
    profile=$(echo $env_profile | cut -d' ' -f2)
    SM_KEYS=$(aws secretsmanager get-secret-value \
      --secret-id "/helix-deploy/spacecat-services/$svc/latest" \
      --profile "$profile" \
      --query SecretString --output text 2>/dev/null \
      | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
    VAULT_KEYS=$(vault kv get -format=json "dx_mysticat/$env/$svc" 2>/dev/null \
      | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['data']))" 2>/dev/null || echo "0")
    if [ "$SM_KEYS" = "$VAULT_KEYS" ]; then
      echo "OK: $env/$svc ($SM_KEYS keys)"
    else
      echo "MISMATCH: $env/$svc - SM=$SM_KEYS, Vault=$VAULT_KEYS"
    fi
  done
done

# 3. Verify AppRole-scoped reads work (login as the service, then read its own secrets)
for svc in api-service coralogix-feeder; do  # Spot-check two services
  SECRET=$(aws secretsmanager get-secret-value \
    --secret-id "/mysticat/bootstrap/$svc" \
    --profile spacecat-dev \
    --query SecretString --output text)
  ROLE_ID=$(echo "$SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin)['role_id'])")
  SEC_ID=$(echo "$SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin)['secret_id'])")
  TOKEN=$(vault write -field=token auth/approle/login role_id="$ROLE_ID" secret_id="$SEC_ID")
  VAULT_TOKEN=$TOKEN vault kv get "dx_mysticat/dev/$svc" > /dev/null 2>&1 \
    && echo "OK: $svc can read its own secrets" \
    || echo "FAIL: $svc cannot read its own secrets via AppRole"
done

# 4. Verify credential isolation (service A cannot read service B's secrets)
# Login as coralogix-feeder, try to read api-service secrets (should fail)
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "/mysticat/bootstrap/coralogix-feeder" \
  --profile spacecat-dev \
  --query SecretString --output text)
ROLE_ID=$(echo "$SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin)['role_id'])")
SEC_ID=$(echo "$SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin)['secret_id'])")
TOKEN=$(vault write -field=token auth/approle/login role_id="$ROLE_ID" secret_id="$SEC_ID")
VAULT_TOKEN=$TOKEN vault kv get "dx_mysticat/dev/api-service" > /dev/null 2>&1 \
  && echo "FAIL: credential isolation broken - coralogix-feeder can read api-service" \
  || echo "OK: credential isolation verified"
```

**Stop condition:** All key counts must match. AppRole-scoped reads must succeed for own secrets. Cross-service reads must fail (isolation verified).

### Phase 4: Service integration (per-service, gradual rollout)

For each service, in order of risk (start with lowest-traffic):

**4a. Update the service code**

```diff
- import secrets from '@adobe/helix-shared-secrets';
+ import vaultSecrets from '@adobe/spacecat-shared-vault-secrets';

  export const main = wrap(run)
-   .with(secrets, { name: resolveSecretsName })
+   .with(vaultSecrets)
    .with(helixStatus);
```

Remove `@adobe/helix-shared-secrets` from dependencies. Add `@adobe/spacecat-shared-vault-secrets`.

**4b. Deploy to dev**

Deploy and verify.

**4c. Deploy to stage and prod**

Follow the standard promotion pipeline.

**4d. Repeat for next service**

#### Validation Gate 4: Per-Service (run after each service deployment)

```bash
SERVICE="coralogix-feeder"  # Replace for each service
ENV="dev"                    # Run for each environment after deployment

# 1. Verify Lambda is running (not in error state)
aws lambda get-function --function-name "spacecat-services--${SERVICE}--latest" \
  --profile spacecat-${ENV} \
  --query "Configuration.{State:State,LastModified:LastModified}" 2>/dev/null \
  || echo "FAIL: Lambda not found"

# 2. Check CloudWatch logs for successful Vault initialization
aws logs filter-log-events \
  --log-group-name "/aws/lambda/spacecat-services--${SERVICE}--latest" \
  --start-time $(date -v-30M +%s000) \
  --filter-pattern "Vault client ready" \
  --profile spacecat-${ENV} \
  --query "events[0].message" --output text
# Expected: log line containing "Vault client ready"

# 3. Check for errors in recent logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/spacecat-services--${SERVICE}--latest" \
  --start-time $(date -v-30M +%s000) \
  --filter-pattern "?\"error fetching secrets\" ?\"Vault authentication failed\" ?\"Failed to load Vault bootstrap\"" \
  --profile spacecat-${ENV} \
  --query "length(events)"
# Expected: 0 (no error events)

# 4. Invoke the service health endpoint (if applicable)
# For api-service: curl the health endpoint
# For workers: trigger a test invocation or check recent execution success

# 5. Verify old SM secrets are still intact (rollback safety)
aws secretsmanager describe-secret \
  --secret-id "/helix-deploy/spacecat-services/${SERVICE}/latest" \
  --profile spacecat-${ENV} \
  --query "{Name:Name,LastAccessed:LastAccessedDate}" 2>/dev/null
# Expected: secret still exists (not deleted)
```

**Stop condition per service:** "Vault client ready" in logs, zero vault-related errors, service functional. Do not proceed to next service until the current one is stable for at least 1 hour in dev.

**Stop condition for phase:** All core services healthy in all environments. No vault-related errors across the fleet.

### Phase 5: Cleanup

After all services are migrated and stable for at least 1 week:

- Remove `resolveSecretsName` from `spacecat-shared-utils`
- Remove `@adobe/helix-shared-secrets` from all services
- Deprecate (do not delete yet) the old SM secrets at `/helix-deploy/spacecat-services/*/latest`
- Remove `/mysticat/vault-bootstrap` after data-service migration is confirmed stable
- Update the `helix-deploy` secret write step in CI pipelines (stop writing secrets to SM)

#### Validation Gate 5: Cleanup

```bash
# 1. Verify no service still imports helix-shared-secrets
for repo in spacecat-api-service spacecat-audit-worker spacecat-reporting-worker \
            spacecat-autofix-worker spacecat-jobs-dispatcher spacecat-auth-service \
            spacecat-fulfillment-worker spacecat-content-processor spacecat-content-scraper \
            spacecat-import-worker spacecat-import-job-manager spacecat-coralogix-feeder \
            spacecat-task-manager; do
  grep -r "helix-shared-secrets" "../$repo/package.json" 2>/dev/null \
    && echo "FAIL: $repo still depends on helix-shared-secrets"
done

# 2. Verify resolveSecretsName is removed from spacecat-shared-utils
grep -r "resolveSecretsName" ../spacecat-shared/packages/spacecat-shared-utils/src/ 2>/dev/null \
  && echo "FAIL: resolveSecretsName still exists" \
  || echo "OK: resolveSecretsName removed"

# 3. Verify all services are healthy (no regressions from cleanup)
for svc in api-service audit-worker reporting-worker autofix-worker jobs-dispatcher \
           auth-service fulfillment-worker content-processor content-scraper \
           import-worker import-job-manager coralogix-feeder task-manager; do
  aws logs filter-log-events \
    --log-group-name "/aws/lambda/spacecat-services--${svc}--latest" \
    --start-time $(date -v-1H +%s000) \
    --filter-pattern "?ERROR ?error" \
    --profile spacecat-dev \
    --query "length(events)" --output text 2>/dev/null
done
# Expected: low error counts, no vault-related errors
```

**Stop condition:** No service references helix-shared-secrets. All services healthy. Old SM secrets tagged as deprecated but not deleted.

### Rollback

At any phase, rollback is straightforward:

- **Phase 4 rollback:** Revert the service code change (swap `vaultSecrets` back to `secrets`). SM secrets are still present and unchanged.
- **Phase 3 rollback:** Vault secrets can be deleted without affecting anything until Phase 4.
- **Phase 2 rollback:** SM bootstrap secrets can be deleted. No service reads them until Phase 4.
- **Phase 1 rollback:** Vault policies can be reverted via PR. IAM policy change is additive (no breakage).

The key safety property: old SM secrets are not deleted until Phase 5, so any service can be rolled back to `helix-shared-secrets` at any time during Phases 1-4.

## Recommended Rollout Order

Start with the simplest, lowest-risk services:

1. **coralogix-feeder** - simple, few secrets, low blast radius
2. **reporting-worker** - read-only, low blast radius
3. **jobs-dispatcher** - orchestrator, validates secret loading works for scheduled jobs
4. **audit-worker** - high volume, validates performance under load
5. **api-service** - highest traffic, most secrets, last among core services
6. **data-service** - ECS (different deployment model), migrate last

## Open Questions

1. **Secret-id rotation** - Tracked separately in [SITES-40736](https://jira.corp.adobe.com/browse/SITES-40736). Must be solved before or in parallel with this migration.
2. **CI/CD pipeline changes** - Currently `hedy --aws-update-secrets` writes secrets to SM. After migration, secret updates go to Vault directly. Need to update CI workflows.
3. **Customer secrets** - `/helix-deploy/spacecat-services/customer-secrets/*` are separate from service secrets. These may need their own migration strategy.
4. **Dev branch deploys** - Currently each developer gets their own SM secret (e.g. `/helix-deploy/spacecat-services/api-service/djaeggi`). Need to decide if dev deploys also use Vault or continue with SM.
