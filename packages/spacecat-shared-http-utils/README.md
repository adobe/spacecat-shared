# Response Helper Functions. 

A set of TypeScript functions for creating HTTP responses with standardized formats.

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
- [Contributing](#contributing)
- [License](#license)

## Introduction

This library provides a collection of functions related to http to be used in Spacecat development. The functions are designed to create responses with standardized formats, making it easier to maintain a consistent structure across different parts of your application.

## Installation

Install the package using npm or yarn:

```bash
npm install @adobe/spacecat-shared-http-utils
```

or

```bash
yarn add @adobe/spacecat-shared-http-utils
```

## Usage

Import the functions in your TypeScript file and use them to generate HTTP responses. Here's an example:

```typescript
import {
  ok,
  noContent,
  badRequest,
  notFound,
  internalServerError,
} from '@adobe/spacecat-shared-http-utils';

// Example usage
const successResponse: Response = ok('Request was successful');

const emptyResponse: Response = noContent();

const errorResponse: Response = badRequest('Invalid input');

const notFoundResponse: Response = notFound('Resource not found');

const serverErrorResponse: Response = internalServerError('Something went wrong');
```

## API

### `ok(body?: string): Response`

Creates a successful response with an optional body.

### `noContent(headers?: Headers): Response`

Creates a response with no content and optional headers.

### `badRequest(message: string, headers?: Headers): Response`

Creates a response for a bad request with an error message and optional headers.

### `notFound(message: string, headers?: Headers): Response`

Creates a response for a not found scenario with an error message and optional headers.

### `internalServerError(message: string, headers?: Headers): Response`

Creates a response for an internal server error with an error message and optional headers.


## Contributing

Feel free to contribute by opening issues or creating pull requests. Please follow the existing coding style and include tests when adding new features.

## License

This project is licensed under the Apache 2.0 - see the [LICENSE](LICENSE) file for details.

