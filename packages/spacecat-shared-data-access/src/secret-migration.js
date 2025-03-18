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
  CreateSecretCommand,
  UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';

// Initialize Secrets Manager clients for source and destination
const sourceClient = new SecretsManagerClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
});

const destinationClient = new SecretsManagerClient({
  region: process.env.DEST_AWS_REGION || process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.DEST_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.DEST_AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.DEST_AWS_SESSION_TOKEN,
  },
});

// Environment variables for account ID replacement
const { OLD_ACCOUNT_ID } = process.env;
const { NEW_ACCOUNT_ID } = process.env;

async function getExistingSecrets() {
  const existingSecrets = new Set();
  let nextToken;

  do {
    const command = new ListSecretsCommand({ NextToken: nextToken });
    // eslint-disable-next-line no-await-in-loop
    const response = await destinationClient.send(command);

    response.SecretList.forEach((secret) => {
      existingSecrets.add(secret.Name);
    });

    nextToken = response.NextToken;
  } while (nextToken);

  return existingSecrets;
}

// Function to get all secrets with pagination
async function getAllSecrets() {
  let secrets = [];
  let nextToken;

  do {
    const command = new ListSecretsCommand({ NextToken: nextToken });
    // eslint-disable-next-line no-await-in-loop
    const response = await sourceClient.send(command);
    secrets = secrets.concat(response.SecretList || []);
    nextToken = response.NextToken;
  } while (nextToken);

  return secrets;
}

async function copySecrets() {
  try {
    console.log('🔍 Fetching all secrets from the source account...');

    // Get all secrets and filter them
    const allSecrets = await getAllSecrets();
    const existingSecrets = await getExistingSecrets();

    const filteredSecrets = allSecrets.filter((secret) => {
      const name = secret.Name;

      // Filter by prefix
      if (!name.startsWith('/helix-deploy/spacecat-services/')) {
        return false;
      }

      // Exclude secrets ending with "v1"
      if (name.endsWith('/v1')) {
        return false;
      }

      // Include secrets that end with "ci", but we'll rename them
      if (name.endsWith('/ci')) {
        return true;
      }

      // Include all others
      return true;
    });

    if (filteredSecrets.length === 0) {
      console.log('⚠️ No matching secrets found after filtering.');
      return;
    }

    console.log(`🧩 Found ${filteredSecrets.length} secrets to copy.`);

    for (const secret of filteredSecrets) {
      let secretName = secret.Name;

      // Rename secrets ending with "ci" to "latest"
      if (secretName.endsWith('/ci')) {
        secretName = secretName.replace(/ci$/, 'latest');
        console.log(`🔄 Renaming secret: ${secret.Name} → ${secretName}`);
      }

      try {
        // Get the secret value
        const getCommand = new GetSecretValueCommand({ SecretId: secret.Name });
        // eslint-disable-next-line no-await-in-loop
        const secretValueResponse = await sourceClient.send(getCommand);

        let secretString = secretValueResponse.SecretString;
        if (!secretString) {
          console.log(`⚠️ Skipping ${secret.Name} - no SecretString found.`);
          // eslint-disable-next-line no-continue
          continue;
        }

        // Replace the old account ID with the new account ID in any SQS queue URL
        if (OLD_ACCOUNT_ID && NEW_ACCOUNT_ID) {
          const updatedSecretString = secretString.replaceAll(OLD_ACCOUNT_ID, NEW_ACCOUNT_ID);
          if (updatedSecretString !== secretString) {
            console.log(`🔁 Replaced account ID in SQS URLs for secret: ${secretName}`);
            secretString = updatedSecretString;
          }
        }

        // Remove '-dev' from the secret value if present
        if (secretString.includes('-dev')) {
          secretString = secretString.replace(/-dev/g, '');
          console.log(`🧹 Removed '-dev' from secret value for: ${secretName}`);
        }

        // Create the secret in the destination account
        console.log(`🚀 Copying secret: ${secretName}`);

        // eslint-disable-next-line no-await-in-loop
        if (existingSecrets.has(secretName)) {
          console.log(`🔄 Secret exists, updating: ${secretName}`);
          const updateCommand = new UpdateSecretCommand({
            SecretId: secretName,
            SecretString: secretString,
          });

          // eslint-disable-next-line no-await-in-loop
          await destinationClient.send(updateCommand);
          console.log(`✅ Successfully updated secret: ${secretName}`);
        } else {
          console.log(`✨ Secret does not exist, creating: ${secretName}`);
          const createCommand = new CreateSecretCommand({
            Name: secretName,
            SecretString: secretString,
          });

          // eslint-disable-next-line no-await-in-loop
          await destinationClient.send(createCommand);
          console.log(`✅ Successfully created secret: ${secretName}`);
        }

        console.log(`✅ Successfully copied secret: ${secretName}`);
      } catch (error) {
        if (error.name === 'ResourceExistsException') {
          console.warn(`⚠️ Secret already exists in the destination account: ${secretName}`);
        } else {
          console.error(`❌ Failed to copy secret: ${secretName}. Error: ${error.message}`);
        }
      }
    }

    console.log('🎉 All matching secrets have been processed successfully.');
  } catch (err) {
    console.error('❌ Failed to process secrets:', err);
  }
}

// Run the script
copySecrets();
