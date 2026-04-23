# vault_policies Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create HCL policy files and mappings.yaml entries for 13 SpaceCat services across 3 environments (39 new files + 39 new mappings entries) in the vault_policies repo.
**Architecture:** Each service gets three HCL policy files (dev/stage/prod) granting read access to its own Vault KV path (`dx_mysticat/data/{env}/{service-name}/*`) plus AppRole self-service paths. All files live in `prod/dx_mysticat/` alongside the existing `data-service` policies. The `mappings.yaml` file gets 39 new `APPROLE_ROLE` entries.
**Tech Stack:** HCL (HashiCorp Configuration Language), YAML

---

## Task 0: Setup - Create feature branch

**File:** N/A (git operations)

```bash
cd /Users/dj/adobe/github/adobe/vault_policies
git checkout main
git pull origin main
git checkout -b feat/per-service-approles
```

**Validate:**
```bash
git branch --show-current
# Expected: feat/per-service-approles
```

---

## Task 1: Create HCL files for api-service (template reference)

This task serves as the template. All subsequent services follow this exact pattern with service name and underscore-name substituted.

**Naming convention:**
- Service name in paths: as-is with hyphens (e.g., `api-service`)
- Policy/role name: hyphens replaced with underscores (e.g., `dx_mysticat_api_service_dev`)

**File:** `/Users/dj/adobe/github/adobe/vault_policies/prod/dx_mysticat/dx_mysticat_api_service_dev.hcl`

```hcl
# AppRole self-service paths for dx_mysticat_api_service_dev
path "auth/approle/role/dx_mysticat_api_service_dev/role-id" {
    capabilities = ["read"]
}

path "auth/approle/role/dx_mysticat_api_service_dev/secret-id*" {
    capabilities = ["update"]
}

# Read access to api-service secrets for DEV environment only
path "dx_mysticat/data/dev/api-service/*" {
    capabilities = ["read"]
}

# Metadata list access (for debugging/discovery)
path "dx_mysticat/metadata/dev/api-service/*" {
    capabilities = ["list"]
}
```

**File:** `/Users/dj/adobe/github/adobe/vault_policies/prod/dx_mysticat/dx_mysticat_api_service_stage.hcl`

```hcl
# AppRole self-service paths for dx_mysticat_api_service_stage
path "auth/approle/role/dx_mysticat_api_service_stage/role-id" {
    capabilities = ["read"]
}

path "auth/approle/role/dx_mysticat_api_service_stage/secret-id*" {
    capabilities = ["update"]
}

# Read access to api-service secrets for STAGE environment only
path "dx_mysticat/data/stage/api-service/*" {
    capabilities = ["read"]
}

# Metadata list access (for debugging/discovery)
path "dx_mysticat/metadata/stage/api-service/*" {
    capabilities = ["list"]
}
```

**File:** `/Users/dj/adobe/github/adobe/vault_policies/prod/dx_mysticat/dx_mysticat_api_service_prod.hcl`

```hcl
# AppRole self-service paths for dx_mysticat_api_service_prod
path "auth/approle/role/dx_mysticat_api_service_prod/role-id" {
    capabilities = ["read"]
}

path "auth/approle/role/dx_mysticat_api_service_prod/secret-id*" {
    capabilities = ["update"]
}

# Read access to api-service secrets for PROD environment only
path "dx_mysticat/data/prod/api-service/*" {
    capabilities = ["read"]
}

# Metadata list access (for debugging/discovery)
path "dx_mysticat/metadata/prod/api-service/*" {
    capabilities = ["list"]
}
```

**Validate:**
```bash
cd /Users/dj/adobe/github/adobe/vault_policies
# Verify files exist and have correct structure
for env in dev stage prod; do
  file="prod/dx_mysticat/dx_mysticat_api_service_${env}.hcl"
  test -f "$file" && echo "OK: $file" || echo "MISSING: $file"
  grep -q "api-service" "$file" && echo "  - Contains api-service path" || echo "  - MISSING api-service path"
  grep -q "dx_mysticat_api_service_${env}" "$file" && echo "  - Contains correct role name" || echo "  - MISSING correct role name"
  grep -q "${env}" "$file" && echo "  - Contains correct env" || echo "  - MISSING correct env"
done
```

**Commit:**
```bash
git add prod/dx_mysticat/dx_mysticat_api_service_*.hcl
git commit -m "Add Vault policies for api-service (dev/stage/prod)"
```

---

## Task 2: Create HCL files for audit-worker, reporting-worker, autofix-worker

For each service below, create three HCL files (dev/stage/prod) following the exact pattern from Task 1. Substitute the service name and underscore name:

| Service | Underscore Name | Path Name |
|---------|----------------|-----------|
| audit-worker | audit_worker | audit-worker |
| reporting-worker | reporting_worker | reporting-worker |
| autofix-worker | autofix_worker | autofix-worker |

**Files to create (9 total):**
- `prod/dx_mysticat/dx_mysticat_audit_worker_{dev,stage,prod}.hcl`
- `prod/dx_mysticat/dx_mysticat_reporting_worker_{dev,stage,prod}.hcl`
- `prod/dx_mysticat/dx_mysticat_autofix_worker_{dev,stage,prod}.hcl`

Each file follows the same 4-path structure as Task 1:
1. `auth/approle/role/dx_mysticat_{underscore_name}_{env}/role-id` - capabilities: `["read"]`
2. `auth/approle/role/dx_mysticat_{underscore_name}_{env}/secret-id*` - capabilities: `["update"]`
3. `dx_mysticat/data/{env}/{service-name}/*` - capabilities: `["read"]`
4. `dx_mysticat/metadata/{env}/{service-name}/*` - capabilities: `["list"]`

**Validate:**
```bash
cd /Users/dj/adobe/github/adobe/vault_policies
for svc_pair in "audit-worker:audit_worker" "reporting-worker:reporting_worker" "autofix-worker:autofix_worker"; do
  svc=$(echo "$svc_pair" | cut -d: -f1)
  uscore=$(echo "$svc_pair" | cut -d: -f2)
  for env in dev stage prod; do
    file="prod/dx_mysticat/dx_mysticat_${uscore}_${env}.hcl"
    test -f "$file" && echo "OK: $file" || echo "MISSING: $file"
    grep -q "${svc}" "$file" && echo "  - path OK" || echo "  - path MISSING"
    grep -q "dx_mysticat_${uscore}_${env}" "$file" && echo "  - role OK" || echo "  - role MISSING"
  done
done
```

**Commit:**
```bash
git add prod/dx_mysticat/dx_mysticat_audit_worker_*.hcl \
        prod/dx_mysticat/dx_mysticat_reporting_worker_*.hcl \
        prod/dx_mysticat/dx_mysticat_autofix_worker_*.hcl
git commit -m "Add Vault policies for audit-worker, reporting-worker, autofix-worker"
```

---

## Task 3: Create HCL files for jobs-dispatcher, auth-service, fulfillment-worker

| Service | Underscore Name | Path Name |
|---------|----------------|-----------|
| jobs-dispatcher | jobs_dispatcher | jobs-dispatcher |
| auth-service | auth_service | auth-service |
| fulfillment-worker | fulfillment_worker | fulfillment-worker |

**Files to create (9 total):**
- `prod/dx_mysticat/dx_mysticat_jobs_dispatcher_{dev,stage,prod}.hcl`
- `prod/dx_mysticat/dx_mysticat_auth_service_{dev,stage,prod}.hcl`
- `prod/dx_mysticat/dx_mysticat_fulfillment_worker_{dev,stage,prod}.hcl`

Same 4-path structure as Task 1.

**Validate:**
```bash
cd /Users/dj/adobe/github/adobe/vault_policies
for svc_pair in "jobs-dispatcher:jobs_dispatcher" "auth-service:auth_service" "fulfillment-worker:fulfillment_worker"; do
  svc=$(echo "$svc_pair" | cut -d: -f1)
  uscore=$(echo "$svc_pair" | cut -d: -f2)
  for env in dev stage prod; do
    file="prod/dx_mysticat/dx_mysticat_${uscore}_${env}.hcl"
    test -f "$file" && echo "OK: $file" || echo "MISSING: $file"
    grep -q "${svc}" "$file" && echo "  - path OK" || echo "  - path MISSING"
    grep -q "dx_mysticat_${uscore}_${env}" "$file" && echo "  - role OK" || echo "  - role MISSING"
  done
done
```

**Commit:**
```bash
git add prod/dx_mysticat/dx_mysticat_jobs_dispatcher_*.hcl \
        prod/dx_mysticat/dx_mysticat_auth_service_*.hcl \
        prod/dx_mysticat/dx_mysticat_fulfillment_worker_*.hcl
git commit -m "Add Vault policies for jobs-dispatcher, auth-service, fulfillment-worker"
```

---

## Task 4: Create HCL files for content-processor, content-scraper, import-worker

| Service | Underscore Name | Path Name |
|---------|----------------|-----------|
| content-processor | content_processor | content-processor |
| content-scraper | content_scraper | content-scraper |
| import-worker | import_worker | import-worker |

**Files to create (9 total):**
- `prod/dx_mysticat/dx_mysticat_content_processor_{dev,stage,prod}.hcl`
- `prod/dx_mysticat/dx_mysticat_content_scraper_{dev,stage,prod}.hcl`
- `prod/dx_mysticat/dx_mysticat_import_worker_{dev,stage,prod}.hcl`

Same 4-path structure as Task 1.

**Validate:**
```bash
cd /Users/dj/adobe/github/adobe/vault_policies
for svc_pair in "content-processor:content_processor" "content-scraper:content_scraper" "import-worker:import_worker"; do
  svc=$(echo "$svc_pair" | cut -d: -f1)
  uscore=$(echo "$svc_pair" | cut -d: -f2)
  for env in dev stage prod; do
    file="prod/dx_mysticat/dx_mysticat_${uscore}_${env}.hcl"
    test -f "$file" && echo "OK: $file" || echo "MISSING: $file"
    grep -q "${svc}" "$file" && echo "  - path OK" || echo "  - path MISSING"
    grep -q "dx_mysticat_${uscore}_${env}" "$file" && echo "  - role OK" || echo "  - role MISSING"
  done
done
```

**Commit:**
```bash
git add prod/dx_mysticat/dx_mysticat_content_processor_*.hcl \
        prod/dx_mysticat/dx_mysticat_content_scraper_*.hcl \
        prod/dx_mysticat/dx_mysticat_import_worker_*.hcl
git commit -m "Add Vault policies for content-processor, content-scraper, import-worker"
```

---

## Task 5: Create HCL files for import-job-manager, coralogix-feeder, task-manager

| Service | Underscore Name | Path Name |
|---------|----------------|-----------|
| import-job-manager | import_job_manager | import-job-manager |
| coralogix-feeder | coralogix_feeder | coralogix-feeder |
| task-manager | task_manager | task-manager |

**Files to create (9 total):**
- `prod/dx_mysticat/dx_mysticat_import_job_manager_{dev,stage,prod}.hcl`
- `prod/dx_mysticat/dx_mysticat_coralogix_feeder_{dev,stage,prod}.hcl`
- `prod/dx_mysticat/dx_mysticat_task_manager_{dev,stage,prod}.hcl`

Same 4-path structure as Task 1.

**Validate:**
```bash
cd /Users/dj/adobe/github/adobe/vault_policies
for svc_pair in "import-job-manager:import_job_manager" "coralogix-feeder:coralogix_feeder" "task-manager:task_manager"; do
  svc=$(echo "$svc_pair" | cut -d: -f1)
  uscore=$(echo "$svc_pair" | cut -d: -f2)
  for env in dev stage prod; do
    file="prod/dx_mysticat/dx_mysticat_${uscore}_${env}.hcl"
    test -f "$file" && echo "OK: $file" || echo "MISSING: $file"
    grep -q "${svc}" "$file" && echo "  - path OK" || echo "  - path MISSING"
    grep -q "dx_mysticat_${uscore}_${env}" "$file" && echo "  - role OK" || echo "  - role MISSING"
  done
done
```

**Commit:**
```bash
git add prod/dx_mysticat/dx_mysticat_import_job_manager_*.hcl \
        prod/dx_mysticat/dx_mysticat_coralogix_feeder_*.hcl \
        prod/dx_mysticat/dx_mysticat_task_manager_*.hcl
git commit -m "Add Vault policies for import-job-manager, coralogix-feeder, task-manager"
```

---

## Task 6: Update mappings.yaml with all 39 new APPROLE_ROLE entries

**File:** `/Users/dj/adobe/github/adobe/vault_policies/prod/dx_mysticat/mappings.yaml`

Add 39 new `APPROLE_ROLE` entries (13 services x 3 environments) to the existing `APPROLE_ROLE` list. The existing 3 `data-service` entries remain unchanged. Append the new entries after the existing `dx_mysticat_data_service_prod` entry, before the `OKTA` section.

The complete file should be:

```yaml
- ALLOWED_PATHS:
  - dx_mysticat
- APPROLE_ROLE:
  - role_name: dx_mysticat_data_service_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_data_service_dev
  - role_name: dx_mysticat_data_service_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_data_service_stage
  - role_name: dx_mysticat_data_service_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_data_service_prod
  - role_name: dx_mysticat_api_service_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_api_service_dev
  - role_name: dx_mysticat_api_service_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_api_service_stage
  - role_name: dx_mysticat_api_service_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_api_service_prod
  - role_name: dx_mysticat_audit_worker_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_audit_worker_dev
  - role_name: dx_mysticat_audit_worker_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_audit_worker_stage
  - role_name: dx_mysticat_audit_worker_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_audit_worker_prod
  - role_name: dx_mysticat_reporting_worker_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_reporting_worker_dev
  - role_name: dx_mysticat_reporting_worker_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_reporting_worker_stage
  - role_name: dx_mysticat_reporting_worker_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_reporting_worker_prod
  - role_name: dx_mysticat_autofix_worker_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_autofix_worker_dev
  - role_name: dx_mysticat_autofix_worker_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_autofix_worker_stage
  - role_name: dx_mysticat_autofix_worker_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_autofix_worker_prod
  - role_name: dx_mysticat_jobs_dispatcher_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_jobs_dispatcher_dev
  - role_name: dx_mysticat_jobs_dispatcher_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_jobs_dispatcher_stage
  - role_name: dx_mysticat_jobs_dispatcher_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_jobs_dispatcher_prod
  - role_name: dx_mysticat_auth_service_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_auth_service_dev
  - role_name: dx_mysticat_auth_service_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_auth_service_stage
  - role_name: dx_mysticat_auth_service_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_auth_service_prod
  - role_name: dx_mysticat_fulfillment_worker_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_fulfillment_worker_dev
  - role_name: dx_mysticat_fulfillment_worker_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_fulfillment_worker_stage
  - role_name: dx_mysticat_fulfillment_worker_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_fulfillment_worker_prod
  - role_name: dx_mysticat_content_processor_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_content_processor_dev
  - role_name: dx_mysticat_content_processor_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_content_processor_stage
  - role_name: dx_mysticat_content_processor_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_content_processor_prod
  - role_name: dx_mysticat_content_scraper_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_content_scraper_dev
  - role_name: dx_mysticat_content_scraper_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_content_scraper_stage
  - role_name: dx_mysticat_content_scraper_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_content_scraper_prod
  - role_name: dx_mysticat_import_worker_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_import_worker_dev
  - role_name: dx_mysticat_import_worker_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_import_worker_stage
  - role_name: dx_mysticat_import_worker_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_import_worker_prod
  - role_name: dx_mysticat_import_job_manager_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_import_job_manager_dev
  - role_name: dx_mysticat_import_job_manager_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_import_job_manager_stage
  - role_name: dx_mysticat_import_job_manager_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_import_job_manager_prod
  - role_name: dx_mysticat_coralogix_feeder_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_coralogix_feeder_dev
  - role_name: dx_mysticat_coralogix_feeder_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_coralogix_feeder_stage
  - role_name: dx_mysticat_coralogix_feeder_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_coralogix_feeder_prod
  - role_name: dx_mysticat_task_manager_dev
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_task_manager_dev
  - role_name: dx_mysticat_task_manager_stage
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_task_manager_stage
  - role_name: dx_mysticat_task_manager_prod
    token_ttl: 3600
    token_max_ttl: 3600
    policies:
    - dx_mysticat_task_manager_prod
- OKTA:
  - group_name: DX_AEM_EXP_SUCCESS_ENG
    policies:
    - dx_mysticat
```

**Validate:**
```bash
cd /Users/dj/adobe/github/adobe/vault_policies

# Count APPROLE_ROLE entries (should be 42: 3 existing + 39 new)
grep -c "role_name:" prod/dx_mysticat/mappings.yaml
# Expected: 42

# Verify all 13 services are present
for svc in api_service audit_worker reporting_worker autofix_worker jobs_dispatcher \
           auth_service fulfillment_worker content_processor content_scraper \
           import_worker import_job_manager coralogix_feeder task_manager; do
  count=$(grep -c "dx_mysticat_${svc}_" prod/dx_mysticat/mappings.yaml)
  echo "$svc: $count entries (expected 3)"
done

# Verify data-service entries unchanged
grep -c "dx_mysticat_data_service_" prod/dx_mysticat/mappings.yaml
# Expected: 3

# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('prod/dx_mysticat/mappings.yaml')); print('YAML valid')"
```

**Commit:**
```bash
git add prod/dx_mysticat/mappings.yaml
git commit -m "Add mappings.yaml entries for 13 per-service AppRoles (39 new entries)"
```

---

## Task 7: Final validation - all files and cross-checks

**Validate all 39 HCL files exist:**
```bash
cd /Users/dj/adobe/github/adobe/vault_policies
MISSING=0
for svc_pair in \
  "api-service:api_service" \
  "audit-worker:audit_worker" \
  "reporting-worker:reporting_worker" \
  "autofix-worker:autofix_worker" \
  "jobs-dispatcher:jobs_dispatcher" \
  "auth-service:auth_service" \
  "fulfillment-worker:fulfillment_worker" \
  "content-processor:content_processor" \
  "content-scraper:content_scraper" \
  "import-worker:import_worker" \
  "import-job-manager:import_job_manager" \
  "coralogix-feeder:coralogix_feeder" \
  "task-manager:task_manager"; do
  svc=$(echo "$svc_pair" | cut -d: -f1)
  uscore=$(echo "$svc_pair" | cut -d: -f2)
  for env in dev stage prod; do
    file="prod/dx_mysticat/dx_mysticat_${uscore}_${env}.hcl"
    if [ ! -f "$file" ]; then
      echo "MISSING: $file"
      MISSING=$((MISSING+1))
    fi
  done
done
echo "Missing files: $MISSING (expected: 0)"
```

**Validate every HCL file references the correct env and service:**
```bash
cd /Users/dj/adobe/github/adobe/vault_policies
ERRORS=0
for svc_pair in \
  "api-service:api_service" \
  "audit-worker:audit_worker" \
  "reporting-worker:reporting_worker" \
  "autofix-worker:autofix_worker" \
  "jobs-dispatcher:jobs_dispatcher" \
  "auth-service:auth_service" \
  "fulfillment-worker:fulfillment_worker" \
  "content-processor:content_processor" \
  "content-scraper:content_scraper" \
  "import-worker:import_worker" \
  "import-job-manager:import_job_manager" \
  "coralogix-feeder:coralogix_feeder" \
  "task-manager:task_manager"; do
  svc=$(echo "$svc_pair" | cut -d: -f1)
  uscore=$(echo "$svc_pair" | cut -d: -f2)
  for env in dev stage prod; do
    file="prod/dx_mysticat/dx_mysticat_${uscore}_${env}.hcl"
    # Check all 4 expected paths are present
    grep -q "auth/approle/role/dx_mysticat_${uscore}_${env}/role-id" "$file" || { echo "ERROR: $file missing role-id path"; ERRORS=$((ERRORS+1)); }
    grep -q "auth/approle/role/dx_mysticat_${uscore}_${env}/secret-id" "$file" || { echo "ERROR: $file missing secret-id path"; ERRORS=$((ERRORS+1)); }
    grep -q "dx_mysticat/data/${env}/${svc}/\*" "$file" || { echo "ERROR: $file missing data path"; ERRORS=$((ERRORS+1)); }
    grep -q "dx_mysticat/metadata/${env}/${svc}/\*" "$file" || { echo "ERROR: $file missing metadata path"; ERRORS=$((ERRORS+1)); }
  done
done
echo "Errors: $ERRORS (expected: 0)"
```

**Validate mappings.yaml has a matching entry for every HCL file:**
```bash
cd /Users/dj/adobe/github/adobe/vault_policies
MISMATCHES=0
for svc in api_service audit_worker reporting_worker autofix_worker jobs_dispatcher \
           auth_service fulfillment_worker content_processor content_scraper \
           import_worker import_job_manager coralogix_feeder task_manager; do
  for env in dev stage prod; do
    role="dx_mysticat_${svc}_${env}"
    # Check HCL file exists
    test -f "prod/dx_mysticat/${role}.hcl" || { echo "MISSING HCL: ${role}.hcl"; MISMATCHES=$((MISMATCHES+1)); }
    # Check mappings.yaml has the role
    grep -q "role_name: ${role}" prod/dx_mysticat/mappings.yaml || { echo "MISSING MAPPING: ${role}"; MISMATCHES=$((MISMATCHES+1)); }
    # Check mappings.yaml references the correct policy
    grep -A3 "role_name: ${role}" prod/dx_mysticat/mappings.yaml | grep -q "- ${role}" || { echo "MISSING POLICY REF: ${role}"; MISMATCHES=$((MISMATCHES+1)); }
  done
done
echo "Mismatches: $MISMATCHES (expected: 0)"
```

**Count total new files:**
```bash
cd /Users/dj/adobe/github/adobe/vault_policies
ls prod/dx_mysticat/dx_mysticat_*.hcl | wc -l
# Expected: 42 (3 existing data-service + 39 new)
```

---

## Task 8: Push branch and create PR

```bash
cd /Users/dj/adobe/github/adobe/vault_policies
git push -u origin feat/per-service-approles
```

Create a PR targeting the `main` branch of `cst-vault/vault_policies` on git.corp.adobe.com. The PR should be created from the `djaeggi` fork.

**PR Title:** Add per-service Vault AppRole policies for 13 SpaceCat services

**PR Body:**
```
## Summary

Adds Vault HCL policy files and mappings.yaml AppRole entries for 13 SpaceCat services
across all three environments (dev/stage/prod). This is Phase 1a of the per-service Vault
AppRole migration (SITES-40735).

## Changes

- 39 new HCL policy files (13 services x 3 environments)
- 39 new APPROLE_ROLE entries in mappings.yaml
- Existing data-service policies and mappings unchanged

## Services

api-service, audit-worker, reporting-worker, autofix-worker, jobs-dispatcher,
auth-service, fulfillment-worker, content-processor, content-scraper,
import-worker, import-job-manager, coralogix-feeder, task-manager

## Policy structure (per service per env)

Each policy grants:
1. AppRole self-service (read role-id, generate secret-id)
2. Read access to `dx_mysticat/data/{env}/{service-name}/*`
3. List access to `dx_mysticat/metadata/{env}/{service-name}/*`

## JIRA

SITES-40735
```

---

## Reference: Complete service name mapping

| Service Name | Underscore Name | Example Role (dev) |
|-------------|----------------|-------------------|
| api-service | api_service | dx_mysticat_api_service_dev |
| audit-worker | audit_worker | dx_mysticat_audit_worker_dev |
| reporting-worker | reporting_worker | dx_mysticat_reporting_worker_dev |
| autofix-worker | autofix_worker | dx_mysticat_autofix_worker_dev |
| jobs-dispatcher | jobs_dispatcher | dx_mysticat_jobs_dispatcher_dev |
| auth-service | auth_service | dx_mysticat_auth_service_dev |
| fulfillment-worker | fulfillment_worker | dx_mysticat_fulfillment_worker_dev |
| content-processor | content_processor | dx_mysticat_content_processor_dev |
| content-scraper | content_scraper | dx_mysticat_content_scraper_dev |
| import-worker | import_worker | dx_mysticat_import_worker_dev |
| import-job-manager | import_job_manager | dx_mysticat_import_job_manager_dev |
| coralogix-feeder | coralogix_feeder | dx_mysticat_coralogix_feeder_dev |
| task-manager | task_manager | dx_mysticat_task_manager_dev |
