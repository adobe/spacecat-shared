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

/* eslint-disable no-unused-expressions */

import { expect } from 'chai';

import { isValidEmail } from '../src/email.js';

describe('isValidEmail', () => {
  it('returns false for invalid email addresses', () => {
    const invalidEmails = [
      null,
      undefined,
      1234,
      true,
      '',
      'invalid-email',
      'test@',
      '@example.com',
      'test..test@example.com',
      'test@.com',
      'test@example.',
      'test@example..com',
      'test@example.com.',
      'test space@example.com',
      'test@example com',
    ];
    invalidEmails.forEach((email) => expect(isValidEmail(email)).to.be.false);
  });

  it('returns true for valid email addresses', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.org',
      'user123@subdomain.example.net',
      'firstname.lastname@company-name.com',
    ];
    validEmails.forEach((email) => expect(isValidEmail(email)).to.be.true);
  });
});
