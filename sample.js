const SQLite = require('./SQLite.js');

var testdb=new SQLite('.\\mytest.sqlite',[
	{name:"testTable",columns:"X int,LABEL varchar[64],data blob"},
],function(){
	testdb.sql("INSERT INTO ?testTable VALUES(#X,$LABEL,&DATA)",
	{
		testTable:"testTable",
		X:123,
		LABEL:"Hello World",
		DATA:new Buffer("DEADBEEF","hex")
	},
	function(data){
		testdb.sql("SELECT * from ?testTable",
		{
			testTable:"testTable"
		},
		function(data){
			console.log(JSON.stringify(data,null,"\t"));
			process.exit();
		});
	});
});