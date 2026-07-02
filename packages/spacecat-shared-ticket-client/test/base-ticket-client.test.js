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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import BaseTicketClient from '../src/clients/base-ticket-client.js';

use(chaiAsPromised);

class ConcreteClient extends BaseTicketClient {}

describe('BaseTicketClient', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new BaseTicketClient({}, {}, {})).to.throw('abstract');
  });

  it('throws when createTicket is not implemented', async () => {
    const client = new ConcreteClient({}, {}, {});
    await expect(client.createTicket({})).to.be.rejectedWith('createTicket() must be implemented');
  });
});
