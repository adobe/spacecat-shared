# spacecat-infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-service Vault bootstrap secret containers and IAM policy updates to support per-service AppRole credential isolation (Phase 1b of the Vault AppRole migration).

**Architecture:** Create 14 empty `aws_secretsmanager_secret` resources at `/mysticat/bootstrap/{service-name}` for each core service. Expose their ARNs as module outputs. Add the `/mysticat/bootstrap/*` wildcard to three existing IAM policies so Lambda execution roles and CI/CD can read/write the new secrets. The existing `/mysticat/vault-bootstrap` secret and data-service `vault_bootstrap_secret_arn` remain unchanged.

**Tech Stack:** Terraform (AWS provider), Secrets Manager, IAM

---

## Task 1: Create feature branch

**File:** N/A (git operations)

```bash
cd /Users/dj/adobe/github/adobe/spacecat-infrastructure
git fetch origin
git checkout -b feat/vault-bootstrap-per-service origin/main
```

**Expected:** Clean branch from latest main.

---

## Task 2: Add per-service bootstrap secret resources

**File:** `/Users/dj/adobe/github/adobe/spacecat-infrastructure/modules/secrets_manager/secrets.tf`

Append the following after the existing `mysticat_vault_bootstrap` resource (line 82):

```hcl
# Per-service Vault AppRole bootstrap secrets
# Empty containers - values populated manually in Phase 2 after AppRoles are provisioned

resource "aws_secretsmanager_secret" "mysticat_bootstrap_api_service" {
  name        = "/mysticat/bootstrap/api-service"
  description = "Vault AppRole bootstrap credentials for api-service"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_audit_worker" {
  name        = "/mysticat/bootstrap/audit-worker"
  description = "Vault AppRole bootstrap credentials for audit-worker"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_reporting_worker" {
  name        = "/mysticat/bootstrap/reporting-worker"
  description = "Vault AppRole bootstrap credentials for reporting-worker"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_autofix_worker" {
  name        = "/mysticat/bootstrap/autofix-worker"
  description = "Vault AppRole bootstrap credentials for autofix-worker"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_jobs_dispatcher" {
  name        = "/mysticat/bootstrap/jobs-dispatcher"
  description = "Vault AppRole bootstrap credentials for jobs-dispatcher"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_auth_service" {
  name        = "/mysticat/bootstrap/auth-service"
  description = "Vault AppRole bootstrap credentials for auth-service"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_fulfillment_worker" {
  name        = "/mysticat/bootstrap/fulfillment-worker"
  description = "Vault AppRole bootstrap credentials for fulfillment-worker"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_content_processor" {
  name        = "/mysticat/bootstrap/content-processor"
  description = "Vault AppRole bootstrap credentials for content-processor"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_content_scraper" {
  name        = "/mysticat/bootstrap/content-scraper"
  description = "Vault AppRole bootstrap credentials for content-scraper"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_import_worker" {
  name        = "/mysticat/bootstrap/import-worker"
  description = "Vault AppRole bootstrap credentials for import-worker"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_import_job_manager" {
  name        = "/mysticat/bootstrap/import-job-manager"
  description = "Vault AppRole bootstrap credentials for import-job-manager"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_coralogix_feeder" {
  name        = "/mysticat/bootstrap/coralogix-feeder"
  description = "Vault AppRole bootstrap credentials for coralogix-feeder"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_task_manager" {
  name        = "/mysticat/bootstrap/task-manager"
  description = "Vault AppRole bootstrap credentials for task-manager"
}

resource "aws_secretsmanager_secret" "mysticat_bootstrap_data_service" {
  name        = "/mysticat/bootstrap/data-service"
  description = "Vault AppRole bootstrap credentials for data-service"
}
```

**Verify:** 14 new `aws_secretsmanager_secret` resources (13 Lambda services + data-service). The existing `mysticat_vault_bootstrap` resource at line 79-82 is unchanged.

---

## Task 3: Add outputs for new bootstrap secret ARNs

**File:** `/Users/dj/adobe/github/adobe/spacecat-infrastructure/modules/secrets_manager/outputs.tf`

Append after the existing `mysticat_vault_bootstrap_arn` output (line 72):

```hcl
# Per-service Vault bootstrap secret ARNs

output "mysticat_bootstrap_api_service_arn" {
  description = "ARN of the Vault bootstrap secret for api-service"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_api_service.arn
}

output "mysticat_bootstrap_audit_worker_arn" {
  description = "ARN of the Vault bootstrap secret for audit-worker"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_audit_worker.arn
}

output "mysticat_bootstrap_reporting_worker_arn" {
  description = "ARN of the Vault bootstrap secret for reporting-worker"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_reporting_worker.arn
}

output "mysticat_bootstrap_autofix_worker_arn" {
  description = "ARN of the Vault bootstrap secret for autofix-worker"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_autofix_worker.arn
}

output "mysticat_bootstrap_jobs_dispatcher_arn" {
  description = "ARN of the Vault bootstrap secret for jobs-dispatcher"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_jobs_dispatcher.arn
}

output "mysticat_bootstrap_auth_service_arn" {
  description = "ARN of the Vault bootstrap secret for auth-service"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_auth_service.arn
}

output "mysticat_bootstrap_fulfillment_worker_arn" {
  description = "ARN of the Vault bootstrap secret for fulfillment-worker"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_fulfillment_worker.arn
}

output "mysticat_bootstrap_content_processor_arn" {
  description = "ARN of the Vault bootstrap secret for content-processor"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_content_processor.arn
}

output "mysticat_bootstrap_content_scraper_arn" {
  description = "ARN of the Vault bootstrap secret for content-scraper"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_content_scraper.arn
}

output "mysticat_bootstrap_import_worker_arn" {
  description = "ARN of the Vault bootstrap secret for import-worker"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_import_worker.arn
}

output "mysticat_bootstrap_import_job_manager_arn" {
  description = "ARN of the Vault bootstrap secret for import-job-manager"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_import_job_manager.arn
}

output "mysticat_bootstrap_coralogix_feeder_arn" {
  description = "ARN of the Vault bootstrap secret for coralogix-feeder"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_coralogix_feeder.arn
}

output "mysticat_bootstrap_task_manager_arn" {
  description = "ARN of the Vault bootstrap secret for task-manager"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_task_manager.arn
}

output "mysticat_bootstrap_data_service_arn" {
  description = "ARN of the Vault bootstrap secret for data-service"
  value       = aws_secretsmanager_secret.mysticat_bootstrap_data_service.arn
}
```

**Verify:** 14 new outputs, one per service. Names follow the `mysticat_bootstrap_{service_name}_arn` pattern.

---

## Task 4: Add `/mysticat/bootstrap/*` to IAM policies

**File:** `/Users/dj/adobe/github/adobe/spacecat-infrastructure/modules/iam/policies.tf`

Three policies need updating. Each currently has a `Resource` list with only `/helix-deploy/spacecat-services/*`. Add `/mysticat/bootstrap/*` to each.

### 4a. Update `spacecat_policy_secrets_rw` (line 342)

Change the Resource array in the `SecretsManagerAccess` statement from:

```hcl
        Resource : [
          "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:/helix-deploy/spacecat-services/*",
        ]
```

to:

```hcl
        Resource : [
          "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:/helix-deploy/spacecat-services/*",
          "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:/mysticat/bootstrap/*",
        ]
```

### 4b. Update `spacecat_policy_secrets_ro` (line 371)

Change the Resource array in the `SecretsReadOnlyAccess` statement from:

```hcl
        Resource : [
          "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:/helix-deploy/spacecat-services/*"
        ]
```

to:

```hcl
        Resource : [
          "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:/helix-deploy/spacecat-services/*",
          "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:/mysticat/bootstrap/*",
        ]
```

### 4c. Update `spacecat_policy_service_basic` (line 395)

This policy's `ServiceLogAndXRayAccess` statement has a mixed `Resource` list covering both logs and secrets. Add the bootstrap path to the existing list. Change from:

```hcl
        "Resource" : [
          "arn:aws:logs:${var.region}:${var.account_id}:log-group:/*",
          "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:/helix-deploy/spacecat-services/*"
        ]
```

to:

```hcl
        "Resource" : [
          "arn:aws:logs:${var.region}:${var.account_id}:log-group:/*",
          "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:/helix-deploy/spacecat-services/*",
          "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:/mysticat/bootstrap/*"
        ]
```

**Verify:** Three policies updated. Each adds exactly one new ARN pattern. No other changes.

---

## Task 5: Format and validate Terraform

**Commands:**

```bash
cd /Users/dj/adobe/github/adobe/spacecat-infrastructure

# Format
terraform fmt -recursive

# Validate all three environments
for env in dev stage prod; do
  cd /Users/dj/adobe/github/adobe/spacecat-infrastructure/environments/$env
  terraform init -backend=false
  terraform validate
done
```

**Expected output for each environment:**
```
Success! The configuration is valid.
```

If `terraform init` fails on provider download, it may need AWS credentials. Use `terraform init -backend=false` which skips remote state but still validates module references. If validation fails, fix the issue and re-run.

---

## Task 6: Commit and push

**Commands:**

```bash
cd /Users/dj/adobe/github/adobe/spacecat-infrastructure

git add modules/secrets_manager/secrets.tf modules/secrets_manager/outputs.tf modules/iam/policies.tf
git commit -m "feat: add per-service Vault bootstrap secrets and IAM policy updates

Add 14 aws_secretsmanager_secret resources at /mysticat/bootstrap/{service-name}
for each core service (13 Lambda + data-service). These are empty containers
that will be populated with Vault AppRole credentials in Phase 2.

Add /mysticat/bootstrap/* to three IAM policies:
- spacecat-policy-secrets-ro (Lambda read access)
- spacecat-policy-secrets-rw (CI/CD read-write access)
- spacecat-policy-service-basic (basic service permissions)

Part of Phase 1b: per-service Vault AppRole credential isolation.
SITES-40735"

git push -u origin feat/vault-bootstrap-per-service
```

---

## Task 7: Create pull request

**Command:**

```bash
gh pr create \
  --repo adobe/spacecat-infrastructure \
  --title "feat: add per-service Vault bootstrap secrets" \
  --body "$(cat <<'EOF'
## Summary

Phase 1b of the per-service Vault AppRole migration ([SITES-40735](https://jira.corp.adobe.com/browse/SITES-40735)).

- Add 14 `aws_secretsmanager_secret` resources at `/mysticat/bootstrap/{service-name}` (13 Lambda services + data-service)
- Add corresponding outputs for the new secret ARNs
- Add `/mysticat/bootstrap/*` to three IAM policies: `spacecat-policy-secrets-ro`, `spacecat-policy-secrets-rw`, `spacecat-policy-service-basic`

### What this does NOT change

- The existing `/mysticat/vault-bootstrap` secret is kept as-is
- The `vault_bootstrap_secret_arn` for data-service still points to `/mysticat/vault-bootstrap` (updated in Phase 2d)
- No service code changes - secrets are empty containers until Phase 2

### Services in scope

api-service, audit-worker, reporting-worker, autofix-worker, jobs-dispatcher, auth-service, fulfillment-worker, content-processor, content-scraper, import-worker, import-job-manager, coralogix-feeder, task-manager, data-service

## Test plan

- [ ] `terraform fmt -recursive` passes with no changes
- [ ] `terraform validate` passes in all three environments (dev, stage, prod)
- [ ] CI pipeline passes (LocalStack test + dev deploy)
- [ ] After merge: verify SM secrets exist in dev via `aws secretsmanager describe-secret --secret-id /mysticat/bootstrap/api-service --profile spacecat-dev`
- [ ] After merge: verify IAM policies include bootstrap path via AWS Console or CLI
EOF
)"
```

---

## Task 8: Monitor CI and verify

After CI runs:

```bash
# Watch the CI workflow
gh run watch --repo adobe/spacecat-infrastructure

# After merge + deploy, verify one secret exists in dev
AWS_PROFILE=spacecat-dev aws secretsmanager describe-secret \
  --secret-id "/mysticat/bootstrap/api-service" \
  --query "{Name:Name,ARN:ARN}"

# Verify IAM policy includes bootstrap path
POLICY_ARN=$(AWS_PROFILE=spacecat-dev aws iam list-policies \
  --query "Policies[?PolicyName=='spacecat-policy-secrets-ro'].Arn" --output text)
VERSION=$(AWS_PROFILE=spacecat-dev aws iam get-policy \
  --policy-arn "$POLICY_ARN" --query "Policy.DefaultVersionId" --output text)
AWS_PROFILE=spacecat-dev aws iam get-policy-version \
  --policy-arn "$POLICY_ARN" --version-id "$VERSION" \
  --query "PolicyVersion.Document" --output text | grep -o "bootstrap"
```

**Expected:** Secret exists, IAM policy contains "bootstrap".

---

## Notes

- **No data-service migration in this PR.** The `vault_bootstrap_secret_arn` variable in the `mysticat_data_service` module continues to reference `module.spacecat_secrets.mysticat_vault_bootstrap_arn`. Phase 2d will update it to `module.spacecat_secrets.mysticat_bootstrap_data_service_arn`.
- **Additive-only changes.** No existing resources are modified or destroyed. IAM policy changes add a new Resource entry alongside the existing one. This makes rollback trivial - just revert the PR.
- **No environment-specific changes.** All three environments (dev/stage/prod) use the same secrets_manager module without conditional logic, so all 14 secrets are created in all accounts.
