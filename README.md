# Node-SQLite

__Node-SQLite__

Node-SQLite is a very simplistic abstraction layer for the sqlite3 shell application. While full integration using something like
node-sqlite3 is usually preferable, there are cases when a simple, portable solution is a safer choice. Node-SQLite requires nothing
but the plain node.exe and sqlite3.exe files. No NPM, nothing. Just these two EXE files.

__Limitations__

- Error reporting is a bit broken. SQL errors are therefore reported directly to console.error.
- Handling of character \u0000 is broken in sqlite3.exe, so Node-SQLite replaces it with \u0020 automatically.
- Characters \u0003 and \u0004 are used as delimiters for sqlite3.exe output,so any statements will have them replaced with \u0020 automatically.
- This applies to binary data as well. (sqlite3.exe simply doesn't contain any methods for outputting blobs in an encoded form)

__Usage__

Just drop node.exe and sqlite into a directory named BIN (or change the path in SQLite.js).

Create your JS file (for example main.js). Put SQLite.js somewhere and reference it via

    const SQLite = require('./SQLite.js');

When opening a database you can specifiy a filename, options for creating tables and a callback to be run after all tables have been created.

    var testdb=new SQLite('.\\db\\test.sqlite',[
        {name:"FOO",columns:"X int,LABEL varchar[64]"},
        {name:"BAR",columns:"X int,LABEL varchar[64]"}
    ],function(){
        //Your code
    });
    
Executing SQL is done via instance.sql, which returns an array of objects where each property corresponds to the column name.

    testdb.sql("SELECT COUNT(*) AS COUNT FROM FOO",function(data){
        console.log(JSON.stringify(data,null,"\t"));
    }.bind(this));

Open a shell and start Node

    CD \directory
    bin\node.exe main.js

