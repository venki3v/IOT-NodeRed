module.exports = function (RED) {
	"use strict";
	var ui = require('node-red-dashboard/ui')(RED);
	var Client = require('node-rest-client').Client;
	var PropertiesReader = require('properties-reader');
	var properties = PropertiesReader(__dirname + '/services.properties');
 var ourGroupId;
 var ourMemberId;
 var operation;
	function createGroup(n) {
	RED.nodes.createNode(this,n);
	this.clis=n.clis;
	this.personId=n.personId;
	ourMemberId=this.personId;
	this.groupId=n.groupId;
	ourGroupId=this.groupId;
	this.opType=n.opType;
	operation=this.opType;
	
	var node = this;
	var clis = RED.nodes.getNode(n.clis);
	if (!clis) { return; }
	try{
		this.on('input', function(msg) {
			var oauthData = JSON.parse(JSON.stringify(msg.oauth));
			var token = oauthData.access_token;
			ourMemberId=this.personId;
			ourGroupId=this.groupId;
			operation=this.opType;
			if (msg.payload!=''){
				var jsData = JSON.parse(msg.payload);
				ourGroupId = jsData.groupId;
				ourMemberId = jsData.memberId;
				operation = jsData.operation;
			}
			
			if (operation=="match"){
				callMatchOperation(ourGroupId, ourMemberId, token, node, msg, false);
			}
			else if (operation=="add"){
				callAddOperation(ourGroupId, ourMemberId, token, node, msg);
			}
			else if (operation=="delete"){
				callMatchOperation(ourGroupId, ourMemberId, token, node, msg, true);
				//callDeleteOperation(ourGroupId, ourMemberId, token, node, msg);
			}
		});
	}
	catch(e){
		node.error(e);
	}
	
	}
	RED.nodes.registerType("covs-group",createGroup);

	function generateRandAlphaNumStr(len) {
	  var rdmString = "";
	  for( ; rdmString.length < len; rdmString  += Math.random().toString(36).substr(2));
	  return  rdmString.substr(0, len);

	}
	function callMatchOperation(grpId, memberId, token, node, msg, isInternal){
		var membershipId;
		var matched = false;
		var grpURL = properties.get('group.url.getMembership');
		var client = new Client();
		var responseDataStr ="nothing";
		var args2 = {
				path: { "groupId": ourGroupId},
				headers: { 
					"Accept": "application/vnd.com.covisint.platform.group.membership.v1+json;includeGroupAndEntitlements=false",
					"Content-Type": "application/vnd.com.covisint.platform.group.membership.v1+json",
					"Authorization": "Bearer "+token
				} // request headers 
		};
		client.get(grpURL, args2, function (data, response) {
		responseDataStr =data.toString('utf8'); 
		var respJson = JSON.parse(responseDataStr);
		
		for (var i=0;i<respJson.length;i++){
			if (!matched){
				if (memberId.localeCompare(respJson[i].member.id)==0){
					matched = true;
					msg.payload="Match Found for "+memberId;
					membershipId= respJson[i].id;
				}
			}
			
		}
		if (!matched){
			msg.payload="Match not Found for "+memberId;
		}
			if (!isInternal){
				node.send(msg);
			}
			else {
				var grpDelURL = properties.get('group.url.getMembership') + "/${memberId}";
				var responseDelDataStr ="nothing";
				var argsDel2 = {
						path: { "groupId": ourGroupId, "memberId":membershipId},
						headers: { 
							"Accept": "application/vnd.com.covisint.platform.group.membership.v1+json",
							"Content-Type": "application/vnd.com.covisint.platform.group.membership.v1+json",
							"Authorization": "Bearer "+token
						} // request headers 
				};
				client.delete(grpDelURL, argsDel2, function (data, response) {

					if (data!=''){
						responseDelDataStr =data.toString('utf8'); 
						var respDelJson = JSON.parse(responseDelDataStr);
						msg.payload=respDelJson.apiMessage;
					}
					else {
						msg.payload="Member deleted successfully with id ="+memberId;
					}
					node.send(msg);
				
				});
			}
			
		});
		
	}
	
	function callAddOperation(grpId, memberId, token, node, msg){
		var grpURL = properties.get('group.url.getMembership');
		var client = new Client();
		var responseDataStr ="nothing";
		var args2 = {
				path: { "groupId": ourGroupId},
				headers: { 
					"Accept": "application/vnd.com.covisint.platform.group.membership.v1+json",
					"Content-Type": "application/vnd.com.covisint.platform.group.membership.v1+json",
					"Authorization": "Bearer "+token
				}, 
				data : {  
						   "creator":"id",
						   "creatorAppId":"IOT-WORKBENCH",
						   "group":{  
							  "id": grpId,
							  "type":"group",
							  "realm":"CISCODEV-CLOUD"
						   },
						   "member":{  
							  "id":memberId,
							  "type":"person",
							  "realm":"CISCODEV-CLOUD"
						   }
						}
		};
		try{
			client.post(grpURL, args2, function (data, response) {
				responseDataStr =data.toString('utf8'); 
				var respJson = JSON.parse(responseDataStr);
					msg.payload="Member Added with id ="+memberId;
					node.send(msg);
			});
		}
		catch(e){
			node.error(e,msg)
		}
		
		
	}
	
}
