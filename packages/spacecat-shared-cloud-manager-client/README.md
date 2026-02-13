# Spacecat Shared - Cloud Manager Client

A JavaScript client for Adobe Cloud Manager repository operations. It supports cloning, pulling, pushing, applying patches, and creating pull requests for both **BYOG (Bring Your Own Git)** and **standard** Cloud Manager repositories.

## Installation

```bash
npm install @adobe/spacecat-shared-cloud-manager-client
```

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

// ... create branch, apply patch, etc. ...

// Push
await client.push(clonePath, programId, repositoryId, { imsOrgId });

// Create PR (BYOG only; uses IMS token)
const pr = await client.createPullRequest(programId, repositoryId, imsOrgId, {
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
const repoUrl = 'https://git.cloudmanager.adobe.com/your-org/your-repo.git';

const config = {
  repoType: 'standard',
  repoUrl,
  ref: 'main', // optional — checks out this ref after clone
};

// Clone
const clonePath = await client.clone(programId, repositoryId, config);

// Pull latest changes
await client.pull(clonePath, programId, repositoryId, config);

// ... create branch, apply patch, etc. ...

// Push (same config)
await client.push(clonePath, programId, repositoryId, config);
```

*Note*: For Cloud Manager Standard Repositories, pull requests aren't supported, as there's no upstream.


## API overview

- **`clone(programId, repositoryId, config)`** – Clone repo to a unique temp directory. Config: `imsOrgId` (BYOG), or `repoType: 'standard'` and `repoUrl`. Optional `ref` to checkout a specific branch/tag after clone (failure to checkout does not fail the clone).
- **`pull(clonePath, programId, repositoryId, config)`** – Pull latest changes into an existing clone. Same config as `clone` for auth.
- **`push(clonePath, programId, repositoryId, config)`** – Push current branch. Same config as `clone` for auth.
- **`zipRepository(clonePath)`** – Zip the clone (including `.git`) and return a Buffer.
- **`createBranch(clonePath, baseBranch, newBranch)`** – Create a branch from a base.
- **`applyPatch(clonePath, branch, s3PatchPath)`** – Download patch from S3 and apply with `git am`.
- **`cleanup(clonePath)`** – Remove the clone directory.
- **`createPullRequest(programId, repositoryId, imsOrgId, { sourceBranch, destinationBranch, title, description })`** – Create a PR via the CM Repo API (BYOG only, uses IMS token).

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
