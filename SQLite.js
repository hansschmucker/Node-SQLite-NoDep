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
	
	this.process = child_process.execFile('.\\bin\\sqlite3.exe');
	
	this.process.stdin.write(".open '"+this.dbname+"'\r\n");
	this.process.stdin.write(".mode list\r\n");
	this.process.stdin.write(".separator '\u0003' '\u0004'\r\n");
	this.process.stdin.write(".width 0\r\n");
	this.process.stdin.write(".headers on\r\n");
	this.process.stdin.write(".changes on\r\n");
	
	this.process.on('close',this.handleClose.bind(this));
	this.process.stderr.on('data',this.handleStderr.bind(this));
	this.process.stdout.on('data',this.handleStdout.bind(this));
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
	return "'"+str.replace("'","''")+"'";
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

SQLite.prototype.handleStdout = function(data){
	if(typeof(this._lastSqlCallback)=="function")
		this._lastSqlCallback(this._decodeResponse(data));
	
	this._lastSqlCallback = null;
	
	if(this._sqlQueue.length){
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