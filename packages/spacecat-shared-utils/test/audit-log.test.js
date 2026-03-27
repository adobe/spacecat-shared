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

import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { logWithAuditPrefix } from '../src/audit-log.js';

use(sinonChai);

describe('audit-log', () => {
  it('prefixes messages with the audit type', () => {
    const info = sinon.stub();

    logWithAuditPrefix({ info }, 'info', 'prerender', 'hello world');

    expect(info).to.have.been.calledOnceWith('[prerender] hello world');
  });

  it('forwards an error when provided', () => {
    const errorLog = sinon.stub();
    const error = new Error('boom');

    logWithAuditPrefix({ error: errorLog }, 'error', 'canonical', 'failed to process', error);

    expect(errorLog).to.have.been.calledOnceWith('[canonical] failed to process', error);
  });

  it('does nothing when the log level is missing', () => {
    expect(() => logWithAuditPrefix({}, 'warn', 'prerender', 'ignored')).to.not.throw();
  });

  it('does nothing when the logger is missing', () => {
    expect(() => logWithAuditPrefix(null, 'info', 'prerender', 'ignored')).to.not.throw();
  });
});
