
'use strict';

var WebSocket = require('ws');  
var host = "websockets.wss.covapp.io";
var realm = 'CISCODEV-CLOUD';
var ws_user;
var ws_pass;

var requestor = '<requestor>';

var requestorapp = '<requestorapp>';
var streamId;

var fs = require('fs');
var path = require('path');

/* SXP Config */
var ca = __dirname + '/ca/chained_prod_cert_covapp_io.pem.cer';

var clientIDVar;
var subjectId;
var fileName;
var initialSt =false;

//Process input parameters
process.argv.forEach(function (val, index, array) {
	  console.log(index + ': ' + val);
});

// First 2 arguments are node and WSSubscriber
console.log("username: " + process.argv[2]);
console.log("pwd: " + process.argv[3]);
console.log("stream Id: " + process.argv[4]);
console.log("client id: " + process.argv[5]);

ws_user = process.argv[2];
ws_pass = process.argv[3];
streamId = process.argv[4];
clientIDVar = process.argv[5] +generateRandAlphaNumStr(3);//added this to have a unique client id for each client.
console.log("client id var: " + clientIDVar); 
subjectId = process.argv[6];
function generateRandAlphaNumStr(len) {
  var rdmString = "";
  for( ; rdmString.length < len; rdmString  += Math.random().toString(36).substr(2));
  return  rdmString.substr(0, len);

}

var headers = {
		realm : realm,
		requestor : requestor,
		requestorapp : requestorapp,
		username : ws_user,
		password : ws_pass
};

var options = {
		headers : headers
};
var ws = new WebSocket('wss://' + host + '/websocket/message/' + streamId, options);
console.log('info', "Sent connect request for websocket child.");

/*var fileOptions = {
  flags: 'a',
  defaultEncoding: 'utf8',
  fd: null,
  mode: process.env[(process.platform == 'win32') ? '0o666' : '0666'],
  autoClose: true
};*/

ws.on('open', function open() {
		//To receive message some dummy message need to sent
		//ws.send("dummyMessgae");
		console.log("Web Socket connection established successfully.");
		var tstamp = Math.floor(Date.now() / 1000);
		var fdate = getFormattedDate();
		fileName = path.join(__dirname +'/logs/'+subjectId+'.txt');
		if (!initialSt){
			fs.appendFile(fileName,'Start of the logs @'+fdate+' \r\n');
			initialSt = true;
		}
	});

	ws.on('error', function error(err) {
		console.log("Error is WS connection: " + err);
	});

	ws.on('message', function(data, flags) {
		console.log("Message received: " + data);
		//ws.close();
		// message is Buffer 
		/*var jsonObj = JSON.parse(data);
		var deviceId = jsonObj.deviceId;
		var decodesMsgContent = (new Buffer(jsonObj.message, 'base64').toString());
		console.log('info', "Message Arrived. Creating Payload here.");
		var returnPayload = {"Consumer Topic":streamId,"Payload":jsonObj};
		console.log("writing data to file-->"+JSON.stringify(jsonObj));
		//writeStream.write(JSON.stringify(jsonObj));
		var tstamp = Math.floor(Date.now() / 1000);
		fs.appendFile(fileName,JSON.stringify(jsonObj)+'\r\n');    
		process.send(returnPayload);*/
        var returnPayload = {"Consumer Topic":streamId,"Payload":data};
        process.send(returnPayload);
	});
	
	function getFormattedDate(){
    var d = new Date(),
    minutes = d.getMinutes().toString().length == 1 ? '0'+d.getMinutes() : d.getMinutes(),
    hours = d.getHours().toString().length == 1 ? '0'+d.getHours() : d.getHours(),
    ampm = d.getHours() >= 12 ? 'pm' : 'am',
    months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
return days[d.getDay()]+' '+months[d.getMonth()]+' '+d.getDate()+' '+d.getFullYear()+' '+hours+':'+minutes+ampm;
}
	
	function onExit(err) {
	console.log('ending........... inside exit method of websocket child process');
	ws.close();
	//mclient.end();
	//process.removeAllListeners();
   // writeStream.end();
    var fdate = getFormattedDate();
    fs.appendFile(fileName,'\r\nFile Ends here at '+fdate); 
    console.log("Write stream for log file ended here.");
	process.exit();
	if (typeof err != 'undefined')
		console.log(err);
}

process.on('SIGINT', onExit)

	console.log("Killing the Child-Process: %s", streamId);