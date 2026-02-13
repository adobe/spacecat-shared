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

/* eslint-env mocha */

import { expect } from 'chai';
import sinon from 'sinon';

import {
  applyWhere,
  camelToSnake,
  createFieldMaps,
  decodeCursor,
  encodeCursor,
  entityToTableName,
  fromDbRecord,
  snakeToCamel,
  toDbField,
  toDbRecord,
  toModelField,
} from '../../../src/util/postgrest.utils.js';
import SiteSchema from '../../../src/models/site/site.schema.js';

describe('postgrest utils', () => {
  it('transforms camel/snake case values', () => {
    expect(camelToSnake('auditType')).to.equal('audit_type');
    expect(snakeToCamel('audit_type')).to.equal('auditType');
  });

  it('resolves table names with entity overrides', () => {
    expect(entityToTableName('LatestAudit')).to.equal('audits');
    expect(entityToTableName('ScrapeJob')).to.equal('scrape_jobs');
  });

  it('encodes and decodes cursors', () => {
    const encoded = encodeCursor(42);
    const invalidOffset = Buffer.from(JSON.stringify({ offset: 'not-int' }), 'utf-8').toString('base64');
    expect(decodeCursor(encoded)).to.equal(42);
    expect(decodeCursor('')).to.equal(0);
    expect(decodeCursor('bad-cursor')).to.equal(0);
    expect(decodeCursor(invalidOffset)).to.equal(0);
  });

  it('creates field maps from schema attributes', () => {
    const schema = {
      getAttributes: () => ({
        siteId: {},
        auditType: {},
      }),
    };

    const maps = createFieldMaps(schema);
    expect(maps.toDbMap).to.deep.equal({
      siteId: 'site_id',
      auditType: 'audit_type',
    });
    expect(maps.toModelMap).to.deep.equal({
      site_id: 'siteId',
      audit_type: 'auditType',
    });
  });

  it('maps model id field to DB id when schema idName is defined', () => {
    const schema = {
      getIdName: () => 'siteId',
      getAttributes: () => ({
        siteId: {},
        baseURL: {},
      }),
    };

    const maps = createFieldMaps(schema);
    expect(maps.toDbMap).to.deep.equal({
      siteId: 'id',
      baseURL: 'base_url',
    });
    expect(maps.toModelMap).to.deep.equal({
      id: 'siteId',
      base_url: 'baseURL',
    });
  });

  it('maps idName to id even when id field is not in schema attributes', () => {
    const schema = {
      getIdName: () => 'siteId',
      getAttributes: () => ({
        baseURL: {},
      }),
    };

    const maps = createFieldMaps(schema);
    expect(maps.toDbMap).to.deep.equal({
      baseURL: 'base_url',
      siteId: 'id',
    });
    expect(maps.toModelMap).to.deep.equal({
      base_url: 'baseURL',
      id: 'siteId',
    });
  });

  it('uses explicit postgrestField from schema attribute definition', () => {
    const schema = {
      getIdName: () => 'siteId',
      getAttributes: () => ({
        siteId: {},
        baseURL: { postgrestField: 'base_url_override' },
      }),
    };

    const maps = createFieldMaps(schema);
    expect(maps.toDbMap).to.deep.equal({
      siteId: 'id',
      baseURL: 'base_url_override',
    });
    expect(maps.toModelMap).to.deep.equal({
      id: 'siteId',
      base_url_override: 'baseURL',
    });
  });

  it('maps real Site schema fields base_url <-> baseURL', () => {
    const maps = createFieldMaps(SiteSchema);
    expect(maps.toDbMap.siteId).to.equal('id');
    expect(maps.toDbMap.baseURL).to.equal('base_url');
    expect(maps.toModelMap.base_url).to.equal('baseURL');

    expect(fromDbRecord({ id: 'site-1', base_url: 'https://example.com' }, maps.toModelMap))
      .to.deep.equal({ siteId: 'site-1', baseURL: 'https://example.com' });
  });

  it('maps individual db/model fields and whole records', () => {
    const toDbMap = {
      siteId: 'site_id',
      auditType: 'audit_type',
    };
    const toModelMap = {
      site_id: 'siteId',
      audit_type: 'auditType',
    };

    expect(toDbField('siteId', toDbMap)).to.equal('site_id');
    expect(toDbField('createdAt', toDbMap)).to.equal('created_at');
    expect(toModelField('site_id', toModelMap)).to.equal('siteId');
    expect(toModelField('created_at', toModelMap)).to.equal('createdAt');
    expect(toDbRecord({ siteId: 's1', auditType: 'lhs-mobile' }, toDbMap)).to.deep.equal({
      site_id: 's1',
      audit_type: 'lhs-mobile',
    });
    expect(fromDbRecord({ site_id: 's1', audit_type: 'lhs-mobile' }, toModelMap)).to.deep.equal({
      siteId: 's1',
      auditType: 'lhs-mobile',
    });
  });

  it('returns query unchanged when where clause is not usable', () => {
    const query = {};
    expect(applyWhere(query, null, {})).to.equal(query);
    expect(applyWhere(query, () => null, {})).to.equal(query);
    expect(applyWhere(query, () => 'invalid', {})).to.equal(query);
    expect(applyWhere(query, () => ({ type: 'unknown' }), {})).to.equal(query);
  });

  it('applies eq where filters', () => {
    const query = { eq: sinon.stub().returnsThis() };
    const result = applyWhere(query, (attr, op) => op.eq(attr.auditType, 'lhs-mobile'), {});

    expect(result).to.equal(query);
    sinon.assert.calledOnceWithExactly(query.eq, 'audit_type', 'lhs-mobile');
  });

  it('applies contains where filters with scalar and array values', () => {
    const query = { contains: sinon.stub().returnsThis() };

    applyWhere(query, (attr, op) => op.contains(attr.tags, 'seo'), {});
    sinon.assert.calledOnceWithExactly(query.contains, 'tags', ['seo']);

    query.contains.resetHistory();
    applyWhere(query, (attr, op) => op.contains(attr.tags, ['seo', 'ux']), {});
    sinon.assert.calledOnceWithExactly(query.contains, 'tags', ['seo', 'ux']);
  });
});
