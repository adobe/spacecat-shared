# SpaceCat Shared Utilities

This repository contains a collection of shared utility functions used across various SpaceCat projects. These utilities provide a range of checks and validations, from basic data type validation to more complex checks like ISO date strings and URL validation.

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
- `sqsEventAdapter(function)`: Wrapper function to turn an SQS record into a function param.

## Testing

This library includes a comprehensive test suite to ensure the reliability of the utility functions. To run the tests, use the following command:

```bash
npm test
```

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE.txt) file for details.
