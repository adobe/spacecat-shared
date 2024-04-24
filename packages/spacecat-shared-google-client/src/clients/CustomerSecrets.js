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

import {
  CreateSecretCommand,
  GetSecretValueCommand,
  SecretsManagerClient,
  UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';

export default class CustomerSecrets {
  constructor(region, log = console) {
    this.client = new SecretsManagerClient({ region });
    this.log = log;
  }

  async storeToken(secretName, tokenValue) {
    const command = new CreateSecretCommand({
      Name: secretName,
      SecretString: JSON.stringify(tokenValue),
    });

    try {
      return await this.client.send(command);
    } catch (error) {
      this.log.error(error);
      return null;
    }
  }

  async updateTokens(secretName, tokenValue) {
    const command = new UpdateSecretCommand({
      SecretId: secretName,
      SecretString: JSON.stringify(tokenValue),
    });

    try {
      return await this.client.send(command);
    } catch (error) {
      this.log.error(error);
      return null;
    }
  }

  async retrieveTokens(secretName) {
    const command = new GetSecretValueCommand({ SecretId: secretName });

    try {
      const data = await this.client.send(command);
      return JSON.parse(data.SecretString);
    } catch (error) {
      this.log.error(error);
      return null;
    }
  }
}
