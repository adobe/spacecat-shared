## Functions

<dl>
<dt><a href="#createClient">createClient(log, dbClient, docClient)</a> ⇒ <code>Object</code></dt>
<dd><p>Creates a client object for interacting with DynamoDB.</p>
</dd>
<dt><a href="#createResponse">createResponse(body, status, headers)</a> ⇒ <code>Response</code></dt>
<dd><p>Creates a response with a JSON body. Defaults to 200 status.</p>
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
<dt><a href="#dateAfterDays">dateAfterDays(days)</a> ⇒ <code>Date</code></dt>
<dd><p>Calculates the date after a specified number of days from the current date.</p>
</dd>
<dt><a href="#resolveSecretsName">resolveSecretsName(opts, ctx, defaultPath)</a> ⇒ <code>string</code></dt>
<dd><p>Resolves the name of the secret based on the function version.</p>
</dd>
</dl>

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

## createResponse(body, status, headers) ⇒ <code>Response</code>
Creates a response with a JSON body. Defaults to 200 status.

**Kind**: global function  
**Returns**: <code>Response</code> - Response.  

| Param | Type | Description |
| --- | --- | --- |
| body | <code>object</code> | JSON body. |
| status | <code>number</code> | Optional status code. |
| headers | <code>object</code> | Optional headers. |

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

## dateAfterDays(days) ⇒ <code>Date</code>
Calculates the date after a specified number of days from the current date.

**Kind**: global function  
**Returns**: <code>Date</code> - A new Date object representing the calculated date after the specified days.  
**Throws**:

- <code>TypeError</code> If the provided 'days' parameter is not a number.
- <code>RangeError</code> If the calculated date is outside the valid JavaScript date range.


| Param | Type | Description |
| --- | --- | --- |
| days | <code>number</code> | The number of days to add to the current date. |

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

