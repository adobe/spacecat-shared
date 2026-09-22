# Spacecat Shared - GPT Client

## Azure OpenAI

The `AzureOpenAIClient` library provides a streamlined way to interact with Azure OpenAI's Chat Completions API, enabling applications to fetch AI-generated responses based on provided prompts. Designed with simplicity and efficiency in mind, this client handles all aspects of communication with Azure OpenAI, including request authentication, error handling, and response parsing.

### Configuration

To use the `AzureOpenAIClient`, you need to configure it with the following parameters:

- `AZURE_OPENAI_ENDPOINT`: The endpoint URL for your Azure OpenAI resource (e.g., `https://your-resource.openai.azure.com`).
- `AZURE_OPENAI_KEY`: Your API key for accessing the Azure OpenAI API.
- `AZURE_API_VERSION`: The API version to use (e.g., `2024-02-01`).
- `AZURE_COMPLETION_DEPLOYMENT`: The deployment name for your Azure OpenAI model (e.g., `gpt-4o`).

**All parameters are required.** The client will throw an error if any of these configuration values are missing or invalid.

These parameters can be set through environment variables or passed directly to the `AzureOpenAIClient.createFrom` method.

### Usage Examples

#### Instantiating the Azure OpenAI Client

```javascript
import AzureOpenAIClient from 'path/to/azure-openai-client';

// Assuming environment variables are set
const context = {
  env: process.env,
  log: console, // Using console for logging in this example
};

try {
  const client = AzureOpenAIClient.createFrom(context);
  console.log('AzureOpenAIClient created successfully.');
} catch (error) {
  console.error('Error creating AzureOpenAIClient:', error.message);
}
```

#### Fetching Chat Completions

```javascript
/**
 * Fetch chat completions using Azure OpenAI's Chat Completions API.
 */
async function fetchChatCompletion(prompt) {
  try {
    const client = AzureOpenAIClient.createFrom({
      env: {
        AZURE_OPENAI_ENDPOINT: 'https://your-resource.openai.azure.com',
        AZURE_OPENAI_KEY: 'your-api-key',
        AZURE_API_VERSION: '2024-02-01',
        AZURE_COMPLETION_DEPLOYMENT: 'gpt-4o',
      },
      log: console,
    });

    const response = await client.fetchChatCompletion(prompt);
    console.log('Response:', JSON.stringify(response));
  } catch (error) {
    console.error('Failed to fetch chat completion:', error.message);
  }
}

fetchChatCompletion('What is the capital of France?');
```

#### Using Images with Chat Completions

```javascript
/**
 * Fetch chat completions with image analysis using Azure OpenAI.
 */
async function fetchChatCompletionWithImages(prompt, imageUrls) {
  try {
    const client = AzureOpenAIClient.createFrom({
      env: {
        AZURE_OPENAI_ENDPOINT: 'https://your-resource.openai.azure.com',
        AZURE_OPENAI_KEY: 'your-api-key',
        AZURE_API_VERSION: '2024-02-01',
        AZURE_COMPLETION_DEPLOYMENT: 'gpt-4o',
      },
      log: console,
    });

    const options = {
      imageUrls: imageUrls, // Array of image URLs or base64 data
    };

    const response = await client.fetchChatCompletion(prompt, options);
    console.log('Response:', JSON.stringify(response));
  } catch (error) {
    console.error('Failed to fetch chat completion with images:', error.message);
  }
}

// Example with image URLs
fetchChatCompletionWithImages(
  'Identify all food items in this image',
  ['https://example.com/food-image.jpg', 'data:image/png;base64,iVBORw0KGgoAAAA...=']
);
```

#### Requesting JSON Responses

```javascript
/**
 * Fetch chat completions with JSON response format.
 */
async function fetchJSONResponse(prompt) {
  try {
    const client = AzureOpenAIClient.createFrom({
      env: {
        AZURE_OPENAI_ENDPOINT: 'https://your-resource.openai.azure.com',
        AZURE_OPENAI_KEY: 'your-api-key',
        AZURE_API_VERSION: '2024-02-01',
        AZURE_COMPLETION_DEPLOYMENT: 'gpt-4o',
      },
      log: console,
    });

    const options = {
      responseFormat: 'json_object',
    };

    const response = await client.fetchChatCompletion(prompt, options);
    console.log('JSON Response:', JSON.stringify(response));
  } catch (error) {
    console.error('Failed to fetch JSON response:', error.message);
  }
}

fetchJSONResponse('Provide a list of 3 colors in JSON format');
```

Ensure that you replace `'path/to/azure-openai-client'` with the actual path to the `AzureOpenAIClient` class in your project and adjust the configuration parameters according to your Azure OpenAI resource credentials.

## Azure Embeddings

The `AzureEmbeddingClient` calls Azure OpenAI's **embeddings** API (e.g. `text-embedding-3-small`). It is separate from `AzureOpenAIClient` (chat/completions) but shares the same vendor/auth, and implements the minimal `EmbeddingProvider` interface (`createEmbeddings(inputs, options?) => number[][]`) so consumers can depend on the interface rather than the concrete client. It embeds a batch of input strings and returns one vector per input, in input order, with bounded retry/backoff (429/5xx, honoring `Retry-After`, capped).

### Configuration

Only the embeddings deployment is distinct and required; the endpoint/key/api-version fall back to the chat client's `AZURE_OPENAI_*` values when embeddings share the same Azure resource:

- `AZURE_EMBEDDING_DEPLOYMENT` (**required**): the deployment name of the embeddings model (e.g. `text-embedding-3-small`).
- `AZURE_EMBEDDING_ENDPOINT` (optional, falls back to `AZURE_OPENAI_ENDPOINT`): the resource endpoint if embeddings live on a different Azure resource than chat.
- `AZURE_EMBEDDING_KEY` (optional, falls back to `AZURE_OPENAI_KEY`): API key for that resource.
- `AZURE_EMBEDDING_API_VERSION` (optional, falls back to `AZURE_API_VERSION`): API version.
- `AZURE_EMBEDDING_MAX_RETRIES` (optional, default `3`): retries for transient 429/5xx responses (`0` disables; negative is clamped to `0`).

These parameters can be set through environment variables (via `AzureEmbeddingClient.createFrom(context)`) or passed directly to the constructor (`{ apiEndpoint, apiKey, apiVersion, deploymentName, maxRetries?, retryBaseDelayMs?, retryMaxDelayMs? }`).

### Usage Example

```javascript
import { AzureEmbeddingClient } from '@adobe/spacecat-shared-gpt-client';

// Assuming AZURE_EMBEDDING_DEPLOYMENT (+ AZURE_OPENAI_* or AZURE_EMBEDDING_*) are set on context.env
const client = AzureEmbeddingClient.createFrom(context);
const [vectorA, vectorB] = await client.createEmbeddings(['running shoes', 'trail runners']);
// each vector is a number[] at the model's native dimension (1536 for text-embedding-3-small)
```

Both the write path (opportunity topic vectors) and the read path (query text) in the Lookup Service embed via this client against the **same deployment**, so their vectors share one embedding space by construction.

## Firefall
The `FirefallClient` library offers a streamlined way to interact with the Firefall API, enabling applications to fetch insights, recommendations, and codes based on provided prompts. Designed with simplicity and efficiency in mind, this client handles all aspects of communication with the Firefall API, including request authentication, error handling, and response parsing.

### Configuration

To use the `FirefallClient`, you need to configure it with the following parameters:

- `FIREFALL_API_ENDPOINT`: The endpoint URL for the Firefall API.
- `FIREFALL_API_KEY`: Your API key for accessing the Firefall API.
- `FIREFALL_API_CAPABILITY_NAME`: The capability name for the Firefall API.

Optionally, you can specify the IMS ORG ID to use when calling the Firefall APIs.  If this value is not specified, the IMS_CLIENT_ID (see below) will
be used for the header's value:

- `FIREFALL_IMS_ORG_ID`: The IMS ORG ID to use when calling the Firefall APIs and tracking the request.

These parameters can be set through environment variables or passed directly to the `FirefallClient.createFrom` method.

Additionally, the configuration for the `@adobe/spacecat-shared-ims-client` library is required to fetch the service access token from the IMS API:

- `IMS_HOST`: The hostname of the IMS API.
- `IMS_CLIENT_ID`: Your IMS client ID.
- `IMS_CLIENT_CODE`: Your IMS client code, used for authentication.
- `IMS_CLIENT_SECRET`: Your IMS client secret, used for authentication.

### Usage Examples

#### Instantiating the Firefall Client

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

#### Fetching Insights

1.  Via Capability Execution endpoint

```javascript
/**
 *  Fetch insights using the Firefall's capability execution endpoint.
 */
async function fetchInsights(prompt) {
  try {
    const client = FirefallClient.createFrom({
      env: {
        FIREFALL_API_ENDPOINT: 'https://api.firefall.example.com',
        FIREFALL_API_KEY: 'yourApiKey',
        FIREFALL_API_CAPABILITY_NAME: 'yourCapabilityName',
        IMS_HOST: 'ims.example.com',
        IMS_CLIENT_ID: 'yourClientId',
        IMS_CLIENT_CODE: 'yourClientCode',
        IMS_CLIENT_SECRET: 'yourClientSecret',
      },
      log: console,
    });

    const insights = await client.fetchCapabilityExecution(prompt);
    console.log('Insights:', insights);
  } catch (error) {
    console.error('Failed to fetch insights:', error.message);
  }
}

fetchInsights('How can we improve customer satisfaction?');
```

2.  Via Chat Completions endpoint

```javascript
/**
 *  Fetch completions using the Firefall's chat completions endpoint.
 */
async function fetchCompletions(prompt) {
  try {
    const client = FirefallClient.createFrom({
      env: {
        FIREFALL_API_ENDPOINT: 'https://api.firefall.example.com',
        FIREFALL_API_KEY: 'yourApiKey',
        IMS_HOST: 'ims.example.com',
        IMS_CLIENT_ID: 'yourClientId',
        IMS_CLIENT_CODE: 'yourClientCode',
        IMS_CLIENT_SECRET: 'yourClientSecret',
      },
      log: console,
    });
    const options = {
      imageUrls: ['data:image/png;base64,iVBORw0KGgoAAAA...='],
      model:'gpt-4-vision',
      responseFormat: undefined,
    };

    const response = await client.fetchChatCompletion(prompt, { options });
    console.log('Response:', JSON.stringify(response));
  } catch (error) {
    console.error('Failed to fetch chat completion:', error.message);
  }
}

fetchCompletions('Identify all food items in this image', { imageUrls: ['data:image/png;base64,iVBORw0KGgoAAAA...='] });
```

Ensure that you replace `'path/to/firefall-client'` with the actual path to the `FirefallClient` class in your project and adjust the configuration parameters according to your Firefall API credentials.

## Genvar Client

The `Genvar client` library provides a convenient way to interact with the Genvar APIs.

### Configuration
To use the `GenvarClient`, you need to configure it with the following parameters:

- `GENVAR_HOST`: The hostname for Genvar API.
- `GENVAR_IMS_ORG_ID`: The IMS ORG ID to use when calling the Genvar APIs and tracking the request.

These parameters can be set through environment variables or passed directly to the `GenvarClient.createFrom` method.

Additionally, the configuration for the `@adobe/spacecat-shared-ims-client` library is required to fetch the service access token from the IMS API:

- `IMS_HOST`: The hostname of the IMS API.
- `IMS_CLIENT_ID`: Your IMS client ID.
- `IMS_CLIENT_CODE`: Your IMS client code, used for authentication.
- `IMS_CLIENT_SECRET`: Your IMS client secret, used for authentication.

### Usage Examples

#### Instantiating the Genvar Client
```javascript
import GenvarClient from 'path/to/genvar-client';

// Assuming environment variables are set
const context = {
  env: process.env,
  log: console, // Using console for logging in this example
};

try {
  const client = GenvarClient.createFrom(context);
  console.log('GenvarClient created successfully.');
} catch (error) {
  console.error('Error creating GenvarClient:', error.message);
}
```

#### Calling Genvar API

- Using `generateSuggestions` method which first submits the job and then polls the job status
```javascript
/**
 *  Call Genvar API with generate suggestions method 
 */
async function generateAISuggestions() {
  try {
    const client = GenvarClient.createFrom({
      env: {
        GENVAR_HOST: 'https://12345-genvarapi-seotest.adobeioruntime.net',
        GENVAR_IMS_ORG_ID: 'abcd@AdobeOrg',
        IMS_HOST: 'ims.example.com',
        IMS_CLIENT_ID: 'yourClientId',
        IMS_CLIENT_CODE: 'yourClientCode',
        IMS_CLIENT_SECRET: 'yourClientSecret',
      },
      log: console,
    });

    const requestBody = {
      param1: 'some-value',
    };
    const endpoint = '/some-endpoint';
    const response = await client.generateSuggestions(requestBody, endpoint);
    console.log('Genvar API response:', response);
  } catch (error) {
    console.error('Failed to call genvar API:', error.message);
  }
}
```

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
