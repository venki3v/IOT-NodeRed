module.exports = function (RED) {
	"use strict";
	
	function createOAuth(n){
		RED.nodes.createNode(this,n);
		this.clientID=n.clientID;
		this.clientSecret=n.clientSecret;
		var node = this;
		var ClientOAuth2 = require('client-oauth2')
		try{
			this.on('input', function(msg) {
				console.log("Input msg:::::::::::"+msg.payload);
				if (msg.payload){
					var jsData = JSON.parse(msg.payload);
					if (jsData.clientID!=undefined && jsData.clientSecret!=undefined){
						this.clientID=jsData.clientID;
						this.clientSecret=jsData.clientSecret;
					}
				}
				console.log("this.clientID->"+this.clientID);
				console.log("this.clientSecret->"+this.clientSecret);
				var covsAuth = new ClientOAuth2({
				  clientId: this.clientID,
				  clientSecret: this.clientSecret,
				  accessTokenUri: 'https://api.us1.covisint.com/oauth/v3/token',
				  authorizationUri: '',
				  authorizationGrants: ['credentials'],
				  redirectUri: 'http://example.com/auth/github/callback',
				  scopes: ['all']
				});
				
				covsAuth.credentials.getToken().then(function (user) {
					console.log(user) 
					console.log("Inside "+user.data.expires_in);
					var str = "{\"access_token \":"+"\""+user.accessToken+"\","+"\r\n"+"\"expires_in\":"+"\""+user.data.expires_in+"\","+"\r\n"+"\"token_type\": "+"\"Bearer\""+"\r\n"+"}";
					var jsonObj = {};
					jsonObj.access_token=user.accessToken;
					jsonObj.expires_in=user.data.expires_in;
					jsonObj.token_type='Bearer';
					//msg.payload=jsonObj;
					msg.oauth=jsonObj;
					console.log("jsonObje being returned-->"+jsonObj);
					node.send(msg);
				});
				
			});
		}
		catch(e){
			node.error(e,msg);
		}
		
		
	}
	
RED.nodes.registerType("covs-oauth",createOAuth);
}
