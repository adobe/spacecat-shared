/*
 * Copyright 2024 Adobe. All rights reserved.
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
import AuthInfo from '../../src/auth/auth-info.js';

describe('AuthInfo', () => {
  describe('isLLMOAdministrator', () => {
    it('should return undefined if profile is not set', () => {
      const authInfo = new AuthInfo();
      expect(authInfo.isLLMOAdministrator()).to.be.undefined;
    });

    it('should return undefined if is_llmo_administrator is not in profile', () => {
      const authInfo = new AuthInfo().withProfile({});
      expect(authInfo.isLLMOAdministrator()).to.be.undefined;
    });

    it('should return true if is_llmo_administrator is true', () => {
      const authInfo = new AuthInfo().withProfile({ is_llmo_administrator: true });
      expect(authInfo.isLLMOAdministrator()).to.be.true;
    });

    it('should return false if is_llmo_administrator is false', () => {
      const authInfo = new AuthInfo().withProfile({ is_llmo_administrator: false });
      expect(authInfo.isLLMOAdministrator()).to.be.false;
    });
  });
});
