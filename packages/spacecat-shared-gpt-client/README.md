# Spacecat Shared - GPT Client

The `FirefallClient` library offers a streamlined way to interact with the Firefall API, enabling applications to fetch insights, recommendations, and codes based on provided prompts. Designed with simplicity and efficiency in mind, this client handles all aspects of communication with the Firefall API, including request authentication, error handling, and response parsing.

## Configuration

To use the `FirefallClient`, you need to configure it with the following parameters:

- `FIREFALL_API_ENDPOINT`: The endpoint URL for the Firefall API.
- `FIREFALL_IMS_ORG`: Your IMS organization ID for Firefall.
- `FIREFALL_API_KEY`: Your API key for accessing the Firefall API.
- `FIREFALL_API_AUTH`: Your Bearer authorization token for the Firefall API.

These parameters can be set through environment variables or passed directly to the `FirefallClient.createFrom` method.

## Usage Examples

### Instantiating the Firefall Client

```javascript
import FirefallClient from 'path/to/firefall-client';

// Assuming environment variables are set
const context = {
  env: process.env,
  log: console, // Using console for logging in this example
};

try {
  const client = FirefallClient.createFrom(context);
  console.log('FirefallClient created successfully.');
} catch (error) {
  console.error('Error creating FirefallClient:', error.message);
}
```

### Fetching Insights

```javascript
async function fetchInsights(prompt) {
  try {
    const client = FirefallClient.createFrom({
      env: {
        FIREFALL_API_ENDPOINT: 'https://api.firefall.example.com',
        FIREFALL_IMS_ORG: 'yourImsOrgId',
        FIREFALL_API_KEY: 'yourApiKey',
        FIREFALL_API_AUTH: 'yourApiAuth',
      },
      log: console,
    });

    const insights = await client.fetch(prompt);
    console.log('Insights:', insights);
  } catch (error) {
    console.error('Failed to fetch insights:', error.message);
  }
}

fetchInsights('How can we improve customer satisfaction?');
```

Ensure that you replace `'path/to/firefall-client'` with the actual path to the `FirefallClient` class in your project and adjust the configuration parameters according to your Firefall API credentials.

## Testing

To run tests:

```bash
npm test
```

## Linting

Lint your code:

```bash
npm run lint
```

## Cleaning

To remove `node_modules` and `package-lock.json`:

```bash
npm run clean
```

## Additional Information

- **Repository**: [GitHub](https://github.com/adobe/spacecat-shared.git)
- **Issue Tracking**: [GitHub Issues](https://github.com/adobe/spacecat-shared/issues)
- **License**: Apache-2.0
