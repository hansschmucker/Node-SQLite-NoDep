<a name="SQLite"></a>
## SQLite : <code>[SQLite](#SQLite)</code>
**Kind**: global class  

* [SQLite](#SQLite) : <code>[SQLite](#SQLite)</code>
    * [new SQLite(databaseFilename, tableCreateArray, onReady)](#new_SQLite_new)
    * [.debug](#SQLite+debug) : <code>number</code>
    * [.onOpenComplete](#SQLite+onOpenComplete) : <code>function</code>
    * [.tables](#SQLite+tables) : <code>Array.&lt;Object&gt;</code>
    * [.close()](#SQLite+close)
    * [.resolveBind(q, params)](#SQLite+resolveBind) ⇒ <code>string</code>
    * [.sql(q, callbackOrParametersObject, [callbackIfParameters])](#SQLite+sql)
    * [.createTable(name, columns, callback)](#SQLite+createTable)
    * [.createTables(tablesArray, callback)](#SQLite+createTables)

<a name="new_SQLite_new"></a>
### new SQLite(databaseFilename, tableCreateArray, onReady)
Creates and manages an sqlite3 instance.


| Param | Type | Description |
| --- | --- | --- |
| databaseFilename | <code>string</code> | The file name of the SQLITE database file to be used. |
| tableCreateArray | <code>Array.&lt;Object&gt;</code> | An array containing the name and SQL create string describing each column |
| tableCreateArray[].name | <code>string</code> | Name of the column |
| tableCreateArray[].columns | <code>string</code> | SQL describing the content of the row |
| onReady | <code>function</code> | Called after the tables have been created. |

<a name="SQLite+debug"></a>
### sqLite.debug : <code>number</code>
Specifies how much will be output to the console. 0 means no output, 3 means verbose output.

**Kind**: instance property of <code>[SQLite](#SQLite)</code>  
<a name="SQLite+onOpenComplete"></a>
### sqLite.onOpenComplete : <code>function</code>
Called after tables have been created.

**Kind**: instance property of <code>[SQLite](#SQLite)</code>  
<a name="SQLite+tables"></a>
### sqLite.tables : <code>Array.&lt;Object&gt;</code>
An array containing the name and SQL create string describing each column

**Kind**: instance property of <code>[SQLite](#SQLite)</code>  
<a name="SQLite+close"></a>
### sqLite.close()
Closes the SQLite3 process gracefully. The object can however be reused.

**Kind**: instance method of <code>[SQLite](#SQLite)</code>  
<a name="SQLite+resolveBind"></a>
### sqLite.resolveBind(q, params) ⇒ <code>string</code>
Injects values into a query string: ?id for identifier $id for string, #id for number, &id for binary.

**Kind**: instance method of <code>[SQLite](#SQLite)</code>  

| Param | Type |
| --- | --- |
| q | <code>string</code> | 
| params | <code>object</code> | 

<a name="SQLite+sql"></a>
### sqLite.sql(q, callbackOrParametersObject, [callbackIfParameters])
Runs the specified query and calls a callback when it completes. An optional object may be used to resolve bind parameters.

**Kind**: instance method of <code>[SQLite](#SQLite)</code>  

| Param | Type | Description |
| --- | --- | --- |
| q | <code>string</code> | Query |
| callbackOrParametersObject | <code>object</code> &#124; <code>function</code> | Either the callback or if the query string contains bind parameters, an object used to look up values |
| [callbackIfParameters] | <code>function</code> | Callback if bind paramters are used. |

<a name="SQLite+createTable"></a>
### sqLite.createTable(name, columns, callback)
Creates a table

**Kind**: instance method of <code>[SQLite](#SQLite)</code>  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | The name of the table |
| columns | <code>string</code> | A string containing the SQL Syntax for all columns |
| callback | <code>function</code> | Callback to be run upon completion. |

<a name="SQLite+createTables"></a>
### sqLite.createTables(tablesArray, callback)
Creates any number of tables and runs the specified callback upon completion.

**Kind**: instance method of <code>[SQLite](#SQLite)</code>  

| Param | Type | Description |
| --- | --- | --- |
| tablesArray | <code>Array.&lt;Object&gt;</code> | An array containing the name and SQL create string describing each column |
| tablesArray[].name | <code>string</code> | Name of the column |
| tablesArray[].columns | <code>string</code> | SQL describing the content of the row |
| callback | <code>function</code> |  |

