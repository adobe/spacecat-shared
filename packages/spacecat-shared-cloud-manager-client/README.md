# Spacecat Shared - Cloud Manager Client

A JavaScript client for Adobe Cloud Manager repository operations. It supports cloning, pulling, pushing, checking out refs, zipping/unzipping repositories, applying patches (from S3 or in-memory strings), writing files directly, and creating pull requests for both **BYOG (Bring Your Own Git)** and **standard** Cloud Manager repositories.

The client is **stateless** with respect to repositories — no repo-specific information is stored on the instance. All repository details (`programId`, `repositoryId`, `imsOrgId`, `repoType`, `repoUrl`) are passed per method call. The only instance-level state is the cached IMS service token (shared across all repos) and generic configuration (CM API base URL, S3 client, git committer identity). This means a single `CloudManagerClient` instance can work across multiple repositories, programs, and IMS orgs within the same session.

## Installation

```bash
npm install @adobe/spacecat-shared-cloud-manager-client
```

## Prerequisites

This client executes native git commands and requires the **git binary** available at `/opt/bin/git` (e.g. via an AWS Lambda Layer). The Lambda layer must provide:

- `git` binary at `/opt/bin/git`
- Git sub-commands (e.g. `git-remote-https`) at `/opt/libexec/git-core/`
- Shared libraries (`libcurl`, `libexpat`, etc.) at `/opt/lib/`

The client also uses the system `unzip` command (available on AWS Lambda AL2023 runtime) for `unzipRepository`.

The following environment variables are set automatically by the client for Lambda layer compatibility:

| Variable | Value |
|----------|-------|
| `PATH` | `/opt/bin:/usr/local/bin:/usr/bin:/bin` |
| `GIT_EXEC_PATH` | `/opt/libexec/git-core` |
| `LD_LIBRARY_PATH` | `/opt/lib:/lib64:/usr/lib64` |
| `GIT_TERMINAL_PROMPT` | `0` |

## Configuration

Create a client from a Helix Universal context (e.g. in a Lambda with the required middleware):

```js
import CloudManagerClient from '@adobe/spacecat-shared-cloud-manager-client';

const client = CloudManagerClient.createFrom(context);
```

### Required environment variables

| Variable | Description |
|----------|-------------|
| `IMS_HOST` | IMS host (e.g. `ims-na1.adobelogin.com`) |
| `ASO_CM_REPO_SERVICE_IMS_CLIENT_ID` | IMS client ID for the CM Repo Service |
| `ASO_CM_REPO_SERVICE_IMS_CLIENT_SECRET` | IMS client secret |
| `ASO_CM_REPO_SERVICE_IMS_CLIENT_CODE` | IMS authorization code |
| `CM_REPO_URL` | Cloud Manager Repo API base URL (e.g. `https://cm-repo.example.com`) |
| `ASO_CODE_AUTOFIX_USERNAME` | Git committer username |
| `ASO_CODE_AUTOFIX_EMAIL` | Git committer email |

The context must also provide an S3 client via `context.s3.s3Client` (e.g. using `s3Wrapper`).

### Standard repository credentials (optional)

For **standard** (non-BYOG) Cloud Manager repositories, provide credentials via:

| Variable | Description |
|----------|-------------|
| `CM_STANDARD_REPO_CREDENTIALS` | JSON string mapping **program ID** to basic-auth credentials per program |

**Format:** A single JSON object. Each key is a Cloud Manager **program ID** (string). Each value is the HTTP basic-auth credential for that program in the form `"username:accessToken"`.

**Example:**

```json
{
  "12345": "git-user:personal-access-token-or-password",
  "67890": "another-user:another-token"
}
```

- If `CM_STANDARD_REPO_CREDENTIALS` is omitted or empty, only BYOG repos can be used (clone/pull/push require IMS Bearer token and `imsOrgId`).
- The value must be valid JSON; invalid JSON throws at `createFrom()`.
- For a given **programId**, credentials must exist in this map when using `repoType: 'standard'`; otherwise the client throws at clone/pull/push time.

## Repository types

The client supports two authentication modes:

| Type | Auth method | When to use |
|------|-------------|-------------|
| **BYOG** (Bring Your Own Git) | IMS Bearer token via `http.extraheader` | GitHub, GitLab, Bitbucket, Azure DevOps (or any `repoType` other than `'standard'`) |
| **Standard** | Base64 Basic auth via `http.extraheader` | Cloud Manager "standard" (managed) repos |

Both repo types authenticate via `http.extraheader` — no credentials are ever embedded in URLs. Use the same type for `clone`, `pull`, and `push` for a given repo (same `programId`/`repositoryId`).

**Security notes:**

- Clone directories are created via `mkdtempSync` under the OS temp directory, producing unique, unpredictable paths safe from symlink attacks and concurrent-run collisions.
- Patch files are also written into unique temp directories, cleaned up in a `finally` block.
- Git error output is sanitized before logging — Bearer tokens, Basic auth headers, `x-api-key`, `x-gw-ims-org-id` values, and basic-auth credentials in URLs are all replaced with `[REDACTED]`. Both `stderr`, `stdout`, and `error.message` are sanitized.
- All git commands run with a 120-second timeout to prevent hung processes from blocking the Lambda.
- `GIT_ASKPASS` is explicitly cleared to prevent inherited credential helpers from being invoked.
- All apply methods (`applyPatch`, `applyPatchContent`, `applyFiles`) share a single internal orchestration path that configures git identity, checks out the branch, applies changes, and optionally stages + commits. Patch format detection (mail-message vs plain diff) is also centralized.

## Usage

### BYOG repositories (e.g. GitHub, GitLab)

Clone and push use the IMS token and `imsOrgId`; no `CM_STANDARD_REPO_CREDENTIALS` needed.

```js
const programId = '12345';
const repositoryId = '67890';
const imsOrgId = 'your-ims-org@AdobeOrg';

// Clone (optionally checkout a specific ref)
const clonePath = await client.clone(programId, repositoryId, {
  imsOrgId,
  ref: 'release/5.11', // optional — checks out this ref after clone
});

// Pull latest changes (optional ref checks out the branch before pulling)
await client.pull(clonePath, programId, repositoryId, { imsOrgId, ref: 'main' });

// Checkout a specific ref (standalone, without pull)
await client.checkout(clonePath, 'main');

// Create a branch and apply a patch
await client.createBranch(clonePath, 'main', 'feature/fix');

// Apply a mail-message patch (git am — commit message is embedded in the patch)
await client.applyPatch(clonePath, 'feature/fix', 's3://bucket/patches/fix.patch');

// Apply a plain diff patch (git apply — commitMessage is required)
await client.applyPatch(clonePath, 'feature/fix', 's3://bucket/patches/fix.diff', {
  commitMessage: 'Apply agent suggestion: fix accessibility issue',
});

// Apply a patch from an in-memory string (no S3 download)
await client.applyPatchContent(clonePath, 'feature/fix', patchString, 'fix: apply suggestion');

// Write files directly and commit
await client.applyFiles(clonePath, 'feature/fix', [
  { path: 'src/main.js', content: 'updated content' },
  { path: 'src/utils/helper.js', content: 'new helper' },
], 'fix: update accessibility assets');

// Push (ref is required — specifies the branch to push)
await client.push(clonePath, programId, repositoryId, { imsOrgId, ref: 'feature/fix' });

// Create PR (BYOG only; uses IMS token)
const pr = await client.createPullRequest(programId, repositoryId, {
  imsOrgId,
  sourceBranch: 'feature/fix',
  destinationBranch: 'main',
  title: 'Fix issue',
  description: 'Automated fix',
});
```

### Standard repositories

Use credentials from `CM_STANDARD_REPO_CREDENTIALS` and pass `repoType: 'standard'` and the repo URL.

```js
const programId = '12345';
const repositoryId = '67890';
const imsOrgId = 'your-ims-org@AdobeOrg';
const repoUrl = 'https://git.cloudmanager.adobe.com/your-org/your-repo.git';

const config = {
  imsOrgId,
  repoType: 'standard',
  repoUrl,
  ref: 'main', // optional — checks out this ref after clone
};

// Clone
const clonePath = await client.clone(programId, repositoryId, config);

// Pull latest changes (optional ref checks out the branch before pulling)
await client.pull(clonePath, programId, repositoryId, { imsOrgId, repoType: 'standard', repoUrl, ref: 'main' });

// Create a branch and apply a patch
await client.createBranch(clonePath, 'main', 'feature/fix');
await client.applyPatch(clonePath, 'feature/fix', 's3://bucket/patches/fix.patch', {
  commitMessage: 'Apply agent suggestion',
});

// Push (ref is required — specifies the branch to push)
await client.push(clonePath, programId, repositoryId, {
  imsOrgId, repoType: 'standard', repoUrl, ref: 'feature/fix',
});

// Zip the repository (includes .git history)
const zipBuffer = await client.zipRepository(clonePath);

// Cleanup
await client.cleanup(clonePath);
```

*Note*: For Cloud Manager Standard Repositories, pull requests aren't supported, as there's no upstream.


## API overview

- **`clone(programId, repositoryId, config)`** – Clone repo to a unique temp directory. Config: `{ imsOrgId, repoType, repoUrl, ref }`. Optional `ref` checks out a specific branch/tag after clone (failure to checkout does not fail the clone).
- **`pull(clonePath, programId, repositoryId, config)`** – Pull latest changes into an existing clone. Config: `{ imsOrgId, repoType, repoUrl, ref }`. Optional `ref` checks out the branch before pulling.
- **`push(clonePath, programId, repositoryId, config)`** – Push a ref to the remote. Config: `{ imsOrgId, repoType, repoUrl, ref }`. The `ref` is **required** and specifies the branch to push.
- **`checkout(clonePath, ref)`** – Checkout a specific git ref (branch, tag, or SHA) in an existing clone. Unlike the optional checkout in `clone()`, this throws on failure.
- **`zipRepository(clonePath)`** – Zip the clone (including `.git` history) and return a Buffer.
- **`unzipRepository(zipBuffer)`** – Extract a ZIP buffer to a new temp directory and return the path. Used for incremental updates (restore a previously-zipped repo from S3, then `pull` with `ref` instead of a full clone). Cleans up on failure.
- **`createBranch(clonePath, baseBranch, newBranch)`** – Checkout the base branch and create a new branch from it.
- **`applyPatch(clonePath, branch, s3PatchPath, options?)`** – Download a patch from S3 (`s3://bucket/key` format) and apply it. The patch format is detected automatically from the content. Mail-message patches (starting with `From `) are applied with `git am` (auto-commits using embedded metadata). Plain diffs are applied with `git apply` then staged and committed — `options.commitMessage` is required for this flow. If `commitMessage` is provided with a mail-message patch, it is ignored and a warning is logged. Cleans up the temp patch file in a `finally` block.
- **`applyPatchContent(clonePath, branch, patchContent, commitMessage)`** – Same as `applyPatch`, but takes the patch content as an in-memory string instead of downloading from S3. Useful when the patch is already available (e.g. from suggestion data). The `commitMessage` parameter is required; for mail-message patches it is ignored (logged as info).
- **`applyFiles(clonePath, branch, files, commitMessage)`** – Write files to the clone directory and commit the changes. `files` is an array of `{ path, content }` objects where `path` is relative to the repo root. Parent directories are created automatically. Changes are staged with `git add -A` and committed.
- **`cleanup(clonePath)`** – Remove the clone directory. Validates the path starts with the expected temp prefix to prevent accidental deletion.
- **`createPullRequest(programId, repositoryId, config)`** – Create a PR via the CM Repo API (BYOG only, uses IMS token). Config: `{ imsOrgId, sourceBranch, destinationBranch, title, description }`.

## Exports

Repository type constants (for use when passing `repoType` or checking repo type):

```js
import CloudManagerClient, { CM_REPO_TYPE } from '@adobe/spacecat-shared-cloud-manager-client';

// CM_REPO_TYPE.GITHUB      → 'github'
// CM_REPO_TYPE.BITBUCKET    → 'bitbucket'
// CM_REPO_TYPE.GITLAB       → 'gitlab'
// CM_REPO_TYPE.AZURE_DEVOPS → 'azure_devops'
// CM_REPO_TYPE.STANDARD     → 'standard'
```

## Testing

```bash
npm run test
```

## Linting

```bash
npm run lint
```

## License

Apache-2.0
