# Vault Migration Runbook - SM to Vault Secret Sync

**JIRA:** [SITES-40735](https://jira.corp.adobe.com/browse/SITES-40735)
**Phase:** 3 (Copy secrets to Vault)
**Impact:** None - secrets are written to Vault but no service reads from Vault until Phase 4

## Overview

This runbook syncs service secrets from AWS Secrets Manager to HashiCorp Vault. It is **idempotent** and should be re-run before Phase 4 (service switchover) to ensure Vault has the latest values.

## Prerequisites

| Requirement | Command | TTL |
|-------------|---------|-----|
| Vault token | `vldj` | 4h |
| AWS sessions | `klam login && klsa` | ~1h |

Both scripts live in `spacecat-shared/docs/plans/`.

## Quick Reference

```bash
cd ~/adobe/github/adobe/spacecat-shared/docs/plans

# Dry run (shows what would happen, no writes)
DRY_RUN=1 ./vault-sm-to-vault-sync.sh

# Sync all services, all envs
./vault-sm-to-vault-sync.sh

# Sync single env
./vault-sm-to-vault-sync.sh dev

# Sync single service + env
./vault-sm-to-vault-sync.sh dev api-service

# Validate (after sync)
./vault-sm-to-vault-validate.sh
./vault-sm-to-vault-validate.sh dev   # dev only
```

## What Gets Synced

| Source (SM) | Destination (Vault) |
|-------------|---------------------|
| `/helix-deploy/spacecat-services/{service}/latest` | `dx_mysticat/{env}/{service}` |

Services: api-service, audit-worker, auth-service, autofix-worker, content-processor, content-scraper, fulfillment-worker, import-job-manager, import-worker, jobs-dispatcher, reporting-worker, task-manager

Environments: dev (spacecat-dev), stage (spacecat-stage), prod (spacecat-prod)

**Excluded:** data-service (ECS, different bootstrap path and secret layout)

## Procedure

### 1. Authenticate

```bash
vldj              # Vault (needs MFA push)
klam login && klsa  # AWS (needs MFA)
```

### 2. Dry run

```bash
DRY_RUN=1 ./vault-sm-to-vault-sync.sh
```

Verify: output shows expected key counts for each service/env. No writes performed.

### 3. Sync - dev first

```bash
./vault-sm-to-vault-sync.sh dev
```

Verify: 12 passed, 0 failed.

### 4. Validate dev

```bash
./vault-sm-to-vault-validate.sh dev
```

Verify: key counts match, AppRole reads succeed, isolation holds.

### 5. Sync stage + prod

```bash
./vault-sm-to-vault-sync.sh stage
./vault-sm-to-vault-sync.sh prod
```

### 6. Full validation

```bash
./vault-sm-to-vault-validate.sh
```

Expected: 36 key count checks pass + 2 AppRole read checks + 1 isolation check = 39 total.

## Re-sync Before Switchover

Before switching any service to Vault (Phase 4), re-run the sync to pick up any secret changes made since the last sync:

```bash
# Re-sync the specific service about to switch
./vault-sm-to-vault-sync.sh dev api-service
./vault-sm-to-vault-sync.sh stage api-service
./vault-sm-to-vault-sync.sh prod api-service
```

Or re-sync everything:

```bash
./vault-sm-to-vault-sync.sh
```

## Rollback

Vault secrets can be deleted without affecting any service (until Phase 4 switchover):

```bash
# Delete a single service's secrets from Vault
vault kv metadata delete dx_mysticat/dev/api-service
```

No SM secrets are modified by this process.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `permission denied` on vault commands | Token expired | `vldj` |
| `ExpiredTokenException` on AWS commands | Session expired | `klam login && klsa` |
| `No value found at dx_mysticat/data/...` | Secret not yet synced | Run sync script |
| Key count mismatch | SM secret changed after sync | Re-run sync for that service/env |
| AppRole read fails | Bootstrap secret has stale secret_id | Re-run Phase 2 bootstrap script |
| Isolation check fails | HCL policy too permissive | Check `dx_mysticat_{service}_{env}.hcl` |
