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
        // Evolving strategies (the default type) require a non-empty baselinePrompts array
        baselinePrompts: [
          { prompt: 'best photo editor', regions: ['us'] },
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
          baselinePrompts: [{ prompt: 'p', regions: ['us'] }],
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

  describe('url, topic, topicId, and metadata variants', () => {
    it('validates strategy with url as an array of strings', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            url: ['/strategies/q1-optimization', '/strategies/q1-alt'],
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].url).deep.equals(['/strategies/q1-optimization', '/strategies/q1-alt']);
      }
    });

    it('validates strategy with topic as an array of strings', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            topic: ['Performance', 'SEO'],
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].topic).deep.equals(['Performance', 'SEO']);
      }
    });

    it('validates strategy with topicId as an array of UUIDs', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            topicId: ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].topicId).deep.equals(['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8']);
      }
    });

    it('validates strategy with metadata object containing arbitrary key-value pairs', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            metadata: {
              source: 'import',
              priority: 1,
              tags: ['q1', 'optimization'],
              nested: { key: 'value' },
            },
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].metadata).deep.equals({
          source: 'import',
          priority: 1,
          tags: ['q1', 'optimization'],
          nested: { key: 'value' },
        });
      }
    });

    it('validates strategy with single-value url, topic, topicId (backward compatibility)', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            url: '/strategies/q1-optimization',
            topic: 'Performance',
            topicId: '550e8400-e29b-41d4-a716-446655440000',
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].url).equals('/strategies/q1-optimization');
        expect(result.data.strategies[0].topic).equals('Performance');
        expect(result.data.strategies[0].topicId).equals('550e8400-e29b-41d4-a716-446655440000');
      }
    });

    it('validates strategy without metadata (backward compatibility)', () => {
      const result = strategyWorkspaceData.safeParse(baseWorkspaceData);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].metadata).to.be.undefined;
      }
    });

    it('validates strategyOpportunity with metadata object containing arbitrary key-value pairs', () => {
      const data = {
        ...baseWorkspaceData,
        strategies: [
          {
            ...baseWorkspaceData.strategies[0],
            opportunities: [
              {
                ...baseWorkspaceData.strategies[0].opportunities[0],
                metadata: {
                  source: 'import',
                  priority: 1,
                  tags: ['q1', 'optimization'],
                  nested: { key: 'value' },
                },
              },
            ],
          },
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].opportunities[0].metadata).deep.equals({
          source: 'import',
          priority: 1,
          tags: ['q1', 'optimization'],
          nested: { key: 'value' },
        });
      }
    });

    it('validates strategyOpportunity without metadata (backward compatibility)', () => {
      const result = strategyWorkspaceData.safeParse(baseWorkspaceData);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].opportunities[0].metadata).to.be.undefined;
      }
    });

    it('validates library opportunity with metadata object containing arbitrary key-value pairs', () => {
      const data = {
        ...baseWorkspaceData,
        opportunities: [
          {
            ...baseWorkspaceData.opportunities[0],
            metadata: {
              source: 'import',
              priority: 1,
              tags: ['q1', 'optimization'],
              nested: { key: 'value' },
            },
          },
          baseWorkspaceData.opportunities[1],
        ],
      };

      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.opportunities[0].metadata).deep.equals({
          source: 'import',
          priority: 1,
          tags: ['q1', 'optimization'],
          nested: { key: 'value' },
        });
      }
    });

    it('validates library opportunity without metadata (backward compatibility)', () => {
      const result = strategyWorkspaceData.safeParse(baseWorkspaceData);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.opportunities[0].metadata).to.be.undefined;
        expect(result.data.opportunities[1].metadata).to.be.undefined;
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

  describe('strategy type discriminator', () => {
    it('defaults type to "evolving" when missing (backward compat)', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-1',
          name: 'Existing strategy without type field',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
          baselinePrompts: [{ prompt: 'p', regions: ['us'] }],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].type).equal('evolving');
      }
    });

    it('accepts type "atomic"', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-2',
          type: 'atomic',
          experimentId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Atomic strategy',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].type).equal('atomic');
      }
    });

    it('rejects unknown type values', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-3',
          type: 'something-else',
          name: 'Bad type',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
    });

    it('accepts a valid UUID experimentId', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-4',
          type: 'evolving',
          experimentId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Strategy with experiment',
          status: 'completed',
          completedAt: '2025-02-01T00:00:00Z',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
          baselinePrompts: [{ prompt: 'p', regions: ['us'] }],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
    });

    it('accepts null experimentId on Evolving (no opt-in yet)', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-5',
          type: 'evolving',
          experimentId: null,
          name: 'Evolving without opt-in',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
          baselinePrompts: [{ prompt: 'p', regions: ['us'] }],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
    });

    it('rejects non-UUID experimentId', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-6',
          type: 'evolving',
          experimentId: 'not-a-uuid',
          name: 'Bad experiment id',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
          baselinePrompts: [{ prompt: 'p', regions: ['us'] }],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
    });

    it('accepts baselinePrompts array on Evolving', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-7',
          type: 'evolving',
          name: 'With baseline prompts',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
          baselinePrompts: [
            { prompt: 'best photo editor', regions: ['us', 'uk'] },
            { prompt: 'photo editing software', regions: ['us'] },
          ],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
      if (result.success) {
        expect(result.data.strategies[0].baselinePrompts).length(2);
      }
    });
  });

  describe('strategy type invariants (superRefine)', () => {
    it('rejects Atomic without experimentId', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-bad-1',
          type: 'atomic',
          // experimentId missing
          name: 'Bad atomic',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
      if (!result.success) {
        expect(result.error.issues.some(
          (i) => i.message.includes('Atomic strategies require a non-null experimentId'),
        )).true;
      }
    });

    it('rejects Atomic with null experimentId', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-bad-2',
          type: 'atomic',
          experimentId: null,
          name: 'Atomic with null exp',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
    });

    it('rejects Atomic with non-empty baselinePrompts', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-bad-3',
          type: 'atomic',
          experimentId: '550e8400-e29b-41d4-a716-446655440000',
          baselinePrompts: [{ prompt: 'x', regions: ['us'] }],
          name: 'Atomic with baseline prompts',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
      if (!result.success) {
        expect(result.error.issues.some(
          (i) => i.message.includes('must not carry baselinePrompts'),
        )).true;
      }
    });

    it('accepts Atomic with empty baselinePrompts array (treated as none)', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-edge-1',
          type: 'atomic',
          experimentId: '550e8400-e29b-41d4-a716-446655440000',
          baselinePrompts: [],
          name: 'Atomic with empty baseline prompts',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
    });

    it('rejects Evolving without baselinePrompts', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-bad-4',
          type: 'evolving',
          // baselinePrompts missing
          name: 'Evolving without baseline',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
      if (!result.success) {
        expect(result.error.issues.some(
          (i) => i.message.includes('Evolving strategies require a non-empty baselinePrompts'),
        )).true;
      }
    });

    it('rejects Evolving with empty baselinePrompts array', () => {
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-bad-5',
          type: 'evolving',
          baselinePrompts: [],
          name: 'Evolving with empty baseline',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).false;
    });

    it('accepts Evolving with default type (no type field) and baselinePrompts', () => {
      // Backward-compat path: existing strategies will lack `type`, default kicks in to 'evolving'.
      // The Evolving invariant fires regardless of whether `type` was provided or defaulted, so
      // backward-compat consumers must include baselinePrompts (or be migrated to do so).
      const data = {
        opportunities: [],
        strategies: [{
          id: 'strat-existing',
          // type defaults to 'evolving'
          name: 'Pre-GA strategy',
          status: 'in_progress',
          url: '/x',
          description: '',
          topic: 'T',
          createdAt: '2025-01-01T00:00:00Z',
          opportunities: [],
          baselinePrompts: [{ prompt: 'p', regions: ['us'] }], // explicit
        }],
      };
      const result = strategyWorkspaceData.safeParse(data);
      expect(result.success).true;
    });
  });
});
