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

/* eslint-env mocha */

import { expect } from 'chai';
import {
  DEPENDENCY_SOURCES,
  OPPORTUNITY_DEPENDENCY_MAP,
  getDependenciesForOpportunity,
  getOpportunitiesForSource,
} from '../../src/opportunity/dependency-mapping.js';

describe('dependency-mapping', () => {
  describe('DEPENDENCY_SOURCES', () => {
    it('defines all expected source keys', () => {
      expect(DEPENDENCY_SOURCES).to.include.keys('RUM', 'SEO_IMPORT', 'GSC', 'SCRAPING', 'EXTERNAL_API', 'CRUX', 'PSI');
    });

    it('has correct string values', () => {
      expect(DEPENDENCY_SOURCES.RUM).to.equal('RUM');
      expect(DEPENDENCY_SOURCES.SEO_IMPORT).to.equal('SEOImport');
      expect(DEPENDENCY_SOURCES.GSC).to.equal('GSC');
      expect(DEPENDENCY_SOURCES.SCRAPING).to.equal('scraping');
      expect(DEPENDENCY_SOURCES.EXTERNAL_API).to.equal('ExternalAPI');
      expect(DEPENDENCY_SOURCES.CRUX).to.equal('CrUX');
      expect(DEPENDENCY_SOURCES.PSI).to.equal('PSI');
    });
  });

  describe('OPPORTUNITY_DEPENDENCY_MAP', () => {
    it('is a non-empty object', () => {
      expect(OPPORTUNITY_DEPENDENCY_MAP).to.be.an('object');
      expect(Object.keys(OPPORTUNITY_DEPENDENCY_MAP).length).to.be.greaterThan(0);
    });

    it('maps cwv to RUM, CrUX and PSI dependencies', () => {
      expect(OPPORTUNITY_DEPENDENCY_MAP.cwv).to.deep.equal([
        DEPENDENCY_SOURCES.RUM,
        DEPENDENCY_SOURCES.CRUX,
        DEPENDENCY_SOURCES.PSI,
      ]);
    });

    it('maps broken-backlinks to SEO_IMPORT and SCRAPING', () => {
      expect(OPPORTUNITY_DEPENDENCY_MAP['broken-backlinks']).to.deep.equal([
        DEPENDENCY_SOURCES.SEO_IMPORT,
        DEPENDENCY_SOURCES.SCRAPING,
      ]);
    });

    it('maps offsite analysis to EXTERNAL_API', () => {
      expect(OPPORTUNITY_DEPENDENCY_MAP['wikipedia-analysis']).to.deep.equal([DEPENDENCY_SOURCES.EXTERNAL_API]);
    });
  });

  describe('getDependenciesForOpportunity', () => {
    it('returns dependencies for a known opportunity type', () => {
      expect(getDependenciesForOpportunity('cwv')).to.deep.equal([
        DEPENDENCY_SOURCES.RUM,
        DEPENDENCY_SOURCES.CRUX,
        DEPENDENCY_SOURCES.PSI,
      ]);
    });

    it('returns multiple dependencies when applicable', () => {
      const deps = getDependenciesForOpportunity('high-organic-low-ctr');
      expect(deps).to.include(DEPENDENCY_SOURCES.RUM);
      expect(deps).to.include(DEPENDENCY_SOURCES.GSC);
    });

    it('returns empty array for unknown opportunity type', () => {
      expect(getDependenciesForOpportunity('nonexistent-opportunity')).to.deep.equal([]);
    });
  });

  describe('getOpportunitiesForSource', () => {
    it('returns opportunities that depend on RUM', () => {
      const opps = getOpportunitiesForSource(DEPENDENCY_SOURCES.RUM);
      expect(opps).to.be.an('array');
      expect(opps).to.include('cwv');
      expect(opps).to.include('high-organic-low-ctr');
    });

    it('returns opportunities that depend on EXTERNAL_API', () => {
      const opps = getOpportunitiesForSource(DEPENDENCY_SOURCES.EXTERNAL_API);
      expect(opps).to.include('wikipedia-analysis');
      expect(opps).to.include('reddit-analysis');
      expect(opps).to.include('youtube-analysis');
    });

    it('returns empty array for unknown source', () => {
      expect(getOpportunitiesForSource('unknown-source')).to.deep.equal([]);
    });
  });
});
