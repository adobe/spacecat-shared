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
 * CLI to migrate site hlxConfig to use the new aem.live TLD.
 *
 * Behavior:
 * - Process ALL sites unless filtered by --orgId/--siteId.
 * - Only migrates sites where hlxConfig.rso.tld is exactly "hlx.live".
 * - Changes hlxConfig.rso.tld from "hlx.live" to "aem.live".
 * - Writes to the DynamoDB table in env DYNAMO_TABLE_NAME_DATA
 *   (default: spacecat-services-data).
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
  hasText,
  isNonEmptyArray,
} from '@adobe/spacecat-shared-utils';

import {
  createDataAccess,
} from '../src/service/index.js';

function parseArgs(argv) {
  const args = {
    orgId: undefined,
    siteId: undefined,
    apply: false,
    dryRun: false,
    report: false,
    yes: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--report') args.report = true;
    else if (a === '--yes' || a === '--force' || a === '-y') args.yes = true;
    else if (a.startsWith('--orgId=')) {
      const [, value] = a.split('=');
      args.orgId = value;
    } else if (a.startsWith('--siteId=')) {
      const [, value] = a.split('=');
      args.siteId = value;
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

function csvRow(fields) {
  const escape = (v) => {
    if (v === undefined || v === null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return fields.map(escape).join(',');
}

// -----------------------------
// Main
// -----------------------------
async function main() {
  const args = parseArgs(process.argv);
  const {
    orgId, siteId, apply, dryRun, report, yes,
  } = args;

  const env = {
    DYNAMO_TABLE_NAME_DATA: process.env.DYNAMO_TABLE_NAME_DATA || 'spacecat-services-data',
  };

  console.log(
    `[start] table=${env.DYNAMO_TABLE_NAME_DATA} apply=${apply} `
    + `dryRun=${dryRun} report=${report}`,
  );

  const dataAccess = createDataAccess(
    {
      tableNameData: env.DYNAMO_TABLE_NAME_DATA,
    },
    console,
  );

  const {
    Site: SiteCollection,
  } = dataAccess;

  let sites = [];

  if (hasText(siteId)) {
    const site = await SiteCollection.findById(siteId);
    if (site) sites = [site];
  } else if (hasText(orgId)) {
    sites = await SiteCollection.allByOrganizationId(orgId);
  } else {
    sites = await SiteCollection.all();
  }

  if (!isNonEmptyArray(sites)) {
    console.log('[done] no matching sites');
    return;
  }

  const changes = [];

  const processSite = async (site) => {
    const currentSiteId = site.getId();
    const baseURL = site.getBaseURL();
    const organizationId = site.getOrganizationId();
    const hlxConfig = site.getHlxConfig();

    if (!hlxConfig || typeof hlxConfig !== 'object' || !hlxConfig.rso || hlxConfig.rso.tld !== 'hlx.live') {
      changes.push({
        siteId: currentSiteId,
        organizationId,
        baseURL,
        action: 'skipped',
        oldTld: '',
        newTld: '',
      });
      return { action: 'skipped' };
    }

    const newConfig = JSON.parse(JSON.stringify(hlxConfig));
    newConfig.rso.tld = 'aem.live';

    changes.push({
      siteId: currentSiteId,
      organizationId,
      baseURL,
      action: apply ? 'updated' : 'planned',
      oldTld: 'hlx.live',
      newTld: 'aem.live',
    });

    if (!apply) {
      return { action: 'planned' };
    }

    site.setHlxConfig(newConfig);
    site.setUpdatedBy('system');
    // await site.save();

    return { action: 'updated' };
  };

  if (apply && !yes) {
    console.log(
      `About to process ${sites.length} site(s). `
      + 'Use --yes to proceed or run with --dry-run first.',
    );
    return;
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const site of sites) {
    // eslint-disable-next-line no-await-in-loop
    await processSite(site);
  }

  // Reporting
  if (report) {
    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const outDir = path.resolve(dirname, '../../../reports');
    ensureDir(outDir);

    const stamp = nowStamp();
    const csvPath = path.join(outDir, `helix-tld-migration-${stamp}.csv`);
    const jsonPath = path.join(outDir, `helix-tld-migration-${stamp}.json`);

    const header = [
      'siteId',
      'organizationId',
      'baseURL',
      'oldTld',
      'newTld',
      'action',
    ];
    const rows = [csvRow(header)];
    for (const c of changes) {
      rows.push(csvRow([
        c.siteId,
        c.organizationId,
        c.baseURL,
        c.oldTld,
        c.newTld,
        c.action,
      ]));
    }
    fs.writeFileSync(csvPath, `${rows.join('\n')}\n`, 'utf8');
    fs.writeFileSync(
      jsonPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          changes,
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
