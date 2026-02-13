# Spacecat Shared - Cloud Manager Client

A JavaScript client for Adobe Cloud Manager repository operations. It supports cloning, pulling, pushing, checking out refs, zipping/unzipping repositories, applying patches, and creating pull requests for both **BYOG (Bring Your Own Git)** and **standard** Cloud Manager repositories.

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
| **Standard** | Basic auth embedded in the clone/pull/push URL | Cloud Manager "standard" (managed) repos |

Use the same type for `clone`, `pull`, and `push` for a given repo (same `programId`/`repositoryId`).

**Security notes:**

- Clone directories are created via `mkdtempSync` under the OS temp directory, producing unique, unpredictable paths safe from symlink attacks and concurrent-run collisions.
- For standard repos, after cloning the client runs `git remote set-url origin <repoUrl>` to strip basic-auth credentials from the stored remote, so `git remote -v` never exposes secrets.
- Patch files are also written into unique temp directories, cleaned up in a `finally` block.
- Git error output is sanitized before logging — Bearer tokens are replaced with `[REDACTED]` and basic-auth credentials in URLs are masked with `***`.

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

// Pull latest changes
await client.pull(clonePath, programId, repositoryId, { imsOrgId });

// Checkout a specific ref
await client.checkout(clonePath, 'main');

// ... create branch, apply patch, etc. ...

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

// Pull latest changes
await client.pull(clonePath, programId, repositoryId, { imsOrgId, repoType: 'standard', repoUrl });

// ... create branch, apply patch, etc. ...

// Push (ref is required — specifies the branch to push)
await client.push(clonePath, programId, repositoryId, {
  imsOrgId, repoType: 'standard', repoUrl, ref: 'main',
});

// Zip the repository (includes .git history)
const zipBuffer = await client.zipRepository(clonePath);

// Cleanup
await client.cleanup(clonePath);
```

*Note*: For Cloud Manager Standard Repositories, pull requests aren't supported, as there's no upstream.


## API overview

- **`clone(programId, repositoryId, config)`** – Clone repo to a unique temp directory. Config: `{ imsOrgId, repoType, repoUrl, ref }`. Optional `ref` checks out a specific branch/tag after clone (failure to checkout does not fail the clone).
- **`pull(clonePath, programId, repositoryId, config)`** – Pull latest changes into an existing clone. Config: `{ imsOrgId, repoType, repoUrl }`.
- **`push(clonePath, programId, repositoryId, config)`** – Push a ref to the remote. Config: `{ imsOrgId, repoType, repoUrl, ref }`. The `ref` is **required** and specifies the branch to push.
- **`checkout(clonePath, ref)`** – Checkout a specific git ref (branch, tag, or SHA) in an existing clone. Unlike the optional checkout in `clone()`, this throws on failure.
- **`zipRepository(clonePath)`** – Zip the clone (including `.git` history) and return a Buffer.
- **`unzipRepository(zipBuffer)`** – Extract a ZIP buffer to a new temp directory and return the path. Used for incremental updates (restore a previously-zipped repo from S3, then `checkout` + `pull` instead of a full clone). Cleans up on failure.
- **`createBranch(clonePath, baseBranch, newBranch)`** – Checkout the base branch and create a new branch from it.
- **`applyPatch(clonePath, branch, s3PatchPath)`** – Download a patch from S3 (`s3://bucket/key` format) and apply it with `git am`. Configures committer identity from `ASO_CODE_AUTOFIX_USERNAME`/`ASO_CODE_AUTOFIX_EMAIL`. Cleans up the temp patch file in a `finally` block.
- **`cleanup(clonePath)`** – Remove the clone directory. Validates the path starts with the expected temp prefix to prevent accidental deletion.
- **`createPullRequest(programId, repositoryId, config)`** – Create a PR via the CM Repo API (BYOG only, uses IMS token). Config: `{ imsOrgId, sourceBranch, destinationBranch, title, description }`.

## Exports

Repository type constants (for use when passing `repoType` or checking repo type):

```js
import CloudManagerClient, {
  CM_REPO_TYPE_STANDARD,
  CM_REPO_TYPE_GITHUB,
  CM_REPO_TYPE_BITBUCKET,
  CM_REPO_TYPE_GITLAB,
  CM_REPO_TYPE_AZURE_DEVOPS,
} from '@adobe/spacecat-shared-cloud-manager-client';
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
