#!/usr/bin/env node
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/*
 * CLI to migrate Sites to Projects and set locales.
 *
 * Behavior:
 * - Process ALL sites unless filtered by --orgId/--projectId/--domain/--siteId.
 * - Project key = (organizationId + registrable domain).
 * - If site.projectId exists → skip.
 * - Otherwise find-or-create Project, then set site.projectId.
 * - If site.language/region are unset → detect via locale-detect (network by default),
 *   with fallback to en/US.
 * - Writes to the DynamoDB table in env DYNAMO_TABLE_NAME_DATA
 *   (default: spacecat-services-data).
 * - Concurrency default: 10 (configurable via --concurrency).
 * - Reporting with --report emits CSV and JSON under ./reports/.
 *
 * Required env:
 * - AWS_REGION (e.g., us-east-1).
 * - AWS credentials via default chain (env).
 */

/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  detectLocale,
  hasText,
  isNonEmptyArray,
} from '@adobe/spacecat-shared-utils';

import {
  createDataAccess,
} from '../src/service/index.js';

function parseArgs(argv) {
  const args = {
    orgId: undefined,
    projectId: undefined,
    domain: undefined,
    siteId: undefined,
    apply: false,
    dryRun: false,
    report: false,
    yes: false,
    noNetwork: false,
    concurrency: 10,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--report') args.report = true;
    else if (a === '--yes' || a === '--force' || a === '-y') args.yes = true;
    else if (a === '--no-network') args.noNetwork = true;
    else if (a.startsWith('--orgId=')) {
      const [, value] = a.split('=');
      args.orgId = value;
    } else if (a.startsWith('--projectId=')) {
      const [, value] = a.split('=');
      args.projectId = value;
    } else if (a.startsWith('--domain=')) {
      const [, value] = a.split('=');
      args.domain = value;
    } else if (a.startsWith('--siteId=')) {
      const [, value] = a.split('=');
      args.siteId = value;
    } else if (a.startsWith('--concurrency=')) {
      const [, value] = a.split('=');
      args.concurrency = parseInt(value, 10);
    }
  }

  if (!args.apply && !args.dryRun) {
    args.dryRun = true;
  }

  return args;
}

// -----------------------------
// Utilities
// -----------------------------
function nowStamp() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function toRegistrableDomain(baseURL) {
  try {
    const parsedBaseURL = new URL(baseURL);
    const { hostname } = parsedBaseURL;
    const parts = hostname.split('.');

    if (parts.length <= 2) {
      return hostname;
    }

    for (let i = 0; i < Math.min(parts.length, 2); i += 1) {
      const part = parts[i];
      if (part.length === 2 || part.length === 3) {
        parts[i] = null;
      }
    }

    return parts.filter(Boolean).join('.');
  } catch {
    return undefined;
  }
}

async function detectSiteLocale(site, { noNetwork }) {
  const baseUrl = site.getBaseURL();
  try {
    if (noNetwork) {
      const res = await detectLocale({ baseUrl, html: '<html></html>', headers: {} });
      return {
        language: res.language || 'en',
        region: res.region || 'US',
      };
    }
    const res = await detectLocale({ baseUrl });
    return {
      language: res.language || 'en',
      region: res.region || 'US',
    };
  } catch {
    return { language: 'en', region: 'US' };
  }
}

function csvRow(fields) {
  const escape = (v) => {
    if (v === undefined || v === null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return fields.map(escape).join(',');
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  const workers = [];
  let currentIndex = 0;

  const worker = async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (currentIndex >= items.length) {
        break;
      }
      const index = currentIndex;
      currentIndex += 1;
      // eslint-disable-next-line no-await-in-loop
      const result = await mapper(items[index], index);
      results[index] = result;
    }
  };

  const workerCount = Math.min(limit, items.length);
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

// -----------------------------
// Main
// -----------------------------
async function main() {
  const args = parseArgs(process.argv);
  const {
    orgId, projectId, domain, siteId, apply, dryRun, report, yes, noNetwork, concurrency,
  } = args;

  const env = {
    DYNAMO_TABLE_NAME_DATA: process.env.DYNAMO_TABLE_NAME_DATA || 'spacecat-services-data',
  };

  console.log(
    `[start] table=${env.DYNAMO_TABLE_NAME_DATA} apply=${apply} `
    + `dryRun=${dryRun} report=${report} concurrency=${concurrency} `
    + `noNetwork=${noNetwork}`,
  );

  const dataAccess = createDataAccess(
    {
      tableNameData: env.DYNAMO_TABLE_NAME_DATA,
    },
    console,
  );

  const {
    Project: ProjectCollection,
    Site: SiteCollection,
  } = dataAccess;

  let sites = [];

  if (hasText(siteId)) {
    const site = await SiteCollection.findById(siteId);
    if (site) sites = [site];
  } else if (hasText(projectId)) {
    sites = await SiteCollection.allByProjectId(projectId);
  } else if (hasText(orgId)) {
    try {
      if (SiteCollection.allByOrganizationId) {
        sites = await SiteCollection.allByOrganizationId(orgId);
      } else {
        const allSites = await SiteCollection.all();
        sites = allSites.filter(
          (site) => site.getOrganizationId && site.getOrganizationId() === orgId,
        );
      }
    } catch {
      const allSites = await SiteCollection.all();
      sites = allSites.filter(
        (site) => site.getOrganizationId && site.getOrganizationId() === orgId,
      );
    }
    if (hasText(domain)) {
      const dLower = domain.toLowerCase();
      sites = sites.filter(
        (site) => (toRegistrableDomain(site.getBaseURL()) || '').toLowerCase() === dLower,
      );
    }
  } else if (hasText(domain)) {
    const allSites = await SiteCollection.all();
    const dLower = domain.toLowerCase();
    sites = allSites.filter(
      (site) => (toRegistrableDomain(site.getBaseURL()) || '').toLowerCase() === dLower,
    );
  } else {
    sites = await SiteCollection.all();
  }

  if (!isNonEmptyArray(sites)) {
    console.log('[done] no matching sites');
    return;
  }

  // Group projects cache per org for faster lookup
  const projectsCacheByOrg = new Map(); // orgId -> Array<Project>

  async function findOrCreateProjectForSite(site) {
    const org = site.getOrganizationId();
    const projName = toRegistrableDomain(site.getBaseURL());
    if (!hasText(org) || !hasText(projName)) {
      return null;
    }
    let orgProjects = projectsCacheByOrg.get(org);
    if (!orgProjects) {
      try {
        if (ProjectCollection.allByOrganizationId) {
          orgProjects = await ProjectCollection.allByOrganizationId(org);
        } else {
          const allProjects = await ProjectCollection.all();
          orgProjects = allProjects.filter(
            (project) => project.getOrganizationId && project.getOrganizationId() === org,
          );
        }
      } catch {
        const allProjects = await ProjectCollection.all();
        orgProjects = allProjects.filter(
          (project) => project.getOrganizationId && project.getOrganizationId() === org,
        );
      }
      projectsCacheByOrg.set(org, orgProjects);
    }
    let project = orgProjects.find(
      (candidate) => candidate.getProjectName && candidate.getProjectName() === projName,
    );
    if (!project && apply) {
      project = await ProjectCollection.create({
        organizationId: org,
        projectName: projName,
      });
      orgProjects.push(project);
    }
    return project;
  }

  const changes = [];

  const processOne = async (site) => {
    const before = {
      siteId: site.getId(),
      baseURL: site.getBaseURL(),
      organizationId: site.getOrganizationId(),
      projectId: site.getProjectId?.() || site.record?.projectId,
      language: site.getLanguage?.() || site.record?.language,
      region: site.getRegion?.() || site.record?.region,
    };

    if (before.projectId) {
      changes.push({
        siteId: before.siteId,
        organizationId: before.organizationId,
        baseURL: before.baseURL,
        projectId: before.projectId,
        language: before.language || '',
        region: before.region || '',
        action: 'skipped:project-present',
      });
      return { action: 'skipped' };
    }

    const project = await findOrCreateProjectForSite(site);
    const projectIdNew = project?.getId();

    let langNew = before.language;
    let regionNew = before.region;
    if (!langNew || !regionNew) {
      const detected = await detectSiteLocale(site, { noNetwork });
      langNew = before.language || detected.language || 'en';
      regionNew = before.region || detected.region || 'US';
    }

    // Record change summary
    changes.push({
      siteId: before.siteId,
      organizationId: before.organizationId,
      baseURL: before.baseURL,
      projectId: projectIdNew || before.projectId || '',
      language: langNew || '',
      region: regionNew || '',
      action: apply ? 'updated' : 'planned',
    });

    if (!apply) {
      return { action: 'planned' };
    }

    // Apply updates (idempotent: only set fields that are unset)
    if (projectIdNew && !before.projectId && site.setProjectId) {
      site.setProjectId(projectIdNew);
    }
    if (!before.language && site.setLanguage) {
      site.setLanguage(langNew);
    }
    if (!before.region && site.setRegion) {
      site.setRegion(regionNew);
    }
    if (site.setUpdatedBy) {
      site.setUpdatedBy('system');
    }
    await site.save();
    return { action: 'updated' };
  };

  if (apply && !yes) {
    console.log(
      `About to process ${sites.length} site(s). `
      + 'Use --yes to proceed or run with --dry-run first.',
    );
    return;
  }

  const effectiveConcurrency = Number.isFinite(concurrency) && concurrency > 0
    ? concurrency
    : 10;
  await mapWithConcurrency(sites, effectiveConcurrency, processOne);

  // Reporting
  if (report) {
    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const outDir = path.resolve(dirname, '../../../reports');
    ensureDir(outDir);

    const stamp = nowStamp();
    const csvPath = path.join(outDir, `site-project-migration-${stamp}.csv`);
    const jsonPath = path.join(outDir, `site-project-migration-${stamp}.json`);

    const header = [
      'siteId',
      'organizationId',
      'baseURL',
      'projectId',
      'language',
      'region',
      'action',
    ];
    const rows = [csvRow(header)];
    for (const c of changes) {
      rows.push(csvRow([
        c.siteId,
        c.organizationId,
        c.baseURL,
        c.projectId,
        c.language,
        c.region,
        c.action,
      ]));
    }
    fs.writeFileSync(csvPath, `${rows.join('\n')}\n`, 'utf8');
    fs.writeFileSync(
      jsonPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          changes, // already contains final projectId, language, region, action
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    console.log(`[report] ${csvPath}`);
    console.log(`[report] ${jsonPath}`);
  }

  const updated = changes.filter((change) => change.action === 'updated').length;
  const planned = changes.filter((change) => change.action === 'planned').length;
  const skipped = changes.filter(
    (change) => change.action && change.action.startsWith('skipped'),
  ).length;
  console.log(
    `[done] sites=${sites.length} `
    + `updated=${updated} planned=${planned} skipped=${skipped}`,
  );
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
