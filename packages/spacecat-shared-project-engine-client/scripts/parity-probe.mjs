/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * Live-vs-mock parity probe for the Semrush Project Engine + User Manager gateways.
 *
 * A reusable drift detector: it replays one canonical request catalog against any
 * base origin (the live Semrush gateway OR a running Counterfact mock), normalises
 * the volatile bits (uuids, timestamps), and writes a JSON capture. A second
 * `diff` run compares two captures field-by-field and separates the KNOWN /
 * intentional divergences (recorded in EXPECTED_DIVERGENCES below, with their
 * reason + tracking status) from any UNEXPECTED drift — so a green diff means
 * "the mock still matches live except where we documented it does not".
 *
 * This is a dev tool, not part of the published package (it lives under scripts/,
 * outside the src/ + mock/ coverage globs). Both gateways share one origin, so one
 * script covers both. Findings encoded here were live-pinned 2026-06-29 against
 * prod (`https://adobe-hackathon.semrush.com`); see spacecat-shared#1745.
 *
 * Usage:
 *   # 1) capture LIVE (read-only by default; --mutate adds a create→publish→delete
 *   #    lifecycle with cleanup). Needs a real IMS bearer + workspace/project ids.
 *   node scripts/parity-probe.mjs capture \
 *     --base https://adobe-hackathon.semrush.com \
 *     --token "$(mysticat auth token --ims)" \
 *     --pe-ws <child-ws> --pe-project <published-project> \
 *     --pe-unowned-ws <ws-you-do-not-own> \
 *     --um-parent <parent-ws> --um-unknown 00000000-0000-4000-8000-000000000000 \
 *     --mutate --out live.json
 *
 *   # 2) capture the running MOCK (boot it first: `npm run mock` / the GHCR image).
 *   #    The mock seed ids are the defaults below, so most flags can be omitted.
 *   node scripts/parity-probe.mjs capture --base https://localhost:8443 \
 *     --token dummy --insecure --mutate --out mock.json
 *
 *   # 3) diff — flags only UNEXPECTED drift; lists the known gaps + their status.
 *   node scripts/parity-probe.mjs diff live.json mock.json
 *
 * Exit code of `diff` is non-zero when any UNEXPECTED divergence is found, so it
 * can gate a manual parity check in CI behind a live token.
 */

/* eslint-disable no-console */ // this is a CLI tool; console output is its purpose

import { writeFileSync, readFileSync } from 'node:fs';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g;

// ── arg parsing ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i += 1;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

// ── normalisation ──────────────────────────────────────────────────────────
// Tokenise volatile ids/timestamps but KEEP semantic values (language.name,
// publish_status, existing_count, model.key, …) so the diff surfaces real
// behaviour differences, not id noise.
function normalise(value) {
  if (typeof value === 'string') {
    return value.replace(UUID_RE, '<uuid>').replace(ISO_RE, '<ts>');
  }
  if (Array.isArray(value)) {
    // Capture length + the shape of the first item (enough to compare envelopes
    // and item schemas without depending on element count/order).
    return { __array_len: value.length, __item0: value.length ? normalise(value[0]) : null };
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((k) => [k, normalise(value[k])]),
    );
  }
  return value;
}

// ── HTTP ───────────────────────────────────────────────────────────────────
async function call(base, {
  method = 'GET', path, body, token, auth = true,
}, insecure) {
  if (insecure) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  const headers = { Accept: 'application/json' };
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  let res;
  let text;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    text = await res.text();
  } catch (e) {
    return { error: String(e?.message || e) };
  }
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : '';
  } catch {
    parsed = text;
  }
  return {
    status: res.status,
    contentType: (res.headers.get('content-type') || '').split(';')[0] || null,
    body: normalise(parsed),
  };
}

// ── catalog ────────────────────────────────────────────────────────────────
// Defaults are the mock seed ids so a mock capture needs almost no flags.
const D = {
  peWs: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  peProject: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  peUnownedWs: '00000000-0000-4000-8000-000000000000',
  umParent: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  umUnknown: '00000000-0000-4000-8000-000000000000',
  english: '5a0a33ed-7f5c-4901-befd-a042c0350da1',
};

function readOnlyProbes(c) {
  const pe = (p) => `/enterprise/projects/api${p}`;
  const um = (p) => `/enterprise/users/api${p}`;
  return [
    // catalogs
    { id: 'pe.languages', path: pe('/v1/languages') },
    { id: 'pe.ai_models', path: pe('/v1/ai_models') },
    // project list quirks
    { id: 'pe.projects.noparam', path: pe(`/v1/workspaces/${c.peWs}/projects`) },
    { id: 'pe.projects.typeai', path: pe(`/v1/workspaces/${c.peWs}/projects?type=ai`) },
    { id: 'pe.projects.livetrue', path: pe(`/v1/workspaces/${c.peWs}/projects?live=true`) },
    { id: 'pe.projects.unowned', path: pe(`/v1/workspaces/${c.peUnownedWs}/projects?type=ai`) },
    { id: 'pe.project.bogus', path: pe(`/v1/workspaces/${c.peWs}/projects/${D.peUnownedWs}`) },
    // published-project reads
    {
      id: 'pe.by_tags', method: 'POST', path: pe(`/v2/workspaces/${c.peWs}/projects/${c.peProject}/aio/prompts/by_tags`), body: {},
    },
    { id: 'pe.init_status', path: pe(`/v2/workspaces/${c.peWs}/projects/${c.peProject}/aio/init_status`) },
    { id: 'pe.benchmarks', path: pe(`/v1/workspaces/${c.peWs}/projects/${c.peProject}/ai_models/benchmarks`) },
    // auth
    { id: 'pe.noauth', path: pe(`/v1/workspaces/${c.peWs}/projects?type=ai`), auth: false },
    // user manager
    { id: 'um.status', path: um(`/v1/workspaces/${c.umParent}/status`) },
    { id: 'um.family', path: um(`/v1/workspaces/${c.umParent}/family`) },
    { id: 'um.family.unknown', path: um(`/v1/workspaces/${c.umUnknown}/family`) },
    { id: 'um.status.unknown', path: um(`/v1/workspaces/${c.umUnknown}/status`) },
  ];
}

const sleep = (ms) => new Promise((r) => {
  setTimeout(r, ms);
});

// Create a project once and return BOTH the normalised probe result (for the
// capture) and the raw id (for the lifecycle) — a single create so the --mutate
// run cleans up exactly what it makes (no leaked project).
async function rawCreate(base, ws, body, token, insecure) {
  if (insecure) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  try {
    const res = await fetch(`${base}/enterprise/projects/api/v1/workspaces/${ws}/projects`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      j = text;
    }
    const contentType = (res.headers.get('content-type') || '').split(';')[0] || null;
    return { id: j?.id || null, probe: { status: res.status, contentType, body: normalise(j) } };
  } catch (e) {
    return { id: null, probe: { error: String(e?.message || e) } };
  }
}

// A create→read→publish→read→dup→delete lifecycle (PE). Self-cleaning. Records
// the read-view shape at each stage. Only runs under --mutate. Returns a results
// object (the caller merges it) rather than mutating a passed-in one.
async function mutateProbes(base, c, token, insecure) {
  const pe = (p) => `/enterprise/projects/api${p}`;
  const ws = c.peWs;
  const createBody = {
    name: 'ZZ-PARITY-PROBE',
    type: 'ai',
    brand_name_display: 'Adobe',
    brand_names: ['Adobe'],
    domain: 'adobe.com',
    country_code: 'us',
    location_id: 2840,
    location_name: 'United States',
    language_id: D.english,
  };
  const r = {};
  // ONE create — capture its normalised shape AND keep the id for the lifecycle.
  const { id: rawId, probe: createProbe } = await rawCreate(base, ws, createBody, token, insecure);
  r['pe.create'] = createProbe;
  if (!rawId) {
    r['pe.lifecycle.note'] = { error: 'create returned no id; skipping lifecycle' };
    return r;
  }
  const proj = (p) => pe(`/v1/workspaces/${ws}/projects/${rawId}${p}`);
  r['pe.get.draft'] = await call(base, { path: proj(''), token }, insecure);
  r['pe.publish'] = await call(base, { method: 'POST', path: proj('/publish'), token }, insecure);
  await sleep(1500);
  r['pe.get.published'] = await call(base, { path: proj(''), token }, insecure);
  const tagged = pe(`/v2/workspaces/${ws}/projects/${rawId}/aio/prompts/tagged`);
  const dupBody = { prompts: { 'ZZ dup': ['t:a'] } };
  await call(base, {
    method: 'POST', path: tagged, body: dupBody, token,
  }, insecure);
  r['pe.prompt.dup'] = await call(base, {
    method: 'POST', path: tagged, body: dupBody, token,
  }, insecure);
  r['pe.delete'] = await call(base, { method: 'DELETE', path: proj(''), token }, insecure);
  r['pe.delete.bogus'] = await call(base, {
    method: 'DELETE', path: pe(`/v1/workspaces/${ws}/projects/${D.peUnownedWs}`), token,
  }, insecure);
  return r;
}

// ── known divergences (live → mock), with reason + status ──────────────────
// status: 'fixed-in-1746' (closed by PR #1746), 'intentional' (documented
// simplification), 'serenity-bug' (real consumer bug the mock hides).
const EXPECTED_DIVERGENCES = [
  {
    probe: 'pe.create', field: 'body.settings.ai.language.name', reason: 'live=ISO code "en"; old mock=""', status: 'fixed-in-1746',
  },
  {
    probe: 'pe.create', field: 'body.settings.ai.country.name', reason: 'live="USA"; old mock=""', status: 'fixed-in-1746',
  },
  {
    probe: 'pe.get.published', field: 'body.publish_status', reason: 'live flips draft→live; old mock stays draft', status: 'fixed-in-1746',
  },
  {
    probe: 'pe.get.published', field: 'body.published_at', reason: 'live sets it on publish; old mock omits', status: 'fixed-in-1746',
  },
  {
    probe: 'pe.prompt.dup', field: 'body.existing_count', reason: 'live dedups dup prompt text → 1; old mock always 0', status: 'fixed-in-1746',
  },
  {
    probe: 'um.family.unknown', field: 'status', reason: 'live 403; old mock 200 empty', status: 'fixed-in-1746',
  },
  {
    probe: 'pe.projects.noparam', field: 'status', reason: 'live 500; mock 200 (mock has no unguarded-500 path)', status: 'intentional',
  },
  {
    probe: 'pe.projects.livetrue', field: 'status', reason: 'live 500; mock 200', status: 'intentional',
  },
  {
    probe: 'pe.projects.unowned', field: 'status', reason: 'live 403 (no ownership); mock 200 empty', status: 'intentional',
  },
  {
    probe: 'pe.init_status', field: 'body.initialized', reason: 'live false until async AI-init; mock hardcodes true', status: 'intentional',
  },
  {
    probe: 'pe.delete.bogus', field: 'status', reason: 'live 404; mock 204 (serenity treats 404-as-success)', status: 'intentional',
  },
  {
    probe: 'pe.publish', field: 'contentType', reason: 'live empty (no Content-Type); mock application/json (Counterfact limit)', status: 'intentional',
  },
  {
    probe: 'pe.create', field: 'body.role', reason: 'live omits role on POST; present on GET', status: 'intentional',
  },
];

// ── diff ───────────────────────────────────────────────────────────────────
function flatten(obj, prefix = '', acc = {}) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const k of Object.keys(obj)) {
      flatten(obj[k], prefix ? `${prefix}.${k}` : k, acc);
    }
  } else {
    acc[prefix] = JSON.stringify(obj);
  }
  return acc;
}

function isExpected(probe, field) {
  return EXPECTED_DIVERGENCES.find(
    (e) => e.probe === probe && (field === e.field || field.startsWith(`${e.field}.`) || `${e.field}`.startsWith(field)),
  );
}

// Body fields whose VALUE is behaviourally meaningful (compared by value). Every
// other body.* field is compared by TYPE + presence only, so a mock seeded with
// DIFFERENT data than the live workspace (different brand names, prompt text,
// counts) does not flood the diff — only structural drift (missing/added fields,
// type changes) and these behavioural sentinels surface. `status`/`contentType`
// are always compared by value.
const SENTINELS = new Set([
  'body.settings.ai.language.name',
  'body.settings.ai.country.name',
  'body.publish_status',
  'body.is_draft',
  'body.initialized',
  'body.existing_count',
  'body.status',
]);

// Derive a coarse type from a JSON.stringify'd leaf so non-sentinel fields are
// compared structurally (string vs number vs bool vs null vs absent).
function leafType(s) {
  if (s === undefined) {
    return 'absent';
  }
  if (s === 'null') {
    return 'null';
  }
  if (s === 'true' || s === 'false') {
    return 'boolean';
  }
  if (s.startsWith('"')) {
    return 'string';
  }
  return 'number';
}

function diff(liveCap, mockCap) {
  const probes = new Set([...Object.keys(liveCap), ...Object.keys(mockCap)]);
  const unexpected = [];
  const known = [];
  for (const probe of [...probes].sort()) {
    const live = liveCap[probe];
    const mock = mockCap[probe];
    if (!live || !mock) {
      unexpected.push({
        probe, field: '(presence)', live: live ? 'present' : 'MISSING', mock: mock ? 'present' : 'MISSING',
      });
    } else {
      const lf = flatten({ status: live.status, contentType: live.contentType, body: live.body });
      const mf = flatten({ status: mock.status, contentType: mock.contentType, body: mock.body });
      for (const field of new Set([...Object.keys(lf), ...Object.keys(mf)])) {
        // Skip array counts — they vary with seed size, not behaviour.
        const isArrayLen = field.endsWith('.__array_len');
        const byValue = field === 'status' || field === 'contentType' || SENTINELS.has(field);
        const differ = !isArrayLen && (byValue
          ? lf[field] !== mf[field]
          : leafType(lf[field]) !== leafType(mf[field]));
        if (differ) {
          const exp = isExpected(probe, field);
          const row = byValue
            ? {
              probe, field, live: lf[field] ?? '(absent)', mock: mf[field] ?? '(absent)',
            }
            : {
              probe, field: `${field} (shape)`, live: leafType(lf[field]), mock: leafType(mf[field]),
            };
          if (exp) {
            known.push({ ...row, reason: exp.reason, status: exp.status });
          } else {
            unexpected.push(row);
          }
        }
      }
    }
  }
  return { unexpected, known };
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  if (cmd === 'diff') {
    const [a, b] = args._.slice(1);
    if (!a || !b) {
      console.error('usage: parity-probe.mjs diff <live.json> <mock.json>');
      process.exit(2);
    }
    const live = JSON.parse(readFileSync(a, 'utf8'));
    const mock = JSON.parse(readFileSync(b, 'utf8'));
    const { unexpected, known } = diff(live.results || live, mock.results || mock);
    console.log(`\n=== KNOWN / documented divergences (${known.length}) ===`);
    for (const k of known) {
      console.log(`  [${k.status}] ${k.probe} ${k.field}: live=${k.live} mock=${k.mock}  — ${k.reason}`);
    }
    console.log(`\n=== UNEXPECTED drift (${unexpected.length}) ===`);
    for (const u of unexpected) {
      console.log(`  ⚠️  ${u.probe} ${u.field}: live=${u.live} mock=${u.mock}`);
    }
    if (!unexpected.length) {
      console.log('  (none — mock matches live except where documented)');
    }
    process.exit(unexpected.length ? 1 : 0);
  }

  if (cmd === 'capture') {
    const { base } = args;
    const { token } = args;
    if (!base) {
      console.error('--base is required');
      process.exit(2);
    }
    const c = {
      peWs: args['pe-ws'] || D.peWs,
      peProject: args['pe-project'] || D.peProject,
      peUnownedWs: args['pe-unowned-ws'] || D.peUnownedWs,
      umParent: args['um-parent'] || D.umParent,
      umUnknown: args['um-unknown'] || D.umUnknown,
    };
    const insecure = !!args.insecure;
    // --only pe|um restricts the catalog to one gateway, so a single local mock
    // container (which serves only its own prefix) can be captured without the
    // other gateway's probes 404ing. Default: both.
    const only = args.only === 'pe' || args.only === 'um' ? args.only : null;
    const results = {};
    for (const probe of readOnlyProbes(c)) {
      if (!only || probe.id.startsWith(`${only}.`)) {
        // eslint-disable-next-line no-await-in-loop
        results[probe.id] = await call(base, { ...probe, token }, insecure);
      }
    }
    if (args.mutate && only !== 'um') {
      Object.assign(results, await mutateProbes(base, c, token, insecure));
    }
    const out = {
      base, capturedFor: c, mutated: !!args.mutate, results,
    };
    if (args.out) {
      writeFileSync(args.out, JSON.stringify(out, null, 2));
      console.log(`wrote ${args.out} (${Object.keys(results).length} probes)`);
    } else {
      console.log(JSON.stringify(out, null, 2));
    }
    process.exit(0);
  }

  console.error('usage: parity-probe.mjs <capture|diff> [...]\n  see the file header for full usage.');
  process.exit(2);
}

main();
