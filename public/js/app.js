// ######################################
// ## 07/11/2016 disable button added in 'streamSubmit' function
// ## 07/12/2016 data type in text field and placeholder added
// ## 07/12/2016 validation on forms completed
// ## 07/12/2016 publish button enabled after validation
// ## 07/13/2016 comments added
// ## 07/15/2016 configuration form for dynamic details
// ## 07/20/2016 socket auto connection on populating stream info bar
// ## 07/25/2016 socket error handling
// ##
// ######################################

var myCuiJs  = cui.api();
myCuiJs.setServiceUrl('PRD');

var eventJSONPayload = {
	"clientID":"", 
	"mqttBroker":"", 
	"brokerPort":8883, 
	"userName":"", 
	"passCode":"", 
	"messageType":"", 
	"msgTypeID":"",
	"id":"", 
	"producerTopic":"", 
	"msgToPublish":{}
}

//fetches all the devices
function getAllDevices($scope) {
	myCuiJs.getDevices()
	.then(function(response) {
		$scope.deviceList = [];
		response.forEach(function(fetchedDeviceFromList) {
			if(fetchedDeviceFromList.state.lifecycleState == "active"){ //checks if state of each device is active
					$scope.deviceList.push(fetchedDeviceFromList);//filtered device list is pushed in "deviceList" array
					$scope.$apply();
				}
			});
		});
}	

//fetches all the applications 
function getAllApplications($scope){
	myCuiJs.getApplications()
		.then(function(response) {
			$scope.appList = [];
			response.forEach(function(fetchedAppFromList) { // pushes all the applications into "applist" array
				$scope.appList.push(fetchedAppFromList);
				$scope.$apply();
			});
		})
}

// extracts the data from selected device by "getDevice" CUI function call
function getSelectedDeviceInfo(selectedDevId, $scope) {
	myCuiJs.getDevice({deviceId: selectedDevId})
	.then(function(response) {
		$scope.result = response;
		$scope.commandsList = response.supportedCommands;
		$scope.commandListLocal = [];
		$scope.eventFieldList = response.observableEvents; //"observableEvents" contains the list of all events in selected device
		$scope.eventsLocal = [];
		angular.forEach($scope.eventFieldList, function(item){
			var eventVar = { "name" : item.name, "id" : item.id, "count" : 0} //adds count to the eventField of selected device
			$scope.eventsLocal.push(eventVar);
			$scope.$apply();
		});
		
		angular.forEach($scope.commandsList, function(item){
			//checks if commands have fields
			if(item.args){ 
				var commandVar = { "name" : item.name, "id" : item.id, "args":[]}
				
				angular.forEach(item.args, function(commandField){
					var commandfieldVar = { "name" : commandField.name,"type":commandField.type, "value":""}; //adds value field to the commandField of selected device
					commandVar.args.push(commandfieldVar);					
				});
				$scope.commandListLocal.push(commandVar);
			}
			//if no fields found in commands
			else{ 
				var commandVar = { "name" : item.name, "id" : item.id, "message":""} // adding message field
				$scope.commandListLocal.push(commandVar);
			}
			$scope.$apply();
		});
		
	})
}	

var app = angular.module('appModule',[]);
app.controller('appController', function($scope, $interval,$http) {
	$scope.pauseLogs = false; //pauseLogs boolean initially set to false
	$scope.changeInFile = false;
   
	$('#submitStreamInfo').prop('disabled', true);
	$('#disconnectStreamInfo').prop('disabled', true);
	// alert("disabled")
	$interval(function () {
		getAuthToken($scope,"NoFollowUpFunction");
	}, 1000*60*10); // Refresh Token every ten minutes
	
	$scope.hostName = "localhost";
	$scope.hostPort = "1880";
	$scope.tokenClientId = "SJ4qGQuU88b1qwHfOeNbqWnG73MRfMTb";
	$scope.tokenClientSecret = "zZBfYRA5Ax9w0aA8";
	
	$scope.saveConfig = function(){
		saveConfig($scope);
	}
	
	$scope.selected ={};
	$scope.appSelected = function(item) {
		myCuiJs.getApplication({applicationId: $scope.selectedApp.id})
		.then(function(responseApp) {	
			console.log("User selected app: " + $scope.selectedApp.id); // displays the user selected application
			delete $scope.selectedDevice;
			$scope.$apply();
		})
		.fail(function(err) {
		  console.error(err);
		});
	}
    
	$scope.deviceSelected = function(item){
		var selectedDeviceId = $scope.selectedDevice.id;
		var selectedAppId = $scope.selectedApp.id;
		console.log("User selected device: " + selectedDeviceId); // displays the user selected device
		getSelectedDeviceInfo(selectedDeviceId, $scope); 
		// populateStreamInfoBar($scope, $http, selectedAppId); //populates stream information dynamically
		resetPage($scope,$http, selectedAppId,selectedDeviceId);
	}	
	$scope.currentSocket;
	$scope.errors = [];
	
	// pause/play functionality
	$scope.pauseLogging = function(){
		$('#pauseGlyphicon').toggleClass('glyphicon glyphicon-pause').toggleClass('glyphicon glyphicon-play');
			if ( $('#pauseGlyphicon').is(".glyphicon-pause")){
				$('#pauseGlyphicon').css("color","#FFF176");//going to resume logs
				$scope.pauseLogs = false;
			} else {
				$scope.pauseLogs = true;
				$('#pauseGlyphicon').css("color","#76FF03");
			}
		};
	//clear logs functionality
	$scope.clearLogs = function(){
			$("#incomingData").empty();
			$("#outgoingData").empty();
	};	

	//sends commands to server on form submit button
	$scope.getFormData = function(selectedCommand) {
		getFormData(selectedCommand, $scope, $http);
	}
	
	// $scope.streamInfoValidation = false;
	//validating streaminfo
	$scope.validateStreamInfo = function(){
		// if($scope.streamInfoValidation == false){
		validateStreamInfo($scope);
		// }
		$scope.streamSubmit = function(){
			if($scope.currentSocket){
                $scope.currentSocket.disconnect();
            }
			streamSubmit($scope, $scope.clientID, $scope.username, $scope.password, $scope.consumerTopic, $scope.selectedApp.id,$scope.selectedDevice.id,$scope.host,$scope.changeInFile)
		}
	}
});

//clears form text fields for republishing 
function clearForm($scope,selectedCommand){
	var keepGoing = true;
	angular.forEach($scope.commandListLocal, function(localCommand){
		//checks if commands have dynamic fields
		if(localCommand.name == selectedCommand && keepGoing) {
			if(localCommand.args){ 
				angular.forEach(localCommand.args, function(commandField) {
					commandField.value = "";
				});
			}//no dynamic fields
			else{ 
				localCommand.message= "";
			}
		}
		
	});
}

//sends commands to server on form submit button
function getFormData(inputParam1, $scope,$http) {
	var keepGoing = true;
	var eventJSON;
	var commandString= "{";
	angular.forEach($scope.commandListLocal, function(localCommand){
		if(localCommand.name == inputParam1 && keepGoing) { //checks if user input matches the command field name 
			angular.forEach(localCommand.args, function(commandField) {
				if(commandField.type == "integer"){
					$('#commandDetails input').attr('type','number');
				}
				commandString = commandString +"\""+ commandField.name +"\":" +"\""+commandField.value+"\" ,";
			});
			keepGoing = false;
			commandString =  commandString.substring(0, commandString.length-1) + "}";
			$scope.commandJSONMessage=commandString;

			var dataApp =  "\"clientID\":"+$scope.clientID+","+
									"\"mqttBroker\":"+$scope.host+","+
									"\"brokerPort\":"+$scope.port+","+
									"\"userName\":"+$scope.username+","+
									"\"passCode\":"+$scope.password+","+
									"\"messageType\":Command"+","+
									"\"msgTypeID\":"+localCommand.id+","+
									"\"deviceId\":"+$scope.selectedDevice.id+","+
									"\"producerTopic\":"+$scope.producerTopic+","+
									"\"msgToPublish\":"+$scope.commandJSONMessage;
			var event = "Event Sent: ";
			event = event.fontcolor("#42A5F5");
			if($scope.pauseLogs == false){ //checks if logs are played or paused
				$("#outgoingData").prepend(getDate() + '<br/>' + event + dataApp + '<br/><br/>'); // prepends logs for latest logs to be on top
			}
			if ($scope.errors.length == 0) {
				$http({
					url: $scope.httpHost + '/publish', //creates connection on publish button and sends below data
					dataType: 'json',
					method: 'POST',
								data:
								{	"clientID":$scope.clientID,
									"mqttBroker": $scope.host,
									"brokerPort": $scope.port,
									"userName": $scope.username,
									"passCode": $scope.password,
									"messageType": "Command",
									"msgTypeID": localCommand.id,
									"deviceId": $scope.selectedDevice.id,
									"producerTopic":$scope.producerTopic,
									"msgToPublish": $scope.commandJSONMessage
								},
								headers: {

								}
				}).success(function(data, message, xhr) {
					   $scope.success = true;
					   
					   if(data.id!=undefined || data.id!=""){
							$scope.msg = "JSON Payload sent";
					   } else {
							$scope.msg = "JSON Payload Failed";
					   }
						clearForm($scope,inputParam1);
					}
				).error(function(error) {
					   alert("ERROR"+error);
					   $scope.errors.push("ERROR -" + error.data.message);
				});
			}
		}
	})
}

//populates stream information dynamically
function populateStreamInfoBar ($scope, $http, selectedAppId,selectedDeviceId){
	$http({
			url: $scope.httpHost+'/getJsonConfig?subjectId='+selectedAppId+selectedDeviceId,
			dataType: 'json',
			method: 'GET',
			data: {},		
			headers: {}
		}).success(function(data, message, xhr) {
				$scope.success = true;
				$scope.fileExists = true;
				// checks if stream information already exists in file named with above "subjectId" on server
				if(data.Host){
					$scope.msg = "subject ID sent";
					$scope.clientID = data["Client ID"].toString();
					$scope.consumerTopic = data["Consumer Topic"].toString();
					$scope.producerTopic = data["Producer Topic"].toString();
					$scope.encryptionKey = data["Encryption Key"].toString();
					$scope.host = data.Host;
					$scope.port = data.Port;
					$scope.username = data.Username;
					$scope.password = data.Password;
					$scope.streamUserInput = 	"Host: "+$scope.host+ "\n" +
												"Port: "+$scope.port+ "\n" +
												"Username: "+$scope.username+ "\n" +
												"Password: "+$scope.password+ "\n" +
												"Client ID: "+$scope.clientID+ "\n" +
												"Consumer Topic: "+$scope.consumerTopic+ "\n" +
												"Producer Topic: "+$scope.producerTopic+ "\n" +
												"Encryption Key: "+$scope.encryptionKey;
					streamSubmit($scope, $scope.clientID, $scope.username, $scope.password, $scope.consumerTopic, selectedAppId,selectedDeviceId,$scope.host,$scope.changeInFile)
					$("#slideStreamInfo").animate({width: 'toggle'});
					$('#streamButton').find('span').toggleClass('glyphicon glyphicon-menu-right').toggleClass('glyphicon glyphicon-menu-left');
					return false;
				}
				else{
					$scope.fileExists = false;
				}
		})
		.error(function(error) {
			alert("ERROR"+error);
			$scope.errors.push("ERROR -" + error);
		});				
}

//sends stream information and create socket connection on "connect" button
function streamSubmit($scope, clientID, username, password, consumerTopic, selectedApp,selectedDeviceId,host,changeInFile){

	var streamQuery = "clientID="+clientID+"&userName="+username+"&passCode="+password+"&consumerTopic="+consumerTopic+"&JSONString="+$scope.streamString+"&subjectID="+selectedApp+selectedDeviceId+"&hostName="+host+"&changeInFile="+changeInFile;
	var sentQuery = "query sent: ";
	sentQuery = sentQuery.fontcolor("#42A5F5");
	if($scope.pauseLogs == false){
		$("#outgoingData").prepend(getDate() + '<br/>' + sentQuery +streamQuery + '<br/><br/>');
	}
	// socket io starts
	var socket = io.connect($scope.httpHost,{query:streamQuery});//sends the query string to server for connection
    $scope.currentSocket = socket;
	//on socket connect
	socket.on('connect', function() {
		console.log('socket is connected');
		$('#streamButton').addClass('btn-success').removeClass('btn-danger');
		$('#submitStreamInfo').prop('disabled', true);//"connect" button disabled after data is received
		$('#disconnectStreamInfo').prop('disabled', false);//"connect" button disabled after data is received
		var connectionInfo = "Connection created!";
		connectionInfo = connectionInfo.fontcolor("#42A5F5");
		if($scope.pauseLogs == false){
			$("#incomingData").prepend(getDate() + '<br/>' + connectionInfo + '<br/><br/>');
		}
	});
	// on socket disconnect
	socket.on('disconnect', function() {
		socket.disconnect();
        $('#submitStreamInfo').prop('disabled', false); //"connect" button enabled until no data is received
        $('#disconnectStreamInfo').prop('disabled', true); //"connect" button enabled until no data is received
        console.log('socket is disconnected');
        $('#streamButton').addClass('btn-danger').removeClass('btn-success');
        var disconnectionError = "Connection broken. Please reconnect";
        disconnectionError = disconnectionError.fontcolor("#EF5350");
        if($scope.pauseLogs == false){
            $("#incomingData").prepend(getDate() + '<br/>' + disconnectionError + '<br/><br/>');
        }
	});
	//on response
	socket.on('applData', function(data) {
		console.log('Got applData:', data.appData.eventTemplateId); 
		angular.forEach($scope.eventsLocal, function(item){
			if(item.id == data.appData.eventTemplateId) {
				item.count++; //increases count on receiving specific event
				$scope.$apply();
			}
		});
		
        if (host!=null && host.includes("websocket")){
            if($scope.pauseLogs == false){
                $("#incomingData").prepend(getDate() + '<br/>' + "Response:" + data.appData + '<br/><br/>');
            }
        }
        else if (host!=null && host.includes("amqp")){
            if($scope.pauseLogs == false){
                $("#incomingData").prepend(getDate() + '<br/>' + "Response:" + data.appData + '<br/><br/>');
            }
        }

        else if (host!=null && host.includes("mqtt")){
            var decodedString = atob(data.appData.message); //decode received message 
            var eventId = "Event ID: ";
            eventId = eventId.fontcolor("#42A5F5");
            if($scope.pauseLogs == false){
                $("#incomingData").prepend(getDate() + '<br/>' + eventId + data.appData.eventTemplateId + ":" + decodedString + '<br/><br/>');
            }
        }
	
	});
	// server is offline
	socket.on("connect_error", function(){
		var couldNotConnect = "Server is offline. Please try again.";
		couldNotConnect = couldNotConnect.fontcolor("#EF5350");
		if($scope.pauseLogs == false){
			$("#incomingData").prepend(getDate() + '<br/>' + couldNotConnect + '<br/><br/>');
		}
		slideLog();
		socket.disconnect();
	})
	
	// failed connection attempts
	socket.on("connect_failed", function(){
		var couldNotConnect = "Could not connect. Please try again.";
		couldNotConnect = couldNotConnect.fontcolor("#EF5350");
		if($scope.pauseLogs == false){
			$("#incomingData").prepend(getDate() + '<br/>' + couldNotConnect + '<br/><br/>');
		}
		slideLog();
		socket.disconnect();
	})
	//socket io ends
	$("#slideStreamInfo").animate({width: 'toggle'});
	$('#streamButton').find('span').toggleClass('glyphicon glyphicon-menu-right').toggleClass('glyphicon glyphicon-menu-left');
	return false;
}
function saveConfig($scope){
	
	$scope.hostName = $('#hostName').val();
	$scope.hostPort = $('#hostPort').val();
	$scope.tokenClientId = $('#tokenClientID').val();
	$scope.tokenClientSecret = $('#tokenClientSecret').val();
	
	var textToSave = "Host    " + $scope.hostName + ":" + $scope.hostPort + "\n" +
					"Client Id   " + $scope.tokenClientId + "\n" +
					"Client Secret   " + $scope.tokenClientSecret + "\n";
	getAuthToken($scope,"GetAllAppsAndDevices");
	$scope.configEntered = true;
	
	$scope.httpHost = "http://"+ $scope.hostName + ":" + $scope.hostPort; //defining host IP address for reuse
}

//fetches Authtoken
function getAuthToken($scope,followUpFunction) {
	myCuiJs.doSysAuth({
		clientId : $scope.tokenClientId,
		clientSecret : $scope.tokenClientSecret
		
	}).then(function(token) {
		if(followUpFunction == 'GetAllAppsAndDevices') {
				getAllApplications($scope);
				getAllDevices($scope);
		} else {
			console.log("Plain getTokenCall. No followup function is invoked");
		}
	}).fail(function(err) {
		console.log("Error in getAuthToken(): " + JSON.stringify(err));
	});
}
function resetPage($scope,$http,selectedAppId,selectedDeviceId){
	
	$("#incomingData").empty();
	$("#outgoingData").empty();
	$scope.streamUserInput = "";
	// $('#submitStreamInfo').prop('disabled', false);
	$('#streamButton').addClass('btn-danger').removeClass('btn-success');
	populateStreamInfoBar($scope, $http, selectedAppId,selectedDeviceId);
	
}
function validateStreamInfo($scope){
	splitStreamInfo($scope);
	$scope.keys = Object.keys(streamJSON);
	if($scope.keys.includes("Host" && "Port" && "Username" && "Password" && "Client ID" && "Consumer Topic" && "Producer Topic" && "Encryption Key") ){
		$scope.clientID = streamJSON["Client ID"].toString();
		$scope.encryptionKey = streamJSON["Encryption Key"].toString();
		$scope.producerTopic = streamJSON["Producer Topic"].toString();
		$scope.username = streamJSON.Username;
		$scope.password = streamJSON.Password;
		$scope.host = streamJSON.Host;
		$scope.port = streamJSON.Port;
		$scope.consumerTopic = streamJSON["Consumer Topic"].toString();
		if($scope.host && $scope.port && $scope.username && $scope.password &&  $scope.clientID && $scope.consumerTopic && $scope.producerTopic && $scope.encryptionKey && $scope.encryptionKey!="" ){
			$('#submitStreamInfo').prop('disabled', false);
			$('#disconnectStreamInfo').prop('disabled', true);
			$scope.changeInFile = true;
		}
		else{
			console.log("Validation of streaminfo failed");
			$('#submitStreamInfo').prop('disabled', true);
			$('#disconnectStreamInfo').prop('disabled', false);
		}
	}
	else{
		console.log("Validation of streaminfo failed");
		$('#submitStreamInfo').prop('disabled', true);
		$('#disconnectStreamInfo').prop('disabled', false);
	}
}
function splitStreamInfo($scope){
	$scope.streamString=$scope.streamUserInput;
	var str="{";
	var json = [];
	var toSplit1 = $scope.streamString.split("\n");
	for (var i = 0; i < toSplit1.length; i++) {
		var toSplit2 = toSplit1[i].split(":");
		for (var j=0;j<toSplit2.length;j++){
			toSplit2[j] = toSplit2[j].trim();
			str+="\""+toSplit2[j]+"\"";
			if (j!=toSplit2.length-1){
			str+=":";
			}
		}
		if (i!=toSplit1.length-1){
			str+=",";
		}
	}
	str+="}";
	$scope.streamString=str; //converts the data into JSON format
	streamJSON = JSON.parse($scope.streamString);
}