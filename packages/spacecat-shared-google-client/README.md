# Spacecat Shared - Google Client

The GoogleClient library provides an easy-to-use interface for interacting with Google Search Console APIs.
It allows for secure retrieval of organic search data and site listings using OAuth2 authentication, with credentials managed via AWS Secrets Manager.

## Installation

Install the package using npm:

```bash
npm install @adobe/spacecat-shared-google-client
```

## Environment Variables
- `GOOGLE_CLIENT_ID`: Google OAuth2 client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth2 client secret
- `GOOGLE_REDIRECT_URI`: Google OAuth2 redirect URI: 
  - For dev environment: https://spacecat.experiencecloud.live/api/ci/auth/google
  - For prod environment: https://spacecat.experiencecloud.live/api/v1/auth/google

## Usage

```
import GoogleClient from '@adobe/spacecat-shared-google-client';

...
 try {
    const googleClient = await GoogleClient.createFrom(context, baseURL);
    const response = await googleClient.getOrganicTrafficData(baseURL, startDate, endDate);
    const data = await response.json();
  } catch (error) {
    // handle error
  }
...
```

## Testing

To run tests:

```bash
npm run test
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
