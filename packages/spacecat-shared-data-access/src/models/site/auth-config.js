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
function googleConfig(config) {
  if (!config || Object.keys(config).length === 0) {
    return {};
  }
  return {
    client_id: config.client_id,
    client_secret: config.client_secret,
    redirect_uri: config.redirect_uri,
  };
}

const AuthConfig = (data = {}) => {
  const state = {
    getGoogleAuthConfig: () => googleConfig(data.google),
  };

  const self = {
    googleAuthConfig: () => state.google,
  };

  return Object.freeze(self);
};

AuthConfig.fromDynamoItem = (dynamoItem) => AuthConfig(dynamoItem);

AuthConfig.toDynamoItem = (authConfig) => ({
  google: authConfig.googleAuthConfig(),
});
export default AuthConfig;
