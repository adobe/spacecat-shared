## Functions

<dl>
<dt><a href="#createClient">createClient(log, dbClient, docClient)</a> ⇒ <code>Object</code></dt>
<dd><p>Creates a client object for interacting with DynamoDB.</p>
</dd>
<dt><a href="#query">query(originalParams)</a> ⇒ <code>Promise.&lt;Array&gt;</code></dt>
<dd><p>Queries DynamoDB and automatically handles pagination to retrieve all items.</p>
</dd>
<dt><a href="#getItem">getItem(tableName, partitionKey, [sortKey])</a> ⇒ <code>Promise.&lt;Object&gt;</code></dt>
<dd><p>Retrieves an item from DynamoDB using a table name and key.</p>
</dd>
<dt><a href="#putItem">putItem(tableName, item)</a> ⇒ <code>Promise.&lt;Object&gt;</code></dt>
<dd><p>Inserts or updates an item in a DynamoDB table.</p>
</dd>
<dt><a href="#removeItem">removeItem(tableName, partitionKey, [sortKey])</a> ⇒ <code>Promise.&lt;Object&gt;</code></dt>
<dd><p>Removes an item from a DynamoDB table.</p>
</dd>
<dt><a href="#isBoolean">isBoolean(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Determines if the given value is a boolean or a string representation of a boolean.</p>
</dd>
<dt><a href="#isInteger">isInteger(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks if the given value is an integer.</p>
</dd>
<dt><a href="#isNumber">isNumber(value)</a> ⇒ <code>boolean</code></dt>
<dd><p>Determines if the given value is a number.</p>
</dd>
<dt><a href="#isObject">isObject(obj)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks if the given parameter is an object and not an array or null.</p>
</dd>
<dt><a href="#isString">isString(str)</a> ⇒ <code>boolean</code></dt>
<dd><p>Determines if the given parameter is a string.</p>
</dd>
<dt><a href="#hasText">hasText(str)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks if the given string is not empty.</p>
</dd>
<dt><a href="#isValidDate">isValidDate(obj)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks whether the given object is a valid JavaScript Date.</p>
</dd>
<dt><a href="#isIsoDate">isIsoDate(str)</a> ⇒ <code>boolean</code></dt>
<dd><p>Validates whether the given string is a JavaScript ISO date string in
Zulu (UTC) timezone. Used for persisting system dates, which must be independent of any user timezone.</p>
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
<dd><p>Compares two arrays for equality.</p>
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
| docClient | <code>DynamoDBDocumentClient</code> | The AWS SDK DynamoDB Document client instance. |

<a name="query"></a>

## query(originalParams) ⇒ <code>Promise.&lt;Array&gt;</code>
Queries DynamoDB and automatically handles pagination to retrieve all items.

**Kind**: global function  
**Returns**: <code>Promise.&lt;Array&gt;</code> - A promise that resolves to an array of items retrieved from DynamoDB.  
**Throws**:

- <code>Error</code> Throws an error if the DynamoDB query operation fails.


| Param | Type | Description |
| --- | --- | --- |
| originalParams | <code>Object</code> | The parameters for the DynamoDB query. |

<a name="getItem"></a>

## getItem(tableName, partitionKey, [sortKey]) ⇒ <code>Promise.&lt;Object&gt;</code>
Retrieves an item from DynamoDB using a table name and key.

**Kind**: global function  
**Returns**: <code>Promise.&lt;Object&gt;</code> - A promise that resolves to the retrieved item.  
**Throws**:

- <code>Error</code> Throws an error if the DynamoDB get operation fails.


| Param | Type | Description |
| --- | --- | --- |
| tableName | <code>string</code> | The name of the DynamoDB table. |
| partitionKey | <code>string</code> | The partition key of the item to retrieve. |
| [sortKey] | <code>string</code> | The sort key of the item to retrieve, if applicable. |

<a name="putItem"></a>

## putItem(tableName, item) ⇒ <code>Promise.&lt;Object&gt;</code>
Inserts or updates an item in a DynamoDB table.

**Kind**: global function  
**Returns**: <code>Promise.&lt;Object&gt;</code> - A promise that resolves to a message indicating success.  
**Throws**:

- <code>Error</code> Throws an error if the DynamoDB put operation fails.


| Param | Type | Description |
| --- | --- | --- |
| tableName | <code>string</code> | The name of the DynamoDB table. |
| item | <code>Object</code> | The item to insert or update in the table. |

<a name="removeItem"></a>

## removeItem(tableName, partitionKey, [sortKey]) ⇒ <code>Promise.&lt;Object&gt;</code>
Removes an item from a DynamoDB table.

**Kind**: global function  
**Returns**: <code>Promise.&lt;Object&gt;</code> - A promise that resolves to a message indicating successful removal.  
**Throws**:

- <code>Error</code> Throws an error if the DynamoDB delete operation fails.


| Param | Type | Description |
| --- | --- | --- |
| tableName | <code>string</code> | The name of the DynamoDB table. |
| partitionKey | <code>string</code> | The partition key of the item to remove. |
| [sortKey] | <code>string</code> | The sort key of the item to remove, if applicable. |

<a name="isBoolean"></a>

## isBoolean(value) ⇒ <code>boolean</code>
Determines if the given value is a boolean or a string representation of a boolean.

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

## isObject(obj) ⇒ <code>boolean</code>
Checks if the given parameter is an object and not an array or null.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the parameter is an object, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| obj | <code>\*</code> | The object to check. |

<a name="isString"></a>

## isString(str) ⇒ <code>boolean</code>
Determines if the given parameter is a string.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the parameter is a string, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>\*</code> | The string to check. |

<a name="hasText"></a>

## hasText(str) ⇒ <code>boolean</code>
Checks if the given string is not empty.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the string is not empty, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>\*</code> | The string to check. |

<a name="isValidDate"></a>

## isValidDate(obj) ⇒ <code>boolean</code>
Checks whether the given object is a valid JavaScript Date.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the given object is a valid Date object, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| obj | <code>\*</code> | The object to check. |

<a name="isIsoDate"></a>

## isIsoDate(str) ⇒ <code>boolean</code>
Validates whether the given string is a JavaScript ISO date string in
Zulu (UTC) timezone. Used for persisting system dates, which must be independent of any user timezone.

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
Compares two arrays for equality.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the arrays are equal, false otherwise.  

| Param | Type | Description |
| --- | --- | --- |
| a | <code>Array</code> | The first array to compare. |
| b | <code>Array</code> | The second array to compare. |

