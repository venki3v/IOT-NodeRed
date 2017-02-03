
'use strict';
var clients = [];
var socketCollection = [];
var mqtt = require('mqtt');
var fs = require('fs');
var winston = require('winston');
var express = require('express');
var app = express();
//for node-red starts
var RED = require("node-red");
var n_http = require('http');
var server = n_http.createServer(app);
//for node red ends

//var http = require('http').Server(app);
var io = require('socket.io')(server);//(http);
var querystring = require('querystring');
var path = require('path');
var childProcess    = require('child_process');
var HashMap = require('hashmap');
var devHashMap = new HashMap();
var fileData;
var WebSocket = require('ws'); //added for websocket
var amqp = require('amqplib'); // added for amqp
var when = require('when'); // added for amqp
//for node-red starts
app.use("/",express.static("public"));


var settings = {
    httpAdminRoot:"/red",
    httpNodeRoot: "/api",
    userDir:path.join(getUserHome(),".node-red"),
	uiPort: 1880,
	mqttReconnectTime: 15000,
	serialReconnectTime: 15000,
	debugMaxLength: 1000,
    functionGlobalContext: { },
    editorTheme: {
    page: {
        title: "COVS-RED",
    },
    header: {
        title: "COVS-RED",
        url: "https://developer.covisint.com" // optional url to make the header text/image a link to this url
    },
    menu: { // Hide unwanted menu items by id. see editor/js/main.js:loadEditor for complete list
        "menu-item-keyboard-shortcuts": false,
        "menu-item-help": {
            label: "Covisint Developer Portal",
            url: "https://developer.covisint.com"
        }
    }
  }
        // enables global context
};

RED.init(server,settings);
app.use(settings.httpAdminRoot,RED.httpAdmin);
app.use(settings.httpNodeRoot,RED.httpNode);
server.listen(1880);
RED.start();
//for node-red ends
winston.add(
		  winston.transports.File, {
		    filename: 'IOTWorkbench.log',
		    level: 'info',
		    json: true,
		    eol: '\n', // for Windows, or `eol: ‘n’,` for *NIX OSs
		    timestamp: true,
		    maxsize: 5242880, //5MB
            maxFiles: 3
		  }
		)

/* SXP Config */
var ca = __dirname + '/ca/chained_prod_cert_covapp_io.pem.cer';

function getUserHome() {
    winston.log('info',"Starting getUserHome function; process.env.PORT-->"+process.env.PORT);
    winston.log('info',"result of getUserHome()-->"+process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']);
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function initiateMQTTConn(cliID, mqtt_broker, broker_port, mqtt_user, mqtt_pass) {
	winston.log('info', "Starting initiateMQTTConn function with clientId: "+cliID+", mqttBroker: "+mqtt_broker+ ", brokerPort: "+broker_port+ ", mqtt UserName: "+mqtt_user+ "and mqtt password: "+mqtt_pass);
	var options = {
		host: mqtt_broker,
		port: broker_port,
		protocol: 'mqtts',
		ca:  [fs.readFileSync(ca)],
		secureProtocol: 'TLSv1_method',
		rejectUnauthorized : false,
		username: mqtt_user,
		password: mqtt_pass,
		clientId: cliID
	};
	try{
		var mclient = mqtt.connect(options);
		winston.log('info', "Sent MQTT connect request");
		mclient.on('connect', function () {
			winston.log('info', "MQTT Connection established inside initiateMQTTConn method.");
		});
		// server is offline
		mclient.on("connect_error", function(){
			winston.log('error',"Mclient is offline. Please try again.");
		})
		// failed connection attempts
		mclient.on("connect_failed", function(){
			winston.log('error',"Could not connect. MQTT connection failed.");
		})
	}catch (e) {
        winston.log('error','Mqtt is unavailable. Error: '+ e);
    }
	
	return mclient;
}

function initiateWSConn(producerStreamId, broker, port, user, pass) {
	winston.log('info',"Starting initiateWSConn function with producerStreamId: "+producerStreamId+ ", broker: "+broker+ ", port: " +port+ ", username: "+user+ "and password: "+pass)
    var realm = 'CISCODEV-CLOUD';
    var requestor = '<requestor>';
    var requestorapp = '<requestorapp>';
    var headers = {
		realm : realm,
		requestor : requestor,
		requestorapp : requestorapp,
		username : user,
		password : pass
    };
    var options = {
		headers : headers
    };
	try{
		var ws = new WebSocket('wss://' + broker + '/websocket/event/' + producerStreamId, options);
		winston.log('info', "Sent WebSocket connect request");
	}catch(e){
		winston.log('error','Web socket is unavailable. Error: '+ e);
	}
   	return ws;
}
function initiateAMQPConn(producerStreamId, broker, port, user, pass) {
	winston.log('info',"Starting initiateAMQPConn function with producerStreamId: "+producerStreamId+ ", broker: "+broker+ ", port: " +port+ ", username: "+user+ "and password: "+pass)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    var url = 'amqps://' + user + ':' + pass + '@' + broker + ':' + port + "/";
    var opts = {
			cert : fs.readFileSync(ca),
			passphrase : fs.readFileSync(ca),
			ca : [ fs.readFileSync(ca) ]
	};
	var common_options = {
			durable : true
	};
	var bar_opts = Object.create(common_options);
	try{
		var conn = amqp.connect(url);
		winston.log('info', "Sent AMQP connect request");
	}catch(e){
		winston.log('error','AMQPC is unavailable. Error: '+ e);
	}
	return conn;
}

function publishMessage(clientID, mqttBroker, brokerPort, userName, passCode, messageType, msgTypeID, deviceId, producerTopic, msgToPublish){
winston.log('info',"Starting publishMessage function with clientID: "+clientID+ ", mqttBroker: "+mqttBroker+ ", brokerPort: " +brokerPort+ ", username: "+userName+ ", password: "+passCode+ ", messageType: "+messageType+ ", msgTypeID: " +msgTypeID+ ", deviceId" +deviceId+ ", producerTopic: " +producerTopic+ "and msgToPublish: " +msgToPublish);

	var mclient = initiateMQTTConn(clientID, mqttBroker, brokerPort, userName, passCode);
	var encodedMsg = (new Buffer(msgToPublish)).toString('base64');
	winston.log('info',"Message to publish encoded to: " +encodedMsg);
	var msgIdentifier;
	if(messageType == "Command") {
		msgIdentifier = "commandId";
	} else {
		msgIdentifier = "eventTemplateId";
	}
	var sendEventMessageObj = '{"messageId":"MSG12345","deviceId":"'+deviceId+'","'+msgIdentifier+'":"' + msgTypeID + '","message":"' + encodedMsg + '","encodingType":"BASE64"}';
	try{
		mclient.publish(producerTopic, sendEventMessageObj);
		winston.log('info','Message published!!!'+sendEventMessageObj);
		mclient.end();
		winston.log('info','MQTT Client disconnected programatically.');
	} catch(e){
		winston.log('error',"unable to publish. Error: "+ e)
	}
	
}

function publishWebSocketMessage(clientID, mqttBroker, brokerPort, userName, passCode, messageType, msgTypeID, deviceId, producerTopic, msgToPublish){
winston.log('info',"Starting publishWebSocketMessage function with clientID: "+clientID+ ", mqttBroker: "+mqttBroker+ ", brokerPort: " +brokerPort+ ", username: "+userName+ ", password: "+passCode+ ", messageType: "+messageType+ ", msgTypeID: " +msgTypeID+ ", deviceId" +deviceId+ ", producerTopic: " +producerTopic+ "and msgToPublish: " +msgToPublish);
	var ws = initiateWSConn(producerTopic, mqttBroker, brokerPort, userName, passCode);
	var encodedMsg = (new Buffer(msgToPublish)).toString('base64');
	winston.log('info',"Message to publish encoded to: " +encodedMsg);
	var msgIdentifier;
	if(messageType == "Command") {
		msgIdentifier = "commandId";
	} else {
		msgIdentifier = "eventTemplateId";
	}
	var sendEventMessageObj = '{"messageId":"MSG12345","deviceId":"'+deviceId+'","'+msgIdentifier+'":"' + msgTypeID + '","message":"' + encodedMsg + '","encodingType":"BASE64"}';
    try{
		ws.on('open', function open() {
			ws.send(sendEventMessageObj);
			console.log("Message sent");
			winston.log('info','Message published!!!'+sendEventMessageObj);
		});

		ws.on('error', function error(err) {
			console.log(err);
			winston.log('error', err); // error added in log file
		});
		ws.onmessage = function(evt) {
			var msgReceived = evt.data;
			console.log("Message recieved as ack-->"+msgReceived);
			winston.log('info',"Message recieved as ack-->"+msgReceived);
			ws.close();
			console.log('Websocket Client disconnected programatically.');
		};
	} catch(e){
		winston.log('error',"unable to publish Websocket messsage. Error: "+ e)
	}
}

function publishAMQPMessage(clientID, mqttBroker, brokerPort, userName, passCode, messageType, msgTypeID, deviceId, producerTopic, msgToPublish){
	winston.log('info',"Starting publishAMQPMessage function with clientID: "+clientID+ ", mqttBroker: "+mqttBroker+ ", brokerPort: " +brokerPort+ ", username: "+userName+ ", password: "+passCode+ ", messageType: "+messageType+ ", msgTypeID: " +msgTypeID+ ", deviceId" +deviceId+ ", producerTopic: " +producerTopic+ "and msgToPublish: " +msgToPublish);
	
	var conn = initiateAMQPConn(clientID, mqttBroker, brokerPort, userName, passCode);
	var encodedMsg = (new Buffer(msgToPublish)).toString('base64');
	winston.log('info',"Message to publish encoded to: " +encodedMsg);
	var msgIdentifier;
	if(messageType == "Command") {
		msgIdentifier = "commandId";
	} else {
		msgIdentifier = "eventTemplateId";
	}
	var sendEventMessageObj = '{"messageId":"MSG12345","deviceId":"'+deviceId+'","'+msgIdentifier+'":"' + msgTypeID + '","message":"' + encodedMsg + '","encodingType":"BASE64"}';
	try{
		conn.then(function(conn) {
			console.log("AMQP Connection successful.");
			return when(conn.createChannel().then(
				function(channel) {
					var validatedExchange = channel.assertExchange(
							producerTopic,'topic',{durable: true});
					return validatedExchange.then(function(_qok) {
						channel.publish(producerTopic,'#',new Buffer(sendEventMessageObj));
						console.log("Message sent");
						console.log('Message published in Buffer!!!'+sendEventMessageObj);
						return channel.close();
					});
				})).ensure(function() {
					conn.close();
				console.log('AMQP Client disconnected programatically.');
				});
		}).then(null, console.warn);
	} catch(e){
		winston.log('error',"unable to publish AMQP messsage. Error: "+ e)
	}
    

}
app.use(express.static('public'));
app.use(express.static('src/views'));
app.use(express.static('bower_components'));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', function(req, res, next) {
	console.log("[405] " + req.method + " to " + req.url);
	winston.log('info',"Starting app.get function with [405] " + req.method + " to " + req.url);
	try{
		res.sendFile(path.join(__dirname +'/src/views/index.html'));
	}
	catch(e){
		winston.log('error',"Error: "+ e)
	}
    
});

//modified function starts
app.post('/publish', function(req, res, next) {
 // Handle the post for this route
 console.log("[200] " + req.method + " to " + req.url);
 winston.log('info',"Starting app.post function with [200] " + req.method + " to " + req.url);
	try{
		var fullBody = '';
		req.on('data', function(chunk) {
			console.log("Received body data:");
			var jsonObj = JSON.parse(chunk);
			console.log("jsonObj.clientID->"+jsonObj.clientID);
			console.log("jsonObj.mqttBroker->"+jsonObj.mqttBroker);
			console.log("jsonObj.brokerPort->"+jsonObj.brokerPort);
			console.log("jsonObj.userName->"+jsonObj.userName);
			console.log("jsonObj.passCode->"+jsonObj.passCode);
			console.log("jsonObj.messageType->"+jsonObj.messageType);
			console.log("jsonObj.msgTypeID->"+jsonObj.msgTypeID);
			console.log("jsonObj.deviceId->"+jsonObj.deviceId);
			console.log("jsonObj.producerTopic->"+jsonObj.producerTopic);
			console.log("jsonObj.msgToPublish->"+JSON.stringify(jsonObj.msgToPublish));
			console.log(chunk.toString());
			fullBody += chunk.toString();
			winston.log('info',"Received body data: "+ 
								"jsonObj.clientID->"+jsonObj.clientID+
								"jsonObj.mqttBroker->"+jsonObj.mqttBroker+
								"jsonObj.brokerPort->"+jsonObj.brokerPort+
								"jsonObj.userName->"+jsonObj.userName+
								"jsonObj.passCode->"+jsonObj.passCode+
								"jsonObj.messageType->"+jsonObj.messageType+
								"jsonObj.msgTypeID->"+jsonObj.msgTypeID+
								"jsonObj.deviceId->"+jsonObj.deviceId+
								"jsonObj.producerTopic->"+jsonObj.producerTopic+
								"jsonObj.msgToPublish->"+JSON.stringify(jsonObj.msgToPublish));
			if (jsonObj.mqttBroker!=null && jsonObj.mqttBroker.indexOf("websocket") > -1){
				console.log("This is websocket publish request");
				publishWebSocketMessage(jsonObj.clientID, jsonObj.mqttBroker, jsonObj.brokerPort, jsonObj.userName, jsonObj.passCode, jsonObj.messageType, jsonObj.msgTypeID,jsonObj.deviceId, jsonObj.producerTopic, JSON.stringify(jsonObj.msgToPublish));
			}
			else if (jsonObj.mqttBroker!=null && jsonObj.mqttBroker.indexOf("amqp") > -1){
	console.log("This is amqp publish request");
	publishAMQPMessage(jsonObj.clientID, jsonObj.mqttBroker, jsonObj.brokerPort, jsonObj.userName, jsonObj.passCode, jsonObj.messageType, jsonObj.msgTypeID,jsonObj.deviceId, jsonObj.producerTopic, JSON.stringify(jsonObj.msgToPublish));
			}
			else if (jsonObj.mqttBroker!=null && jsonObj.mqttBroker.indexOf("mqtt") > -1){
			  console.log("This is mqtt publish request");
			  publishMessage(jsonObj.clientID, jsonObj.mqttBroker, jsonObj.brokerPort, jsonObj.userName, jsonObj.passCode, jsonObj.messageType, jsonObj.msgTypeID,jsonObj.deviceId, jsonObj.producerTopic, jsonObj.msgToPublish);
			}
		});
		req.on('end', function() {
		  // empty 200 OK response for now
			res.writeHead(200, "OK", { "access-control-allow-origin": "*", 'Content-Type': 'text/html'});
		   // parse the received body data
			var decodedBody = querystring.parse(fullBody);
			console.log("decodedBody-->"+decodedBody);
			// output the decoded data to the HTTP response
			res.write('<html><head><title>Post data</title></head><body><pre>');
			res.write(JSON.stringify(decodedBody));
			res.write('</pre></body></html>');
			res.end();
		});
	}
	catch(e){
		winston.log('error',"Error : "+ e)
	}
});
//modified function ends

io.on('connection', function(socket){
	try{
		console.log('log input param : ' + socket.handshake.query.name);
		winston.log('info','log input param : ' + socket.handshake.query.name);
		//changed code for other protocol support starts
		var consumerParams;
		var streamType;
		var clientID = socket.handshake.query.clientID;
		var userName = socket.handshake.query.userName;
		var passCode = socket.handshake.query.passCode;
		var consumerTopic = socket.handshake.query.consumerTopic;
		var webSockStrmId = socket.handshake.query.consumerTopic;//wsStrId;
		var jsonString = socket.handshake.query.JSONString;
		var subjectId = socket.handshake.query.subjectID;
		var fileNeedsToChange = socket.handshake.query.changeInFile;
		console.log("jsonString-->"+jsonString);
		console.log("subjectId-->"+subjectId);
		console.log("fileNeedsToChange-->"+fileNeedsToChange);
		createFile(subjectId, jsonString, fileNeedsToChange);
		console.log("After calling create file method.");

		var hostName = socket.handshake.query.hostName;
		console.log("*****************hostName-->"+hostName);
		if (hostName!=null && hostName!=undefined){
				if (hostName!=null && (hostName.indexOf("websocket")>-1) && webSockStrmId!=null && webSockStrmId!=undefined){
				console.log("Websocket configuration.");
				consumerParams = [userName, //User ID
							  passCode, //Password
							  webSockStrmId, //Websocket stream id
							  clientID,	//Client Id
							  subjectId]; //application id or device id
				streamType = "websocket";
			}
			else if (hostName!=null && (hostName.indexOf("amqp")>-1)){
				console.log("AMQP configuration.");
				consumerParams = [userName, //User ID
							  passCode, //Password
							  consumerTopic, //AMQP stream id @TODO: Needs to be changed
							  clientID,	//Client Id
							  subjectId]; //application id or device id
				streamType = "amqp";
			}
			else if (hostName!=null && (hostName.indexOf("mqtt")>-1) && clientID!=null && clientID!=undefined && userName!=null && userName!=undefined
			   && passCode!=null && passCode!=undefined && consumerTopic!=null && consumerTopic!=undefined
			  && subjectId!=null && subjectId!=undefined){
				console.log("MQTT configuration.");
				consumerParams = [userName, //User ID
							  passCode, //Password
							  consumerTopic, //Consumer Topic
							  clientID,	//Client Id
							  subjectId]; //application id or device id
				streamType = "mqtt";
			}
			var appGlobalSocket = socket;
			console.log('a user connected');
			winston.log('info','a user connected');
			handleSocketMap (consumerParams[2], appGlobalSocket, devHashMap, consumerParams, streamType);
			console.log("The number of elements inside devhashmap="+devHashMap.count());

			appGlobalSocket.on('disconnect', function(){
				console.log("user disconnected...");
				console.log("***************Printing the value before splicing");
				devHashMap.forEach(function(value, key) { //TODO: Get rid of this unnecessary loop once testing is done on a higher level
				console.log(key + "-> is key i.e. old key :for value i.e. old value ->" + value);
				});
				devHashMap.forEach(function(value, key) {
					for (var i=0;i<value.length;i++){
						console.log("Inside for loop");
						console.log("value["+i+"]="+value[i].toString());
						console.log("appGlobalSocket="+appGlobalSocket.toString());
						if (value[i]===appGlobalSocket){
							console.log("Match happened");
							console.log("The length of array before splice ="+value.length +" for the key= "+key);
							value.splice(i,1);
							i--;
							console.log("The length of array after splice ="+value.length +" for the key= "+key);
						}
						if (value.length==0){
							console.log("there are no elements in array for key ="+key +" but not removing the element from map.");
							//devHashMap.remove(key);
						}
					}
				});
				console.log("***************Printing the value after splicing");
				devHashMap.forEach(function(value, key) {//TODO: Get rid of this unnecessary loop once testing is done on a higher level
				console.log(key + "-> is key i.e. new key :for value i.e. new value ->" + value);
				});
			});
			// server is offline
			appGlobalSocket.on("connect_error", function(){
				winston.log('error',"Server is offline. Please try again.");
			})
			
			// failed connection attempts
			appGlobalSocket.on("connect_failed", function(){
				winston.log('error',"Could not connect. Please try again.");
			})


			devHashMap.forEach(function(value, key) {
				console.log(key + "-> is key:for value ->" + value);
				console.log("*********************The number of elements in the hashmap before any deletion="+value.length);


				// Success!  Now listen to messages to be received
				appGlobalSocket.on('message',function(event){
					console.log('Received message from client!',event);
				});

				appGlobalSocket.on('event', function(data) {
					console.log('A client sent us this dumb message:', data.message);
				});


			});

		}
		else {
			console.log("Disconnected this connection as no stream params provided");
			winston.log('warn',"Disconnected this connection as no stream params provided");
		}
		//changed code for other protocol support ends
	}
	catch(e){
		winston.log('error',"Error: " + e);
	}
});

//Two functions changed to support other protocols start
function handleSocketMap (channelID, currentSocket, theHashMap, consumerParams, streamType){
	console.log("Inside handleSocketMap. And the parameters passed are : channelID:"+channelID + " currentSocket:"+currentSocket+" the hashmap:"+theHashMap +" consumerParams:"+consumerParams +" streamType:"+streamType);
	winston.log("info","Inside handleSocketMap. And the parameters passed are : channelID:"+channelID + " currentSocket:"+currentSocket+" the hashmap:"+theHashMap +" consumerParams:"+consumerParams +" streamType:"+streamType);
	try{
		if (theHashMap.count()>0 && theHashMap.get(channelID)!=undefined) {
			console.log("The hashmap contains some value of socket for this channelID:"+channelID);
			console.log("Add this socket to existing array of sockets and update the map");
			//socketCollection.push(currentSocket);
			var localSocketArray = theHashMap.get(channelID);
			console.log("The size of array inside hashmap without inserting current socket is :"+localSocketArray.length);
			localSocketArray.push(currentSocket);
			console.log("The size of array inside hashmap after inserting current socket is :"+localSocketArray.length);
			console.log("The modified array to be stored in hashmap is :"+localSocketArray);
			theHashMap.set(channelID, localSocketArray);
			console.log("The array has been inserted into the map, corresponding to the channelID i.e. key="+channelID);
		}
		else {
			console.log ("The hashmap does not contain any value. Add the socket to array and then to map.");
			var localSocketArray = [];
			localSocketArray.push(currentSocket);
			theHashMap.set(channelID, localSocketArray);
			var childProcess = setupChildProcess(consumerParams[2], consumerParams, streamType);
			console.log("The object returned after creation of child ===childProcess="+childProcess.toString());
			winston.log("info","The object returned after creation of child ===childProcess="+childProcess.toString());
			clients.push(childProcess);
		}
	}
	catch(e){
		winston.log("error","Error: "+e)
	}
	
}

function setupChildProcess(processID, subscriberProcessParams, streamType) {
	winston.log('info', "in setupChildProcess function with processID: "+processID+ ", subscriberProcessParams: "+subscriberProcessParams+ "and streamType: "+streamType);
	try{
		var app;
		if (streamType =="mqtt")
			app	= childProcess.fork('./MQTTSubscriber_child.js', subscriberProcessParams);
		else if (streamType == "amqp")
			app	= childProcess.fork('./AMQPSubscriber_child.js', subscriberProcessParams);
		else if (streamType == "websocket")
			app	= childProcess.fork('./WSSubscriber_child.js', subscriberProcessParams);
		app.on('message', function(msg){
			console.log(processID + ' got Event:', msg);

			var consumerTopicId = msg["Consumer Topic"];
			console.log("consumerTopicId-->"+consumerTopicId);
			console.log("Payload-->"+msg.Payload);
			var socketClientConn = devHashMap.get(consumerTopicId);

			if (socketClientConn!=undefined && socketClientConn.length>0){
				for (var i=0;i<socketClientConn.length;i++){
					console.log("Socket no "+i + " inside the map for consumer topic id="+consumerTopicId);
					console.log("emitting message to this socket ");
					socketClientConn[i].emit('applData', {appData:msg.Payload});
				}
			}
			else {
				app.kill();
				console.log("No socket connection found in the map. Killing the process");
				winston.log('warn',"No socket connection found in the map. Killing the process");
			}
		});
		return app;
	}
	catch(e){
		winston.log('error', "Error: "+ e)
	}
}
	//Two functions changed to support other protocols end


function createFile(subjectId, jsonObj, fileNeedsToChange) {
	console.log("Inside create File method. parameters passed are subjectId:"+subjectId +"and the jsonObj="+jsonObj);
	winston.log('info', "Inside create File method. parameters passed are subjectId:"+subjectId +"and the jsonObj="+jsonObj);
	
		var fileExistVar = false;
		if (subjectId!=undefined){
			try{
				fs.stat(path.join(__dirname +'/streamInfo/'+subjectId+'.json'), function(err, stat) {
					console.log("Error here:::"+err);
					winston.log('error', "Error here: "+err);
					if (err!=null)
						console.log("Error code here:::"+err);
						console.log('error', "Error code here: "+err);
					if(err == null) {
						console.log('File exists');
						fileExistVar = true;
						console.log("Inside create File method and value of fileNeedsToChange-->"+fileNeedsToChange);
						if (fileNeedsToChange == 'true'){
							var writeStream = fs.createWriteStream(path.join(__dirname +'/streamInfo/'+subjectId+'.json'));
							writeStream.write(jsonObj);
							writeStream.end();
							console.log("File needed to change so changed it");
						}
					} else if(err.code == 'ENOENT') {
						console.log("file does not exist");
						fileExistVar = false;
						var writeStream = fs.createWriteStream(path.join(__dirname +'/streamInfo/'+subjectId+'.json'));
					writeStream.write(jsonObj);
					writeStream.end();
					} else {
						winston.log('error','Some other error:'+ err.code);
					}
				});
			}
			catch(e){
				winston.log('error','Error: '+ e);
			}
		}
}
app.get('/getJsonConfig', function(req, res, err) {
	var fileName = req.query.subjectId;
	console.log("Filename-->"+fileName);
	var jsonData ="{}";
	try {
		jsonData = fs.readFileSync(path.join(__dirname +'/streamInfo/'+fileName+'.json'));
	}
	catch (e) {
		if (e.code === 'ENOENT') {
		  console.log('File not found!');
		  winston.log('warn','File not found!');
		} else {
		  throw e;
		   winston.log('error','Exception: '+ e);
		}
	}
	console.log("jsonData-->"+jsonData.toString());
	res.send(jsonData);
});
function onExit(err) {
	console.log('ending........... inside exit method');
	winston.log('info','ending........... inside exit method');
	clients.forEach(function(childProcessObj){
		childProcessObj.kill();
		console.log("Killing the process");
		winston.log('warn',"Killing the process");
	});
	try{
		process.removeAllListeners();
		process.exit();
	}
	catch(e){
		winston.log('error',"Error: "+e)
	}
	if (typeof err != 'undefined')
			console.log(err);
			winston.log('error', err);
	
}

//starts the test
//catches ctrl+c event
process.on('SIGINT', onExit)
