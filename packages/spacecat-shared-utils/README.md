# SpaceCat Shared Utilities

This repository contains a collection of shared utility functions used across various SpaceCat projects. These utilities provide a range of checks and validations, from basic data type validation to more complex checks like ISO date strings and URL validation.

> **v1.76.0**: Added trace ID propagation support for distributed tracing across SpaceCat services.

## Installation

To install the SpaceCat Shared Utilities, you can use npm:

```bash
npm install spacecat-shared-utils
```

Or, if you are using yarn:

```bash
yarn add spacecat-shared-utils
```

## Usage

Here's how you can use the different utility functions in your project:

```javascript
import { isBoolean, isValidUrl } from 'spacecat-shared-utils';

console.log(isBoolean('true')); // true
console.log(isValidUrl('https://www.example.com')); // true
```

## Functions

The library includes the following utility functions:

- `isBoolean(value)`: Determines if the given value is a boolean or a string representation of a boolean.
- `isInteger(value)`: Checks if the given value is an integer.
- `isValidDate(obj)`: Checks whether the given object is a valid JavaScript Date.
- `isIsoDate(str)`: Validates whether the given string is a JavaScript ISO date string in Zulu (UTC) timezone.
- `isIsoTimeOffsetsDate(str)`: Validates whether the given string is a JavaScript ISO date string following UTC time offsets format.
- `isNumber(value)`: Determines if the given value is a number.
- `isObject(obj)`: Checks if the given parameter is an object and not an array or null.
- `isString(str)`: Determines if the given parameter is a string.
- `toBoolean(value)`: Converts a given value to a boolean. Throws an error if the value is not a boolean.
- `arrayEquals(a, b)`: Compares two arrays for equality.
- `isValidUrl(urlString)`: Validates whether the given string is a valid URL with http or https protocol.
- `hasText(str)`: Checks if the given string is not empty.
- `dateAfterDays(number)`: Calculates the date after a specified number of days from the current date.

## Log Wrapper

The `logWrapper` enhances your Lambda function logs by automatically prepending `jobId` (from message) and `traceId` (from AWS X-Ray) to all log statements. This improves log traceability across distributed services.

### Features
- Automatically extracts AWS X-Ray trace ID
- Includes jobId from message when available  
- Enhances `context.log` directly - **no code changes needed**
- Works seamlessly with existing log levels (info, error, debug, warn, trace, etc.)

### Usage

```javascript
import { logWrapper, sqsEventAdapter } from '@adobe/spacecat-shared-utils';

async function run(message, context) {
  const { log } = context;
  
  // Use context.log as usual - trace IDs are added automatically
  log.info('Processing started'); 
  // Output: [jobId=xxx] [traceId=1-xxx-xxx] Processing started
}

export const main = wrap(run)
  .with(sqsEventAdapter)
  .with(logWrapper)  // Add this line early in the wrapper chain
  .with(dataAccess)
  .with(sqs)
  .with(secrets)
  .with(helixStatus);
```

**Note:** The `logWrapper` enhances `context.log` directly. All existing code using `context.log` will automatically include trace IDs and job IDs in logs without any code changes.

## SQS Event Adapter

The library also includes an SQS event adapter to convert an SQS record into a function parameter. This is useful when working with AWS Lambda functions that are triggered by an SQS event. Usage:

```javascript
import { sqsEventAdapter } from '@adobe/spacecat-shared-utils';

// ...

export const main = wrap(run)
  .with(dataAccess)
  .with(sqsEventAdapter) // Add this line
  .with(sqs)
  .with(secrets)
  .with(helixStatus);
````

## AWS X-Ray Integration

### getTraceId()

Extracts the current AWS X-Ray trace ID from the segment. Returns `null` if not in AWS Lambda or no segment is available.

```javascript
import { getTraceId } from '@adobe/spacecat-shared-utils';

const traceId = getTraceId();
// Returns: '1-5e8e8e8e-5e8e8e8e5e8e8e8e5e8e8e8e' or null
```

This function is automatically used by `logWrapper` to include trace IDs in logs.

## Testing

This library includes a comprehensive test suite to ensure the reliability of the utility functions. To run the tests, use the following command:

```bash
npm test
```

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE.txt) file for details.
