const child_process = require('child_process');

/**
 * Creates and manages an sqlite3 instance.
 *
 * @constructor
 * @type {SQLite}
 *
 * @param {string} databaseFilename The file name of the SQLITE database file to be used.
 * @param {Object[]} tableCreateArray An array containing the name and SQL create string describing each column
 * @param {string} tableCreateArray[].name Name of the column
 * @param {string} tableCreateArray[].columns SQL describing the content of the row
 * @param {function} onReady Called after the tables have been created.
 */
var SQLite = function(databaseFilename,tableCreateArray,onReady){
	this._sqlQueue = [];
	this._db_filename=databaseFilename;
	this.tables=tableCreateArray;
	this.onOpenComplete = onReady;
	this._open_child_process();
};

module.exports=SQLite;

/**
 * Specifies how much will be output to the console. 0 means no output, 3 means verbose output.
 * @type {number}
 */
SQLite.prototype.debug=0;
/**
 * Determines whether open is needed before the instance can be used again.
 * @type {boolean}
 * @private
 */
SQLite.prototype._isOpen=false;
/**
 * Called after tables have been created.
 * @type {function}
 */
SQLite.prototype.onOpenComplete=null;
/**
 * sqlite3 child process.
 * @type {child_process}
 * @private
 */
SQLite.prototype._child_process=null;
/**
 * Name of the SQLite database file.
 * @type {string}
 * @private
 */
SQLite.prototype._db_filename="";
/**
 * An array containing the name and SQL create string describing each column
 * @type {Object[]} tables
 * @type {string} tables[].name
 * @type {string} tables[].columns
 */
SQLite.prototype.tables=null;
/**
 * The callback that will be run once the current statement finishes.
 * @type {function}
 * @private
 */
SQLite.prototype._lastSqlCallback = null;

/**
 * Opens an sqlite3.exe child_process and sets it up.
 * @type {function}
 * @private
 */
SQLite.prototype._open_child_process = function(){
	if(this._isOpen)
		return;
	
	this._child_process = child_process.exec('.\\bin\\sqlite3.exe',[],{maxBuffer: 1024*1024*1024});
	this._isOpen = true;
	
	this._rawCmd(".open '"+this._db_filename+"'");
	this._rawCmd(".mode insert");
	this._rawCmd(".width 0");
	this._rawCmd(".binary on");
	this._rawCmd(".headers on");
	this._rawCmd(".changes on");
	
	this._child_process.on('close',this._handleClose.bind(this));
	this._child_process.stderr.on('data',this._handleStderr.bind(this));
	this._child_process.stdout.on('data',this._handleStdout.bind(this));
	this._child_process.stdout.on('end',this._handleStdout.bind(this));
	
	this.createTables(this.tables,this.onOpenComplete);
}

/**
 * Closes the SQLite3 process gracefully. The object can however be reused.
 */
SQLite.prototype.close = function(){
	if(!this._isOpen)
		return;
	
	this._rawCmd(".exit");
}

/**
 * An array containing the queued queries and their callbacks.
 * @type {Object[]} _sqlQueue
 * @type {string} _sqlQueue[].q
 * @type {function} _sqlQueue[].c
 * @private
 */
SQLite.prototype._sqlQueue = null;

/**
 * Injects values into a query string: ?id for identifier $id for string, #id for number, &id for binary.
 * @param {string} q
 * @param {object} params
 * @returns {string}
 */
SQLite.prototype.resolveBind = function(q,params){
	if(!params)
		return q;

		//Make sure that we only match OUTSIDE strings.
		//Find the following tokens ('(?:(?:'')*|[\s\S]*?[^'](?:'')*)')|("(?:(?:"")*|[\s\S]*?[^"](?:"")*)")|(\[(?:(?:\]\])*|[\s\S]*?[^\]](?:\]\])*)\]) and return them right back
		// Match the following tokens and replace them with data: (\?\w+)|(\#\w+)|(\$\w+)|(\&\w+)
		var parser=/('(?:(?:'')*|[\s\S]*?[^'](?:'')*)')|("(?:(?:"")*|[\s\S]*?[^"](?:"")*)")|(\[(?:(?:\]\])*|[\s\S]*?[^\]](?:\]\])*)\])|\?([a-z_][0-9a-z_]*)|\#([a-z_][0-9a-z_]*)|\$([a-z_][0-9a-z_]*)|\&([a-z_][0-9a-z_]*)/gi;
		if(this.debug>=3)
			console.log(q);
		q=q.replace(parser,function(match, singleQuote, doubleQuote, squareQuote, identParam,numParam,strParam,binParam){
				if(singleQuote || doubleQuote || squareQuote)
					return (singleQuote || doubleQuote || squareQuote);
				else if(identParam){
					if(typeof(params[identParam])!="string")
						throw("Bind identifier "+identParam+" parameter not string.");
					
					return '"'+params[identParam].replace(/"/g,'""')+'"';
				}else if(numParam){
					if(typeof(params[numParam])!="number")
						throw("Bind parameter "+numParam+" not number.");
					
					return params[numParam].toString();
				}else if(strParam){
					if(typeof(params[strParam])!="string" && !(params[strParam] instanceof Buffer))
						throw("Bind parameter "+strParam+" not string or Buffer.");
					
					return "'"+params[strParam].toString().replace(/'/g,"''")+"'";
				}else if(binParam){
					if(typeof(params[binParam])!="string" && !(params[binParam] instanceof Buffer))
						throw("Bind parameter "+binParam+" not string or Buffer.");
					
					if(params[binParam] instanceof Buffer)
						return "X'"+params[binParam].toString('hex').toUpperCase()+"'";
					else
						return "X'"+(new Buffer(params[binParam])).toString('hex').toUpperCase()+"'";
				}
		});
		
		return q;
};

/**
 * Runs the specified query and calls a callback when it completes. An optional object may be used to resolve bind parameters.
 * @param {string} q Query
 * @param {object|function} callbackOrParametersObject Either the callback or if the query string contains bind parameters, an object used to look up values
 * @param {function} [callbackIfParameters] Callback if bind paramters are used.
 */
SQLite.prototype.sql=function(q,callbackOrParametersObject,callbackIfParameters){
	this._open_child_process();
	if(typeof(callbackOrParametersObject)=="function"){
		
		if(this._lastSqlCallback){
			this._sqlQueue.push({q:q,c:callbackOrParametersObject});
		}else{
			this._lastSqlCallback = callbackOrParametersObject||true;
			this._rawCmd(q+";");
		}
	}else if(typeof(callbackOrParametersObject)=="object"){
		q=this.resolveBind(q,callbackOrParametersObject);
		
		if(this._lastSqlCallback){
			this._sqlQueue.push({q:q,c:callbackIfParameters});
		}else{
			this._lastSqlCallback = callbackIfParameters||true;
			this._rawCmd(q+";");
		}		
	}
}

/**
 * Passes any code directly to the sqlite3.exe instance.
 * @param {string} q The command to be run
 * @private
 */
SQLite.prototype._rawCmd=function(q){
	if(this.debug>=3)
		console.log("STDIN: "+q);
	/*
		This is ONLY for specific commands that are not SQL, like ".tables"
	*/
	this._open_child_process();
	
	this._child_process.stdin.write(q+"\r\n");
}

/**
 * Creates a table
 * @param {string} name The name of the table
 * @param {string}columns A string containing the SQL Syntax for all columns
 * @param {function} callback Callback to be run upon completion.
 */
SQLite.prototype.createTable=function(name,columns,callback){
	this._open_child_process();
	
	this.sql("CREATE TABLE ?name("+columns+")",{name:name},callback);
};

/**
 * Creates any number of tables and runs the specified callback upon completion.
 * @param {Object[]} tablesArray An array containing the name and SQL create string describing each column
 * @param {string} tablesArray[].name Name of the column
 * @param {string} tablesArray[].columns SQL describing the content of the row
 * @param {function} callback
 */
SQLite.prototype.createTables=function(tablesArray,callback){
	var i=0;
	
	if(tablesArray.length<=0){
		callback("OK");
		return;
	}
	
	var createNextTable;
	this.createTable(tablesArray[0].name,tablesArray[0].columns,createNextTable=(function(data){
		i++;
		if(i<tablesArray.length)
			this.createTable(tablesArray[i].name,tablesArray[i].columns,createNextTable);
		else
			callback("OK");
	}.bind(this)));
};

/**
 * Used to resume parsing of INSERT statement if input is incomplete.
 * @type {object}
 * @private
 */
SQLite.prototype._decodeInsertState = null;
/**
 * Decodes INSERT statements until changes:\s*\d+\s*total_changes:\s*\d+\s* is encountered. Input may be incomplete, in which case onDone will not be called.
 * @param {string} data Input string
 * @param {function} onDone Function to be called after all data has been received.
 * @private
 */
SQLite.prototype._decodeInsertResponse = function(data,onDone){
	var parser=/([+\-]?(?:\d*?\.)?\d+(?:E\d+)?)|('(?:(?:'')*|[\s\S]*?[^'](?:'')*)')|("(?:(?:"")*|[\s\S]*?[^"](?:"")*)")|(\[(?:(?:\]\])*|[\s\S]*?[^\]](?:\]\])*)\])|(X'(?:[A-F\d][A-F\d])*')|(')|(")|(\[)|(NULL)|(CURRENT_TIME)|(CURRENT_DATE)|(CURRENT_TIMESTAMP)|(INSERT INTO)|(changes:\s*\d+\s*total_changes:\s*\d+\s*)|(VALUES)|(,)|(;)|(\()|(\))|(\w+)|(.+?)/gi;
	data=data.toString();
	
	var m=null;
	if(!this._decodeInsertState){
		this._decodeInsertState={
			data:data,
			table:"",
			rows:[],
			currentRow:[],
			currentRowIdentifiers:[],
			state:0
		};
	}else{
		this._decodeInsertState.data+=data;
	}
	var prevIndex=0;
	var error=false;
	while(this._decodeInsertState && !waitForMore && (m=parser.exec(this._decodeInsertState.data)) && !error){
		
		var atEnd=parser.lastIndex==this._decodeInsertState.data.length;
		var waitForMore=false;
		if(m[13]){
			//New row
			if(this._decodeInsertState.state==0){
				this._decodeInsertState.currentRow=[];
				this._decodeInsertState.rows.push(this._decodeInsertState.currentRow);
				this._decodeInsertState.state=1;
				this._decodeInsertState.table="";
				this._decodeInsertState.currentRowIdentifiers=[];
			}else
				error = this._decodeInsertState.state+" "+1;
				
		}else if(m[20] || m[2] || m[3] || m[4]){
			//Identifier or string
			var decodedValue=m[4]?m[4].substr(1,m[4].length-2).replace(/\[\[/g,"[") : m[3]?m[3].substr(1,m[3].length-2).replace(/""/g,"\"")  : m[2]?m[2].substr(1,m[2].length-2).replace(/''/g,"'")  : m[20];
			//If it (except m[15]) matches up to the end of data, save state and wait for resume
			if(this._decodeInsertState.state==1){
				//INSERT INTO $TABLE
				if(atEnd)
					waitForMore=true;
				else{
					this._decodeInsertState.table=decodedValue;
					this._decodeInsertState.state=2;
				}
			}else if(this._decodeInsertState.state==3){
				//INSERT INTO TABLE($COLUMN / INSERT INTO TABLE(COLUMN,$COLUMN
				if(atEnd)
					waitForMore=true;
				else{
					this._decodeInsertState.currentRowIdentifiers.push(decodedValue);
					this._decodeInsertState.state=4;
				}
			}else if(this._decodeInsertState.state==7){
				//VALUES($STRING / VALUES(DATA,$STRING
				if(atEnd)
					waitForMore=true;
				else{
					this._decodeInsertState.currentRow.push(new Buffer(decodedValue));
					this._decodeInsertState.state=8;
				}
			}else
				error = 2;
			
		}else if(m[1]){
			//Number
			//FIXME Better Decode
			var decodedValue=parseFloat(m[1]);
			if(this._decodeInsertState.state==7){
				if(atEnd)
					waitForMore=true;
				else{
					this._decodeInsertState.currentRow.push(decodedValue);
					this._decodeInsertState.state=8;
				}
			}else
				error = 3;

		}else if(m[5]){
			//Binary
			var decodedValue=(new Buffer(m[5].substr(2,m[5].length-3), 'hex'));
			 if(this._decodeInsertState.state==7){
				this._decodeInsertState.currentRow.push(decodedValue);
				this._decodeInsertState.state=8;
			 }else
				error = 4;

		}else if(m[9]){
			//NULL
			var decodedValue=null;
			 if(this._decodeInsertState.state==7){
 				if(atEnd)
					waitForMore=true;
				else{
					this._decodeInsertState.currentRow.push(decodedValue);
					this._decodeInsertState.state=8;
				}
			 }else
				error = 5;

		}else if(m[10]){
			//CURRENT_TIME
			//FIXME decode
			var decodedValue="CURRENT_TIME";
			 if(this._decodeInsertState.state==7){
				if(atEnd)
					waitForMore=true;
				else{
					this._decodeInsertState.currentRow.push(decodedValue);
					this._decodeInsertState.state=8;
				}
			 }else
				error = 6;

		}else if(m[11]){
			//CURRENT_DATE
			//FIXME decode
			var decodedValue="CURRENT_DATE";
			 if(this._decodeInsertState.state==7){
 				if(atEnd)
					waitForMore=true;
				else{
					this._decodeInsertState.currentRow.push(decodedValue);
					this._decodeInsertState.state=8;
				}
			 }else
				error = 7;

		}else if(m[12]){
			//CURRENT_DATETIME
			//FIXME decode
			var decodedValue="CURRENT_DATETIME";
			 if(this._decodeInsertState.state==7){
				if(atEnd)
					waitForMore=true;
				else{
					this._decodeInsertState.currentRow.push(decodedValue);
					this._decodeInsertState.state=8;
				}
			 }else
				error = 8;

		}else if(m[16]){
			//,
			if(this._decodeInsertState.state==4)
				this._decodeInsertState.state=3;
			else if(this._decodeInsertState.state==8)
				this._decodeInsertState.state=7;
			else
				error = 9;

		}else if(m[17]){
			//End of statement
			if(this._decodeInsertState.state==9){
				this._decodeInsertState.state=0;
				if(this._decodeInsertState.currentRowIdentifiers.length){
					var dict={};
					for(var i=0;i<this._decodeInsertState.currentRowIdentifiers.length;i++){
						dict[this._decodeInsertState.currentRowIdentifiers[i]]=this._decodeInsertState.currentRow[i];
					}
					this._decodeInsertState.rows[this._decodeInsertState.rows.length-1]=dict;
				}
				
			}else
				error = 10;
			
		}else if(m[18]){
			//(
			if(this._decodeInsertState.state==2){
				//We're getting column names
				this._decodeInsertState.state=3;
			}else if(this._decodeInsertState.state==6){
				//Begin values
				this._decodeInsertState.state=7;
			}else
				error = 11;

		}else if(m[19]){
			//)
			if(this._decodeInsertState.state==4)
				//End of columns
				this._decodeInsertState.state=5;
			else if(this._decodeInsertState.state==8)
				//End of values
				this._decodeInsertState.state=9;
			else
				error = this._decodeInsertState.state+" "+12;

		}else if(m[6] || m[7] || m[8]){
			//Incomplete: Save state and wait for resume
			waitForMore=true;
		}else if(m[14]){
			//Complete: run callback
			var rows=this._decodeInsertState.rows;
			this._decodeInsertState=null;
			if(this.debug>=3){
				console.log(rows);
			}
			onDone(rows);
		}else if(m[15]){
			//VALUES
			if(this._decodeInsertState.state==5 || this._decodeInsertState.state==2)
				//Begin values
				if(atEnd)
					waitForMore=true;
				else
					this._decodeInsertState.state=6;
			else
				error = 13;
		}else if(m[21] && m[21].trim().length){
			//Other
			error=99;
		}
		
		//FIXME Needs more testing
		var beforePrevIndex=prevIndex;
		prevIndex=parser.lastIndex;
	}
	
	if(error){
		if(this.debug>=1)
			console.error("Parse Error " + error + " '" + m+"'");
		this._decodeInsertState=null;
	}else if(waitForMore){
		//Save state
		this._decodeInsertState.data=this._decodeInsertState.data.substr(beforePrevIndex);
	}else if(this._decodeInsertState){
		this._decodeInsertState.data="";
	}
	
	return;
};

/**
 * Handles the STDOUT stream coming from sqlite3.exe
 * @param {Buffer} data
 * @private
 */
SQLite.prototype._handleStdout = function(data){
	if(this.debug>=3)
		console.log("STDOUT: "+data);
	if(typeof(this._lastSqlCallback)=="function"){
		this._decodeInsertResponse(data,function(data){
			this._lastSqlCallback(data);
			this._lastSqlCallback = null;
			if(this._sqlQueue.length){
				var next=this._sqlQueue[0];
				this._sqlQueue.splice(0,1);
				this.sql(next.q,next.c);
			}
		}.bind(this));
	}else if(this._sqlQueue.length){
		var next=this._sqlQueue[0];
		this._sqlQueue.splice(0,1);
		this.sql(next.q,next.c);
	}
};

/**
 * Handles the STDERR stream coming from sqlite3.exe
 * @param {Buffer} data
 * @private
 */
SQLite.prototype._handleStderr = function(data){
	if(this.debug>=2)
		console.error("STDERR:"+data);
	if(typeof(this._lastSqlCallback)=="function")
		this._lastSqlCallback("Database error.");
	
	this._lastSqlCallback = null;
	
	if(this._sqlQueue.length){
		var next=this._sqlQueue[0];
		this._sqlQueue.splice(0,1);
		this.sql(next.q,next.c);
	}
};

/**
 * Tracks whether sqlite3.exe is currently running.
 * @param code
 * @private
 */
SQLite.prototype._handleClose = function(code){
	this._isOpen=false;
};