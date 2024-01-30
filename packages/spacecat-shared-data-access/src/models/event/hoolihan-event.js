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

import { Base } from '../base.js';

const HoolihanEvent = (data = {}) => {
  const self = Base(data);

  self.getEventContentDecoded = () => {
    const contentEncodedBase64 = self.state.value?.content;
    // TODO: try this instead? Then do we need a logger passed to this class?
    // Or just throw our own version of the error?
    return Buffer.from(contentEncodedBase64, 'base64').toString('utf-8');
  };

  return self;
};

export const createHoolihanEvent = (data) => {
  const newState = { ...data };

  // TODO perform validity checks, see organization.js for example

  return HoolihanEvent(newState);
};
