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

/**
 * Local test script for bot blocker detection.
 * Tests real-world URLs to validate detection logic.
 *
 * Note: Results may differ from Lambda environment due to IP-based blocking.
 * Sites that block AWS IPs may be accessible from your local IP.
 */

import { detectBotBlocker } from '../../src/bot-blocker-detect/bot-blocker-detect.js';

const testSites = [
  {
    url: 'https://www.bmw.fr',
    description: 'BMW France (known to block with HTTP/2 errors)',
  },
  {
    url: 'https://www.adobe.com',
    description: 'Adobe.com (should be accessible)',
  },
  {
    url: 'https://www.example.com',
    description: 'Example.com (should be accessible)',
  },
];

console.log('🤖 Bot Blocker Detection Test\n');
console.log('⚠️  Note: Results may differ from Lambda (AWS IPs often blocked)\n');

async function runTests() {
  // eslint-disable-next-line no-restricted-syntax
  for (const { url, description } of testSites) {
    console.log(`Testing: ${url}`);
    console.log(`Description: ${description}`);

    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await detectBotBlocker({ baseUrl: url });

      console.log('Result:');
      console.log(`  Crawlable: ${result.crawlable ? '✅ Yes' : '❌ No'}`);
      console.log(`  Type: ${result.type}`);
      console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }

    console.log('');
  }

  console.log('Test complete!');
}

runTests();
