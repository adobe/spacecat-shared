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
  getPTASummaryQuery,
  getPTASummaryWithTrendQuery,
  getPreviousPeriod,
  PTASummaryResponseDto,
  PTASummaryWithTrendResponseDto,
} from '../src/pta2/queries.js';

describe('PTA2 Queries', () => {
  describe('getPTASummaryQuery', () => {
    it('should generate PTA summary query with all parameters', () => {
      const params = {
        siteId: 'test-site-123',
        tableName: 'pta_data_table',
        week: 45,
        year: 2024,
      };

      const result = getPTASummaryQuery(params);

      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);

      // Verify table name is included
      expect(result).to.include('FROM pta_data_table');

      // Verify siteId is included in WHERE clause
      expect(result).to.include("siteid = 'test-site-123'");

      // Verify temporal condition is included
      expect(result).to.include('year=2024');
      expect(result).to.include('week=45');

      // Verify traffic type filter
      expect(result).to.include("trf_type = 'paid'");
    });

    it('should include all required aggregations', () => {
      const params = {
        siteId: 'site-456',
        tableName: 'my_table',
        year: 2025,
        month: 1,
      };

      const result = getPTASummaryQuery(params);

      // Verify all aggregation columns
      expect(result).to.include('total_pageviews');
      expect(result).to.include('total_clicks');
      expect(result).to.include('total_engaged');
      expect(result).to.include('total_rows');
      expect(result).to.include('click_rate');
      expect(result).to.include('engagement_rate');
      expect(result).to.include('bounce_rate');

      // Verify aggregation functions
      expect(result).to.include('SUM(pageviews)');
      expect(result).to.include('SUM(clicked)');
      expect(result).to.include('SUM(engaged)');
      expect(result).to.include('COUNT(*)');
    });

    it('should handle week-based temporal conditions', () => {
      const params = {
        siteId: 'complex-site',
        tableName: 'data_table',
        week: 45,
        year: 2024,
      };

      const result = getPTASummaryQuery(params);

      // Verify the temporal condition is properly included
      expect(result).to.include('year=2024');
      expect(result).to.include('week=45');
      expect(result).to.match(/WHERE[\s\S]*siteid[\s\S]*AND[\s\S]*\(/);
    });

    it('should calculate rates with NULLIF to avoid division by zero', () => {
      const params = {
        siteId: 'rate-test-site',
        tableName: 'rate_table',
        year: 2024,
        month: 6,
      };

      const result = getPTASummaryQuery(params);

      // Verify NULLIF is used to prevent division by zero
      expect(result).to.include('NULLIF(COUNT(*), 0)');

      // Verify click rate calculation
      expect(result).to.match(/CAST\(SUM\(clicked\) AS DOUBLE\)\s*\/\s*NULLIF\(COUNT\(\*\), 0\)\s*AS click_rate/);

      // Verify engagement rate calculation
      expect(result).to.match(/CAST\(SUM\(engaged\) AS DOUBLE\)\s*\/\s*NULLIF\(COUNT\(\*\), 0\)\s*AS engagement_rate/);

      // Verify bounce rate calculation (1 - engagement_rate)
      expect(result).to.match(/1\s*-\s*CAST\(SUM\(engaged\) AS DOUBLE\)\s*\/\s*NULLIF\(COUNT\(\*\), 0\)\s*AS bounce_rate/);
    });

    it('should cast aggregations to appropriate types', () => {
      const params = {
        siteId: 'type-test-site',
        tableName: 'type_table',
        year: 2024,
        month: 3,
      };

      const result = getPTASummaryQuery(params);

      // Verify BIGINT casting for count fields
      expect(result).to.include('CAST(SUM(pageviews) AS BIGINT)');
      expect(result).to.include('CAST(SUM(clicked) AS BIGINT)');
      expect(result).to.include('CAST(SUM(engaged) AS BIGINT)');

      // Verify DOUBLE casting for rate calculations
      expect(result).to.include('CAST(SUM(clicked) AS DOUBLE)');
      expect(result).to.include('CAST(SUM(engaged) AS DOUBLE)');
    });

    it('should handle siteId with special characters', () => {
      const params = {
        siteId: 'site-with-dashes_and_underscores',
        tableName: 'test_table',
        year: 2024,
        month: 5,
      };

      const result = getPTASummaryQuery(params);

      expect(result).to.include("siteid = 'site-with-dashes_and_underscores'");
    });

    it('should handle table names with schema prefix', () => {
      const params = {
        siteId: 'schema-test',
        tableName: 'my_schema.my_table',
        year: 2024,
        month: 8,
      };

      const result = getPTASummaryQuery(params);

      expect(result).to.include('FROM my_schema.my_table');
    });

    it('should filter by paid traffic type only', () => {
      const params = {
        siteId: 'traffic-type-test',
        tableName: 'traffic_table',
        year: 2024,
        month: 9,
      };

      const result = getPTASummaryQuery(params);

      // Verify only paid traffic is included
      expect(result).to.include("trf_type = 'paid'");

      // Verify it's in the WHERE clause
      expect(result).to.match(/WHERE[\s\S]*trf_type = 'paid'/);
    });

    it('should maintain proper SQL structure', () => {
      const params = {
        siteId: 'structure-test',
        tableName: 'structure_table',
        year: 2024,
        month: 6,
      };

      const result = getPTASummaryQuery(params);

      // Verify SELECT clause is present
      expect(result).to.match(/SELECT\s+CAST\(SUM\(pageviews\)/);

      // Verify FROM clause is present
      expect(result).to.match(/FROM\s+structure_table/);

      // Verify WHERE clause is present
      expect(result).to.match(/WHERE\s+siteid\s*=/);

      // No dangling commas
      expect(result).to.not.match(/,\s*FROM/);
      expect(result).to.not.match(/,\s*WHERE/);
    });

    it('should handle month-only temporal condition', () => {
      const params = {
        siteId: 'month-test',
        tableName: 'monthly_table',
        year: 2024,
        month: 6,
      };

      const result = getPTASummaryQuery(params);

      expect(result).to.include('year=2024');
      expect(result).to.include('month=6');
      expect(result).to.not.include('week');
    });

    it('should handle week-based temporal condition', () => {
      const params = {
        siteId: 'week-test',
        tableName: 'weekly_table',
        year: 2024,
        week: 45,
      };

      const result = getPTASummaryQuery(params);

      expect(result).to.include('week=45');
    });

    it('should throw error when missing required parameters', () => {
      expect(() => getPTASummaryQuery({
        tableName: 'test_table',
        year: 2024,
        month: 10,
      })).to.throw('Missing required parameters: siteId, or tableName');

      expect(() => getPTASummaryQuery({
        siteId: 'test-site',
        tableName: 'test_table',
      })).to.throw('Missing required parameters: week, month or year');

      expect(() => getPTASummaryQuery({
        siteId: 'test-site',
        tableName: 'test_table',
        month: 10,
      })).to.throw('Missing required parameters: week, month or year');
    });

    it('should produce valid SQL without syntax errors', () => {
      const params = {
        siteId: 'validation-test',
        tableName: 'valid_table',
        year: 2024,
        month: 11,
      };

      const result = getPTASummaryQuery(params);

      // Check for common SQL syntax issues
      expect(result).to.not.include('undefined');
      expect(result).to.not.include('null');
      expect(result).to.not.match(/,,/); // No double commas
      expect(result).to.not.match(/\(\s*\)/); // No empty parentheses
      expect(result).to.not.match(/WHERE\s+AND/); // No WHERE AND without condition
      expect(result).to.not.match(/WHERE\s+OR/); // No WHERE OR without condition
    });

    it('should include all WHERE conditions with proper AND operators', () => {
      const params = {
        siteId: 'where-test',
        tableName: 'where_table',
        year: 2024,
        month: 7,
      };

      const result = getPTASummaryQuery(params);

      // Verify all three WHERE conditions are present
      expect(result).to.match(/WHERE\s+siteid\s*=\s*'where-test'/);
      expect(result).to.match(/AND\s+\(/);
      expect(result).to.include('year=2024');
      expect(result).to.match(/AND\s+trf_type\s*=\s*'paid'/);
    });

    it('should handle numeric siteIds', () => {
      const params = {
        siteId: '12345',
        tableName: 'numeric_table',
        year: 2024,
        month: 12,
      };

      const result = getPTASummaryQuery(params);

      expect(result).to.include("siteid = '12345'");
    });

    it('should generate consistent output format', () => {
      const params = {
        siteId: 'consistency-test',
        tableName: 'consistency_table',
        year: 2024,
        month: 2,
      };

      const result1 = getPTASummaryQuery(params);
      const result2 = getPTASummaryQuery(params);

      // Function should be deterministic
      expect(result1).to.equal(result2);
    });

    it('should properly alias all SELECT columns', () => {
      const params = {
        siteId: 'alias-test',
        tableName: 'alias_table',
        year: 2024,
        month: 4,
      };

      const result = getPTASummaryQuery(params);

      // Verify all columns have aliases
      expect(result).to.match(/AS total_pageviews/);
      expect(result).to.match(/AS total_clicks/);
      expect(result).to.match(/AS total_engaged/);
      expect(result).to.match(/AS total_rows/);
      expect(result).to.match(/AS click_rate/);
      expect(result).to.match(/AS engagement_rate/);
      expect(result).to.match(/AS bounce_rate/);
    });
  });

  describe('getPreviousPeriod', () => {
    it('should calculate previous week within same year', () => {
      const result = getPreviousPeriod({ week: 45, year: 2024 });
      expect(result).to.deep.equal({ week: 44, year: 2024 });
    });

    it('should calculate previous week at year boundary', () => {
      const result = getPreviousPeriod({ week: 1, year: 2024 });
      expect(result).to.deep.equal({ week: 52, year: 2023 });
    });

    it('should calculate previous month within same year', () => {
      const result = getPreviousPeriod({ month: 6, year: 2024 });
      expect(result).to.deep.equal({ month: 5, year: 2024 });
    });

    it('should calculate previous month at year boundary', () => {
      const result = getPreviousPeriod({ month: 1, year: 2024 });
      expect(result).to.deep.equal({ month: 12, year: 2023 });
    });

    it('should throw error when neither week nor month is provided', () => {
      expect(() => getPreviousPeriod({ year: 2024 })).to.throw(
        'Either week or month must be provided',
      );
    });

    it('should prioritize week when both are provided', () => {
      // Week should be checked first
      const result = getPreviousPeriod({ week: 10, month: 5, year: 2024 });
      expect(result).to.deep.equal({ week: 9, year: 2024 });
    });

    it('should handle month correctly when week is explicitly undefined', () => {
      const result = getPreviousPeriod({ week: undefined, month: 11, year: 2025 });
      expect(result).to.deep.equal({ month: 10, year: 2025 });
    });

    it('should handle edge case with week undefined and month at year boundary', () => {
      const result = getPreviousPeriod({ week: undefined, month: 1, year: 2025 });
      expect(result).to.deep.equal({ month: 12, year: 2024 });
    });
  });

  describe('PTASummaryResponseDto', () => {
    describe('toJSON', () => {
      it('should convert PTA summary data to JSON format', () => {
        const data = {
          total_pageviews: 10000,
          total_clicks: 500,
          total_engaged: 750,
          total_rows: 1000,
          click_rate: 0.5,
          engagement_rate: 0.75,
          bounce_rate: 0.25,
        };

        const result = PTASummaryResponseDto.toJSON(data);

        expect(result).to.deep.equal({
          pageviews: 10000,
          click_rate: 0.5,
          engagement_rate: 0.75,
          bounce_rate: 0.25,
        });
      });
    });
  });

  describe('getPTASummaryWithTrendQuery', () => {
    it('should generate PTA summary query with trend data for week-based period', () => {
      const params = {
        siteId: 'test-site-123',
        tableName: 'pta_data_table',
        week: 45,
        year: 2024,
      };

      const result = getPTASummaryWithTrendQuery(params);

      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);

      // Verify table name is included
      expect(result).to.include('FROM pta_data_table');

      // Verify siteId is included in WHERE clause
      expect(result).to.include("siteid = 'test-site-123'");

      // Verify current period temporal condition
      expect(result).to.include('year=2024');
      expect(result).to.include('week=45');

      // Verify previous period temporal condition (week 44)
      expect(result).to.include('week=44');

      // Verify traffic type filter
      expect(result).to.include("trf_type = 'paid'");

      // Verify period column and UNION ALL
      expect(result).to.include('period');
      expect(result).to.include('UNION ALL');
      expect(result).to.include("'current' as period");
      expect(result).to.include("'previous' as period");

      // Verify GROUP BY period
      expect(result).to.include('GROUP BY period');
    });

    it('should generate PTA summary query with trend data for month-based period', () => {
      const params = {
        siteId: 'site-456',
        tableName: 'my_table',
        year: 2025,
        month: 3,
      };

      const result = getPTASummaryWithTrendQuery(params);

      // Verify current period (March 2025)
      expect(result).to.include('year=2025');
      expect(result).to.include('month=3');

      // Verify previous period (February 2025)
      expect(result).to.include('month=2');
    });

    it('should handle year boundary for week-based periods', () => {
      const params = {
        siteId: 'boundary-test',
        tableName: 'boundary_table',
        week: 1,
        year: 2024,
      };

      const result = getPTASummaryWithTrendQuery(params);

      // Current period should be week 1 of 2024
      expect(result).to.include('year=2024');
      expect(result).to.include('week=1');

      // Previous period should be week 52 of 2023
      expect(result).to.include('year=2023');
      expect(result).to.include('week=52');
    });

    it('should handle year boundary for month-based periods', () => {
      const params = {
        siteId: 'month-boundary-test',
        tableName: 'month_boundary_table',
        month: 1,
        year: 2024,
      };

      const result = getPTASummaryWithTrendQuery(params);

      // Current period should be January 2024
      expect(result).to.include('year=2024');
      expect(result).to.include('month=1');

      // Previous period should be December 2023
      expect(result).to.include('year=2023');
      expect(result).to.include('month=12');
    });

    it('should include all required aggregations in both periods', () => {
      const params = {
        siteId: 'agg-test',
        tableName: 'agg_table',
        year: 2025,
        month: 6,
      };

      const result = getPTASummaryWithTrendQuery(params);

      // Verify all aggregation columns
      expect(result).to.include('total_pageviews');
      expect(result).to.include('total_clicks');
      expect(result).to.include('total_engaged');
      expect(result).to.include('total_rows');
      expect(result).to.include('click_rate');
      expect(result).to.include('engagement_rate');
      expect(result).to.include('bounce_rate');

      // Verify aggregation functions
      expect(result).to.include('SUM(pageviews)');
      expect(result).to.include('SUM(clicked)');
      expect(result).to.include('SUM(engaged)');
      expect(result).to.include('COUNT(*)');
    });

    it('should throw error when missing required parameters', () => {
      expect(() => getPTASummaryWithTrendQuery({
        tableName: 'test_table',
        year: 2024,
        month: 10,
      })).to.throw('Missing required parameters: siteId, or tableName');

      expect(() => getPTASummaryWithTrendQuery({
        siteId: 'test-site',
        tableName: 'test_table',
      })).to.throw('Missing required parameters: week, month or year');
    });

    it('should maintain proper SQL structure with subquery', () => {
      const params = {
        siteId: 'structure-test',
        tableName: 'structure_table',
        year: 2024,
        month: 8,
      };

      const result = getPTASummaryWithTrendQuery(params);

      // Verify SELECT with period column
      expect(result).to.match(/SELECT\s+period,/);

      // Verify subquery structure
      expect(result).to.match(/FROM\s+\(/);
      expect(result).to.match(/\)\s+GROUP BY period/);

      // Verify UNION ALL structure
      expect(result).to.match(/WHERE[\s\S]*UNION ALL[\s\S]*WHERE/);
    });
  });

  describe('PTASummaryWithTrendResponseDto', () => {
    describe('toJSON', () => {
      it('should convert trend data with both periods to JSON format', () => {
        const data = [
          {
            period: 'current',
            total_pageviews: 10000,
            total_clicks: 500,
            total_engaged: 750,
            total_rows: 1000,
            click_rate: 0.5,
            engagement_rate: 0.75,
            bounce_rate: 0.25,
          },
          {
            period: 'previous',
            total_pageviews: 8000,
            total_clicks: 400,
            total_engaged: 600,
            total_rows: 800,
            click_rate: 0.5,
            engagement_rate: 0.75,
            bounce_rate: 0.25,
          },
        ];

        const result = PTASummaryWithTrendResponseDto.toJSON(data);

        // Check current period metrics at top level
        expect(result.pageviews).to.equal(10000);
        expect(result.click_rate).to.equal(0.5);
        expect(result.engagement_rate).to.equal(0.75);
        expect(result.bounce_rate).to.equal(0.25);

        // Check trends
        expect(result).to.have.property('trends');

        // Pageviews increased by 25%: (10000 - 8000) / 8000 * 100 = 25
        expect(result.trends.pageviews).to.equal(25);

        // Rates stayed the same, so trend is 0%
        expect(result.trends.click_rate).to.equal(0);
        expect(result.trends.engagement_rate).to.equal(0);
        expect(result.trends.bounce_rate).to.equal(0);
      });

      it('should calculate positive and negative trends correctly', () => {
        const data = [
          {
            period: 'current',
            total_pageviews: 12000,
            total_clicks: 600,
            total_engaged: 900,
            total_rows: 1200,
            click_rate: 0.6,
            engagement_rate: 0.8,
            bounce_rate: 0.2,
          },
          {
            period: 'previous',
            total_pageviews: 10000,
            total_clicks: 500,
            total_engaged: 750,
            total_rows: 1000,
            click_rate: 0.5,
            engagement_rate: 0.75,
            bounce_rate: 0.25,
          },
        ];

        const result = PTASummaryWithTrendResponseDto.toJSON(data);

        // Check current period metrics
        expect(result.pageviews).to.equal(12000);
        expect(result.click_rate).to.equal(0.6);
        expect(result.engagement_rate).to.equal(0.8);
        expect(result.bounce_rate).to.equal(0.2);

        // Pageviews: (12000 - 10000) / 10000 * 100 = 20%
        expect(result.trends.pageviews).to.be.closeTo(20, 0.01);

        // Click rate: (0.6 - 0.5) / 0.5 * 100 = 20%
        expect(result.trends.click_rate).to.be.closeTo(20, 0.01);

        // Engagement rate: (0.8 - 0.75) / 0.75 * 100 ≈ 6.67%
        expect(result.trends.engagement_rate).to.be.closeTo(6.67, 0.01);

        // Bounce rate: (0.2 - 0.25) / 0.25 * 100 = -20%
        expect(result.trends.bounce_rate).to.be.closeTo(-20, 0.01);
      });

      it('should handle only current period data', () => {
        const data = [
          {
            period: 'current',
            total_pageviews: 10000,
            total_clicks: 500,
            total_engaged: 750,
            total_rows: 1000,
            click_rate: 0.5,
            engagement_rate: 0.75,
            bounce_rate: 0.25,
          },
        ];

        const result = PTASummaryWithTrendResponseDto.toJSON(data);

        // Check current period metrics
        expect(result.pageviews).to.equal(10000);
        expect(result.click_rate).to.equal(0.5);
        expect(result.engagement_rate).to.equal(0.75);
        expect(result.bounce_rate).to.equal(0.25);

        // No trends when no previous data
        expect(result.trends).to.be.null;
      });

      it('should handle zero values in previous period', () => {
        const data = [
          {
            period: 'current',
            total_pageviews: 10000,
            total_clicks: 500,
            total_engaged: 750,
            total_rows: 1000,
            click_rate: 0.5,
            engagement_rate: 0.75,
            bounce_rate: 0.25,
          },
          {
            period: 'previous',
            total_pageviews: 0,
            total_clicks: 0,
            total_engaged: 0,
            total_rows: 0,
            click_rate: 0,
            engagement_rate: 0,
            bounce_rate: 0,
          },
        ];

        const result = PTASummaryWithTrendResponseDto.toJSON(data);

        // Check current period metrics
        expect(result.pageviews).to.equal(10000);
        expect(result.click_rate).to.equal(0.5);

        // Trends should be null when previous values are 0 (to avoid infinity)
        expect(result.trends.pageviews).to.be.null;
        expect(result.trends.click_rate).to.be.null;
        expect(result.trends.engagement_rate).to.be.null;
        expect(result.trends.bounce_rate).to.be.null;
      });

      it('should throw error when data is not an array', () => {
        expect(() => PTASummaryWithTrendResponseDto.toJSON({})).to.throw(
          'Expected an array with at least one period',
        );

        expect(() => PTASummaryWithTrendResponseDto.toJSON(null)).to.throw(
          'Expected an array with at least one period',
        );

        expect(() => PTASummaryWithTrendResponseDto.toJSON(undefined)).to.throw(
          'Expected an array with at least one period',
        );
      });

      it('should throw error when data array is empty', () => {
        expect(() => PTASummaryWithTrendResponseDto.toJSON([])).to.throw(
          'Expected an array with at least one period',
        );
      });

      it('should throw error when current period is missing', () => {
        const data = [
          {
            period: 'previous',
            total_pageviews: 8000,
            total_clicks: 400,
            total_engaged: 600,
            total_rows: 800,
            click_rate: 0.5,
            engagement_rate: 0.75,
            bounce_rate: 0.25,
          },
        ];

        expect(() => PTASummaryWithTrendResponseDto.toJSON(data)).to.throw(
          'Current period data not found',
        );
      });

      it('should handle periods in reverse order', () => {
        const data = [
          {
            period: 'previous',
            total_pageviews: 8000,
            total_clicks: 400,
            total_engaged: 600,
            total_rows: 800,
            click_rate: 0.4,
            engagement_rate: 0.6,
            bounce_rate: 0.4,
          },
          {
            period: 'current',
            total_pageviews: 10000,
            total_clicks: 500,
            total_engaged: 750,
            total_rows: 1000,
            click_rate: 0.5,
            engagement_rate: 0.75,
            bounce_rate: 0.25,
          },
        ];

        const result = PTASummaryWithTrendResponseDto.toJSON(data);

        // Check current period metrics
        expect(result.pageviews).to.equal(10000);
        expect(result.click_rate).to.equal(0.5);

        // Check trends
        expect(result.trends.pageviews).to.equal(25);
      });
    });
  });
});
