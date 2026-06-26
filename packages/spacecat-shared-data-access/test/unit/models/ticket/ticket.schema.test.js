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
import ticketSchema from '../../../../src/models/ticket/ticket.schema.js';

describe('Ticket Schema', () => {
  let attributes;

  before(() => {
    attributes = ticketSchema.getAttributes();
  });

  describe('externalTicketId attribute', () => {
    it('exists', () => {
      expect(attributes.externalTicketId).to.exist;
    });

    it('is required', () => {
      expect(attributes.externalTicketId.required).to.be.true;
    });

    it('is readOnly', () => {
      expect(attributes.externalTicketId.readOnly).to.be.true;
    });

    it('is of type string', () => {
      expect(attributes.externalTicketId.type).to.equal('string');
    });
  });

  describe('ticketKey attribute', () => {
    it('is required and readOnly', () => {
      expect(attributes.ticketKey.required).to.be.true;
      expect(attributes.ticketKey.readOnly).to.be.true;
    });

    it('is of type string', () => {
      expect(attributes.ticketKey.type).to.equal('string');
    });
  });

  describe('ticketUrl attribute', () => {
    it('is required and readOnly', () => {
      expect(attributes.ticketUrl.required).to.be.true;
      expect(attributes.ticketUrl.readOnly).to.be.true;
    });

    it('validates URLs', () => {
      expect(attributes.ticketUrl.validate('https://acme.atlassian.net/browse/ASO-42')).to.be.true;
    });

    it('rejects invalid URLs', () => {
      expect(attributes.ticketUrl.validate('not-a-url')).to.be.false;
    });
  });

  describe('ticketStatus attribute', () => {
    it('is optional', () => {
      expect(attributes.ticketStatus.required).to.be.false;
    });

    it('defaults to null', () => {
      expect(attributes.ticketStatus.default).to.be.null;
    });
  });

  describe('ticketProvider attribute', () => {
    it('is required and readOnly', () => {
      expect(attributes.ticketProvider.required).to.be.true;
      expect(attributes.ticketProvider.readOnly).to.be.true;
    });
  });

  describe('createdBy attribute', () => {
    it('is required and readOnly', () => {
      expect(attributes.createdBy.required).to.be.true;
      expect(attributes.createdBy.readOnly).to.be.true;
    });
  });
});
