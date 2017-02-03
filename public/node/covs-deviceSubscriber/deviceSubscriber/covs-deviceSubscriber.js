module.exports = function (RED) {
	"use strict";
	var fs = require('fs');
	var mqtt = require('mqtt'); 
	var amqp = require('amqplib');
	var when = require('when');
	var WebSocket = require('ws');
	var ca = __dirname + '/ca/chained_prod_cert_covapp_io.pem.cer';
	var consumerTopic;
	function createSubsDevice(n) {
		console.log("Step 1");
		RED.nodes.createNode(this,n);
		
		this.clientId =n.subsDeviceClientId;
		this.uname = n.subsDeviceUname;
		this.pwd = n.subsDevicePwd;
		this.consumerTopic = n.subsDeviceConsumerTopic;
		consumerTopic = this.consumerTopic;
		this.protocolValue = n.subsDeviceProtocolType;
		console.log("n.subsDeviceClientId="+n.subsDeviceClientId);
		console.log("n.subsDeviceProtocolType="+n.subsDeviceProtocolType);
		var node = this;
		console.log("node-"+JSON.stringify(node));
		try{
			this.on('input', function(msg) {
				msg.clientId = this.clientId;
				console.log("msg.clientId="+msg.clientId);
				msg.payload = "worked";
				console.log("Step 3");
				console.log(msg);
				console.log(msg.payload);
				var cliID = this.clientId;
				console.log("cliID="+cliID);
				var broker;
				console.log("Step 4");
				var broker_port;
				console.log("username="+this.uname);
				console.log("password="+this.pwd);
				console.log("consumerTopic="+this.consumerTopic);
				console.log("protocolValue="+this.protocolValue);
				consumerTopic = this.consumerTopic;
				var conn;
				if (this.protocolValue=='MQTT'){
					console.log("INSIDE MQTT LOOP");
					broker = "mqtt.covapp.io";
					broker_port = "8883";
					conn = initiateMQTTConn(this.clientId+generateRandAlphaNumStr(3), broker, broker_port, this.uname, this.pwd);
				}
				else if (this.protocolValue=='AMQP'){
					console.log("INSIDE AMQP LOOP");
					broker = "amqp.covapp.io";
					broker_port = "5671";
					var opts = {
									cert : fs.readFileSync(ca),
									passphrase : fs.readFileSync(ca),
									ca : [ fs.readFileSync(ca) ]
								};

					process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

					var url = 'amqps://' + this.uname + ':' + this.pwd + '@' + broker + ':' + broker_port + "/";
					conn = amqp.connect(url, opts);
				}
				else if (this.protocolValue=='Websocket'){
					console.log("INSIDE Websocket LOOP");
					broker = "websockets.wss.covapp.io";
					var realm = 'CISCODEV-CLOUD';
					var requestor = '<requestor>';
					var requestorapp = '<requestorapp>';
					var headers = {
							realm : realm,
							requestor : requestor,
							requestorapp : requestorapp,
							username : this.uname,
							password : this.pwd
					};
					var options = {
							headers : headers
					};
					conn = new WebSocket('wss://' + broker + '/websocket/message/' + consumerTopic, options);
				}
				//conn = initiateMQTTConn(this.clientId+generateRandAlphaNumStr(3), broker, broker_port, this.uname, this.pwd);
				msg.payload = "Success from subscriber";
				//var mesg = "MQTT connected.";
				node.status({fill:"green",shape:"dot",text:"connected"});
				if (this.protocolValue=='MQTT'){
					try{
						conn.subscribe(this.consumerTopic);
						conn.on('message', function (topic, message) {
						// message is Buffer 
						var jsonObj = JSON.parse(message);
						var deviceId = jsonObj.deviceId;
						var decodesMsgContent = (new Buffer(jsonObj.message, 'base64').toString());
						console.log('info', "Message Arrived. Creating Payload here.");	
						var returnPayload = {"Consumer Topic":this.consumerTopic,"Payload":jsonObj};
						console.log("JSON.stringify of data-->"+JSON.stringify(jsonObj));
						//writeStream.write(JSON.stringify(jsonObj));
						decodesMsgContent = JSON.parse(decodesMsgContent);
						decodesMsgContent.deviceId=deviceId;
						msg.payload = decodesMsgContent;
						/*if(decodesMsgContent.indexOf("latitude") > 0){
							decodesMsgContent = decodesMsgContent.replace('latitude','lat');
							decodesMsgContent = decodesMsgContent.replace('longitude','lon');
							decodesMsgContent = decodesMsgContent.replace(/\\/g,"");
							var len = decodesMsgContent.length;
							decodesMsgContent = decodesMsgContent.slice(1,(len-1));
							console.log("Updated Payload "+JSON.stringify(decodesMsgContent));
							msg.payload = decodesMsgContent;
						}else {
							msg.payload = decodesMsgContent;
						}*/

						node.send(msg);
						//client.end();
						});
					}catch(e){
						node.error(e);
						node.debug(e);
					}
				}
				else if (this.protocolValue=='AMQP'){
					try{
						conn.then(function(conn) {
							console.log("AMQP Connection successful.");
							return when(conn.createChannel().then(function(channel) {
								var sub = channel.assertQueue(consumerTopic, {
									durable : true
								});
								sub = sub.then(function(_qok) {
									return channel.consume(consumerTopic, function(mesg) {
										console.log(" [x] Received '%s'", mesg.content.toString());
										var jsonObj = JSON.parse(mesg.content.toString());
										console.log("Json Object parsed-->"+jsonObj);
										var decodesMsgContent = (new Buffer(jsonObj.message, 'base64').toString());
										console.log("Decoded message content->"+decodesMsgContent);
										console.log('info', "Message Arrived. Creating Payload here.");
										var returnPayload = {"Consumer Topic":consumerTopic,"Payload":jsonObj};
										console.log("JSON.stringify of AMQP subscription data-->"+JSON.stringify(jsonObj));
										//writeStream.write(JSON.stringify(jsonObj));
										if(decodesMsgContent.indexOf("latitude") > 0){
											decodesMsgContent = decodesMsgContent.replace('latitude','lat');
											decodesMsgContent = decodesMsgContent.replace('longitude','lon');
											decodesMsgContent = decodesMsgContent.replace(/\\/g,"");
											var len = decodesMsgContent.length;
											decodesMsgContent = decodesMsgContent.slice(1,(len-1));
											decodesMsgContent = JSON.parse(decodesMsgContent);
											decodesMsgContent.name=deviceId;
											console.log("Updated Payload "+JSON.stringify(decodesMsgContent));
											msg.payload = decodesMsgContent;
										}else {
											msg.payload = JSON.stringify(decodesMsgContent);
										}
										//msg.payload = mesg.content.toString();
										node.send(msg);
									}, {
										noAck : true
									});
								});

								return sub.then(function(_consumeOk) {
									console.log(' [*] Waiting for messages. To exit press CTRL+C');
								});
							}));
						}).then(null, console.warn);
					}
					catch(e){
						node.error(e);
						node.debug(e)
					}
				}
				else if (this.protocolValue=='WebSocket'){
					try{
						conn.on('open', function open() {
						//To receive message some dummy message need to sent
						//ws.send("dummyMessgae");
							console.log("Web Socket connection established successfully.");
						});

						conn.on('error', function error(err) {
							console.log("Error is WS connection: " + err);
						});

						conn.on('message', function(data, flags) {
							console.log("Message received: " + data);
							//ws.close();
						});
					}catch(e){
						node.error(e);
						node.debug(e);
					}
				}
				node.send(msg);
			});
		}
		catch(e){
			node.error(e,msg)
		}
	}

	RED.nodes.registerType("covs-deviceSubscriber",createSubsDevice);

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
			node.error(e);
		}
		return mclient;
	}

}
