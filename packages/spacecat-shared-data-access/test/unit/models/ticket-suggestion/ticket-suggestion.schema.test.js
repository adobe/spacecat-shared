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

import { expect } from 'chai';
import ticketSuggestionSchema from '../../../../src/models/ticket-suggestion/ticket-suggestion.schema.js';

describe('TicketSuggestion Schema', () => {
  let attributes;

  before(() => {
    attributes = ticketSuggestionSchema.getAttributes();
  });

  describe('schema options', () => {
    it('does not allow updates (append-only)', () => {
      expect(ticketSuggestionSchema.allowsUpdates()).to.be.false;
    });
  });

  describe('suggestionId attribute', () => {
    it('exists', () => {
      expect(attributes.suggestionId).to.exist;
    });

    it('is required', () => {
      expect(attributes.suggestionId.required).to.be.true;
    });

    it('is readOnly', () => {
      expect(attributes.suggestionId.readOnly).to.be.true;
    });

    it('is of type string', () => {
      expect(attributes.suggestionId.type).to.equal('string');
    });
  });

  describe('opportunityId attribute', () => {
    it('is required and readOnly', () => {
      expect(attributes.opportunityId.required).to.be.true;
      expect(attributes.opportunityId.readOnly).to.be.true;
    });

    it('is of type string', () => {
      expect(attributes.opportunityId.type).to.equal('string');
    });
  });

  describe('createdBy attribute', () => {
    it('is required and readOnly', () => {
      expect(attributes.createdBy.required).to.be.true;
      expect(attributes.createdBy.readOnly).to.be.true;
    });

    it('is of type string', () => {
      expect(attributes.createdBy.type).to.equal('string');
    });
  });

  describe('index', () => {
    it('has an index on suggestionId', () => {
      const indexes = Object.values(ticketSuggestionSchema.getIndexes());
      expect(indexes).to.be.an('array').that.is.not.empty;
      const suggestionIdIndex = indexes.find(
        (idx) => idx.pk?.composite?.includes('suggestionId'),
      );
      expect(suggestionIdIndex).to.exist;
    });

    it('belongs_to Ticket index uses createdAt as sort key (ticket_suggestions has no updated_at column)', () => {
      const indexes = Object.values(ticketSuggestionSchema.getIndexes());
      const ticketIndex = indexes.find(
        (idx) => idx.pk?.composite?.includes('ticketId'),
      );
      expect(ticketIndex).to.exist;
      expect(ticketIndex.sk?.composite).to.deep.equal(['createdAt']);
    });
  });
});
