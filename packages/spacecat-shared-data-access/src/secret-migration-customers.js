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
import {
  SecretsManagerClient,
  ListSecretsCommand,
  GetSecretValueCommand,
  DeleteSecretCommand, UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';

// Initialize Secrets Manager clients for source and destination
const secretClient = new SecretsManagerClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
});

// Function to get all secrets with pagination
async function getAllSecrets() {
  let secrets = [];
  let nextToken;

  do {
    const command = new ListSecretsCommand({ NextToken: nextToken });
    // eslint-disable-next-line no-await-in-loop
    const response = await secretClient.send(command);
    secrets = secrets.concat(response.SecretList || []);
    nextToken = response.NextToken;
  } while (nextToken);

  return secrets;
}

async function removeUnusedCustomerSecrets() {
  try {
    console.log('🔍 Fetching all secrets from the source account...');

    // Get all secrets and filter them
    const allSecrets = await getAllSecrets();

    const filteredSecrets = allSecrets.filter((secret) => {
      const name = secret.Name;

      return name.startsWith('/helix-deploy/spacecat-services/customer-secrets/');
    });

    if (filteredSecrets.length === 0) {
      console.log('⚠️ No matching secrets found after filtering.');
      return;
    }

    console.log(`🧩 Found ${filteredSecrets.length} customer secrets to check.`);

    for (const secret of filteredSecrets) {
      const secretName = secret.Name;
      try {
        // Get the secret value
        const getCommand = new GetSecretValueCommand({ SecretId: secret.Name });
        // eslint-disable-next-line no-await-in-loop
        const secretValueResponse = await secretClient.send(getCommand);

        const secretString = secretValueResponse.SecretString;
        if (!secretString) {
          console.log(`⚠️ Skipping ${secret.Name} - no SecretString found.`);
          // eslint-disable-next-line no-continue
          continue;
        }
        const secretJSON = JSON.parse(secretString);
        delete secretJSON.access_token;
        delete secretJSON.refresh_token;
        delete secretJSON.scope;
        delete secretJSON.token_type;
        delete secretJSON.expiry_date;
        delete secretJSON.site_url;
        delete secretJSON.RUM_DOMAIN_KEY;

        if (Object.keys(secretJSON).length === 0) {
          console.log(`⚠️ Deleting ${secret.Name} - no data to be stored anymore.`);
          const deleteCommand = new DeleteSecretCommand({ SecretId: secret.Name });
          // eslint-disable-next-line no-await-in-loop
          await secretClient.send(deleteCommand);
          // eslint-disable-next-line no-continue
          continue;
        }
        const newSecretString = JSON.stringify(secretJSON);
        if (newSecretString === secretString) {
          console.log(`⚠️ Skipping ${secret.Name} - no changes found.`);
          // eslint-disable-next-line no-continue
          continue;
        }

        // Update the secret value
        const updateCommand = new UpdateSecretCommand({
          SecretId: secret.Name,
          SecretString: newSecretString,
        });

        // eslint-disable-next-line no-await-in-loop
        await secretClient.send(updateCommand);
        console.log(`🔄 Updated secret: ${secret.Name}`);
      } catch (error) {
        if (error.name === 'ResourceExistsException') {
          console.warn(`⚠️ Issue updating secret: ${secretName}`);
        } else {
          console.error(`❌ Failed to copy secret: ${secretName}. Error: ${error.message}`);
        }
      }
    }

    console.log('🎉 All customer secrets have been updated successfully.');
  } catch (err) {
    console.error('❌ Failed to process secrets:', err);
  }
}

// Run the script
await removeUnusedCustomerSecrets();
