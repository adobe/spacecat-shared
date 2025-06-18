## Classes

<dl>
<dt><a href="#SQS">SQS</a></dt>
<dd><p>SQS utility to send messages to SQS</p>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#createFormData">createFormData</a> ⇒ <code>FormData</code></dt>
<dd><p>Creates and populates a FormData object from key-value pairs.</p>
</dd>
<dt><a href="#getGroupMembersEndpoint">getGroupMembersEndpoint</a> ⇒ <code>string</code></dt>
<dd><p>Generates the IMS groups endpoint URL.</p>
</dd>
<dt><a href="#getImsOrgsApiPath">getImsOrgsApiPath</a> ⇒ <code>string</code></dt>
<dd><p>Generates the IMS organizations endpoint URL.</p>
</dd>
<dt><a href="#extractIdAndAuthSource">extractIdAndAuthSource</a> ⇒ <code>Object</code></dt>
<dd><p>Extracts the orgId and authSource from the IMS Org ID.</p>
</dd>
<dt><a href="#emailAddressIsAllowed">emailAddressIsAllowed</a> ⇒ <code>boolean</code></dt>
<dd><p>Validates whether the given email address is allowed.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#createClient">createClient(log, dbClient, docClient)</a> ⇒ <code>Object</code></dt>
<dd><p>Creates a client object for interacting with DynamoDB.</p>
</dd>
<dt><a href="#createResponse">createResponse(body, [status], [headers])</a> ⇒ <code>Response</code></dt>
<dd><p>Creates a response with a JSON body if the content-type is JSON. Defaults to 200 status.
If a header is already defined and has a different content-type, it is handled accordingly.</p>
</dd>
<dt><a href="#isArray">isArray(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Determines if the given parameter is an array.</p>
</dd>
<dt><a href="#isBoolean">isBoolean(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Determines case-insensitively if the given value is a boolean or a string
representation of a boolean.</p>
</dd>
<dt><a href="#isInteger">isInteger(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks if the given value is an integer.</p>
</dd>
<dt><a href="#isNumber">isNumber(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Determines if the given value is a number.</p>
</dd>
<dt><a href="#isObject">isObject(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks if the given parameter is an object and not an array or null.</p>
</dd>
<dt><a href="#isNonEmptyObject">isNonEmptyObject(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks if the given value is an object and contains properties of its own.</p>
</dd>
<dt><a href="#deepEqual">deepEqual(x, y)</a> ⇒ <code>boolean</code></dt>
<dd><p>Deeply compares two objects or arrays for equality. Supports nested objects and arrays.
Does not support circular references. Does not compare functions.</p>
</dd>
<dt><a href="#isString">isString(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Determines if the given parameter is a string.</p>
</dd>
<dt><a href="#hasText">hasText(str)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks if the given string is not empty.</p>
</dd>
<dt><a href="#isValidDate">isValidDate(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks whether the given object is a valid JavaScript Date.</p>
</dd>
<dt><a href="#isIsoDate">isIsoDate(str)</a> ⇒ <code>boolean</code></dt>
<dd><p>Validates whether the given string is a JavaScript ISO date string in
Zulu (UTC) timezone. Used for persisting system dates, which must be
independent of any user timezone.</p>
</dd>
<dt><a href="#isIsoTimeOffsetsDate">isIsoTimeOffsetsDate(str)</a> ⇒ <code>boolean</code></dt>
<dd><p>Validates whether the given string is a JavaScript ISO date string
following UTC time offsets format.</p>
</dd>
<dt><a href="#isValidUrl">isValidUrl(urlString)</a> ⇒ <code>boolean</code></dt>
<dd><p>Validates whether the given string is a valid URL with http or https protocol.</p>
</dd>
<dt><a href="#toBoolean">toBoolean(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Converts a given value to a boolean. Throws an error if the value is not a boolean.</p>
</dd>
<dt><a href="#arrayEquals">arrayEquals(a, b)</a> ⇒ <code>boolean</code></dt>
<dd><p>Compares two arrays for equality. Supports primitive array item types only.</p>
</dd>
<dt><a href="#dateAfterDays">dateAfterDays(days, [dateString])</a> ⇒ <code>Date</code></dt>
<dd><p>Calculates the date after a specified number of days from the current date.</p>
</dd>
<dt><a href="#resolveSecretsName">resolveSecretsName(opts, ctx, defaultPath)</a> ⇒ <code>string</code></dt>
<dd><p>Resolves the name of the secret based on the function version.</p>
</dd>
<dt><a href="#resolveCustomerSecretsName">resolveCustomerSecretsName(baseURL, ctx)</a> ⇒ <code>string</code></dt>
<dd><p>Resolves the name of the customer secrets based on the baseURL.</p>
</dd>
<dt><a href="#getRUMDomainKey">getRUMDomainKey(baseURL, context)</a> ⇒ <code>Promise.&lt;string&gt;</code></dt>
<dd><p>Retrieves the RUM domain key for the specified base URL from the customer secrets.</p>
</dd>
<dt><a href="#generateCSVFile">generateCSVFile(data)</a> ⇒ <code>Buffer</code></dt>
<dd><p>Generates a CSV file from the provided JSON data.</p>
<p>Each key-value pair in the JSON objects
corresponds to a column and its value in the CSV. The output is a UTF-8
encoded Buffer that represents the CSV file content.</p>
</dd>
<dt><a href="#logWrapper">logWrapper(fn)</a> ⇒ <code>function</code></dt>
<dd><p>A higher-order function that wraps a given function and enhances logging by appending
a <code>jobId</code> to log messages when available. This improves traceability of logs associated
with specific jobs or processes.</p>
<p>The wrapper checks if a <code>log</code> object exists in the <code>context</code> and whether the <code>message</code>
contains a <code>jobId</code>. If found, log methods (e.g., <code>info</code>, <code>error</code>, etc.) will prepend the
<code>jobId</code> to all log statements where <code>context.contextualLog</code> is used. If no <code>jobId</code> is found,
logging will remain unchanged.</p>
</dd>
<dt><a href="#s3Wrapper">s3Wrapper(fn)</a> ⇒ <code>function</code></dt>
<dd><p>Adds an S3Client instance and bucket to the context.</p>
</dd>
<dt><a href="#SQS.">SQS.(queueUrl)</a> ⇒ <code>boolean</code></dt>
<dd><p>Check if the queue is a FIFO queue by examining its URL.</p>
</dd>
<dt><a href="#sqsEventAdapter">sqsEventAdapter(fn)</a> ⇒ <code>function</code></dt>
<dd><p>Wrapper to turn an SQS record into a function param
Inspired by <a href="https://github.com/adobe/helix-admin/blob/main/src/index.js#L108-L133">https://github.com/adobe/helix-admin/blob/main/src/index.js#L108-L133</a></p>
</dd>
<dt><a href="#createSubsegment">createSubsegment(parentSegment, hostname)</a> ⇒ <code>Object</code></dt>
<dd><p>Creates a subsegment for a given hostname based on whether the parent segment is traced or not.</p>
</dd>
<dt><a href="#setTraceHeaders">setTraceHeaders(request, parentSegment, subSegment)</a></dt>
<dd><p>Sets the AWS X-Ray trace headers on the request object.</p>
</dd>
<dt><a href="#setSubSegmentFlagsByStatusCode">setSubSegmentFlagsByStatusCode(subSegment, status)</a></dt>
<dd><p>Adds flags to the given subsegment based on the status code of the response.</p>
</dd>
<dt><a href="#addFetchRequestDataToSegment">addFetchRequestDataToSegment(segment, request, [response])</a></dt>
<dd><p>Adds request and response data to the given segment for AWS X-Ray tracing.</p>
</dd>
<dt><a href="#handleSubSegmentError">handleSubSegmentError(subSegment, request, error)</a></dt>
<dd><p>Adds error data to the given segment for AWS X-Ray tracing.</p>
</dd>
<dt><a href="#tracingFetch">tracingFetch(url, options)</a> ⇒ <code>Promise.&lt;Response&gt;</code></dt>
<dd><p>Performs a fetch request and adds AWS X-Ray tracing, including request/response tracking.</p>
</dd>
<dt><a href="#prependSchema">prependSchema(url)</a> ⇒ <code>string</code></dt>
<dd><p>Prepends &#39;https://&#39; schema to the URL if it&#39;s not already present.</p>
</dd>
<dt><a href="#stripPort">stripPort(url)</a> ⇒ <code>string</code></dt>
<dd><p>Strips the port number from the end of the URL.</p>
</dd>
<dt><a href="#stripTrailingDot">stripTrailingDot(url)</a> ⇒ <code>string</code></dt>
<dd><p>Strips the trailing dot from the end of the URL.</p>
</dd>
<dt><a href="#stripTrailingSlash">stripTrailingSlash(url)</a> ⇒ <code>string</code></dt>
<dd><p>Strips the trailing slash from the end of the URL if the path is &#39;/&#39;.</p>
</dd>
<dt><a href="#stripWWW">stripWWW(url)</a> ⇒ <code>string</code></dt>
<dd><p>Strips &#39;www.&#39; from the beginning of the URL if present.</p>
</dd>
<dt><a href="#composeBaseURL">composeBaseURL(domain)</a> ⇒ <code>string</code></dt>
<dd><p>Composes a base URL by applying a series of transformations to the given domain.</p>
</dd>
<dt><a href="#computeCPCMetrics">computeCPCMetrics(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Computes CPC and related metrics from organic traffic and RUM data.</p>
</dd>
</dl>

<a name="SQS"></a>

## SQS
SQS utility to send messages to SQS

**Kind**: global class  

* [SQS](#SQS)
    * [new SQS(region, log)](#new_SQS_new)
    * [.sendMessage(queueUrl, message, messageGroupId)](#SQS+sendMessage) ⇒ <code>Promise.&lt;void&gt;</code>

<a name="new_SQS_new"></a>

### new SQS(region, log)

| Param | Type | Description |
| --- | --- | --- |
| region | <code>string</code> | AWS region |
| log | <code>object</code> | log object |

<a name="SQS+sendMessage"></a>

### sqS.sendMessage(queueUrl, message, messageGroupId) ⇒ <code>Promise.&lt;void&gt;</code>
Send a message to an SQS queue. For FIFO queues, messageGroupId is required.

**Kind**: instance method of [<code>SQS</code>](#SQS)  

| Param | Type | Description |
| --- | --- | --- |
| queueUrl | <code>string</code> | The URL of the SQS queue. |
| message | <code>object</code> | The message body to send. |
| messageGroupId | <code>string</code> | (Optional) The message group ID for FIFO queues. |

<a name="createFormData"></a>

## createFormData ⇒ <code>FormData</code>
Creates and populates a FormData object from key-value pairs.

**Kind**: global constant  
**Returns**: <code>FormData</code> - A populated FormData object.  

| Param | Type | Description |
| --- | --- | --- |
| fields | <code>Object</code> | Object containing key-value pairs to append to FormData. |

<a name="getGroupMembersEndpoint"></a>

## getGroupMembersEndpoint ⇒ <code>string</code>
Generates the IMS groups endpoint URL.

**Kind**: global constant  
**Returns**: <code>string</code> - `/ims/organizations/$/groups/${string}/members` - The IMS groups endpoint URL.  

| Param | Type | Description |
| --- | --- | --- |
| imsOrgId | <code>string</code> | The IMS host. |
| groupId | <code>string</code> | The IMS client ID. |

<a name="getImsOrgsApiPath"></a>

## getImsOrgsApiPath ⇒ <code>string</code>
Generates the IMS organizations endpoint URL.

**Kind**: global constant  
**Returns**: <code>string</code> - `/ims/organizations/$/v2` - The IMS organizations endpoint URL.  

| Param | Type | Description |
| --- | --- | --- |
| imsOrgId | <code>string</code> | The IMS host. |

<a name="extractIdAndAuthSource"></a>

## extractIdAndAuthSource ⇒ <code>Object</code>
Extracts the orgId and authSource from the IMS Org ID.

**Kind**: global constant  
**Returns**: <code>Object</code> - - The orgId and authSource.  

| Param | Type | Description |
| --- | --- | --- |
| imsOrgId | <code>string</code> | The IMS Org ID. |

<a name="emailAddressIsAllowed"></a>

## emailAddressIsAllowed ⇒ <code>boolean</code>
Validates whether the given email address is allowed.

**Kind**: global constant  
**Returns**: <code>boolean</code> - - True if the email address is allowed, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| email | <code>string</code> | The email address to validate. |

<a name="createClient"></a>

## createClient(log, dbClient, docClient) ⇒ <code>Object</code>
Creates a client object for interacting with DynamoDB.

**Kind**: global function  
**Returns**: <code>Object</code> - A client object with methods to interact with DynamoDB.  

| Param | Type | Description |
| --- | --- | --- |
| log | <code>Object</code> | The logging object, defaults to console. |
| dbClient | <code>DynamoDB</code> | The AWS SDK DynamoDB client instance. |
| docClient | <code>DynamoDBDocument</code> | The AWS SDK DynamoDB Document client instance. |

<a name="createResponse"></a>

## createResponse(body, [status], [headers]) ⇒ <code>Response</code>
Creates a response with a JSON body if the content-type is JSON. Defaults to 200 status.
If a header is already defined and has a different content-type, it is handled accordingly.

**Kind**: global function  
**Returns**: <code>Response</code> - Response.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| body | <code>object</code> |  | Response body. |
| [status] | <code>number</code> | <code>200</code> | Optional status code. |
| [headers] | <code>object</code> | <code>{}</code> | Optional headers. |

<a name="isArray"></a>

## isArray(value) ⇒ <code>boolean</code>
Determines if the given parameter is an array.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the parameter is an array, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | The value to check. |

<a name="isBoolean"></a>

## isBoolean(value) ⇒ <code>boolean</code>
Determines case-insensitively if the given value is a boolean or a string
representation of a boolean.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the value is a boolean or a string representation of a boolean.  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | The value to check. |

<a name="isInteger"></a>

## isInteger(value) ⇒ <code>boolean</code>
Checks if the given value is an integer.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the value is an integer, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | The value to check. |

<a name="isNumber"></a>

## isNumber(value) ⇒ <code>boolean</code>
Determines if the given value is a number.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the value is a finite number, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | The value to check. |

<a name="isObject"></a>

## isObject(value) ⇒ <code>boolean</code>
Checks if the given parameter is an object and not an array or null.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the parameter is an object, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | The value to check. |

<a name="isNonEmptyObject"></a>

## isNonEmptyObject(value) ⇒ <code>boolean</code>
Checks if the given value is an object and contains properties of its own.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the value is a non-empty object, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | The value to check. |

<a name="deepEqual"></a>

## deepEqual(x, y) ⇒ <code>boolean</code>
Deeply compares two objects or arrays for equality. Supports nested objects and arrays.
Does not support circular references. Does not compare functions.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the objects or arrays are equal, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| x | <code>unknown</code> | The first object or array to compare. |
| y | <code>unknown</code> | The second object or array to compare. |

<a name="isString"></a>

## isString(value) ⇒ <code>boolean</code>
Determines if the given parameter is a string.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the parameter is a string, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | The value to check. |

<a name="hasText"></a>

## hasText(str) ⇒ <code>boolean</code>
Checks if the given string is not empty.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the string is not empty, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>\*</code> | The string to check. |

<a name="isValidDate"></a>

## isValidDate(value) ⇒ <code>boolean</code>
Checks whether the given object is a valid JavaScript Date.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the given object is a valid Date object, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | The value to check. |

<a name="isIsoDate"></a>

## isIsoDate(str) ⇒ <code>boolean</code>
Validates whether the given string is a JavaScript ISO date string in
Zulu (UTC) timezone. Used for persisting system dates, which must be
independent of any user timezone.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the given string validates successfully.  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | The string to validate. |

<a name="isIsoTimeOffsetsDate"></a>

## isIsoTimeOffsetsDate(str) ⇒ <code>boolean</code>
Validates whether the given string is a JavaScript ISO date string
following UTC time offsets format.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the given string validates successfully.  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | The string to validate. |

<a name="isValidUrl"></a>

## isValidUrl(urlString) ⇒ <code>boolean</code>
Validates whether the given string is a valid URL with http or https protocol.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the given string validates successfully.  

| Param | Type | Description |
| --- | --- | --- |
| urlString | <code>string</code> | The string to validate. |

<a name="toBoolean"></a>

## toBoolean(value) ⇒ <code>boolean</code>
Converts a given value to a boolean. Throws an error if the value is not a boolean.

**Kind**: global function  
**Returns**: <code>boolean</code> - The converted boolean value.  
**Throws**:

- <code>Error</code> If the value is not a boolean or a boolean-like string.


| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | The value to convert. |

<a name="arrayEquals"></a>

## arrayEquals(a, b) ⇒ <code>boolean</code>
Compares two arrays for equality. Supports primitive array item types only.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the arrays are equal, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| a | <code>Array</code> | The first array to compare. |
| b | <code>Array</code> | The second array to compare. |

<a name="dateAfterDays"></a>

## dateAfterDays(days, [dateString]) ⇒ <code>Date</code>
Calculates the date after a specified number of days from the current date.

**Kind**: global function  
**Returns**: <code>Date</code> - A new Date object representing the calculated date after the specified days.  
**Throws**:

- <code>TypeError</code> If the provided 'days' parameter is not a number.
- <code>RangeError</code> If the calculated date is outside the valid JavaScript date range.


| Param | Type | Description |
| --- | --- | --- |
| days | <code>number</code> | The number of days to add to the current date. |
| [dateString] | <code>string</code> | The reference date in string format. |

**Example**  
```js
// Get the date 7 days from now
const sevenDaysLater = dateAfterDays(7);
console.log(sevenDaysLater); // Outputs a Date object representing the date 7 days from now
```
<a name="resolveSecretsName"></a>

## resolveSecretsName(opts, ctx, defaultPath) ⇒ <code>string</code>
Resolves the name of the secret based on the function version.

**Kind**: global function  
**Returns**: <code>string</code> - - The resolved secret name.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>Object</code> | The options object, not used in this implementation. |
| ctx | <code>Object</code> | The context object containing the function version. |
| defaultPath | <code>string</code> | The default path for the secret. |

<a name="resolveCustomerSecretsName"></a>

## resolveCustomerSecretsName(baseURL, ctx) ⇒ <code>string</code>
Resolves the name of the customer secrets based on the baseURL.

**Kind**: global function  
**Returns**: <code>string</code> - - The resolved secret name.  

| Param | Type | Description |
| --- | --- | --- |
| baseURL | <code>string</code> | The base URL to resolve the customer secrets name from. |
| ctx | <code>Object</code> | The context object containing the function version. |

<a name="getRUMDomainKey"></a>

## getRUMDomainKey(baseURL, context) ⇒ <code>Promise.&lt;string&gt;</code>
Retrieves the RUM domain key for the specified base URL from the customer secrets.

**Kind**: global function  
**Returns**: <code>Promise.&lt;string&gt;</code> - - A promise that resolves to the RUM domain key.  
**Throws**:

- <code>Error</code> Throws an error if no domain key is found for the specified base URL.


| Param | Type | Description |
| --- | --- | --- |
| baseURL | <code>string</code> | The base URL for which the RUM domain key is to be retrieved. |
| context | <code>UniversalContext</code> | Helix Universal Context. See https://github.com/adobe/helix-universal/blob/main/src/adapter.d.ts#L120 |

<a name="generateCSVFile"></a>

## generateCSVFile(data) ⇒ <code>Buffer</code>
Generates a CSV file from the provided JSON data.

Each key-value pair in the JSON objects
corresponds to a column and its value in the CSV. The output is a UTF-8
encoded Buffer that represents the CSV file content.

**Kind**: global function  
**Returns**: <code>Buffer</code> - A Buffer containing the CSV formatted data, encoded in UTF-8.  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Array.&lt;Object&gt;</code> | An array of JSON objects to be converted into CSV format. |

<a name="logWrapper"></a>

## logWrapper(fn) ⇒ <code>function</code>
A higher-order function that wraps a given function and enhances logging by appending
a `jobId` to log messages when available. This improves traceability of logs associated
with specific jobs or processes.

The wrapper checks if a `log` object exists in the `context` and whether the `message`
contains a `jobId`. If found, log methods (e.g., `info`, `error`, etc.) will prepend the
`jobId` to all log statements where `context.contextualLog` is used. If no `jobId` is found,
logging will remain unchanged.

**Kind**: global function  
**Returns**: <code>function</code> - - A wrapped function that enhances
logging and returns the result of the original function.

`context.contextualLog` will include logging methods with `jobId` prefixed, or fall back
to the existing `log` object if no `jobId` is provided.  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | The original function to be wrapped, called with the provided message and context after logging enhancement. |

<a name="s3Wrapper"></a>

## s3Wrapper(fn) ⇒ <code>function</code>
Adds an S3Client instance and bucket to the context.

**Kind**: global function  

| Param | Type |
| --- | --- |
| fn | <code>UniversalAction</code> | 

<a name="SQS."></a>

## SQS.(queueUrl) ⇒ <code>boolean</code>
Check if the queue is a FIFO queue by examining its URL.

**Kind**: global function  
**Returns**: <code>boolean</code> - true if the queue is a FIFO queue, false otherwise  

| Param | Type | Description |
| --- | --- | --- |
| queueUrl | <code>string</code> | the URL of the SQS queue |

<a name="sqsEventAdapter"></a>

## sqsEventAdapter(fn) ⇒ <code>function</code>
Wrapper to turn an SQS record into a function param
Inspired by https://github.com/adobe/helix-admin/blob/main/src/index.js#L108-L133

**Kind**: global function  

| Param | Type |
| --- | --- |
| fn | <code>UniversalAction</code> | 

<a name="createSubsegment"></a>

## createSubsegment(parentSegment, hostname) ⇒ <code>Object</code>
Creates a subsegment for a given hostname based on whether the parent segment is traced or not.

**Kind**: global function  
**Returns**: <code>Object</code> - The created subsegment.  

| Param | Type | Description |
| --- | --- | --- |
| parentSegment | <code>Object</code> | The parent X-Ray segment. |
| hostname | <code>string</code> | The hostname to associate with the subsegment. |

<a name="setTraceHeaders"></a>

## setTraceHeaders(request, parentSegment, subSegment)
Sets the AWS X-Ray trace headers on the request object.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>Request</code> | The request object on which headers are set. |
| parentSegment | <code>Object</code> | The parent X-Ray segment. |
| subSegment | <code>Object</code> | The subsegment to include in the headers. |

<a name="setSubSegmentFlagsByStatusCode"></a>

## setSubSegmentFlagsByStatusCode(subSegment, status)
Adds flags to the given subsegment based on the status code of the response.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| subSegment | <code>Object</code> | The X-Ray subsegment to which flags are added. |
| status | <code>number</code> | The status code of the response. |

<a name="addFetchRequestDataToSegment"></a>

## addFetchRequestDataToSegment(segment, request, [response])
Adds request and response data to the given segment for AWS X-Ray tracing.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| segment | <code>Object</code> | The X-Ray segment to which request and response data are added. |
| request | <code>Request</code> | The original request object. |
| [response] | <code>Response</code> | The response object (if available). |

<a name="handleSubSegmentError"></a>

## handleSubSegmentError(subSegment, request, error)
Adds error data to the given segment for AWS X-Ray tracing.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| subSegment | <code>Object</code> | The X-Ray subsegment to which error data is added. |
| request | <code>Request</code> | The original request object. |
| error | <code>Error</code> | The error object. |

<a name="tracingFetch"></a>

## tracingFetch(url, options) ⇒ <code>Promise.&lt;Response&gt;</code>
Performs a fetch request and adds AWS X-Ray tracing, including request/response tracking.

**Kind**: global function  
**Returns**: <code>Promise.&lt;Response&gt;</code> - The response from the fetch request.  

| Param | Type | Description |
| --- | --- | --- |
| url | <code>string</code> | The URL for the request. |
| options | <code>Object</code> | Options to be passed to the fetch call. |

<a name="prependSchema"></a>

## prependSchema(url) ⇒ <code>string</code>
Prepends 'https://' schema to the URL if it's not already present.

**Kind**: global function  
**Returns**: <code>string</code> - - The URL with 'https://' schema prepended.  

| Param | Type | Description |
| --- | --- | --- |
| url | <code>string</code> | The URL to modify. |

<a name="stripPort"></a>

## stripPort(url) ⇒ <code>string</code>
Strips the port number from the end of the URL.

**Kind**: global function  
**Returns**: <code>string</code> - - The URL with the port removed.  

| Param | Type | Description |
| --- | --- | --- |
| url | <code>string</code> | The URL to modify. |

<a name="stripTrailingDot"></a>

## stripTrailingDot(url) ⇒ <code>string</code>
Strips the trailing dot from the end of the URL.

**Kind**: global function  
**Returns**: <code>string</code> - - The URL with the trailing dot removed.  

| Param | Type | Description |
| --- | --- | --- |
| url | <code>string</code> | The URL to modify. |

<a name="stripTrailingSlash"></a>

## stripTrailingSlash(url) ⇒ <code>string</code>
Strips the trailing slash from the end of the URL if the path is '/'.

**Kind**: global function  
**Returns**: <code>string</code> - - The URL with the trailing slash removed.  

| Param | Type | Description |
| --- | --- | --- |
| url | <code>string</code> | The URL to modify. |

<a name="stripWWW"></a>

## stripWWW(url) ⇒ <code>string</code>
Strips 'www.' from the beginning of the URL if present.

**Kind**: global function  
**Returns**: <code>string</code> - - The URL with 'www.' removed.  

| Param | Type | Description |
| --- | --- | --- |
| url | <code>string</code> | The URL to modify. |

<a name="composeBaseURL"></a>

## composeBaseURL(domain) ⇒ <code>string</code>
Composes a base URL by applying a series of transformations to the given domain.

**Kind**: global function  
**Returns**: <code>string</code> - - The composed base URL.  

| Param | Type | Description |
| --- | --- | --- |
| domain | <code>string</code> | The domain to compose the base URL from. |

<a name="computeCPCMetrics"></a>

## computeCPCMetrics(params) ⇒ <code>Object</code>
Computes CPC and related metrics from organic traffic and RUM data.

**Kind**: global function  
**Returns**: <code>Object</code> - An object with pageViewsChange, ctrChange, projectedTrafficValue, and cpc.  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | The input parameters. |
| params.current | <code>Object</code> | Current RUM metrics ({ totalPageViews, totalClicks, totalCTR }) |
| params.total | <code>Object</code> | Total RUM metrics for a longer period ({ totalPageViews, totalClicks, totalCTR }) |
| params.organicTraffic | <code>Array</code> | Array of organic traffic metrics ({ cost, value }) |

