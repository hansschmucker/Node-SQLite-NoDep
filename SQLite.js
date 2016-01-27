const child_process = require('child_process');


/*
	"test.sqlite",[{name:"FOO",columns:"X INT, TEXT VARCHAR[64]"},...]
*/
var SQLite = module.exports = function(dbname,tables,onReady){
	this._sqlQueue = [];
	this.dbname=dbname;
	this.tables=tables;
	this.onOpenComplete = onReady;
	this.open();
};

SQLite.prototype.isOpen=false;
SQLite.prototype.onOpenComplete=null;
SQLite.prototype.process=null;
SQLite.prototype.dbname="";
SQLite.prototype.tables="";
SQLite.prototype._lastSqlCallback = null;
SQLite.prototype.open = function(){
	if(this.isOpen)
		return;
	
	this.process = child_process.exec('.\\bin\\sqlite3.exe',[],{maxBuffer: 1024*1024*1024});
	
	this.process.stdin.write(".open '"+this.dbname+"'\r\n");
	this.process.stdin.write(".mode insert\r\n");
	this.process.stdin.write(".separator '\u0003' '\u0004'\r\n");
	this.process.stdin.write(".width 0\r\n");
	this.process.stdin.write(".binary on\r\n");
	this.process.stdin.write(".headers on\r\n");
	this.process.stdin.write(".changes on\r\n");
	
	this.process.on('close',this.handleClose.bind(this));
	this.process.stderr.on('data',this.handleStderr.bind(this));
	this.process.stdout.on('data',this.handleStdout.bind(this));
	this.process.stdout.on('end',this.handleStdout.bind(this));
	this.isOpen = true;
	
	this.createTables(this.tables,this.onOpenComplete);
}

SQLite.prototype.close = function(){
	if(!this.isOpen)
		return;
	
	this.process.stdin.write(".exit\r\n");
}

/*
	Contains any statements run while we're still waiting for a result. This way we can make sure that we receive one result per request.
	[{q:string,c:function}]
*/
SQLite.prototype._sqlQueue = null;

SQLite.escapeValue = function(str){
	return "'"+str.replace(/'/g,"''")+"'";
}

SQLite.prototype.sql=function(q,callback){
	/*
		Possible scenarios:
			No output ever: SQLITE is still waiting for the end of the statement
			STDERR output: Something has gone wrong
			STDOUT ouput: Result, including ECHO and CHANGES
	
		By automatically adding ";" we make sure that case 1 never happens. So we wait for #2 or #3 to happen. If another SQL call occurs
		while we're waiting, we'll add this to a private queue, to be run when either an error or output has occured.
	*/
	this.open();
	//0 causes issues for the SQLite shell and 3/4 are our delimeters. We wouldn't want those in our database.
	q=q.replace(/\u0003|\u0004|\u0000/g," ");
	
	if(this._lastSqlCallback){
		this._sqlQueue.push({q:q,c:callback});
	}else{
		this._lastSqlCallback = callback||true;
		this._rawCmd(q+";");
	}
}

SQLite.prototype._rawCmd=function(q,callback){
	/*
		This is ONLY for specific commands that are not SQL, like ".tables"
	*/
	this.open();
	
	this.process.stdin.write(q+"\r\n");
}

SQLite.prototype.createTable=function(name,columns,callback){
	this.open();
	
	this.sql("CREATE TABLE "+name+"("+columns+")",callback);
};

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


SQLite.prototype._decodeResponse = function(data){
	data=data.toString();
	var rows=data.split("\u0004");
	if(rows.length<3)
		return [];
	
	var fields=[];
	var row=rows[0].split("\u0003");
	for(var i=0;i<row.length;i++)
		fields.push(row[i]);
	
	
	var mappedTable=[];
	for(var i=1;i<rows.length-1;i++){
		if(rows[i].length){
			var row=rows[i].split("\u0003");
			var rowTable={};
			for(var j=0;j<row.length;j++){
				rowTable[fields[j]]=row[j];
			}
			mappedTable.push(rowTable);
		}
	}
	return mappedTable;
};

SQLite.prototype._decodeInsertState = null;
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
			var decodedValue=new Buffer(m[5].substr(2,m[5].length-3), 'hex');
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

SQLite.prototype.handleStdout = function(data){
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

SQLite.prototype.handleStderr = function(data){
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

SQLite.prototype.handleClose = function(code){
	this.isOpen=false;
};