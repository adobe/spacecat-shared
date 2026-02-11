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

import { strategyWorkspaceData } from '../src/llmo-strategy.js';

describe('strategyWorkspaceData', () => {
  const baseWorkspaceData = {
    opportunities: [
      {
        id: 'opp-1',
        name: 'Improve Page Speed',
        description: 'Optimize loading times',
        category: 'performance',
      },
      {
        id: 'opp-2',
        name: 'Add Meta Tags',
        description: 'Improve SEO metadata',
        category: 'seo',
      },
    ],
    strategies: [
      {
        id: 'strat-1',
        name: 'Q1 Optimization',
        status: 'in_progress',
        url: '/strategies/q1-optimization',
        description: 'First quarter optimization strategy',
        topic: 'Performance',
        platform: 'chatgpt-paid',
        createdAt: '2025-01-15T10:00:00Z',
        opportunities: [
          {
            opportunityId: 'opp-1',
            status: 'in_progress',
            assignee: 'user@example.com',
          },
        ],
      },
    ],
  };

  it('validates workspace data when all references exist', () => {
    const result = strategyWorkspaceData.safeParse(baseWorkspaceData);
    expect(result.success).true;
  });

  it('validates empty workspace data', () => {
    const result = strategyWorkspaceData.safeParse({
      opportunities: [],
      strategies: [],
    });
    expect(result.success).true;
  });

  it('fails when library opportunity reference does not exist', () => {
    const data = {
      ...baseWorkspaceData,
      strategies: [
        {
          ...baseWorkspaceData.strategies[0],
          opportunities: [
            {
              opportunityId: 'non-existent-opp',
              status: 'new',
              assignee: 'user@example.com',
            },
          ],
        },
      ],
    };

    const result = strategyWorkspaceData.safeParse(data);
    expect(result.success).false;
    if (result.success) {
      throw new Error('Expected validation to fail');
    }
    expect(result.error.issues[0].message).equals('Library opportunity non-existent-opp does not exist');
  });

  it('validates system opportunity with link field (no library reference check)', () => {
    const data = {
      opportunities: [],
      strategies: [
        {
          id: 'strat-1',
          name: 'System Strategy',
          status: 'new',
          url: '/strategies/system',
          description: 'Strategy with system opportunity',
          topic: 'System',
          platform: 'chatgpt-paid',
          createdAt: '2025-01-15T10:00:00Z',
          opportunities: [
            {
              opportunityId: 'system-opp-123',
              name: 'System Generated Opportunity',
              link: '/opportunities/system-opp-123',
              status: 'new',
              assignee: 'user@example.com',
            },
          ],
        },
      ],
    };

    const result = strategyWorkspaceData.safeParse(data);
    expect(result.success).true;
  });

  describe('status validation', () => {
    it('validates all known strategy statuses', () => {
      const statuses = ['new', 'planning', 'in_progress', 'completed', 'on_hold'];

      statuses.forEach((status) => {
        const data = {
          ...baseWorkspaceData,
          strategies: [
            {
              ...baseWorkspaceData.strategies[0],
              status,
              completedAt: status === 'completed' ? '2025-02-01T10:00:00Z' : undefined,
            },
          ],
        };

        const result = strategyWorkspaceData.safeParse(data);
        expect(result.success, `Status '${status}' should be valid`).true;
      });
    });
  });

  describe('completedAt validation', () => {
    it('fails when strategy status is completed but completedAt is missing', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            status: 'completed',
            // completedAt is missing
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
      if (result.success) {
        throw new Error('Expected validation to fail');
      }
      expect(result.error.issues[0].message).equals('completedAt is required when status is completed');
    });

    it('validates when strategy status is completed with completedAt', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            status: 'completed',
            completedAt: '2025-02-01T10:00:00Z',
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
    });

    it('fails when opportunity status is completed but completedAt is missing', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            opportunities: [
              {
                opportunityId: 'opp-1',
                status: 'completed',
                assignee: 'user@example.com',
                // completedAt is missing
              },
            ],
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
      if (result.success) {
        throw new Error('Expected validation to fail');
      }
      expect(result.error.issues[0].message).equals('completedAt is required when status is completed');
    });

    it('validates when opportunity status is completed with completedAt', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            opportunities: [
              {
                opportunityId: 'opp-1',
                status: 'completed',
                assignee: 'user@example.com',
                completedAt: '2025-02-01T10:00:00Z',
              },
            ],
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
    });
  });

  describe('optional fields', () => {
    it('validates strategy with platform field', () => {
      const result = strategyWorkspaceData.safeParse(baseWorkspaceData);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].platform).equals('chatgpt-paid');
      }
    });

    it('fails when platform is empty string', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            platform: '',
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
    });

    it('accepts unknown future goalType values (forward compatibility)', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            goalType: 'future-goal-type',
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
    });

    it('validates strategy with createdBy field', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            createdBy: 'owner@example.com',
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].createdBy).equals('owner@example.com');
      }
    });

    it('validates strategy without createdBy field (backward compatibility)', () => {
      const result = strategyWorkspaceData.safeParse(baseWorkspaceData);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].createdBy).to.be.undefined;
      }
    });
  });

  describe('required fields validation', () => {
    it('fails when opportunity is missing required fields', () => {
      const data = {
        opportunities: [
          {
            id: 'opp-1',
            // missing name, description, category
          },
        ],
        strategies: [],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
    });

    it('fails when strategy is missing required fields', () => {
      const data = {
        opportunities: [],
        strategies: [
          {
            id: 'strat-1',
            // missing name, status, url, description, topic, createdAt, opportunities
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
    });

    it('fails when strategyOpportunity is missing required fields', () => {
      const data = {
        opportunities: [],
        strategies: [
          {
            id: 'strat-1',
            name: 'Strategy',
            status: 'new',
            url: '/test',
            description: 'Test',
            topic: 'Test',
            platform: 'chatgpt-paid',
            createdAt: '2025-01-15T10:00:00Z',
            opportunities: [
              {
                opportunityId: 'opp-1',
                // missing status and assignee
              },
            ],
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
    });
  });
});
