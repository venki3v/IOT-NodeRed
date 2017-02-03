
'use strict';

var amqp = require('amqplib');
var fs = require('fs');
var when = require('when');


var host = "amqp.covapp.io";
var port = 5671;

var fs = require('fs');
var path = require('path');
var initialSt =false;

/* SXP Config */
var ca = __dirname + '/ca/chained_prod_cert_covapp_io.pem.cer';
var fileName;
var opts = {
		cert : fs.readFileSync(ca),
		passphrase : fs.readFileSync(ca),
		ca : [ fs.readFileSync(ca) ]
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


//Process input parameters
process.argv.forEach(function (val, index, array) {
	  console.log(index + ': ' + val);
});

// First 2 arguments are node and AMQPSubscriber
console.log("username: " + process.argv[2]);
console.log("pwd: " + process.argv[3]);
console.log("AMQP Consumer Topic: " + process.argv[4]);
console.log("client id: " + process.argv[5]);
var username = process.argv[2];
var password = process.argv[3];
var consumerTopic = process.argv[4];
var clientIDVar = process.argv[5] +generateRandAlphaNumStr(3);//added this to have a unique client id for each client.
console.log("client id var: " + clientIDVar); 
var subjectId = process.argv[6];
function generateRandAlphaNumStr(len) {
  var rdmString = "";
  for( ; rdmString.length < len; rdmString  += Math.random().toString(36).substr(2));
  return  rdmString.substr(0, len);

}

/*var fileOptions = {
  flags: 'a',
  defaultEncoding: 'utf8',
  fd: null,
  mode: process.env[(process.platform == 'win32') ? '0o666' : '0666'],
  autoClose: true
};*/

var url = 'amqps://' + username + ':' + password + '@' + host + ':' + port + "/";
var conn = amqp.connect(url, opts);
var glbChannel;
conn.then(function(conn) {
		console.log("AMQP Connection successful.");
        console.log("AMQP connection established successfully.");
		var tstamp = Math.floor(Date.now() / 1000);
		var fdate = getFormattedDate();
		fileName = path.join(__dirname +'/logs/'+subjectId+'.txt');
		if (!initialSt){
			fs.appendFile(fileName,'Start of the logs @'+fdate+' \r\n');
			initialSt = true;
		}
		return when(conn.createChannel().then(function(channel) {
            glbChannel = channel;
			var sub = channel.assertQueue(consumerTopic, {
				durable : true
			});
			sub = sub.then(function(_qok) {
				return channel.consume(consumerTopic, function(msg) {
					console.log(" [x] Received '%s'", msg.content.toString());
                    var returnPayload = {"Consumer Topic":consumerTopic,"Payload":msg.content.toString()};
                    process.send(returnPayload);
				}, {
					noAck : true
				});
			});

			return sub.then(function(_consumeOk) {
				console.log(' [*] Waiting for messages. To exit press CTRL+C');
			});
		}));
	}).then(null, console.warn);



/*var headers = {
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



ws.on('open', function open() {
		//To receive message some dummy message need to sent
		//ws.send("dummyMessgae");
		
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
		process.send(returnPayload);
        var returnPayload = {"Consumer Topic":streamId,"Payload":data};
        process.send(returnPayload);
	});*/
	
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
	console.log('ending........... inside exit method of AMQP child process');
        
         glbChannel.close();
          try {
            glbChannel.close();
          }
          catch (alreadyClosed) {
            console.log(alreadyClosed.stackAtStateChange);
          }
	//ws.close();
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

	console.log("Killing the Child-Process:");