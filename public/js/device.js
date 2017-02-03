// ######################################
// ## 07/11/2016 disable button added in 'streamSubmit' function
// ## 07/12/2016 data type in text field and placeholder added
// ## 07/12/2016 validation on forms completed
// ## 07/12/2016 publish button enabled after validation
// ## 07/13/2016 comments added
// ## 07/15/2016 configuration form for dynamic details
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
"deviceId":"", 
"producerTopic":"", 
"msgToPublish":{}
}

var app = angular.module('myApp',[]);
angular.module('filters.stringUtils', [])
.filter('removeSpaces', [function() {
    return function(string) {
        if (!angular.isString(string)) {
            return string;
        }
        return string.replace(/[\s]/g, '');
    };
}]);

//fetches all the devices
function getAllDevices($scope) {
	myCuiJs.getDevices()
	.then(function(response) {
		$scope.deviceList = [];
		response.forEach(function(fetchedDeviceFromList) {
			if(fetchedDeviceFromList.state.lifecycleState == "active"){//checks if state of each device is active
					$scope.deviceList.push(fetchedDeviceFromList);//filtered device list is pushed in "deviceList" array
                    delete $scope.selectedDevice;
					$scope.$apply();
				}
			});
		});
}

// extracts the data from selected device by "getDevice" CUI function call
function getSelectedDeviceInfo(selectedDevId, $scope) {

	console.log("Get Device data for ID: " + selectedDevId);
	myCuiJs.getDevice({deviceId: selectedDevId})
	.then(function(response) {
		$scope.result = response;
		$scope.eventFieldList = response.observableEvents;//"observableEvents" contains the list of all events in selected device
		$scope.eventsLocal = [];
		$scope.commandList = response.supportedCommands;//"supportedCommands" contains the list of all commands in selected device
		$scope.commandsLocal = [];
		angular.forEach($scope.commandList, function(item){
			var commandVar = { "name" : item.name, "id" : item.id, "count" : 0}//adds count to the commandField of selected device
			$scope.commandsLocal.push(commandVar);
		});
		angular.forEach($scope.eventFieldList, function(item){
			var eventVar = { "name" : item.name, "id" : item.id, "eventFields":[]}
			angular.forEach(item.eventFields, function(eventField){
				var fieldVar = { "name" : eventField.name, "type":eventField.type, "value":""}; //adds value field to the eventField 
				eventVar.eventFields.push(fieldVar);				
			});
		$scope.eventsLocal.push(eventVar);
		$scope.$apply();
		});
	});
}

app.controller('myCtrl', function($scope, $interval,$http) {
	var smile = "";
	$scope.pauseLogs = false;//pauseLogs boolean initially set to false 
	$('#submitStreamInfo').prop('disabled', true);
   
	$scope.hostName = "localhost";
	$scope.hostPort = "1880";
	$scope.tokenClientId = "SJ4qGQuU88b1qwHfOeNbqWnG73MRfMTb";
	$scope.tokenClientSecret = "zZBfYRA5Ax9w0aA8";
	
	$scope.saveConfig = function(){
		saveConfig($scope,$http,$interval);
		
	}
	$interval(function () {
		getAuthToken($scope, 'NoFollowUpFunction');
	}, 1000*60*10); // Refresh Token every ten minutes
	
	 // Refresh Token every ten minutes
	$scope.changeInFile = false;
	$scope.selected ={};
	$scope.deviceSelected = function(item) {	// displays the user selected device						
        getSelectedDeviceInfo($scope.selectedDevice.id, $scope)
		resetPage($scope,$http, $scope.selectedDevice.id);
		
	};
    $scope.currentSocket;
	$scope.errors = [];
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
	$scope.resetPage = function(){
		resetPage($scope,$http, $scope.selectedDevice.id)
	};
	
	//sends commands to server on form submit button
	$scope.getFormData = function(selectedEvent){
		getFormData(selectedEvent, $scope, $http);
	}
	

	//validating streaminfo
	$scope.validateStreamInfo = function(){
		validateStreamInfo($scope);
		//sends stream information and create socket connection on "connect" button
		$scope.streamSubmit = function(){
			if($scope.currentSocket){
                $scope.currentSocket.disconnect();
            }
			streamSubmit($scope, $scope.clientID, $scope.username, $scope.password, $scope.consumerTopic,$scope.selectedDevice.id,$scope.host,$scope.changeInFile)
		}
	}
});

//clears form text fields for republishing
function clearForm($scope,selectedEvent){
	var keepGoing = true;
	angular.forEach($scope.eventsLocal, function(localEvent){
		if(localEvent.name == selectedEvent && keepGoing) {
			angular.forEach(localEvent.eventFields, function(eventField) {
				eventField.value = "";
			});
		}
	});
}

//sends commands to server on form submit button	
function getFormData(inputParam1, $scope,$http) {
	var keepGoing = true;
	var eventJSON;
	var eventString= "{";
	angular.forEach($scope.eventsLocal, function(localEvent){
		if(localEvent.name == inputParam1 && keepGoing) {//checks if user input matches the command field name
			angular.forEach(localEvent.eventFields, function(eventField) {
				if(eventField.type == "integer"){
					$('#eventDetails input').attr('type','number');
				}
				eventString = eventString +"\""+ eventField.name +"\":" +"\""+eventField.value+"\" ,";
			});
			keepGoing = false;
			eventString =  eventString.substring(0, eventString.length-1) + "}";
			$scope.eventJSONMessage=eventString;
			var stream = "Stream Information: ";
			stream = stream.fontcolor("#42A5F5");
			if($scope.pauseLogs == false){//checks if logs are played or paused
				$("#outgoingData").prepend(getDate() + '<br/>' + stream + $scope.eventJSONMessage + '<br/><br/>');
			}
			var eventJSON = JSON.parse($scope.eventJSONMessage);
			var dataApp =  "\"clientID\":"+$scope.clientID+","+
							"\"mqttBroker\":"+$scope.host+","+
							"\"brokerPort\":"+$scope.port+","+
							"\"userName\":"+$scope.username+","+
							"\"passCode\":"+$scope.password+","+
							"\"messageType\":Event"+","+
							"\"msgTypeID\":"+localEvent.id+","+
							"\"deviceId\":"+$scope.selectedDevice.id+","+
							"\"producerTopic\":"+$scope.producerTopic+","+
							"\"msgToPublish\":"+$scope.eventJSONMessage;
			var event = "Event Sent: ";
			event = event.fontcolor("#42A5F5");
			if($scope.pauseLogs == false){
				$("#outgoingData").prepend(getDate() + '<br/>' + event + dataApp + '<br/><br/>');// prepends logs for latest logs to be on top
			}
			if ($scope.errors.length == 0) {
				$http({
				
					url: $scope.httpHost+'/publish',//creates connection on publish button and sends below data
					dataType: 'json',
					method: 'POST',
						data: {
						"clientID": $scope.clientID,
						"mqttBroker": $scope.host,
						"brokerPort": $scope.port,
						"userName": $scope.username,
						"passCode": $scope.password,
						"messageType": "Event",
						"msgTypeID": localEvent.id,
						"deviceId": $scope.selectedDevice.id,
						"producerTopic": $scope.producerTopic,
						"msgToPublish": $scope.eventJSONMessage
						},		
						headers: {

						}
				}).success(function(data, message, xhr) {
					   $scope.success = true;
					   if(data.id!=undefined || data.id!=""){
							$scope.msg = "JSON Payload sent";
					   } else {
							$scope.msg = "JSON Payload Failed";
							var jsonFailure = "JSON Payload Failed";
							jsonFailure = jsonFailure.fontcolor("#EF5350");
							if($scope.pauseLogs == false){
								$("#incomingData").prepend(getDate() + '<br/>' + jsonFailure + '<br/><br/>');
							}
					   }
					   clearForm($scope,inputParam1);
					   
					}
				).error(function(error) {
					alert("ERROR"+error);
					$scope.errors.push("ERROR -" + error.data.message);
					var errorConn = "Error in connection ";
					errorConn = errorConn.fontcolor("#EF5350");
					if($scope.pauseLogs == false){
						$("#incomingData").prepend(getDate() + '<br/>' + errorConn + ":" + error + '<br/><br/>');
					}
				});
			}
		}
	})
}

//populates stream information on textarea dynamically
function populateStreamInfoBar ($scope, $http, selectedDeviceId){
	$http({
			url: $scope.httpHost+'/getJsonConfig?subjectId='+selectedDeviceId,
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
				streamSubmit($scope, $scope.clientID, $scope.username, $scope.password, $scope.consumerTopic, selectedDeviceId,$scope.host,$scope.changeInFile)		
				$("#slideStreamInfo").animate({width: 'toggle'});
				$('#streamButton').find('span').toggleClass('glyphicon glyphicon-menu-right').toggleClass('glyphicon glyphicon-menu-left');
				return false;
			}
			else{
				$scope.fileExists = false;
			}
			
	}).error(function(error) {
			alert("ERROR"+error);
			$scope.errors.push("ERROR -" + error);
	});
}

//sends stream information and create socket connection on "connect" button
function streamSubmit($scope, clientID, username, password, consumerTopic, selectedDeviceId,host,changeInFile) {
	var streamQuery = "clientID="+clientID+"&userName="+username+"&passCode="+password+"&consumerTopic="+consumerTopic+"&JSONString="+$scope.streamString+"&subjectID="+selectedDeviceId+"&hostName="+host+"&changeInFile="+changeInFile;
	var sentQuery = "query sent: ";
	sentQuery = sentQuery.fontcolor("#42A5F5");
	if($scope.pauseLogs == false){
		$("#outgoingData").prepend(getDate() + '<br/>' + sentQuery +streamQuery + '<br/><br/>');
	}
	// socket io starts
	var socket = io.connect($scope.httpHost,{query:streamQuery});
	$scope.currentSocket = socket;
	//on socket connect
	socket.on('connect', function() {
		console.log('socket is connected');
		$('#streamButton').addClass('btn-success').removeClass('btn-danger');
		$('#submitStreamInfo').prop('disabled', true);//"connect" button disabled after data is received
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
		console.log('socket is disconnected');
		$('#streamButton').addClass('btn-danger').removeClass('btn-success');
		var disconnectionError = "Connection broken. Please reconnect";
		disconnectionError = disconnectionError.fontcolor("#EF5350");
		if($scope.pauseLogs == false){
			$("#incomingData").prepend(getDate() + '<br/>' + disconnectionError + '<br/><br/>');
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
	
	//on response
	socket.on('applData', function(data) {
		console.log('Socket connection successfully created; Got applData:', data.appData);  //received response
		angular.forEach($scope.commandsLocal, function(item){
			if(item.id == data.appData.commandId) {
				item.count++; //increases count on receiving specific command
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
            var decodedString = atob(data.appData.message);//decode received message 
            var commandID = "Command ID: ";
            commandID = commandID.fontcolor("#42A5F5");
            if($scope.pauseLogs == false){
            $("#incomingData").prepend(getDate() + '<br/>' + commandID + data.appData.commandId + ":" + decodedString + '<br/><br/>');
            }
        }
	
	});
	//socket io ends
	$("#slideStreamInfo").animate({width: 'toggle'});
	$('#streamButton').find('span').toggleClass('glyphicon glyphicon-menu-right').toggleClass('glyphicon glyphicon-menu-left');
	return false;
}	

function saveConfig($scope,$http,$interval){
	
	$scope.hostName = $('#hostName').val();
	$scope.hostPort = $('#hostPort').val();
	$scope.tokenClientId = $('#tokenClientID').val();
	$scope.tokenClientSecret = $('#tokenClientSecret').val();
	var textToSave = "Host    " + $scope.hostName + ":" + $scope.hostPort + "\n" +
					"Client Id   " + $scope.tokenClientId + "\n" +
					"Client Secret   " + $scope.tokenClientSecret + "\n";	
	getAuthToken($scope, "GetAllDevices");
	$scope.httpHost = "http://"+ $scope.hostName + ":" + $scope.hostPort; //defining host IP address for reuse
	$scope.configEntered=true;
	checkCovsRedStatus($scope)
	$interval(function () {
		checkCovsRedStatus($scope);
	}, 1000*2);
	
}
function checkCovsRedStatus($scope){
	checkRedStatus($scope.httpHost,'');
	// checkOverAllStatus($scope.httpHost,'');
}
function checkRedStatus(url,param)
{
  if(window.XMLHttpRequest) {
    try {
      req = new XMLHttpRequest();
    } catch(e) {
      req = false;
    }
  } else if(window.ActiveXObject) {
    try {
      req = new ActiveXObject("Msxml2.XMLHTTP");
    } catch(e) {
      try {
        req = new ActiveXObject("Microsoft.XMLHTTP");
      } catch(e) {
        req = false;
      }
    }
  }
	if(req) {
		try{
			req.onreadystatechange  = function() {
				if (this.readyState == 4 && this.status == 200) {

					smile = true;
				}
				else{
					smile = false;
				}
			}
			req.open("GET", url, false);
			req.send();
		}catch(e){
			console.log("error with sending ajax "+ e)
		}
	}
	if ( smile === true ) {	
		$('.loading-panel').css( "display", "block" )
		$('#statusLine').css( "display", "block" )
		$('#statusLineFalse').css( "display", "none" )
		$('#overAllStatus').css( "display", "none" )
	
	} else if ( smile === false ) {
		$('.loading-panel').css( "display", "none" )
		$('#statusLine').css( "display", "none" )
		$('#statusLineFalse').css( "display", "block" )
		$('#overAllStatus').css( "display", "block" )
	}
}
// function checkOverAllStatus(url,param)
// {
  // if(window.XMLHttpRequest) {
    // try {
      // req = new XMLHttpRequest();
    // } catch(e) {
      // req = false;
    // }
  // } else if(window.ActiveXObject) {
    // try {
      // req = new ActiveXObject("Msxml2.XMLHTTP");
    // } catch(e) {
      // try {
        // req = new ActiveXObject("Microsoft.XMLHTTP");
      // } catch(e) {
        // req = false;
      // }
    // }
  // }
	// if(req) {
		// req.onreadystatechange  = function() {
			// if (this.readyState == 4 && this.status == 200) {
				// smile = true;
			// }
			// else{
				// smile = false;
			// }
		// }
		// req.open("GET", url, false);
		// req.send();
	// }
	// if ( smile === true ) {
		// $('#overAllStatus').css( "display", "none" )
	
	// } else if ( smile === false ) {
		// $('#overAllStatus').css("display", "block" )
	// }
// }		
function getAuthToken($scope, followUpFunction) {
	myCuiJs.doSysAuth({
		
		clientId : $scope.tokenClientId,
		clientSecret : $scope.tokenClientSecret
		
	}).then(function(token) {
		if(followUpFunction == 'GetAllDevices') {
				getAllDevices($scope);
		} else {
			console.log("Plain getTokenCall. No followup function is invoked");
		}
	}).fail(function(err) {
		console.log("Error in getAuthToken(): " + JSON.stringify(err));
	});
}

function resetPage($scope,$http,selectedDeviceId){
	
	$("#incomingData").empty();
	$("#outgoingData").empty();
	$scope.streamUserInput = "";
	$('#submitStreamInfo').prop('disabled', false);
	$('#streamButton').addClass('btn-danger').removeClass('btn-success');
	populateStreamInfoBar($scope, $http, selectedDeviceId);
	
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
			// $scope.streamInfoValidation = true;
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