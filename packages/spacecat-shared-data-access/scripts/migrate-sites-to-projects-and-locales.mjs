#!/usr/bin/env node
/*
 * Migrate Sites to Projects and set locales.
 *
 * Behavior:
 * - Process ALL sites unless filtered by --orgId/--projectId/--domain/--siteId
 * - Project key = (organizationId + registrable domain)
 * - If site.projectId exists → skip
 * - Otherwise find-or-create Project, set site.projectId
 * - If site.language/region are unset → detect via locale-detect (network by default)
 *   - Fallback to en/US
 * - Writes directly to DynamoDB table specified by env DYNAMO_TABLE_NAME_DATA (default spacecat-services-data)
 * - Concurrency default: 10 (configurable via --concurrency)
 * - Reporting with --report emits CSV and JSON under ./reports/
 *
 * Required env:
 * - AWS_REGION (e.g., us-east-1)
 * - AWS credentials via default chain (env or shared profile)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createDataAccess,
} from '../src/service/index.js';

import {
  detectLocale,
  hasText,
  isNonEmptyArray,
} from '@adobe/spacecat-shared-utils';

// -----------------------------
// Small CLI arg parser
// -----------------------------
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
    else if (a.startsWith('--orgId=')) args.orgId = a.split('=')[1];
    else if (a.startsWith('--projectId=')) args.projectId = a.split('=')[1];
    else if (a.startsWith('--domain=')) args.domain = a.split('=')[1];
    else if (a.startsWith('--siteId=')) args.siteId = a.split('=')[1];
    else if (a.startsWith('--concurrency=')) args.concurrency = parseInt(a.split('=')[1], 10);
  }

  if (!args.apply && !args.dryRun) {
    // default to dry-run unless apply explicitly set
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

    // If hostname has only 1–2 parts, just use it as-is
    if (parts.length <= 2) {
      return hostname;
    }

    // Reference semantics (see onboarding helper):
    // - Consider the first two labels as potential subdomains
    // - If a label is 2–3 characters long, drop it
    //   (e.g. www.adobe.com → adobe.com, fr.adobe.com → adobe.com)
    for (let i = 0; i < Math.min(parts.length, 2); i += 1) {
      const part = parts[i];
      if (part.length === 2 || part.length === 3) {
        parts[i] = null;
      }
    }

    // Join remaining parts back to form the project/domain key
    return parts.filter(Boolean).join('.');
  } catch {
    return undefined;
  }
}

async function detectSiteLocale(site, { noNetwork }) {
  const baseUrl = site.getBaseURL();
  try {
    if (noNetwork) {
      // Avoid network by supplying empty HTML and headers
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

// Simple concurrency limiter
async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let inFlight = 0;
  let idx = 0;
  return new Promise((resolve, reject) => {
    const next = () => {
      if (idx >= items.length && inFlight === 0) {
        resolve(results);
        return;
      }
      while (inFlight < limit && idx < items.length) {
        const currentIndex = idx++;
        inFlight += 1;
        Promise.resolve(mapper(items[currentIndex], currentIndex))
          .then((r) => { results[currentIndex] = r; })
          .catch(reject)
          .finally(() => { inFlight -= 1; next(); });
      }
    };
    next();
  });
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

  console.log(`[start] table=${env.DYNAMO_TABLE_NAME_DATA} apply=${apply} dryRun=${dryRun} report=${report} concurrency=${concurrency} noNetwork=${noNetwork}`);

  const dataAccess = createDataAccess(
    {
      tableNameData: env.DYNAMO_TABLE_NAME_DATA,
    },
    console,
  );

  // EntityRegistry exposes collections keyed by entity name (e.g. "Site", "Project")
  // We alias them here for clarity.
  const {
    Project: ProjectCollection,
    Site: SiteCollection,
  } = dataAccess;

  // Resolve target sites
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
        // Fallback: fetch all and filter (should rarely happen)
        const allSites = await SiteCollection.all();
        sites = allSites.filter((s) => s.getOrganizationId && s.getOrganizationId() === orgId);
      }
    } catch {
      const allSites = await SiteCollection.all();
      sites = allSites.filter((s) => s.getOrganizationId && s.getOrganizationId() === orgId);
    }
    if (hasText(domain)) {
      const dLower = domain.toLowerCase();
      sites = sites.filter((s) => (toRegistrableDomain(s.getBaseURL()) || '').toLowerCase() === dLower);
    }
  } else if (hasText(domain)) {
    const allSites = await SiteCollection.all();
    const dLower = domain.toLowerCase();
    sites = allSites.filter((s) => (toRegistrableDomain(s.getBaseURL()) || '').toLowerCase() === dLower);
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
          // Fallback: load all, then filter in-memory
          const allProjects = await ProjectCollection.all();
          orgProjects = allProjects.filter((p) => p.getOrganizationId && p.getOrganizationId() === org);
        }
      } catch {
        const allProjects = await ProjectCollection.all();
        orgProjects = allProjects.filter((p) => p.getOrganizationId && p.getOrganizationId() === org);
      }
      projectsCacheByOrg.set(org, orgProjects);
    }
    let project = orgProjects.find((p) => p.getProjectName && p.getProjectName() === projName);
    if (!project && apply) {
      project = await ProjectCollection.create({
        organizationId: org,
        projectName: projName,
      });
      // refresh cache
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
    console.log(`About to process ${sites.length} site(s). Use --yes to proceed or run with --dry-run first.`);
    return;
  }

  await mapWithConcurrency(sites, Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 10, processOne);

  // Reporting
  if (report) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const outDir = path.resolve(__dirname, '../../../reports');
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

  const updated = changes.filter((c) => c.action === 'updated').length;
  const planned = changes.filter((c) => c.action === 'planned').length;
  const skipped = changes.filter((c) => c.action?.startsWith('skipped')).length;
  console.log(`[done] sites=${sites.length} updated=${updated} planned=${planned} skipped=${skipped}`);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});


