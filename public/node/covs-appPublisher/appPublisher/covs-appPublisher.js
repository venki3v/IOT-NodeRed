module.exports = function (RED) {
	"use strict";
	var fs = require('fs');
	var mqtt = require('mqtt'); 
	var amqp = require('amqplib');
	var when = require('when');
	var WebSocket = require('ws');
	var ca = __dirname + '/ca/chained_prod_cert_covapp_io.pem.cer';

	function createAppPublisher(n) {
		console.log("Step 1");
		RED.nodes.createNode(this,n);
		
		this.clientId =n.deviceClientID;
		console.log("this.clientId="+this.clientId);
		this.uname = n.appUname;
		this.pwd = n.appPwd;
		this.msgType = "Command";
		this.msgTypeId = n.messageTypeId;
		this.deviceId = n.deviceID;
		this.prdTopic = n.devProducerTopic;
		this.msgToPublish = n.messageToPublish;
		this.prtcolType = n.deviceProtocolType;
		
		//this.deviceTemplateId=token.deviceTemplateId;
		
		console.log("n.clientId="+n.pubClientId);
		console.log("n.prtcolType="+n.pubProtocolValue);
		var node = this;
		console.log("node-"+JSON.stringify(node));
		try{
			this.on('input', function(msg) {
				msg.clientId = this.clientId;
				console.log("msg.clientId="+msg.clientId);
				console.log("Step 3");
				console.log("msg="+msg);
				console.log("msg.payload="+msg.payload);
				console.log("JSON.stringify(msg.payload)="+JSON.stringify(msg.payload));
				var cliID = this.clientId;
				console.log("cliID="+cliID);
				var broker;
				console.log("Step 4");
				var broker_port;
				console.log("username="+this.uname);
				console.log("password="+this.pwd);
				console.log("msgType="+this.msgType);
				console.log("msgTypeId="+this.msgTypeId);
				console.log("deviceId="+this.deviceId);
				console.log("prdTopic="+this.prdTopic);
				console.log("msgToPublish="+this.msgToPublish);
				console.log("prtcolType="+this.prtcolType);
				
				var custMsgToPublish;
				if(JSON.stringify(msg.payload)!='' && isNaN(JSON.stringify(msg.payload))){
					custMsgToPublish = JSON.stringify(msg.payload);
				}else{
					custMsgToPublish = this.msgToPublish;
				}
				if (this.prtcolType=='MQTT') {
					console.log("INSIDE PUBLISHER MQTT LOOP");
					broker = "mqtt.covapp.io";
					broker_port = "8883";
					try{
						publishMessage(this.clientId+generateRandAlphaNumStr(3), broker, broker_port, this.uname, this.pwd, this.msgType, this.msgTypeId, this.deviceId, this.prdTopic, custMsgToPublish);
					}catch(e){
						node.warn(e,"could not publish message");
					}
				}
				else if (this.prtcolType=='AMQP'){
					console.log("INSIDE PUBLISHER AMQP LOOP");
					broker = "amqp.covapp.io";
					broker_port = "5671";
					try{
						publishAMQPMessage(this.clientID+generateRandAlphaNumStr(3), broker, broker_port, this.uname, this.pwd, this.msgType, this.msgTypeId, this.deviceId, this.prdTopic, JSON.stringify(custMsgToPublish));
					}catch(e){
						node.warn(e,"could not publish amqp message")
					}
					
				}
				else if (this.prtcolType=='Websocket'){
					console.log("INSIDE PUBLISHER WebSocket LOOP");
					broker = "websockets.wss.covapp.io";
					try{
						publishWebSocketMessage(this.clientID+generateRandAlphaNumStr(3), broker, broker_port, this.uname, this.pwd, this.msgType, this.msgTypeId, this.deviceId, this.prdTopic, JSON.stringify(custMsgToPublish));
					}catch(e){
						node.warn(e,"could not publish web socket message");
					}		
				}
				msg.payload = "Success";
				node.send(msg);
			});
		}catch(e){
			node.error(e,msg);
		}
	}
	RED.nodes.registerType("covs-appPublisher",createAppPublisher);
	function generateRandAlphaNumStr(len) {
		var rdmString = "";
		for( ; rdmString.length < len; rdmString  += Math.random().toString(36).substr(2));
		return  rdmString.substr(0, len);
	}
	function initiateMQTTConn(cliID, mqtt_broker, broker_port, mqtt_user, mqtt_pass) {
		console.log("Step 6");
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
			console.log("Sent MQTT connect request");
			mclient.on('connect', function () {
				console.log( "MQTT Connection established inside initiateMQTTConn method.");
			});
		}catch(e){
			console.log(e+" problem with mqtt connection")
		}
		return mclient;
	}

	function publishMessage(clientID, mqttBroker, brokerPort, userName, passCode, messageType, msgTypeID, deviceId, producerTopic, msgToPublish){
		try{
			var mclient = initiateMQTTConn(clientID, mqttBroker, brokerPort, userName, passCode);
			console.log("mesg to publish->"+msgToPublish);
			var encodedMsg = (new Buffer(msgToPublish)).toString('base64');
			console.log("encode message-->"+encodedMsg);
			var msgIdentifier;
			if(messageType == "Command") {
				msgIdentifier = "commandId";
			} else {
				msgIdentifier = "eventTemplateId";
			}
			var sendEventMessageObj = '{"messageId":"MSG12345","deviceId":"'+deviceId+'","'+msgIdentifier+'":"' + msgTypeID + '","message":"' + encodedMsg + '","encodingType":"BASE64"}';
			mclient.publish(producerTopic, sendEventMessageObj);
			console.log('Message published!!!'+sendEventMessageObj);
			mclient.end();
			console.log('MQTT Client disconnected programatically.');
		}catch(e){
			console.log("problem with initiating MQTT connection: "+e);
		}
	}

	function publishAMQPMessage(clientID, broker, brokerPort, userName, passCode, messageType, msgTypeID, deviceId, producerTopic, msgToPublish){
		try{
			var conn = initiateAMQPConn(producerTopic, broker, brokerPort, userName, passCode);
			console.log("msgToPublish-->"+msgToPublish);
			var encodedMsg = (new Buffer(msgToPublish)).toString('base64');
			console.log("encodedMsg-->"+encodedMsg);
			var msgIdentifier;
			if(messageType == "Command") {
				msgIdentifier = "commandId";
			} else {
				msgIdentifier = "eventTemplateId";
			}
			var sendEventMessageObj = '{"messageId":"MSG12345","deviceId":"'+deviceId+'","'+msgIdentifier+'":"' + msgTypeID + '","message":"' + encodedMsg + '","encodingType":"BASE64"}';
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
		}catch(e){
			console.log("problem with initiating AMQP connection: "+e)
		}
	}
	
	function initiateAMQPConn(producerStreamId, broker, port, user, pass) {
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
		}catch(e){
			console.log(e)
		}
		console.log("Sent AMQP connect request");
		return conn;
	}

	function publishWebSocketMessage(clientID, broker, port, userName, passCode, messageType, msgTypeID, deviceId, producerTopic, msgToPublish){
		try{
			var ws = initiateWSConn(producerTopic, broker, port, userName, passCode);
			console.log("msgToPublish for websocket="+msgToPublish);
			var encodedMsg = (new Buffer(msgToPublish)).toString('base64');
			console.log("encodedMsg->"+encodedMsg);
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
					console.log('Message published!!!'+sendEventMessageObj);
				});

				ws.on('error', function error(err) {
					console.log(err);
				});
				ws.onmessage = function(evt) {
					var msgReceived = evt.data;
					console.log("Message recieved as ack-->"+msgReceived);
					ws.close();
					console.log('Websocket Client disconnected programatically.');
				};
			}catch(e){
				console.log(e);
			}
		}catch(e){
			console.log(e);
		}
	}

	function initiateWSConn(producerStreamId, broker, port, user, pass) {
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
		}catch(e){
			console.log("problem with initiating Websocket connection: "+e)
		}		
		console.log("Sent WebSocket connect request");
		return ws;
	}
}