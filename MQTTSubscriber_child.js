
'use strict';

var mqtt = require('mqtt');  // SXP generic library
var fs = require('fs');
var path = require('path');

/* SXP Config */
var ca = __dirname + '/ca/chained_prod_cert_covapp_io.pem.cer';
var mqtt_broker = 'mqtt.covapp.io';
var broker_port = 8883;
var mqtt_user;
var mqtt_pass;
var consumer_topic;
var clientIDVar;
var subjectId;
var fileName;
var initialSt =false;

//Process input parameters
process.argv.forEach(function (val, index, array) {
	  console.log(index + ': ' + val);
});

// First 2 arguments are node and MQTTSubscriber
console.log("username: " + process.argv[2]);
console.log("pwd: " + process.argv[3]);
console.log("consumer topic: " + process.argv[4]);
console.log("client id: " + process.argv[5]);

mqtt_user = process.argv[2];
mqtt_pass = process.argv[3];
consumer_topic = process.argv[4];
clientIDVar = process.argv[5] +generateRandAlphaNumStr(3);//added this to have a unique client id for each client.
console.log("client id var: " + clientIDVar); 
subjectId = process.argv[6];
function generateRandAlphaNumStr(len) {
  var rdmString = "";
  for( ; rdmString.length < len; rdmString  += Math.random().toString(36).substr(2));
  return  rdmString.substr(0, len);

}

var options = {
		host: mqtt_broker,
		port: broker_port,
		protocol: 'mqtts',
		ca:  [fs.readFileSync(ca)],
		secureProtocol: 'TLSv1_method',
		rejectUnauthorized : false,
		username: mqtt_user,
		password: mqtt_pass, 
		clientId: clientIDVar
};

var mclient = mqtt.connect(options);
console.log('info', "Sent connect request for child.");

/*var fileOptions = {
  flags: 'a',
  defaultEncoding: 'utf8',
  fd: null,
  mode: process.env[(process.platform == 'win32') ? '0o666' : '0666'],//linux: 0666,//0666  for win 0o666
  autoClose: true
};*/
mclient.on('connect', function () {
	console.log('info', "MQTT Connection established for child.");
	mclient.subscribe(consumer_topic);
    //writeStream = fs.createWriteStream(path.join(__dirname +'/logs/'+subjectId+'.txt')); 
	//client.publish('presence', 'Hello mqtt');
    var tstamp = Math.floor(Date.now() / 1000);
    var fdate = getFormattedDate();
    fileName = path.join(__dirname +'/logs/'+subjectId+'.txt');
    if (!initialSt){
        fs.appendFile(fileName,'Start of the logs @'+fdate+' \r\n');
        initialSt = true;
    }
     
});


mclient.on('message', function (topic, message) {
	// message is Buffer 
	var jsonObj = JSON.parse(message);
	var deviceId = jsonObj.deviceId;
	var decodesMsgContent = (new Buffer(jsonObj.message, 'base64').toString());
	console.log('info', "Message Arrived. Creating Payload here.");
	var returnPayload = {"Consumer Topic":consumer_topic,"Payload":jsonObj};
    console.log("writing data to file-->"+JSON.stringify(jsonObj));
    //writeStream.write(JSON.stringify(jsonObj));
    var tstamp = Math.floor(Date.now() / 1000);
    fs.appendFile(fileName,JSON.stringify(jsonObj)+'\r\n');    
    process.send(returnPayload);
	//client.end();
});

/*process.on('exit', function() {
	console.log("Killing the Child-Process: %s", consumer_topic);
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
	console.log('ending........... inside exit method of child process');
	mclient.end();
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