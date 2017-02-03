module.exports = function (RED) {
	"use strict";
	var fs = require('fs');
	var mqtt = require('mqtt'); 
	var amqp = require('amqplib');
	var when = require('when');
	var WebSocket = require('ws');
	var ca = __dirname + '/ca/chained_prod_cert_covapp_io.pem.cer';

	function createDevicePublisher(n) {
		console.log("Step 1");
		RED.nodes.createNode(this,n);
		this.clis=n.clis;
		this.clientId =n.deviceClientId;
		console.log("this.clientId="+this.clientId);
		this.uname = n.deviceUname;
		this.pwd = n.devicePwd;
		this.msgType = n.msgType;
		this.msgTypeId = n.msgTypeId;
		this.deviceId = n.deviceId;
		this.prdTopic = n.deviceProducerTopic;
		this.msgToPublish = n.msgToPublish;
		this.prtcolType = n.deviceProtocolValue;
		console.log("n.clientId="+n.pubClientId);
		console.log("n.prtcolType="+n.pubProtocolValue);
		var node = this;
		var clis = RED.nodes.getNode(n.clis);
        if (!clis) { return; }
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
				//var mqtt_user = msg.wnProperty("node-input-uname");
				console.log("username="+this.uname);
				//var mqtt_pass = msg.hasOwnProperty("node-input-pwd");
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
	//		if (msg.payload=='' || msg.payload=='undefined' ){
				//console.log("There was nothing in msg.payload so textbox content will be sent as message.");
				//custMsgToPublish = this.msgToPublish;
			//}
			//else {
		//		custMsgToPublish = msg.payload;
				//console.log("msg.payload will be sent as message i.e. "+JSON.stringify(msg.payload));
			//}
			
			//var msgToPublish = {"heartRate":"111" ,"bodyTemprature":"111" };
				if (this.prtcolType=='MQTT') {
					console.log("INSIDE PUBLISHER MQTT LOOP");
					broker = "mqtt.covapp.io";
					broker_port = "8883";
					publishMessage(this.clientId+generateRandAlphaNumStr(3), broker, broker_port, this.uname, this.pwd, this.msgType, this.msgTypeId, this.deviceId, this.prdTopic, custMsgToPublish);
				}
				else if (this.prtcolType=='AMQP'){
					console.log("INSIDE PUBLISHER AMQP LOOP");
					broker = "amqp.covapp.io";
					broker_port = "5671";
					publishAMQPMessage(this.clientID+generateRandAlphaNumStr(3), broker, broker_port, this.uname, this.pwd, this.msgType, this.msgTypeId, this.deviceId, this.prdTopic, JSON.stringify(custMsgToPublish));
				}
				else if (this.prtcolType=='Websocket'){
					console.log("INSIDE PUBLISHER WebSocket LOOP");
					broker = "websockets.wss.covapp.io";
					publishWebSocketMessage(this.clientID+generateRandAlphaNumStr(3), broker, broker_port, this.uname, this.pwd, this.msgType, this.msgTypeId, this.deviceId, this.prdTopic, JSON.stringify(custMsgToPublish));			
				}
				msg.payload = "Success";
				node.send(msg);
			});
		}catch(e){
			node.error(e,msg);
			console.log(e)
		}
		
	}
	RED.nodes.registerType("covs-devicePublisher",createDevicePublisher);
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
		}
		catch(e){
			console.log(e);
			throw e;
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
			}
			else{
				msgIdentifier = "eventTemplateId";
			}
			var sendEventMessageObj = '{"messageId":"MSG12345","deviceId":"'+deviceId+'","'+msgIdentifier+'":"' + msgTypeID + '","message":"' + encodedMsg + '","encodingType":"BASE64"}';
			try{
				mclient.publish(producerTopic, sendEventMessageObj);
			}catch(e){
				console.log(e);
			}
			console.log('Message published!!!'+sendEventMessageObj);
			mclient.end();
			console.log('MQTT Client disconnected programatically.');
		}catch(e){
			console.log(e);
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
			console.log(e);
		}
	}

	function initiateAMQPConn(producerStreamId, broker, port, user, pass) {
		try{
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
			var conn = amqp.connect(url);
			console.log("Sent AMQP connect request");
			return conn;
		}
		catch(e){
			console.log(e)
		}
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
					console.log("Message sent");
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
				console.log(e)
			}
		}catch(e){
			console.log(e);
		}	
	}

	function initiateWSConn(producerStreamId, broker, port, user, pass) {
		try{
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

			var ws = new WebSocket('wss://' + broker + '/websocket/event/' + producerStreamId, options);
			console.log("Sent WebSocket connect request");
			return ws;
		}
		catch(e){
			console.log(e);
		}
	}

}
