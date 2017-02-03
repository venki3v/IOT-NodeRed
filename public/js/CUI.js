(function() {
'use strict';


cui.INFO = { 'version': '1.2.4' };

// --------------------------------------------
cui.supportsLocalStorage = function() {
  var mod = 'testlocal';
  try {
      localStorage.setItem(mod, mod);
      localStorage.removeItem(mod);
      return true;
  } catch(e) {
      return false;
  }
};

cui.supportsBeforeunload = function () {
  if (cui.supportsLocalStorage() &&
  localStorage.getItem(keyBeforeUnload) === 'yes' ) {
      return true;
  } else {
      return false;
  }
};

// --------------------------------
// Establish cui.log (and cui.time, and etc.)
//		-allows cross-browser-safe logging
//		-can be toggled on/off from local storage
// -------------------
// 1.Stub out undefined console methods so they do not throw exceptions.
var noop = function() {};
var methods = [
    'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
    'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
    'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
    'timeStamp', 'trace', 'warn'
];
var length = methods.length;
var console = (window.console = window.console || {});
var method;
while (length--) {
  method = methods[length];
  if (!console[method]) {
      console[method] = noop;
  }
}

// 2a. Safely bind 'cui.log()' to console.log...
if (Function.prototype.bind) {
  cui.log = Function.prototype.bind.call(console.log, console);
} 
else {
  cui.log = function() {
      Function.prototype.apply.call(console.log, console, arguments);
  };
}
var logger = cui.log;

// Optional. intercept calls to window.log and route according to our setup...
// 2b. IF DEV, bind shortcut window.log to our enabled log.
// window.log = cui.log;
// 2c. IF PRD, bind shortcut window.log to noop.
// window.log = noop;

cui.enableLog = function() {
  cui.log = logger;
};
cui.disableLog = function() {
  cui.log = noop;
};

// By defult... turn log off!
cui.disableLog();

// NB Can turn on logging by adding 'key:cui.log, value:true' to local storage cache
// Can also turn it on within a page via console > cui.enableLog()
if (cui.supportsLocalStorage()) {
  var logEnabled = localStorage.getItem('cui.log'); 
  if (logEnabled) {
      cui.enableLog();
  }
}
// --------------------------------------------


// --------------------------------------------
// cui ajax helper methods
// --------------------------------------------
var keyBeforeUnload = 'cui.supportsBeforeunload';
if (cui.supportsLocalStorage() &&
! localStorage.getItem(keyBeforeUnload)) {
  $(window).on('beforeunload', function() {
    localStorage.setItem(keyBeforeUnload, 'yes');
  });
  $(window).on('unload', function() {
    // If unload fires, and beforeunload hasn't set the keyBeforeUnload,
    // then beforeunload didn't fire and is therefore not supported (iPad).
    if (! localStorage.getItem(keyBeforeUnload)) {
        localStorage.setItem(keyBeforeUnload, 'no');
    }
  });
}

var beforeunloadCalled = false;
$(window).on('beforeunload', function() {
  beforeunloadCalled = true;
});


cui.parseError = function(response) {
  var msg = response.statusText;
  if (! msg.length) {
    msg = $.parseJSON(response.responseText);
  }
  return msg;
};


cui.ajax = function(options) {

  // Mixin the options which were passed-in with defaults...
  var url = options.url || '';
  var async = (options.async === false) ? false: true;
  var type = options.type || 'GET';
  var beforeSend = options.beforeSend || null;
  var xhrFields = options.xhrFields || null;
  var accepts = options.accepts || '';
  var contentType = options.contentType || '';
  var dataType = options.dataType || 'json';
  var data = options.data || null;
  var dataFilter = options.dataFilter || null;
  var converters = options.converters || {};
  var complete = options.complete || null;
  var error = options.error || null;
  var success = options.success || null;


  if (url.length) {
    cui.log('cui.ajax sending', url, type, accepts, contentType, options);

    return $.ajax({
      url: url,
      type: type,
      async: async,
      xhrFields: xhrFields,
      /*xhrFields: {
        withCredentials: true
      },*/
      beforeSend: beforeSend,
      accepts: {
        text: accepts,
        json: accepts
      },
      data: data,
      contentType: contentType,
      dataType: dataType,
      dataFilter: dataFilter,
      converters: converters,
      error: error,
      complete: complete,
      success: success
    }).then(null,
      // NB define a null success handler, and an explicit fail handler
      // which can then filter the 'fail' cases to see if it is only a fail 
      // because the response was null.
      // (jQuery, as of 1.9.1, returns fail when no response is received,
      //  (http://bugs.jquery.com/ticket/13459))
      // Returning an empty response is the case in many of our services that accept POST but return nothing.
      // So we detect that situation and transform it from a 'fail' into a 'done'.

      function(jqXHR, textStatus, errorThrown) {
        //cui.log('cui.ajax.then(fail): status=' + textStatus + ' : err=' + errorThrown + ' : xhr=' + jqXHR.responseText + '.');
        if (jqXHR.responseText === '') {
          cui.log('cui.ajax.then(fail):resolve()');
          var response = [];
          return $.Deferred().resolve(response, textStatus, jqXHR);
        } else {
          cui.log('cui.ajax.then(fail):reject()', jqXHR);
          return $.Deferred().reject(jqXHR, textStatus, errorThrown);
        }
      }
    ).done(function(response, textStatus, jqXHR) {
      // NB we land here after receiving an empty response on a 200 call...
      cui.log('cui.ajax.done:', response, textStatus, jqXHR);
      // ...so, manually invoke the success because jQuery does not do it 
      if ($.isFunction(success)) {
        success(response, textStatus, jqXHR);
      }
    }).fail(function(jqXHR, textStatus, errorThrown) {
      function handleError() {
        cui.log('cui.ajax.fail: status=' + textStatus + ' : err=' + errorThrown + ' : xhr=' + jqXHR.responseText);
      }

      // NB. Need to differentiate from errors caused by 
      // user navigating away from page,
      // versus a legit server-related error...
      // This solution based on: http://stackoverflow.com/a/18170879
      if (cui.supportsBeforeunload()) {
        if (!beforeunloadCalled) {
          // This is a legit server-related error, so handle normally.
          handleError();
        }
        // else ignore.
      } else {
        setTimeout(function() {
          // This could be a legit server-related error, so handle normally...
          // after 1 second delay,
          // which will never fire if in fact page is unloading.
          handleError();
        }, 1000);
      }
    });
  }
};
// --------------------------------------------



// --------------------------------
// General utilities
// --------------------------------
cui.util = {};

cui.util.hello = function() {
  cui.log('hello util');
};

cui.util.toTitleCase = function(str) {
  return str.replace(/\w\S*/g, function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

cui.util.qs = (function(a) {
	// parse QS for a specified parameter's value
  // called like so:  
  //    var myVar = qs["myParam"];
  
  if (a === '') {
    return {};
  }

  var b = {};
  for (var i = 0; i < a.length; ++i) {
    var p = a[i].split('=');
    if (p.length !== 2) {
        continue;
    }
    b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, ' '));
  }
  return b;
})(window.location.search.substr(1).split('&'));

// --------------------------------






/**
 * CUIjs - the Javascript Library for Covisint APIs and Products.
 *
 * Fork me on <a target="_blank" href="https://github.com/thirdwavellc/cui">GitHub</a>
 * 
 * <b>Features</b>:
 * * Frictionless invocation of <a target="_blank" href="https://developer.covisint.com/web/guest/home">Covisint APIs</a> from javascript.
 * * Convienent abstration-layer preserves all API features and behaviors.
 * * Function names use CRUD terminology (get,create,update,delete) rather than RESTful terminology (PUT,POST,etc.).
 * * URI Paremeters and Query String parameters retain their underlying names.
 * * Automatically supplies `accepts` headers.
 * * Automatically supplies `authorization` header.
 * * Automatically caches, issues, and refreshes access token (`OAuth` and/or `JWT`).
 * * Returns ES6-compatible <a target="_blank" href="http://learn.jquery.com/code-organization/deferreds/">Promise</a>.
 * * Works in browser or nodejs client.
 * 
 * <b>Getting Started</b>: 
 * * Include `cui.js` as a bower dependency in your project,
 * * or, include `cui.js` via a `<script>` tag in the header of index.html.
 * * Then, follow these typical usage examples...
 *
 * <b>Please NOTE</b>: In the left column of this page, the function names have an API categorical prefix
 * (i.e. <b><i>idm&#95</i></b>someFunction, <b><i>iot&#95</i></b>anotherFunction, etc). This is done only to maintain a categorical sequence within the list. 
 * <b>Do not include the prefix or the underscore</b> when making the actual call in code!
 * 
 * @name _UsageTips_
 * @example
 * // ALWAYS obtain an instance of cuijs and set the platform URL
 * var myCuiJs = cui.api();
 * myCuiJs.setServiceUrl('PRD');
 * 
 * @example
 * // 1. Getting a system-level access token.
 * // (Making a call that uses URI parameters).
 * myCuiJs.doSysAuth({
 *   clientId: 'your client id',
 *   clientSecret: 'your client secret'
 * })
 * .then(function(token) {
 *   // Do something, now that the token is available.
 *   // NOTE. All subsequent calls will now automatically
 *   // include this returned access token as the bearer token.
 * })
 * .fail(function(err) {
 *   // Handle error.
 * });
 * 
 * @example
 * // 2. Making a call that uses Query String parameters
 * // NOTE. The qs is an array of arrays (key-value pairs).
 * myCuiJs.activatePerson({qs: [['personId','your person id']]})
 * .then(function(response) {
 *   // Do something with response.
 * })
 * .fail(function(err) {
 *   // Handle error.
 *   var errStr = myCuiJs.parseError(err);
 * });

 *
 * @example
 * // 3. Making a call that uses URI parameter and POSTS a JSON body
 * var orgData = 
 * myCuiJs.updateOrganization({
 *  organizationId: 'OPLATFORM-CUI195802',
 *  data: { 
 *   id: 'OPLATFORM-CUI195802',
 *   version: 1445351932000,
 *   // etc...
 *   // (Format of body is determined by the API-defined schema)
 * })
 * .then(function(response) {
 *   // Do something with response.
 * })
 * .fail(function(err) {
 *   // Handle error.
 *   var errStr = myCuiJs.parseError(err);
 * });
 * 
 */

/**
 * Wrapper function that serves as entry point into the cuijs library of calls.
 * 
 * @name cui.api
 * @example
 * // Obtain an instance of cuijs...
 * var myCuiJs = cui.api();
 * // ...and set the platform URL
 * myCuiJs.setServiceUrl('PRD');
 * 
 * // Now, make a call using that instance
 * myCuiJs.activatePerson({'qs': [['personId','your person id']]})
 * .then(function(response) {
 *   // Do something with response.
 * })
 * .fail(function(err) {
 *   // Handle error.
 * });
 * @returns {Function} An instance of the cui.api() wrapper function, which is then used to make subsequent calls.
 */
// --------------------------------------------
cui.api = function () {

  // -------------------------------------
  // Private vars
  // -------------------------------------
  var DEF_AUTH_STATE = 'cuijs';
  var serviceUrl = '';
  var apiPlatform;
  var covAuthServerUrl = '';
  //var originUri;

  var versionOverrides = [];
  var authHandler = null;
  var autoRefreshTokenDisabled = false;
  var refreshTokenTimer;

  var apiUrls = [];
  apiUrls.push({name: 'PRD', url: 'https://api.us1.covisint.com'});
  apiUrls.push({name: 'PRDBLUE', url: 'https://apidev.covapp.io'});
  apiUrls.push({name: 'QA', url: 'https://apiqa.np.covapp.io'});
  apiUrls.push({name: 'STG', url: 'https://apistg.np.covapp.io'});


  var ACCEPTS_TOKEN = 'AT';
  var ACCEPTS_TEMPLATE = 'application/vnd.com.covisint' + ACCEPTS_TOKEN + '+json';
  var ACCEPTS_TOKEN_REGEX = new RegExp(ACCEPTS_TOKEN, 'g');

  // NB The tokens MUST be unique!
  var ACTIONDEF_TOKEN = 'ADT';
  var ACTIONDEFTEMP_TOKEN = 'ADTT';
  var APPLICATIONID_TOKEN = 'APID';
  var ATTRIBUTEID_TOKEN = 'AID';
  var ATTRIBUTETEMPLATEID_TOKEN = 'ATTID';
  var ATTRIBUTETYPEID_TOKEN = 'ATID';
  var AUTH_REDIRECT_TOKEN = 'ART';
  var CLIENTID_TOKEN = 'CLID';
  var COMMANDTEMPLID_TOKEN = 'CTID';
  var DEVICEID_TOKEN = 'DID';
  var DEVICETEMPLID_TOKEN = 'DTID';
  var ENDTIME_TOKEN = 'ETT';
  var EVENTPOLICYID_TOKEN = 'EPID';
  var EVENTSRCID_TOKEN = 'ESID';
  var EVENTTEMPLID_TOKEN = 'ETID';
  var GROUPENTITLEMENTID_TOKEN = 'GEID';
  var GROUPID_TOKEN = 'GID';
  var GROUPMEMBERSHIPID_TOKEN = 'GMID';
  var IDENTITY_SERVER_TOKEN = 'IURL';
  var INVITATIONID_TOKEN = 'IID';
  var MESSAGEID_TOKEN = 'MID';
  var ORGANIZATIONID_TOKEN = 'OID';
  var PACKAGEID_TOKEN = 'PID';
  var PERSONID_TOKEN = 'PEID';
  var POLICYID_TOKEN = 'POID';
  var REASON_TOKEN = 'RT';
  var REQUESTID_TOKEN = 'RID';
  var RESPONSETYPE_TOKEN = 'RTT';
  var ROUTEID_TOKEN = 'ROID';
  var RULEDEFID_TOKEN = 'RUDID';
  var SCOPE_TOKEN = 'SCT';
  var SERVER_TOKEN = 'SURL';
  var SSO_LOGOUT_TOKEN = 'SSOLURL';
  var SSO_SERVER_TOKEN = 'SSOURL';
  var SERVICEID_TOKEN = 'SID';
  var SOLUTIONINSTANCEID_TOKEN = 'SIID';
  var STATE_TOKEN = 'STT';
  var STARTTIME_TOKEN = 'STRT';
  var STREAMID_TOKEN = 'STID';
  var TAG_TOKEN = 'TT';
  var TRIGGERDEF_TOKEN = 'TDT';
  var TRIGGERDEFTEMP_TOKEN = 'TDTT';

  var ACTIONDEF_TOKEN_REGEX = new RegExp(ACTIONDEF_TOKEN, 'g');
  var ACTIONDEFTEMP_TOKEN_REGEX = new RegExp(ACTIONDEFTEMP_TOKEN, 'g');
  var APPLICATIONID_TOKEN_REGEX = new RegExp(APPLICATIONID_TOKEN, 'g');
  var ATTRIBUTEID_TOKEN_REGEX = new RegExp(ATTRIBUTEID_TOKEN, 'g');
  var ATTRIBUTETEMPLATEID_TOKEN_REGEX = new RegExp(ATTRIBUTETEMPLATEID_TOKEN, 'g');
  var ATTRIBUTETYPEID_TOKEN_REGEX = new RegExp(ATTRIBUTETYPEID_TOKEN, 'g');
  var AUTH_REDIRECT_TOKEN_REGEX = new RegExp(AUTH_REDIRECT_TOKEN, 'g');
  var CLIENTID_TOKEN_REGEX = new RegExp(CLIENTID_TOKEN, 'g');
  var COMMANDTEMPLID_TOKEN_REGEX = new RegExp(COMMANDTEMPLID_TOKEN, 'g');
  var DEVICEID_TOKEN_REGEX = new RegExp(DEVICEID_TOKEN, 'g');
  var DEVICETEMPLID_TOKEN_REGEX = new RegExp(DEVICETEMPLID_TOKEN, 'g');
  var ENDTIME_TOKEN_REGEX = new RegExp(ENDTIME_TOKEN, 'g');
  var EVENTPOLICYID_TOKEN_REGEX = new RegExp(EVENTPOLICYID_TOKEN, 'g');
  var EVENTSRCID_TOKEN_REGEX = new RegExp(EVENTSRCID_TOKEN, 'g');
  var EVENTTEMPLID_TOKEN_REGEX = new RegExp(EVENTTEMPLID_TOKEN, 'g');
  var GROUPENTITLEMENTID_TOKEN_REGEX = new RegExp(GROUPENTITLEMENTID_TOKEN, 'g');
  var GROUPID_TOKEN_REGEX = new RegExp(GROUPID_TOKEN, 'g');
  var GROUPMEMBERSHIPID_TOKEN_REGEX = new RegExp(GROUPMEMBERSHIPID_TOKEN, 'g');
  var IDENTITY_SERVER_TOKEN_REGEX = new RegExp(IDENTITY_SERVER_TOKEN, 'g');
  var INVITATIONID_TOKEN_REGEX = new RegExp(INVITATIONID_TOKEN, 'g');
  var MESSAGEID_TOKEN_REGEX = new RegExp(MESSAGEID_TOKEN, 'g');
  var ORGANIZATIONID_TOKEN_REGEX = new RegExp(ORGANIZATIONID_TOKEN, 'g');
  var PACKAGEID_TOKEN_REGEX = new RegExp(PACKAGEID_TOKEN, 'g');
  var PERSONID_TOKEN_REGEX = new RegExp(PERSONID_TOKEN, 'g');
  var POLICYID_TOKEN_REGEX = new RegExp(POLICYID_TOKEN, 'g');
  var REASON_TOKEN_REGEX = new RegExp(REASON_TOKEN, 'g');
  var REQUESTID_TOKEN_REGEX = new RegExp(REQUESTID_TOKEN, 'g');
  var RESPONSETYPE_TOKEN_REGEX = new RegExp(RESPONSETYPE_TOKEN, 'g');
  var ROUTEID_TOKEN_REGEX = new RegExp(ROUTEID_TOKEN, 'g');
  var RULEDEFID_TOKEN_REGEX = new RegExp(RULEDEFID_TOKEN, 'g');
  var SCOPE_TOKEN_REGEX = new RegExp(SCOPE_TOKEN, 'g');
  var SERVER_TOKEN_REGEX = new RegExp(SERVER_TOKEN, 'g');
  var SSO_LOGOUT_TOKEN_REGEX = new RegExp(SSO_LOGOUT_TOKEN, 'g');
  var SSO_SERVER_TOKEN_REGEX = new RegExp(SSO_SERVER_TOKEN, 'g');
  var SERVICEID_TOKEN_REGEX = new RegExp(SERVICEID_TOKEN, 'g');
  var SOLUTIONINSTANCEID_TOKEN_REGEX = new RegExp(SOLUTIONINSTANCEID_TOKEN, 'g');
  var STARTTIME_TOKEN_REGEX = new RegExp(STARTTIME_TOKEN, 'g');
  var STATE_TOKEN_REGEX = new RegExp(STATE_TOKEN, 'g');
  var STREAMID_TOKEN_REGEX = new RegExp(STREAMID_TOKEN, 'g');
  var TAG_TOKEN_REGEX = new RegExp(TAG_TOKEN, 'g');
  var TRIGGERDEF_TOKEN_REGEX = new RegExp(TRIGGERDEF_TOKEN, 'g');
  var TRIGGERDEFTEMP_TOKEN_REGEX = new RegExp(TRIGGERDEFTEMP_TOKEN, 'g');

  var optionVar = [];
  optionVar.push({regex: ACTIONDEF_TOKEN_REGEX, name: 'actionDefinitionId'});
  optionVar.push({regex: ACTIONDEFTEMP_TOKEN_REGEX, name: 'actionDefinitionTemplateId'});
  optionVar.push({regex: APPLICATIONID_TOKEN_REGEX, name: 'applicationId'});
  optionVar.push({regex: ATTRIBUTEID_TOKEN_REGEX, name: 'attributeId'});
  optionVar.push({regex: ATTRIBUTETEMPLATEID_TOKEN_REGEX, name: 'attributeTemplateId'});
  optionVar.push({regex: ATTRIBUTETYPEID_TOKEN_REGEX, name: 'attributeTypeId'});
  optionVar.push({regex: AUTH_REDIRECT_TOKEN_REGEX, name: 'authRedirect'});
  optionVar.push({regex: CLIENTID_TOKEN_REGEX, name: 'clientId'});
  optionVar.push({regex: COMMANDTEMPLID_TOKEN_REGEX, name: 'commandTemplateId'});
  optionVar.push({regex: DEVICEID_TOKEN_REGEX, name: 'deviceId'});
  optionVar.push({regex: DEVICETEMPLID_TOKEN_REGEX, name: 'deviceTemplateId'});
  optionVar.push({regex: ENDTIME_TOKEN_REGEX, name: 'endTime'});
  optionVar.push({regex: EVENTPOLICYID_TOKEN_REGEX, name: 'eventPolicyId'});
  optionVar.push({regex: EVENTSRCID_TOKEN_REGEX, name: 'eventSourceId'});
  optionVar.push({regex: EVENTTEMPLID_TOKEN_REGEX, name: 'eventTemplateId'});
  optionVar.push({regex: GROUPENTITLEMENTID_TOKEN_REGEX, name: 'groupEntitlementId'});
  optionVar.push({regex: GROUPID_TOKEN_REGEX, name: 'groupId'});
  optionVar.push({regex: GROUPMEMBERSHIPID_TOKEN_REGEX, name: 'groupMembershipId'});
  optionVar.push({regex: IDENTITY_SERVER_TOKEN_REGEX, name: 'idmIdentityUrl'});
  optionVar.push({regex: INVITATIONID_TOKEN_REGEX, name: 'invitationId'});
  optionVar.push({regex: MESSAGEID_TOKEN_REGEX, name: 'messageId'});
  optionVar.push({regex: ORGANIZATIONID_TOKEN_REGEX, name: 'organizationId'});
  optionVar.push({regex: PACKAGEID_TOKEN_REGEX, name: 'packageId'});
  optionVar.push({regex: PERSONID_TOKEN_REGEX, name: 'personId'});
  optionVar.push({regex: POLICYID_TOKEN_REGEX, name: 'policyId'});
  optionVar.push({regex: REASON_TOKEN_REGEX, name: 'reason'});
  optionVar.push({regex: REQUESTID_TOKEN_REGEX, name: 'requestId'});
  optionVar.push({regex: RESPONSETYPE_TOKEN_REGEX, name: 'responseType'});
  optionVar.push({regex: ROUTEID_TOKEN_REGEX, name: 'routeId'});
  optionVar.push({regex: RULEDEFID_TOKEN_REGEX, name: 'ruleDefinitionId'});
  optionVar.push({regex: SERVICEID_TOKEN_REGEX, name: 'serviceId'});
  optionVar.push({regex: SCOPE_TOKEN_REGEX, name: 'scope'});
  optionVar.push({regex: SOLUTIONINSTANCEID_TOKEN_REGEX, name: 'solutionInstanceId'});
  optionVar.push({regex: STARTTIME_TOKEN_REGEX, name: 'startTime'});
  optionVar.push({regex: STATE_TOKEN_REGEX, name: 'state'});
  optionVar.push({regex: STREAMID_TOKEN_REGEX, name: 'streamId'});
  optionVar.push({regex: TAG_TOKEN_REGEX, name: 'tag'});
  optionVar.push({regex: TRIGGERDEF_TOKEN_REGEX, name: 'triggerDefinitionId'});
  optionVar.push({regex: TRIGGERDEFTEMP_TOKEN_REGEX, name: 'triggerDefinitionTemplateId'});


  var dataCalls = [];
  // -------------
  // Auth ...
  // -------------
  dataCalls.push({cmd: '3LEG_OAUTH', cmdType: 'popup', call: SERVER_TOKEN + '/oauth/v3/authorization?client_id=' + CLIENTID_TOKEN + '&response_type=' + RESPONSETYPE_TOKEN + '&scope=' + SCOPE_TOKEN + '&state=' + STATE_TOKEN});
  dataCalls.push({cmd: 'SYS_TOKEN', cmdType: 'auth', call: SERVER_TOKEN + '/oauth/v3/token'});
  dataCalls.push({cmd: 'INTROSPECT_TOKEN', call: SERVER_TOKEN + '/oauth/v3/introspect'});
  dataCalls.push({cmd: 'REVOKE_TOKEN', call: SERVER_TOKEN + '/oauth/v3/revoke'});
  // ---
  dataCalls.push({cmd: 'COV_AUTH_INFO', cmdType: 'authinit', call: SERVER_TOKEN + '/solution/v2/instances'});
  //dataCalls.push({cmd: 'COV_AUTH_POP_PREV', cmdType: 'popup', call: SSO_SERVER_TOKEN + '/login.do?SPA_URI='+ AUTH_REDIRECT_TOKEN});
  //dataCalls.push({cmd: 'COV_AUTH_PREV', cmdType: 'redirect', call: SSO_SERVER_TOKEN + '/login.do?SPA_URI='+ AUTH_REDIRECT_TOKEN});
  dataCalls.push({cmd: 'COV_AUTH_POP', cmdType: 'popup', call: SSO_SERVER_TOKEN + '/CommonReg/secured?cmd=JWTAUTHENTICATE&SPA_URI='+ AUTH_REDIRECT_TOKEN});
  dataCalls.push({cmd: 'COV_AUTH', cmdType: 'redirect', call: SSO_SERVER_TOKEN + '/CommonReg/secured?cmd=JWTAUTHENTICATE&SPA_URI='+ AUTH_REDIRECT_TOKEN});
  dataCalls.push({cmd: 'COV_LOGOUT', cmdType: 'redirect', call: SSO_LOGOUT_TOKEN + '/logout.do'});
  dataCalls.push({cmd: 'COV_JWT_LOGOUT', accepts: '.platform.token.v1', call: SERVER_TOKEN + '/authn/v4/token/tasks/invalidate'});

  // -------------
  // Admin ...
  // -------------
  dataCalls.push({cmd: 'CLIENT_APPS', accepts: '.api.clientApplication.v1', acceptsSuffix: ';includeSecret=true', call: SERVER_TOKEN + '/apimanage/v1/solutionInstances/' + SOLUTIONINSTANCEID_TOKEN + '/clientApplications'});
  dataCalls.push({cmd: 'CREATE_CLIENT_APP', accepts: '.api.clientApplication.v1', call: SERVER_TOKEN + '/apimanage/v1/solutionInstances/' + SOLUTIONINSTANCEID_TOKEN + '/clientApplications'});
  dataCalls.push({cmd: 'CLIENT_APP', accepts: '.api.clientApplication.v1', acceptsSuffix: ';includeSecret=true', call: SERVER_TOKEN + '/apimanage/v1/solutionInstances/' + SOLUTIONINSTANCEID_TOKEN + '/clientApplications/' + CLIENTID_TOKEN});
  dataCalls.push({cmd: 'CLIENT_APP_UPD', accepts: '.api.clientApplication.v1', call: SERVER_TOKEN + '/apimanage/v1/solutionInstances/' + SOLUTIONINSTANCEID_TOKEN + '/clientApplications/' + CLIENTID_TOKEN});
  dataCalls.push({cmd: 'CLIENT_APP_OAUTH', accepts: '.api.oauth.configuration.v1', call: SERVER_TOKEN + '/apimanage/v1/solutionInstances/' + SOLUTIONINSTANCEID_TOKEN + '/clientApplications/' + CLIENTID_TOKEN + '/oauthConfiguration'});
  dataCalls.push({cmd: 'CLIENT_APP_SCOPE', accepts: '.api.oauth.scopes.v1', call: SERVER_TOKEN + '/apimanage/v1/solutionInstances/' + SOLUTIONINSTANCEID_TOKEN + '/clientApplications/' + CLIENTID_TOKEN + '/scopes'});
  dataCalls.push({cmd: 'SOLUINST_OAUTH', accepts: '.api.oauth.configuration.v1', call: SERVER_TOKEN + '/apimanage/v1/solutionInstances/' + SOLUTIONINSTANCEID_TOKEN + '/oauthConfiguration'});
  dataCalls.push({cmd: 'SOLUINST_SCOPE', accepts: '.api.oauth.scopes.v1', call: SERVER_TOKEN + '/apimanage/v1/solutionInstances/' + SOLUTIONINSTANCEID_TOKEN + '/scopes'});
  dataCalls.push({cmd: 'SOLUINST_SCOPE_DESC', accepts: '.api.oauth.scopeDescriptions.v1', call: SERVER_TOKEN + '/apimanage/v1/solutionInstances/' + SOLUTIONINSTANCEID_TOKEN + '/scopeDescriptions/default'});
  

  // -------------
  // IdM ...
  // -------------
  // v2...
  dataCalls.push({apiName: 'organization', apiVer: 2, cmd: 'ORGS', accepts: '.platform.organization.v1', call: SERVER_TOKEN + '/organization/v2/organizations'});
  dataCalls.push({apiName: 'organization', apiVer: 2, cmd: 'ORG', accepts: '.platform.organization.v1', call: SERVER_TOKEN + '/organization/v2/organizations/' + ORGANIZATIONID_TOKEN});
  dataCalls.push({apiName: 'organization', apiVer: 2, cmd: 'ORG_HIERARCHY', accepts: '.platform.reference.hierarchy.v1', call: SERVER_TOKEN + '/organization/v2/organizations/' + ORGANIZATIONID_TOKEN + '/hierarchy'});
  
  // v3...
  dataCalls.push({apiName: 'organization', apiVer: 3, cmd: 'ORGS', cmdType: 'unsecured', accepts: '.platform.organization.v1', call: SERVER_TOKEN + '/organization/v3/organizations'});
  dataCalls.push({apiName: 'organization', apiVer: 3, cmd: 'ORGS_COUNT', cmdType: 'unsecured', accepts: '.platform.organization.v1', call: SERVER_TOKEN + '/organization/v3/organizations/count'});
  dataCalls.push({apiName: 'organization', apiVer: 3, cmd: 'ORG_REQUESTS', cmdType: 'unsecured', accepts: '.platform.organization.request.v1', call: SERVER_TOKEN + '/organization/v3/organizations/requests'});
  dataCalls.push({apiName: 'organization', apiVer: 3, cmd: 'ORG_REQUESTS_APPROVE', accepts: '.platform.organization.request.v1', call: SERVER_TOKEN + '/organization/v3/organizations/requests/tasks/approve'});
  dataCalls.push({apiName: 'organization', apiVer: 3, cmd: 'ORG_REQUESTS_DENY', accepts: '.platform.organization.request.v1', call: SERVER_TOKEN + '/organization/v3/organizations/requests/tasks/deny'});
  dataCalls.push({apiName: 'organization', apiVer: 3, cmd: 'ORG', cmdType: 'unsecured', accepts: '.platform.organization.v1', call: SERVER_TOKEN + '/organization/v3/organizations/' + ORGANIZATIONID_TOKEN});
  dataCalls.push({apiName: 'organization', apiVer: 3, cmd: 'ORG_HIERARCHY', accepts: '.platform.reference.hierarchy.v1', call: SERVER_TOKEN + '/organization/v3/organizations/' + ORGANIZATIONID_TOKEN + '/hierarchy'});
  // ---
  // v2...
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSONS', accepts: '.platform.person.v1', call: SERVER_TOKEN + '/person/v2/persons'});
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSON', accepts: '.platform.person.v1', call: SERVER_TOKEN + '/person/v2/persons/' + PERSONID_TOKEN});
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSON_ACTIVATE', accepts: '.platform.person.v1', call: SERVER_TOKEN + '/person/v2/persons/tasks/activate'});
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSON_SUSPEND', accepts: '.platform.person.v1', call: SERVER_TOKEN + '/person/v2/persons/tasks/suspend'});
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSON_UNSUSPEND', accepts: '.platform.person.v1', call: SERVER_TOKEN + '/person/v2/persons/tasks/unsuspend'});
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSONS_INVITE', accepts: '.platform.person.invitation.v1', call: SERVER_TOKEN + '/person/v2/personInvitations'});
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSON_INVITE', accepts: '.platform.person.invitation.v1', call: SERVER_TOKEN + '/person/v2/personInvitations/' + INVITATIONID_TOKEN});
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSONS_INVITE_ACCEPT', accepts: '.platform.person.invitation.v1', call: SERVER_TOKEN + '/person/v2/personInvitations/tasks/accept'});
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSONS_REQUEST', accepts: '.platform.person.request.v1', call: SERVER_TOKEN + '/person/v2/requests'});
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSON_REQUEST', accepts: '.platform.person.request.v1', call: SERVER_TOKEN + '/person/v2/requests/' + REQUESTID_TOKEN});
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSONS_REQUEST_APPROVE', accepts: '.platform.person.request.v1', call: SERVER_TOKEN + '/person/v2/requests/tasks/approve'});
  dataCalls.push({apiName: 'person', apiVer: 2, cmd: 'PERSON_PASSWORD', accepts: '.platform.person.account.password.v1', call: SERVER_TOKEN + '/person/v2/persons/' + PERSONID_TOKEN + '/accounts/password'});
  
  // v3...
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSONS', accepts: '.platform.person.v1', call: SERVER_TOKEN + '/person/v3/persons'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSONS_ADMINS', accepts: '.platform.person.v1', acceptsSuffix: ';securityadmin=true', call: SERVER_TOKEN + '/person/v3/persons'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSONS_COUNT', call: SERVER_TOKEN + '/person/v3/persons/count'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_ROLES_ONLY', accepts: '.platform.person.role.v1', acceptsSuffix: ';onlyroles=true', call: SERVER_TOKEN + '/person/v3/persons/roles/' + PERSONID_TOKEN});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_ROLES', accepts: '.platform.person.role.v1', call: SERVER_TOKEN + '/person/v3/persons/roles/' + PERSONID_TOKEN});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_REGISTER', cmdType: 'unsecured', accepts: '.platform.person.password.account.v1', call: SERVER_TOKEN + '/person/v3/persons/registration'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_REGISTER_STATUS', accepts: '.platform.person.password.account.v1', call: SERVER_TOKEN + '/person/v3/persons/registration/status'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_REGISTER_VALIDATE', cmdType: 'unsecured', accepts: '.platform.person.password.account.v1', call: SERVER_TOKEN + '/person/v3/persons/registration/validate'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_ATTRIBUTES', accepts: '.platform.person.attribute.template.v1', call: SERVER_TOKEN + '/person/v3/persons/' + PERSONID_TOKEN + '/templates'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_PASSWORD_VALIDATE', cmdType: 'unsecured', accepts: '.platform.password.validation.v1', call: SERVER_TOKEN + '/person/v3/persons/password/validate'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON', accepts: '.platform.person.v1', call: SERVER_TOKEN + '/person/v3/persons/' + PERSONID_TOKEN});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_ACTIVATE', accepts: '.platform.person.v1', call: SERVER_TOKEN + '/person/v3/persons/tasks/activate'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_SUSPEND', accepts: '.platform.person.v1', call: SERVER_TOKEN + '/person/v3/persons/tasks/suspend'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_UNSUSPEND', accepts: '.platform.person.v1', call: SERVER_TOKEN + '/person/v3/persons/tasks/unsuspend'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSONS_INVITE', accepts: '.platform.person.invitation.v1', call: SERVER_TOKEN + '/person/v3/personInvitations'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_INVITE', cmdType: 'unsecured', accepts: '.platform.person.invitation.v1', call: SERVER_TOKEN + '/person/v3/personInvitations/' + INVITATIONID_TOKEN});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSONS_INVITE_ACCEPT', accepts: '.platform.person.invitation.v1', call: SERVER_TOKEN + '/person/v3/personInvitations/tasks/accept'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSONS_REQUEST', accepts: '.platform.person.request.v1', call: SERVER_TOKEN + '/person/v3/requests'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSONS_CREATE_REQUEST', cmdType: 'unsecured', accepts: '.platform.person.request.v1', call: SERVER_TOKEN + '/person/v3/requests'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_REQUEST', accepts: '.platform.person.request.v1', call: SERVER_TOKEN + '/person/v3/requests/' + REQUESTID_TOKEN});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSONS_REQUEST_APPROVE', accepts: '.platform.person.request.v1', call: SERVER_TOKEN + '/person/v3/requests/tasks/approve'});
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSONS_REQUEST_DENY', accepts: '.platform.person.request.v1', call: SERVER_TOKEN + '/person/v3/requests/tasks/deny'});  
  dataCalls.push({apiName: 'person', apiVer: 3, cmd: 'PERSON_PASSWORD', accepts: '.platform.person.account.password.v1', call: SERVER_TOKEN + '/person/v3/persons/' + PERSONID_TOKEN + '/accounts/password'});
  // ---
  // v2...
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'SERVICES', accepts: '.platform.service.v1', call: SERVER_TOKEN + '/service/v2/services'});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'SERVICE', accepts: '.platform.service.v1', call: SERVER_TOKEN + '/service/v2/services/' + SERVICEID_TOKEN});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'PACKAGE_SERVICES', accepts: '.platform.service.v1', call: SERVER_TOKEN + '/service/v2/packages/' + PACKAGEID_TOKEN + '/services'});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'PACKAGES', accepts: '.platform.package.v1', call: SERVER_TOKEN + '/service/v2/packages'});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'PACKAGE', accepts: '.platform.package.v1', call: SERVER_TOKEN + '/service/v2/packages/' + PACKAGEID_TOKEN});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'ASSIGN_SERVICE', call: SERVER_TOKEN + '/service/v2/packages/tasks/assignServiceMembership'});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'REMOVE_SERVICE', call: SERVER_TOKEN + '/service/v2/packages/tasks/removeServiceMembership'});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'PACKAGES_PERSON', accepts: '.platform.package.grant.v1', call: SERVER_TOKEN + '/service/v2/persons/' + PERSONID_TOKEN + '/packages'});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'GRANT_PACKAGE_PERSON', accepts: '.platform.package.grant.v1', call: SERVER_TOKEN + '/service/v2/persons/' + PERSONID_TOKEN + '/packages/' + PACKAGEID_TOKEN});
  
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'PACKAGES_ORG', accepts: '.platform.package.grant.v1', call: SERVER_TOKEN + '/service/v2/organizations/' + ORGANIZATIONID_TOKEN + '/packages'});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'GRANT_PACKAGE_ORG', accepts: '.platform.package.grant.v1', call: SERVER_TOKEN + '/service/v2/organizations/' + ORGANIZATIONID_TOKEN + '/packages/' + PACKAGEID_TOKEN});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'PACKAGE_REQUESTS', accepts: '.platform.package.request.v1', call: SERVER_TOKEN + '/service/v2/requests'});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'PACKAGE_REQUEST', accepts: '.platform.package.request.v1', call: SERVER_TOKEN + '/service/v2/requests/' + REQUESTID_TOKEN});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'APPROVE_PACKAGE', call: SERVER_TOKEN + '/service/v2/requests/tasks/approve'});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'DENY_PACKAGE', call: SERVER_TOKEN + '/service/v2/requests/tasks/deny'});
  dataCalls.push({apiName: 'service', apiVer: 2, cmd: 'PACKAGE_GRANTS', accepts: '.platform.package.grant.v1', call: SERVER_TOKEN + '/service/v2/grants'});

  /* v3...
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'SERVICES', accepts: '.platform.service.v1', call: SERVER_TOKEN + '/service/v3/services'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'SERVICE', accepts: '.platform.service.v1', call: SERVER_TOKEN + '/service/v3/services/' + SERVICEID_TOKEN});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'PACKAGE_SERVICES', accepts: '.platform.service.v1', call: SERVER_TOKEN + '/service/v3/packages/' + PACKAGEID_TOKEN + '/services'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'PACKAGES', accepts: '.platform.package.v1', call: SERVER_TOKEN + '/service/v3/packages'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'PACKAGES_COUNT', accepts: '.platform.package.v1', call: SERVER_TOKEN + '/service/v3/packages/count'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'PACKAGES_PERSONS_REQUESTABLE', accepts: '.platform.package.v1', call: SERVER_TOKEN + '/service/v3/packages/persons/' + PERSONID_TOKEN + '/requestable'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'PACKAGES_ORGANIZATIONS_REQUESTABLE', accepts: '.platform.package.v1', call: SERVER_TOKEN + '/service/v3/packages/organizations/' + ORGANIZATIONID_TOKEN + '/requestable'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'PACKAGE', cmdType: 'unsecured', accepts: '.platform.package.v1', call: SERVER_TOKEN + '/service/v3/packages/' + PACKAGEID_TOKEN});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'ASSIGN_SERVICE', call: SERVER_TOKEN + '/service/v3/packages/tasks/assignServiceMembership'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'REMOVE_SERVICE', call: SERVER_TOKEN + '/service/v3/packages/tasks/removeServiceMembership'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'PACKAGES_PERSON', accepts: '.platform.package.grant.v1', call: SERVER_TOKEN + '/service/v3/persons/' + PERSONID_TOKEN + '/packages'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'GRANT_PACKAGE_PERSON', accepts: '.platform.package.grant.v1', call: SERVER_TOKEN + '/service/v3/persons/' + PERSONID_TOKEN + '/packages/' + PACKAGEID_TOKEN});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'PACKAGES_ORG', cmdType: 'unsecured', accepts: '.platform.package.grant.v1', call: SERVER_TOKEN + '/service/v3/organizations/' + ORGANIZATIONID_TOKEN + '/packages'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'GRANT_PACKAGE_ORG', accepts: '.platform.package.grant.v1', call: SERVER_TOKEN + '/service/v3/organizations/' + ORGANIZATIONID_TOKEN + '/packages/' + PACKAGEID_TOKEN});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'PACKAGE_REQUESTS', accepts: '.platform.package.request.v1', call: SERVER_TOKEN + '/service/v3/requests'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'PACKAGE_REQUEST', accepts: '.platform.package.request.v1', call: SERVER_TOKEN + '/service/v3/requests/' + REQUESTID_TOKEN});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'APPROVE_PACKAGE', call: SERVER_TOKEN + '/service/v3/requests/tasks/approve'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'DENY_PACKAGE', call: SERVER_TOKEN + '/service/v3/requests/tasks/deny'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'PACKAGE_GRANTS', accepts: '.platform.package.grant.v1', call: SERVER_TOKEN + '/service/v3/grants'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'CLAIMS_PERSON', accepts: '.platform.package.grant.claim.v1', call: SERVER_TOKEN + '/service/v3/persons/' + PERSONID_TOKEN + '/claims'});
  dataCalls.push({apiName: 'service', apiVer: 3, cmd: 'CLAIMS_PACKAGE_PERSON', accepts: '.platform.package.grant.claim.v1', call: SERVER_TOKEN + '/service/v3/persons/' + PERSONID_TOKEN + '/packages/' + PACKAGEID_TOKEN  + '/claims'});
  */
  
  // ---
  dataCalls.push({cmd: 'GROUPS', accepts: '.platform.group.v1', acceptsSuffix: ';includeEntitlements', call: SERVER_TOKEN + '/group/v2/groups'});
  dataCalls.push({cmd: 'GROUP', accepts: '.platform.group.v1', acceptsSuffix: ';includeEntitlements', call: SERVER_TOKEN + '/group/v2/groups/' + GROUPID_TOKEN});
  dataCalls.push({cmd: 'GROUP_ENTITLEMENTS', accepts: '.platform.group.entitlement.v1', call: SERVER_TOKEN + '/group/v2/groups/' + GROUPID_TOKEN + '/entitlements'});
  dataCalls.push({cmd: 'GROUP_ENTITLEMENT', accepts: '.platform.group.entitlement.v1', call: SERVER_TOKEN + '/group/v2/groups/' + GROUPID_TOKEN + '/entitlements/' + GROUPENTITLEMENTID_TOKEN});
  dataCalls.push({cmd: 'GROUP_MEMBERSHIPS', accepts: '.platform.group.membership.v1', acceptsSuffix: ';includeGroupAndEntitlements;includeGroup', call: SERVER_TOKEN + '/group/v2/groups/' + GROUPID_TOKEN + '/memberships'});
  dataCalls.push({cmd: 'CREATE_GROUP_MEMBERSHIPS', accepts: '.platform.group.membership.v1', call: SERVER_TOKEN + '/group/v2/groups/' + GROUPID_TOKEN + '/memberships'});
  dataCalls.push({cmd: 'GROUP_MEMBERSHIP', accepts: '.platform.group.membership.v1', call: SERVER_TOKEN + '/group/v2/groups/' + GROUPID_TOKEN + '/memberships/' + GROUPMEMBERSHIPID_TOKEN});
  dataCalls.push({cmd: 'MEMBER_MEMBERSHIPS', accepts: '.platform.group.membership.v1', acceptsSuffix: ';includeGroupAndEntitlements;includeGroup', call: SERVER_TOKEN + '/group/v2/memberships'});
  // ---
  // v3...
  dataCalls.push({apiName: 'authentication', apiVer: 3, cmd: 'SECURITY_QUESTIONS', accepts: '.platform.securityquestion.v1', call: SERVER_TOKEN + '/authn/v3/securityQuestions'});
  dataCalls.push({apiName: 'authentication', apiVer: 3, cmd: 'PERSON_SECURITY_QUESTIONS', accepts: '.platform.securityquestion.v1', call: SERVER_TOKEN + '/authn/v3/securityQuestions/' + PERSONID_TOKEN});
  dataCalls.push({apiName: 'authentication', apiVer: 3, cmd: 'AUTHN_NONCE', call: SERVER_TOKEN + '/authn/v3/authn/nonce'});
  dataCalls.push({apiName: 'authentication', apiVer: 3, cmd: 'PERSON_SECURITY_QUESTION_ACCOUNT', accepts: '.platform.person.account.securityQuestion.v1', call: SERVER_TOKEN + '/authn/v3/persons/' + PERSONID_TOKEN + '/accounts/securityQuestion'});
  dataCalls.push({apiName: 'authentication', apiVer: 3, cmd: 'AUTHENTICATE_PASSWORD', accepts: '.platform.authn.password.resp.v1', call: SERVER_TOKEN + '/authn/v3/passwords/tasks/authenticate'});
  dataCalls.push({apiName: 'authentication', apiVer: 3, cmd: 'LOCK_PASSWORD', accepts: '.platform.password.v1', call: SERVER_TOKEN + '/authn/v3/passwords/tasks/lock'});
  dataCalls.push({apiName: 'authentication', apiVer: 3, cmd: 'UNLOCK_PASSWORD', accepts: '.platform.password.v1', call: SERVER_TOKEN + '/authn/v3/passwords/tasks/unlock'});

  // v4...
  dataCalls.push({apiName: 'authentication', apiVer: 4, cmd: 'SECURITY_QUESTIONS', cmdType: 'unsecured', accepts: '.platform.securityquestion.v1', call: SERVER_TOKEN + '/authn/v4/securityQuestions'});
  dataCalls.push({apiName: 'authentication', apiVer: 4, cmd: 'PERSON_SECURITY_QUESTIONS', accepts: '.platform.securityquestion.v1', call: SERVER_TOKEN + '/authn/v4/securityQuestions/' + PERSONID_TOKEN});
  dataCalls.push({apiName: 'authentication', apiVer: 4, cmdType: 'unsecured', cmd: 'AUTHN_NONCE_VALIDATE', accepts: '.platform.authn.nonce.v1',call: SERVER_TOKEN + '/authn/v4/authn/nonce/validate'});
  dataCalls.push({apiName: 'authentication', apiVer: 4, cmdType: 'unsecured', cmd: 'SESSION_NONCE_VALIDATE', accepts: '.platform.nonce.request.v1', call: SERVER_TOKEN + '/authn/v4/sessionToken/nonce/validate'});  
  dataCalls.push({apiName: 'authentication', apiVer: 4, cmd: 'PERSON_SECURITY_QUESTION_ACCOUNT', accepts: '.platform.person.account.securityQuestion.v1', call: SERVER_TOKEN + '/authn/v4/persons/' + PERSONID_TOKEN + '/accounts/securityQuestion'});
  dataCalls.push({apiName: 'authentication', apiVer: 4, cmd: 'AUTHENTICATE_PASSWORD', accepts: '.platform.authn.password.resp.v1', call: SERVER_TOKEN + '/authn/v4/passwords/tasks/authenticate'});
  dataCalls.push({apiName: 'authentication', apiVer: 4, cmd: 'LOCK_PASSWORD', accepts: '.platform.password.v1', call: SERVER_TOKEN + '/authn/v4/passwords/tasks/lock'});
  dataCalls.push({apiName: 'authentication', apiVer: 4, cmd: 'UNLOCK_PASSWORD', accepts: '.platform.password.v1', call: SERVER_TOKEN + '/authn/v4/passwords/tasks/unlock'});
  dataCalls.push({apiName: 'authentication', apiVer: 4, cmd: 'PASSWORD_POLICIES', accepts: '.platform.password.policy.v1', call: SERVER_TOKEN + '/authn/v4/passwords/policies'});
  dataCalls.push({apiName: 'authentication', apiVer: 4, cmd: 'PASSWORD_POLICY', cmdType: 'unsecured', accepts: '.platform.password.policy.v1', call: SERVER_TOKEN + '/authn/v4/passwords/policies/' + POLICYID_TOKEN});

  // ---
  dataCalls.push({cmd: 'ATTRIBUTES', accepts: '.platform.attribute.v1', call: SERVER_TOKEN + '/attributes/v1/attributes'});
  dataCalls.push({cmd: 'ATTRIBUTE', accepts: '.platform.attribute.v1', cmdType: 'unsecured', call: SERVER_TOKEN + '/attributes/v1/attributes/' + ATTRIBUTEID_TOKEN});
  dataCalls.push({cmd: 'ATTRIBUTE_TEMPLATES', accepts: '.platform.attribute.template.v1', cmdType: 'unsecured', call: SERVER_TOKEN + '/attributes/v1/attributeTemplates'});
  dataCalls.push({cmd: 'ATTRIBUTE_TEMPLATE', accepts: '.platform.attribute.templatev1', cmdType: 'unsecured', call: SERVER_TOKEN + '/attributes/v1/attributeTemplates/' + ATTRIBUTETEMPLATEID_TOKEN});
  dataCalls.push({cmd: 'ATTRIBUTE_TEMPLATE_PERSON_ASSOC', accepts: '.platform.attribute.templatev1', call: SERVER_TOKEN + '/attributes/v1/attributeTemplates/' + ATTRIBUTETEMPLATEID_TOKEN + '/associations/persons/' + PERSONID_TOKEN});
  dataCalls.push({cmd: 'ATTRIBUTE_TEMPLATE_PERSON_ASSOC', accepts: '.platform.attribute.templatev1', call: SERVER_TOKEN + '/attributes/v1/attributeTemplates/' + ATTRIBUTETEMPLATEID_TOKEN + '/associations/organizations/' + ORGANIZATIONID_TOKEN});

  // -------------
  // IoT ...
  // -------------
  dataCalls.push({cmd: 'APPLICATIONS', accepts: '.platform.application.v1', call: SERVER_TOKEN + '/application/v1/applications'});
  dataCalls.push({cmd: 'APPLICATION', accepts: '.platform.application.v1', call: SERVER_TOKEN + '/application/v1/applications/' + APPLICATIONID_TOKEN});
  dataCalls.push({cmd: 'APPLICATION_COUNT', call: SERVER_TOKEN + '/application/v1/applications/count'});

  // ---
  // v2---
  dataCalls.push({apiName: 'device', apiVer: 2, cmd: 'DEVICES', accepts: '.platform.device.v1', call: SERVER_TOKEN + '/device/v2/devices'});
  dataCalls.push({apiName: 'device', apiVer: 2, cmd: 'DEVICES_CHILDREN', accepts: '.platform.device.v1', acceptsSuffix: ';fetchattributetypes=true;fetcheventtemplates=true;fetchcommandtemplates=true', call: SERVER_TOKEN + '/device/v2/devices'});
  dataCalls.push({apiName: 'device', apiVer: 2, cmd: 'GET_DEVICE', accepts: '.platform.device.v1', acceptsSuffix: ';fetchattributetypes=true;fetcheventtemplates=true;fetchcommandtemplates=true', call: SERVER_TOKEN + '/device/v2/devices/' + DEVICEID_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 2, cmd: 'UPDATE_DEVICE', accepts: '.platform.device.v1', call: SERVER_TOKEN + '/device/v2/devices/' + DEVICEID_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 2, cmd: 'CREATE_DEVICE', accepts: '.platform.device.v1', call: SERVER_TOKEN + '/device/v2/tasks/createDeviceFromTemplate?deviceTemplateId=' + DEVICETEMPLID_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 2, cmd: 'DEVICE_TAG', accepts: '.platform.device.v1', call: SERVER_TOKEN + '/device/v2/devices/' + DEVICEID_TOKEN + '/tags/' + TAG_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 2, cmd: 'ACTIVATE_DEVICE', accepts: '.platform.device.v1', call: SERVER_TOKEN + '/device/v2/devices/' + DEVICEID_TOKEN + '/tasks/activate'});
  dataCalls.push({apiName: 'device', apiVer: 2, cmd: 'DEACTIVATE_DEVICE', accepts: '.platform.device.v1', call: SERVER_TOKEN + '/device/v2/devices/' + DEVICEID_TOKEN + '/tasks/deactivate'});
  dataCalls.push({apiName: 'device', apiVer: 2, cmd: 'MIGRATE_DEVICE', accepts: '.platform.device.v1', call: SERVER_TOKEN + '/device/v2/tasks/migrateDeviceToNewTemplate?deviceId=' + DEVICEID_TOKEN + '&deviceTemplateId=' + DEVICETEMPLID_TOKEN});
  
  // v3---
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'DEVICES', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/devices'});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'DEVICES_CHILDREN', accepts: '.platform.device.v2', acceptsSuffix: ';fetchattributetypes=true;fetcheventtemplates=true;fetchcommandtemplates=true', call: SERVER_TOKEN + '/device/v3/devices'});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'GET_DEVICE', accepts: '.platform.device.v2', acceptsSuffix: ';fetchattributetypes=true;fetcheventtemplates=true;fetchcommandtemplates=true', call: SERVER_TOKEN + '/device/v3/devices/' + DEVICEID_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'UPDATE_DEVICE', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/devices/' + DEVICEID_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'CREATE_DEVICE', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/tasks/createDeviceFromTemplate?deviceTemplateId=' + DEVICETEMPLID_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'DEVICE_TAG', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/devices/' + DEVICEID_TOKEN + '/tags/' + TAG_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'ACTIVATE_DEVICE', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/devices/' + DEVICEID_TOKEN + '/tasks/activate'});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'DEACTIVATE_DEVICE', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/devices/' + DEVICEID_TOKEN + '/tasks/deactivate'});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'MIGRATE_DEVICE', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/tasks/migrateDeviceToNewTemplate?deviceId=' + DEVICEID_TOKEN + '&deviceTemplateId=' + DEVICETEMPLID_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'REGISTER_DEVICE', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/devices/' + DEVICEID_TOKEN + '/tasks/register'});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'SUSPEND_DEVICE', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/devices/' + DEVICEID_TOKEN + '/tasks/suspend?reason=' + REASON_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'UNSUSPEND_DEVICE', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/devices/' + DEVICEID_TOKEN + '/tasks/unsuspend?reason=' + REASON_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'UNLOCK_DEVICE', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/devices/' + DEVICEID_TOKEN + '/tasks/unlock?reason=' + REASON_TOKEN});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'RESET_DEVICE', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/devices/' + DEVICEID_TOKEN + '/tasks/reset'});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'DELETE_DEVICE', accepts: '.platform.device.v2', call: SERVER_TOKEN + '/device/v3/devices/' + DEVICEID_TOKEN + '/tasks/delete'});
  dataCalls.push({apiName: 'device', apiVer: 3, cmd: 'DEVICES_COUNT', call: SERVER_TOKEN + '/device/v3/devices/count'});
  // ---
  
  dataCalls.push({cmd: 'DEVICE_TEMPLS', accepts: '.platform.deviceTemplate.v1', acceptsSuffix: ';fetchattributetypes=true;fetcheventtemplates=true;fetchcommandtemplates=true', call: SERVER_TOKEN + '/devicetemplate/v1/deviceTemplates'});
  dataCalls.push({cmd: 'CREATE_DEVICE_TEMPL', accepts: '.platform.deviceTemplate.v1', call: SERVER_TOKEN + '/devicetemplate/v1/deviceTemplates'});
  dataCalls.push({cmd: 'DEVICE_TEMPL_TAG', accepts: '.platform.deviceTemplate.v1', call: SERVER_TOKEN + '/devicetemplate/v1/deviceTemplates/' + DEVICETEMPLID_TOKEN + '/tags/' + TAG_TOKEN});
  dataCalls.push({cmd: 'DEVICE_TEMPL', accepts: '.platform.deviceTemplate.v1', acceptsSuffix: ';fetchattributetypes=true;fetcheventtemplates=true;fetchcommandtemplates=true', call: SERVER_TOKEN + '/devicetemplate/v1/deviceTemplates/' + DEVICETEMPLID_TOKEN});
  dataCalls.push({cmd: 'ACTIVATE_DEVICE_TEMPL', accepts: '.platform.deviceTemplate.v1', call: SERVER_TOKEN + '/devicetemplate/v1/deviceTemplates/' + DEVICETEMPLID_TOKEN + '/tasks/activate'});
  dataCalls.push({cmd: 'DEACTIVATE_DEVICE_TEMPL', accepts: '.platform.deviceTemplate.v1', call: SERVER_TOKEN + '/devicetemplate/v1/deviceTemplates/' + DEVICETEMPLID_TOKEN + '/tasks/deactivate'});
  dataCalls.push({cmd: 'DEVICE_TEMPLS_COUNT', call: SERVER_TOKEN + '/devicetemplate/v1/deviceTemplates/count'});
  // ---
  dataCalls.push({cmd: 'EVENT_SRCS', accepts: '.platform.eventSource.v1', call: SERVER_TOKEN + '/eventsource/v1/eventSources'});
  dataCalls.push({cmd: 'EVENT_SRC_TAG', accepts: '.platform.eventSource.v1', call: SERVER_TOKEN + '/eventsource/v1/eventSources/' + EVENTSRCID_TOKEN + '/tags/' + TAG_TOKEN});
  dataCalls.push({cmd: 'EVENT_SRC', accepts: '.platform.eventSource.v1', call: SERVER_TOKEN + '/eventsource/v1/eventSources/' + EVENTSRCID_TOKEN});
  dataCalls.push({cmd: 'EVENT_SRCS_COUNT', call: SERVER_TOKEN + '/eventsource/v1/eventSources/count'});
  // ---
  dataCalls.push({cmd: 'EVENT_TEMPLS', accepts: '.platform.eventTemplate.v1', call: SERVER_TOKEN + '/eventtemplate/v1/eventTemplates'});
  dataCalls.push({cmd: 'EVENT_TEMPL_TAG', accepts: '.platform.eventTemplate.v1', call: SERVER_TOKEN + '/eventtemplate/v1/eventTemplates/' + EVENTTEMPLID_TOKEN + '/tags/' + TAG_TOKEN});
  dataCalls.push({cmd: 'EVENT_TEMPL', accepts: '.platform.eventTemplate.v1', call: SERVER_TOKEN + '/eventtemplate/v1/eventTemplates/' + EVENTTEMPLID_TOKEN});
  dataCalls.push({cmd: 'ACTIVATE_EVENT_TEMPL', accepts: '.platform.eventTemplate.v1', call: SERVER_TOKEN + '/eventtemplate/v1/eventTemplates/' + EVENTTEMPLID_TOKEN + '/tasks/activate'});
  dataCalls.push({cmd: 'DEACTIVATE_EVENT_TEMPL', accepts: '.platform.eventTemplate.v1', call: SERVER_TOKEN + '/eventtemplate/v1/eventTemplates/' + EVENTTEMPLID_TOKEN + '/tasks/deactivate'});
  dataCalls.push({cmd: 'BIND_EVENT_TEMPL', accepts: '.platform.eventTemplate.v1', call: SERVER_TOKEN + '/eventtemplate/v1/eventTemplates/' + EVENTTEMPLID_TOKEN + '/tasks/bindEventField'});
  dataCalls.push({cmd: 'UNBIND_EVENT_TEMPL', accepts: '.platform.eventTemplate.v1', call: SERVER_TOKEN + '/eventtemplate/v1/eventTemplates/' + EVENTTEMPLID_TOKEN + '/tasks/unbindEventField'});
  dataCalls.push({cmd: 'EVENT_TEMPLS_COUNT', call: SERVER_TOKEN + '/eventtemplate/v1/eventTemplates/count'});
  // ---
  dataCalls.push({cmd: 'EVENT_TEMPL_THRESH', accepts: '.platform.eventThresholdPolicy.v1', call: SERVER_TOKEN + '/eventthresholdpolicy/v1/eventTemplates/' + EVENTTEMPLID_TOKEN + '/thresholdPolicies'});
  dataCalls.push({cmd: 'EVENT_TEMPL_THRESH_POLICY', accepts: '.platform.eventThresholdPolicy.v1', call: SERVER_TOKEN + '/eventthresholdpolicy/v1/eventTemplates/' + EVENTTEMPLID_TOKEN + '/thresholdPolicies/' + EVENTPOLICYID_TOKEN});
  dataCalls.push({cmd: 'EVENT_TEMPL_THRESH_POLICY_VALIDATE', accepts: '.platform.application/json', call: SERVER_TOKEN + '/eventthresholdpolicy/v1/eventTemplates/' + EVENTTEMPLID_TOKEN + '/thresholdPolicies/' + EVENTPOLICYID_TOKEN + '/validateEvent'});
  // ---
  dataCalls.push({cmd: 'ATTR_TYPES', accepts: '.platform.attributeType.v1', call: SERVER_TOKEN + '/attributetype/v1/attributeTypes'});
  dataCalls.push({cmd: 'ATTR_TYPE_TAG', accepts: '.platform.attributeType.v1', call: SERVER_TOKEN + '/attributetype/v1/attributeTypes/' + ATTRIBUTETYPEID_TOKEN + '/tags/' + TAG_TOKEN});
  dataCalls.push({cmd: 'ATTR_TYPE', accepts: '.platform.attributeType.v1', call: SERVER_TOKEN + '/attributetype/v1/attributeTypes/' + ATTRIBUTETYPEID_TOKEN});
  dataCalls.push({cmd: 'ACTIVATE_ATTR_TYPE', accepts: '.platform.attributeType.v1', call: SERVER_TOKEN + '/attributetype/v1/attributeTypes/' + ATTRIBUTETYPEID_TOKEN + '/tasks/activate'});
  dataCalls.push({cmd: 'DEACTIVATE_ATTR_TYPE', accepts: '.platform.attributeType.v1', call: SERVER_TOKEN + '/attributetype/v1/attributeTypes/' + ATTRIBUTETYPEID_TOKEN + '/tasks/deactivate'});
  dataCalls.push({cmd: 'ATTR_TYPES_COUNT', call: SERVER_TOKEN + '/attributetype/v1/attributeTypes/count'});
  // ---
  dataCalls.push({cmd: 'COMMAND_TEMPLS', accepts: '.platform.commandTemplate.v1', call: SERVER_TOKEN + '/commandtemplate/v1/commandTemplates'});
  dataCalls.push({cmd: 'COMMAND_TEMPL_TAG', accepts: '.platform.commandTemplate.v1', call: SERVER_TOKEN + '/commandtemplate/v1/commandTemplates/' + COMMANDTEMPLID_TOKEN + '/tags/' + TAG_TOKEN});
  dataCalls.push({cmd: 'COMMAND_TEMPL', accepts: '.platform.commandTemplate.v1', call: SERVER_TOKEN + '/commandtemplate/v1/commandTemplates/' + COMMANDTEMPLID_TOKEN});
  dataCalls.push({cmd: 'ACTIVATE_COMMAND_TEMPL', accepts: '.platform.commandTemplate.v1', call: SERVER_TOKEN + '/commandtemplate/v1/commandTemplates/' + COMMANDTEMPLID_TOKEN + '/tasks/activate'});
  dataCalls.push({cmd: 'DEACTIVATE_COMMAND_TEMPL', accepts: '.platform.commandTemplate.v1', call: SERVER_TOKEN + '/commandtemplate/v1/commandTemplates/' + COMMANDTEMPLID_TOKEN + '/tasks/deactivate'});
  dataCalls.push({cmd: 'COMMAND_TEMPLS_COUNT', call: SERVER_TOKEN + '/commandtemplate/v1/commandTemplates/count'});
  // ---
  dataCalls.push({cmd: 'SEARCH_TRACKING', accepts: '.platform.messaging.tracking.v1', call: SERVER_TOKEN + '/tracking/v1/trackings?sortBy=-creation'});
  dataCalls.push({cmd: 'TRACKING_SUBPROCESS', accepts: '.platform.messaging.subprocess.v1', call: SERVER_TOKEN + '/tracking/v1/subprocesses?sortBy=-creation' + '&messageId=' + MESSAGEID_TOKEN});
  dataCalls.push({cmd: 'PROCESSOR_AUDITS', accepts: '.platform.messaging.processoraudit.v1', call: SERVER_TOKEN + '/tracking/v1/processorAudits?sortBy=-creation' + '&messageId=' + MESSAGEID_TOKEN});
  // ---
  dataCalls.push({cmd: 'STREAMS', accepts: '.platform.stream.v1', call: SERVER_TOKEN + '/stream/v1/streams'});
  dataCalls.push({cmd: 'STREAM', accepts: '.platform.stream.v1', call: SERVER_TOKEN + '/stream/v1/streams/' + STREAMID_TOKEN});
  dataCalls.push({cmd: 'ACTIVATE_STREAM', accepts: '.platform.stream.v1', call: SERVER_TOKEN + '/stream/v1/streams/' + STREAMID_TOKEN + '/tasks/activate'});
  dataCalls.push({cmd: 'DEACTIVATE_STREAM', accepts: '.platform.stream.v1', call: SERVER_TOKEN + '/stream/v1/streams/' + STREAMID_TOKEN + '/tasks/deactivate'});
  dataCalls.push({cmd: 'STREAM_DEVICES', accepts: '.platform.stream.v1', call: SERVER_TOKEN + '/stream/v1/streams/' + STREAMID_TOKEN + '/devices'});
  dataCalls.push({cmd: 'STREAM_DEVICE', accepts: '.platform.stream.v1', call: SERVER_TOKEN + '/stream/v1/streams/' + STREAMID_TOKEN + '/devices/' + DEVICEID_TOKEN});
  dataCalls.push({cmd: 'STREAMS_COUNT', call: SERVER_TOKEN + '/stream/v1/streams/count'});
  // ---
  dataCalls.push({cmd: 'ROUTES', accepts: '.platform.messaging.route.v1', call: SERVER_TOKEN + '/route/v1/routes'});
  dataCalls.push({cmd: 'ROUTE', accepts: '.platform.messaging.route.v1', call: SERVER_TOKEN + '/route/v1/routes/' + ROUTEID_TOKEN});
  dataCalls.push({cmd: 'ROUTES_COUNT', call: SERVER_TOKEN + '/route/v1/routes/count'});
  // ---
  dataCalls.push({cmd: 'SEND_COMMAND', accepts: '.platform.messaging.sendcommand.v1', call: SERVER_TOKEN + '/sendcommand/v1/message/command/' + STREAMID_TOKEN});
  dataCalls.push({cmd: 'SEND_EVENT', accepts: '.platform.messaging.sendevent.v1', call: SERVER_TOKEN + '/sendevent/v1/message/event/' + STREAMID_TOKEN});
  // ---
  dataCalls.push({cmd: 'SEARCH_EVENTS', accepts: 'application/json', call: SERVER_TOKEN + '/eventsearch/v1/events/search?startTime=' + STARTTIME_TOKEN + '&endTime=' + ENDTIME_TOKEN});
  dataCalls.push({cmd: 'COUNT_EVENTS', accepts: 'application/json', call: SERVER_TOKEN + '/eventsearch/v1/events/count?startTime=' + STARTTIME_TOKEN + '&endTime=' + ENDTIME_TOKEN});

  // ---
  dataCalls.push({cmd: 'ACTION_DEFINITION_TEMPLATES', accepts: '.platform.messaging.actionDefinitionTemplate.v1', call: SERVER_TOKEN + '/ruledefinition/v1/actionDefinitionTemplates'});
  dataCalls.push({cmd: 'ACTION_DEFINITION_TEMPLATE', accepts: '.platform.messaging.actionDefinitionTemplate.v1', call: SERVER_TOKEN + '/ruledefinition/v1/actionDefinitionTemplates/' + ACTIONDEFTEMP_TOKEN });

  dataCalls.push({cmd: 'ACTION_DEFINITIONS', accepts: '.platform.messaging.actionDefinition.v1', call: SERVER_TOKEN + '/ruledefinition/v1/actionDefinitions'});
  dataCalls.push({cmd: 'ACTION_DEFINITION', accepts: '.platform.messaging.actionDefinition.v1', call: SERVER_TOKEN + '/ruledefinition/v1/actionDefinitions/' + ACTIONDEF_TOKEN });

  dataCalls.push({cmd: 'TRIGGER_DEFINITIONS', accepts: '.platform.messaging.triggerDefinition.v1', call: SERVER_TOKEN + '/ruledefinition/v1/triggerDefinitions'});
  dataCalls.push({cmd: 'TRIGGER_DEFINITION', accepts: '.platform.messaging.triggerDefinition.v1', call: SERVER_TOKEN + '/ruledefinition/v1/triggerDefinitions/' + TRIGGERDEF_TOKEN });

  dataCalls.push({cmd: 'TRIGGER_DEFINITION_TEMPLATES', accepts: '.platform.messaging.triggerDefinitionTemplate.v1', call: SERVER_TOKEN + '/ruledefinition/v1/triggerDefinitionTemplates'});
  dataCalls.push({cmd: 'TRIGGER_DEFINITION_TEMPLATE', accepts: '.platform.messaging.triggerDefinitionTemplate.v1', call: SERVER_TOKEN + '/ruledefinition/v1/triggerDefinitionTemplates/' + TRIGGERDEFTEMP_TOKEN });

  dataCalls.push({cmd: 'RULE_DEFINITIONS', accepts: '.platform.messaging.ruleDefinition.v1', call: SERVER_TOKEN + '/ruledefinition/v1/ruleDefinitions'});
  dataCalls.push({cmd: 'RULE_DEFINITION', accepts: '.platform.messaging.ruleDefinition.v1', call: SERVER_TOKEN + '/ruledefinition/v1/ruleDefinitions/' + RULEDEFID_TOKEN });
  dataCalls.push({cmd: 'RULE_DEFINITION_DEACTIVATE', accepts: '.platform.messaging.ruleDefinition.v1', call: SERVER_TOKEN + '/ruledefinition/v1/ruleDefinitions/' + RULEDEFID_TOKEN + '/tasks/deactivate'});
  // ---

  // -------------------------------------


  // -------------------------------------
  // Private methods
  // -------------------------------------
  function setServiceUrl(platform) {
    var url = _.result(_.find(apiUrls, {name: platform}), 'url');

    if (url) {
      // ...then a platform abbreviation was specified, so...
      // NB need to cache the platform, for dataCall version matching...
      setApiPlatform(platform);
    }

    serviceUrl = url || platform;

    cui.log('setServiceUrl', serviceUrl, getApiPlatform());
  }
  
  function getServiceUrl() {
    return serviceUrl;
  }

  function setApiPlatform(platform) {
    apiPlatform = platform;
  }

  function getApiPlatform() {
    return apiPlatform;
  }

  /*function setOriginUri(value) {
    originUri = value;
  }
  function getOriginUri() {
    return originUri;
  }*/

  function parseError(response) {
    if (response && response.responseJSON && response.responseJSON.apiMessage) {
      return response.responseJSON.apiMessage;
    } else {
      return cui.parseError(response);
    }
  }

  function doDelayForIndex(options, origResponse) {
    var pendingPromise = $.Deferred();
    var attempts = 0;

    // Prep options for the GET call...
    var searchFnOptions = _.cloneDeep(options);
    searchFnOptions.data = {};
    searchFnOptions.type = 'GET';
    searchFnOptions.qs = [['id', origResponse.id]];
    searchFnOptions.url = addQueryString(searchFnOptions.url, searchFnOptions);

    if (_.isUndefined(searchFnOptions.delayDuration)) {
      searchFnOptions.delayDuration = 100;
    }
    if (_.isUndefined(searchFnOptions.maxAttempts)) {
      searchFnOptions.maxAttempts = 20;
    }

    function searchFn(promise) {
      if (++attempts > searchFnOptions.maxAttempts) {
        cui.log('searchFn maxed out.');
        // NB still must resolve the orig promise!
        return promise.resolve(origResponse);
      }

      cui.log('searchFn...', attempts);

      cui.ajax(searchFnOptions)
        .then(function (response) {
          if (response.length) {
            // The requested resource exists, from an index perspective.
            cui.log('searchFn resolved.');
            return promise.resolve(origResponse);
          }
          else {
            cui.log('searchFn unresolved.'); 
            // recursively continue the search...
            _.delay(searchFn, searchFnOptions.delayDuration, promise);           
          }
        })
        .fail(function (err) {
          cui.log('searchFn err', parseError(err));
          // NB still must resolve the orig promise!
          return promise.resolve(origResponse);
        });
    }

    // Start the loop...
    searchFn(pendingPromise);

    return pendingPromise;
  }

  function getToken() {
    var token = window.localStorage.getItem('cui.ot');
    return token;
  }
  function setToken(token) {
    window.localStorage.setItem('cui.ot', token);
    return;
  }
  function clearToken() {
    window.localStorage.removeItem('cui.ot');
    return;
  }

  function getExpires() {
    var expires = window.localStorage.getItem('cui.xp');
    return expires;
  }
  function setExpires(expires) {
    window.localStorage.setItem('cui.xp', expires);
    return;    
  }
  function clearExpires() {
    window.localStorage.removeItem('cui.xp');
    return;
  }

  function enableAutoRefresh() {
    autoRefreshTokenDisabled = false;
  }
  function disableAutoRefresh() {
    autoRefreshTokenDisabled = true;
  }

  function isDurationValid(d) {
    var valid = (d >= 0 && d <= 2147482648); /* max is 2**31 - 1ms */
    return valid;
  }

  function autoRefreshToken(expires, options, isSys) {
    // convert duration to milliseconds, and reduce by 30 sec.    
    var durationMS = (expires * 1000) - 30000;
    
    if (isDurationValid(durationMS)) {
      clearInterval(refreshTokenTimer);
      
      // start timer 
      refreshTokenTimer = setInterval(function () { 
        if (! autoRefreshTokenDisabled) {
          if (isSys) {
            // Get a fresh sysLevel token...
            doSysAuth(options); 
          }
          /*
          else {
            // Refresh a user OAuth token...
            // TODO...
            // /token POST type='refresh-token',scope='all','refresh-token'=existing token
            //    use existing token in header. returns a 'new' token.
          }
          */
        } else {
          cui.log('autoRefreshToken disabled.');      
        }
      }, durationMS);

      cui.log('autoRefreshToken valid duration', durationMS);      
    } else {
      cui.log('autoRefreshToken disabled due to invalid duration', durationMS);      
    }
    
    return;
  }

  function doSysAuth(options) {
    if (! options) {
      options = {};
    }
    options.type = 'POST'; 
    options.data = { grant_type: 'client_credentials', scope: 'all' };
    options.contentType = 'application/x-www-form-urlencoded';

    // MUST clear this now... before doCall() or stale xt token could derail us.
    clearXsrfToken();

    // NB by handling in a .done(), the caller's .then() can still get data
    return doCall('SYS_TOKEN', options)
      .done(function (data) {
        cui.log('doSysAuth success',data);
        // cache the token
        var propName = 'access_token';
        var token = data[propName];
        if (token.length) {
          clearToken();
          setToken(token);

          propName = 'expires_in';
          var expires = data[propName];
          
          autoRefreshToken(expires, options, true);
        }
      });
  } 

  function getTokens(options) {
    options.accepts = 'application/json';
    return doCall('SYS_TOKEN', options);
  } 

  function revokeToken(token) {
    var revokingMyToken = false;
    if (decodeURIComponent(token) === decodeURIComponent(getToken())) {
      revokingMyToken = true;
    }

    var options = {};
    options.accepts = 'application/json';
    options.type = 'POST';
    options.data = { token: token, token_type_hint: '', cascade: 'true' };
    options.contentType = 'application/x-www-form-urlencoded';
    return doCall('REVOKE_TOKEN', options)
      .then(function () {
        //cui.log('revokeToken success',data);
        if (revokingMyToken) {
          clearToken();
          clearInterval(refreshTokenTimer);
        }
      });
  }

  function introspectToken(token) {
    var options = {};
    options.accepts = 'application/json';
    options.type = 'POST';
    options.data = { token: token, token_type_hint: 'access_token' };
    options.contentType = 'application/x-www-form-urlencoded';
    return doCall('INTROSPECT_TOKEN', options);
  } 

  function parseAuthInfoResponse() {
    var token = '';
    var expires = '';
    
    var responseStr = window.location.search;
    if (!responseStr.length) {
      responseStr = window.location.hash;
    }

    if (responseStr.indexOf('access_token') !== -1) {
      // This presumes position of values in response is fixed...
      token = responseStr.match(/access_token=(.*)$/)[1].split('&state')[0];
      expires = responseStr.match(/expires_in=(.*)$/)[1];
    } else {
      if (responseStr.indexOf('access_denied') !== -1) {
        token = 'deny';
      }
    }
    //cui.log('parse', expires, token, responseStr);
    return {'token': token, 'expires': expires};
  }

  function doHandleOAuthResponse() {
    var info = parseAuthInfoResponse();
    var token = decodeURIComponent(info.token);
    var expires = info.expires;
    //cui.log('doHandleOAuthResponse', token, expires);

    if (token.length) {
      // drop BOTH 'old' tokens, until we support dual-auth scenario
      clearToken();
      setToken(token);
      clearExpires();
      setExpires(expires);
      
      // Dispose of the popUp
      window.close();        
    }
    // else this window is NOT the result of an OAuthResponse, ignore...
    return;
  }

  function doThreeLeggedOAuth(options) {
    options.responseType = 'token';
    options.state = DEF_AUTH_STATE;
    if (! options.scope) {
      options.scope = 'all';
    }

    // drop BOTH 'old' tokens, until we support dual-auth scenario
    clearToken();
    clearXsrfToken();

    var pendingAuthPromise = $.Deferred();

    // Do call... opens popup
    var popup = doCall('3LEG_OAUTH', options);

    function waitFn(promise, popup) {
      cui.log('waiting', promise, popup);

      if (popup.closed !== false) {
        // 1. the window closed...
        clearInterval(waitForTokenTimer);

        // ...so, presuming the token arrived and was cached...
        var token = getToken();
        if (token) {
          if (token === 'deny') {
            promise.reject();
          }
          else {
            var expires = getExpires();
            autoRefreshToken(expires, null, false);

            // ... resolve the promise
            return promise.resolve(token);
          }
        }
        else {
          // window was manually closed without completing auth process
          // ...reject promise
          promise.reject();
        }
      }
    }

    // Start a loop...
    var waitForTokenTimer = setInterval(function () {
      waitFn(pendingAuthPromise, popup);
    }, 500);

    return pendingAuthPromise;
  }

  function parseCovAuthInfoResponse() {
    var token = '';
    var cuid = '';

    var responseStr = window.location.search;
    if (!responseStr.length) {
      responseStr = window.location.hash;
    }

    if (responseStr.indexOf('xsrf') !== -1) {
      //token = responseStr.match(/xsrfToken=(.*)$/)[1];
      token = responseStr.match(/xsrfToken=(.*)$/)[1].split('&cuid')[0];
      cuid = responseStr.match(/cuid=(.*)$/)[1];
    } else {
      // TODO... WHAT is being sent if access denied ?
      if (responseStr.indexOf('access_denied') !== -1) {
        //token = '';
      }
    }
    cui.log('parseCovAuthInfoResponse', token, cuid, responseStr, window.location);
    return {'token': token, 'cuid': cuid};
  }

  function handleCovAuthResponse(options) {
    //cui.log('handleCovAuthResponse cuid', info, cuid);

    if (! options) {
      options = {};
    }

    var promise = $.Deferred();

    var info = parseCovAuthInfoResponse();
    var token = decodeURIComponent(info.token);
    var cuid = decodeURIComponent(info.cuid);

    if (token.length) {
      // now setting the token...
      setXsrfToken(token);
      setCuid(cuid);
      
      if (options.popup) {
        cui.log('handleCovAuthResponse closing', options);
        window.close();   
      } else {
        // ...and now do the app redirect
        if (options.selfRedirect) {
          cui.log('handleCovAuthResponse self redirect', getAuthInfo());
          // ... let the app handle its own redirection
          return promise.resolve(getAuthInfo());
        } else {
          cui.log('handleCovAuthResponse redirect', getRedirect());
          window.location.replace(getRedirect());
        }
      }     
    } else {
      token = getXsrfToken();
      if (token && token.length) {
        // have token, resolve...
        cui.log('handleCovAuthResponse resolved', getAuthInfo());
        return promise.resolve(getAuthInfo());
      }
    }
    
    // else no CovAuthResponse on the window.location..., ignore...
    return promise;
  }

  function setAuthInfo(obj) {
    // set our internal cache
    cui.log('setAuthInfo', obj);
    
    //covAuthServerUrl = obj.ssoUrl;
    //covAuthServerUrlNext = obj.identityUrl;
    covAuthServerUrl = obj.identityUrl;

    //realmId = obj.realmId;
    //solutionInstanceId = obj.solutionId;
    setSolutionInstanceId(obj.solutionId);

    var authInfoObj = _.cloneDeep(obj);
    //delete authInfoObj.realmId;
    delete authInfoObj.solutionId;
    setAuthInfoObj(JSON.stringify(authInfoObj));
    
    return $.Deferred().resolve(obj);
  }

  function getAuthInfo() {
    // get from our internal cache(s)
    var obj = {};

    var authinfo = getAuthInfoObj();
    if (authinfo && authinfo.length) {
      obj.authInfo = [];
      obj.authInfo.push(JSON.parse(authinfo));
    }

    obj.cuid = getCuid();
    obj.appRedirect = getRedirect();
    
    return obj;
  }

  /*function haveAuthInfo() {
    var info = getAuthInfo();
    var b = info.ssoUrl.length > 0;
    return b;
  }*/

  function covAuthInfo(options) {
    // NB default the originUri to window.location.hostname, if override not specified...
    if (!options) {
      options = {};
      options.qs = [];
      options.qs.push(['originUri', window.location.hostname]);
    } else {
      options.qs = [];
      options.qs.push([options.isIot ? 'iotSolutionHostname' : 'originUri', options.originUri || window.location.hostname]);
    }
    options.contentType = 'application/x-www-form-urlencoded';

    cui.log('covAuthInfo', options);

    /*// NB begin attempt to derive the serviceUrl and apiPlatform
    if (! getServiceUrl()) {
      // NB comment out until it works in PRD
      // setServiceUrl('PRD');
      setServiceUrl('PRDBLUE');
    }*/
    
    return doCall('COV_AUTH_INFO', options)
      .then(function (response) {
        if (! response.solutionId.length) {

          /*// specified originUri was not found in the curr platform... 
          // so try call again, in next platform
          var currPlatform = getApiPlatform();
          if (currPlatform === 'PRD' || currPlatform === 'PRDBLUE') {
            setServiceUrl('STG');
            return covAuthInfo(options);
          } else if (currPlatform === 'STG') {
            setServiceUrl('QA');
            return covAuthInfo(options);
          } else if (currPlatform === 'QA') {
            setApiPlatform('');
            setServiceUrl('');
            // ...else must reject at this point...
            return $.Deferred().reject(response);            
          }
          */
          return $.Deferred().reject(response);            
        } else {
          cui.log('platform resolved to', getServiceUrl(), getApiPlatform());

          setAuthInfo(response);
          return $.Deferred().resolve(response);
        }
      });
  }

  function startCovAuth(options) {
    // make sure we have proper state before proceeding...
    return covAuthInfo(options)
      .then(function (response) {
        return doCovAuth(options);
      });
  }

  function covJWTLogout(options) {
    if (!options) {
      options = {};
    }
    //options.type = 'POST';

    return doCall('COV_JWT_LOGOUT', options)
      .then(function (response) {
        // drop 'old' auth info
        clearXsrfToken();
        clearCuid();

        return $.Deferred().resolve(response);
      });
  }

  function startCovLogout(options) {
    // first drop JWT stuff...
    return covJWTLogout(options)
      .then(function (response) {
        // ...then do SSO/CCA logout
        return doCovLogout(options);
      });
  }

  function doCovLogout(options) {
    var pendingAuthPromise = $.Deferred();

    var finalRedirect = window.location.href.split('#')[0];
    
    if (!options) {
      options = {};
    }
    options.qs = [];
    options.qs.push(['url', finalRedirect]);

    options.contentType = 'application/x-www-form-urlencoded';

    cui.log('doCovLogout', options, options.qs[0], finalRedirect);


    if (options.popup) {
      // TODO support the popup scenario here...
    } else {
      doCall('COV_LOGOUT', options);
    }

    return pendingAuthPromise;
  }

  function doCovAuth(options) {
    cui.log('doCovAuth');

    var pendingAuthPromise = $.Deferred();

    // drop BOTH 'old' tokens, until we support dual-auth scenario
    clearToken();
    clearXsrfToken();
    clearCuid();

    // NB default the authRedirect to window.location.href, if override not specified...
    options.authRedirect = options.authRedirect || window.location.href;
    //setRedirect(options.authRedirect);

    // NB default the appRedirect to window.location.href, if override not specified...
    options.appRedirect = options.appRedirect || window.location.href;
    setRedirect(options.appRedirect);

    cui.log('doCovAuth auth,app Redirect', options.authRedirect, options.appRedirect, options);
    
    // Do call... 
    if (options.popup) {
      var popup = doCall('COV_AUTH_POP', options);

      var waitFn = function(promise, popup) {
        cui.log('waiting', promise, popup);

        if (popup.closed !== false) {
          // 1. the window closed...
          clearInterval(waitTimer);

          // ...so, presuming the xsrf arrived... and was cached...
          var tokenStr = getXsrfToken();
          if (tokenStr) {
            var authInfo = getAuthInfo();
            promise.resolve(authInfo);
          }
          else {
            // window was manually closed without completing auth process
            // ...reject promise
            promise.reject();
          }
        }
      };

      // Start a loop...
      var waitTimer = setInterval(function () {
        waitFn(pendingAuthPromise, popup);
      }, 500);
    } else {
      doCall('COV_AUTH', options);
    }

    return pendingAuthPromise;
  }


  function isJWT() {
    var jwt = getXsrfToken();
    return (jwt && jwt.length > 0);
  }
  function getXsrfToken() {
    var token = window.localStorage.getItem('cui.xt');
    return token;
  }
  function setXsrfToken(val) {
    window.localStorage.setItem('cui.xt', val);
  }
  function clearXsrfToken() {
    window.localStorage.removeItem('cui.xt');
    return;
  }
  function getCuid() {
    var token = window.localStorage.getItem('cui.c');
    return token;
  }
  function setCuid(val) {
    window.localStorage.setItem('cui.c', val);
  }
  function clearCuid() {
    window.localStorage.removeItem('cui.c');
    return;
  }
  function getSolutionInstanceId() {
    var token = window.localStorage.getItem('cui.sii');
    return token;
  }
  function setSolutionInstanceId(val) {
    window.localStorage.setItem('cui.sii', val);
  }
  function setRedirect(val) {
    window.localStorage.setItem('cui.r', val);
  }
  function getRedirect() {
    return window.localStorage.getItem('cui.r');
  }
  function setAuthInfoObj(val) {
    window.localStorage.setItem('cui.ai', val);
  }
  function getAuthInfoObj() {
    return window.localStorage.getItem('cui.ai');
  }
  /*function clearRedirect() {
    window.localStorage.removeItem('cui.r');
    return;
  }*/
  // ----------------------------

  function setVersionOverrides(overrides) {
    _.each(overrides, function(o) {
      versionOverrides.push({name: o[0], ver: o[1]});
    });
  }

  function getVersionOverride(apiName) {
    //cui.log('getVersionOverride',apiName);
    var override = _.find(versionOverrides, {name: apiName});
    return(override);
  }

  /* function getDataCall(cmd) {
    var dataCall = _.find(dataCalls, {cmd: cmd});
    return dataCall;
  }*/
  function getDataCall(cmd) {
    var dataCall;
    var callVersions = _.filter(dataCalls, {cmd: cmd});
    var override = getVersionOverride(callVersions[0].apiName);

    if (override) {
      // ...take it, presume the request is going to match.
      dataCall = _.find(callVersions, {apiVer: override.ver});
    } else {
      //dataCall = _.sortByOrder(callVersions, ['apiVer'], ['desc'])[0];
      
      // ...may have to locate the latest version in the given platform...
      var sortedCallVersions = _.sortByOrder(callVersions, ['apiVer'], ['desc']);
      _.each(sortedCallVersions, function(call, index) {
        if (_.isUndefined(call.apiPlatform)) { // ...call is good across all platforms
          dataCall = call;
          return false; // break loop
        } else { // ...platform match required to use call
          if (call.apiPlatform.indexOf(getApiPlatform()) > -1) {
            // matched
            dataCall = call;
            return false; // break loop;
          }
        }
      });
    }

    return dataCall;
  }

  function addQueryString(url, opts) {
    function addNameValuePair(currUrl, p) {
      var pChar = (currUrl.indexOf('?') === -1) ? '?' : '&';
      var paramStr = pChar + encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]);
      return currUrl + paramStr;
    }

    // attach whatever additional query string params may come in...
    if (opts && opts.qs) {
      if (_.isArray(opts.qs[0])) {
        // multiple key-value pairs.
        _.each(opts.qs, function(p) {
          url = addNameValuePair(url, p);
        });
      } else {
        url = addNameValuePair(url, opts.qs);
      }
    }
    return url;
  }

  function addUriParams(url, opts) {
    if (opts) {
      // replace tokens in call with values specified via 'options' obj
      _.each(optionVar, function (v) {
        var val = opts[v.name];
        if (! _.isUndefined(val)) {
          var replacementValue = encodeURIComponent(val);
                    
          url = url.replace(v.regex, replacementValue);

          //cui.log('uri', val, replacementValue);
        }
      });
    }
    return url;
  }
  
  function prepareCall(cmd, opts) {
    var preparedCall = '';
    var dataCall = getDataCall(cmd);
    if (dataCall) {
      preparedCall = _.cloneDeep(dataCall);

      //cui.log(cmd, opts);
      if (! opts.accepts) {
        // build accepts
        preparedCall.accepts = ACCEPTS_TEMPLATE.replace(ACCEPTS_TOKEN_REGEX, preparedCall.accepts);
        if (preparedCall.acceptsSuffix) {
          preparedCall.accepts = preparedCall.accepts + preparedCall.acceptsSuffix;
        }        
      }

      // 1a. replace SSO_SERVER token as needed...
      // NB HARDCODE of protocol...
      var ssoAuthUrl = 'https://' + covAuthServerUrl;
      preparedCall.call = preparedCall.call.replace(SSO_SERVER_TOKEN_REGEX, ssoAuthUrl);

      // 1b. replace SSO_LOGOUT token as needed...
      //cui.log('preparedCall', preparedCall);
      if (preparedCall.call.indexOf(SSO_LOGOUT_TOKEN) > -1) {
        var authInfoObj = getAuthInfo();
        //cui.log('authInfoObj', authInfoObj);
        if (authInfoObj && authInfoObj.authInfo) {
          var ssoLogoutUrl = 'https://' + authInfoObj.authInfo[0].ssoUrl;
          //var ssoLogoutUrl = 'https://' + authInfoObj.authInfo[0].identityUrl;
          preparedCall.call = preparedCall.call.replace(SSO_LOGOUT_TOKEN_REGEX, ssoLogoutUrl);        
        }
      }

      // 2. replace SERVER_URL token with curr state 
      preparedCall.call = preparedCall.call.replace(SERVER_TOKEN_REGEX, getServiceUrl());

      // 3. replace tokens in call with values specified via 'options' obj
      preparedCall.call = addUriParams(preparedCall.call, opts);

      // 4. add qs params to url
      preparedCall.call = addQueryString(preparedCall.call, opts);
    }

    return preparedCall;
  }

  function isRetriable(xhr, options) {
    var b = false;
    if (xhr && xhr.status === 429) {
      // ... was synthetically throttled
      b = true;
    } else if (xhr &&
      xhr.responseJSON &&
      xhr.responseJSON.fault &&
      xhr.responseJSON.fault.faultstring && 
      xhr.responseJSON.fault.faultstring.toLowerCase().indexOf('spike arrest') > -1) {
      // ... was flaged for speeding
      b = true;
    } else if (isNotYetUnsecure(xhr, options)) {
      // ... was premature
      b = true;
    }
    return b;
  }

  function isUnauthorized(xhr) {
    var b = false;
    if (xhr && xhr.status === 401) {
      //cui.log('isunath', xhr);
      //if (xhr.responseJSON.apiStatusCode === 'gateway:token:invalid') {
        b = true;
      //}
    }
    return b;
  }

  function isNotYetUnsecure(xhr, options) {
    //cui.log('isNotUnsecure', xhr, options);
    var b = false;
    if (options && options.cmdType === 'unsecured') {
      //cui.log('isNotUnsecure 1', xhr, options);
      if (xhr && xhr.status === 400) {
        //cui.log('isNotUnsecure 2', xhr, options);
        if (xhr.responseJSON.apiMessage === 'Solution-instance-Id is missing/invalid.') {
          //cui.log('isNotUnsecure 3', xhr, options);
          b = true;
        }
      }      
    }
    return b;
  }

  function setAuthHandler(fn) {
    // TODO some kind of sanity check?
    authHandler = fn;
  }

  function runAuthHandler() {
    if ($.isFunction(authHandler)) {
      cui.log('calling authHandler');
      // TODO some kind of sanity check?
      return authHandler();
    } else {
      return $.Deferred().reject();
    }
  }

  function doThrottleProofServiceCall(options, defer) {
    // TODO ideally, to support both delayForIndex and retry at the same time,
    // fail handler will be further upstream, in cui.ajax().

    // moved MAGIC
    if (options.useCuid) {
      options.url = options.url.replace(encodeURIComponent(options.personId), encodeURIComponent(getCuid()));
    }
    
    if (! _.isUndefined(options.delayForIndex) && options.delayForIndex === true) {
      return cui.ajax(options)
        .then(function (response) {
          return doDelayForIndex(options, response);
        });
    } else {
      if (! defer) {
        defer = $.Deferred();
      }

      cui.ajax(options)
        // 200 etc
        .then(function (response) {
          //cui.log('resolved', options.url);
          defer.resolve(response);
        })

        // 400, 500 etc
        .fail(function (xhr, textStatus, errorThrown) {
          //cui.log('caught error xhr=', xhr);
          if (isRetriable(xhr, options)) {
            cui.log('retrying', options.url);
            return doThrottleProofServiceCall(options, defer);
          }
          else if (isUnauthorized(xhr)) {
            // ! Automagically handle stale and/or non-existent bearer-token/jwt 
            cui.log('attempting to handle unauthorized');

            runAuthHandler()
            .then(function (response) {
              cui.log('authHandler success', response);

              // attach newly obtained auth...
              setAuthorizationHeader(options);

              // ...reissue call with newly attached auth...
              return doThrottleProofServiceCall(options, defer);  
            })
            .fail(function (err) {
              defer.reject(xhr, textStatus, errorThrown);
            });  
          }
          else {
            defer.reject(xhr, textStatus, errorThrown);
          }
        });
  
      return defer.promise();
    }  
  }

  /* DEPRECATED by above...
  function doServiceCall(options) {
    if (isJWT()) {
      options.success = handleJWT;
    }

    if (! _.isUndefined(options.delayForIndex) && options.delayForIndex === true) {
      return cui.ajax(options)
        .then(function (response) {
          return doDelayForIndex(options, response);
        });
    } else {
      return cui.ajax(options);
    }
  }*/


  function openPopup(url, options) {
    var w = 400 || options.popUpWidth;
    var h = 650 || options.popUpHeight;
    var top = 200 || options.popUpTop;
    var left = 200 || options.popUpLeft;

    //var winName = '_blank' || options.popupWinName;
    var winName = 'Auth' || options.popupName;
    var staticFeatures = 'toolbar=no, location=no, directories=no, status=no, menubar=no, copyhistory=no, ' || options.popUpFeatures;
    var dynamicFeatures = 'width=' + w + ', height=' + h + ', top=' + top + ', left=' + left;
    var winFeatures = staticFeatures + dynamicFeatures;

    return window.open(url, winName, winFeatures);
  }

  function redirect(url, options) {
    //cui.log('cui redirect', url, options);
    window.location.href = url;
    return window;
  }

  function setAuthorizationHeader(options) {
    // Set authorization header...
    if (options.cmdType === 'jwtinit') {
      // no header needed
      options.xhrFields = {withCredentials: true};
    }
    else if (options.cmdType === 'authinit') {
      // initializing auth, don't set any auth headers...
    }
    else if (options.cmdType === 'unsecured') {
      // pre-auth calls, send solutionInstanceId...
      options.beforeSend = function(xhr, settings) { 
        xhr.setRequestHeader('solutionInstanceId', getSolutionInstanceId()); 
      };
    }
    else if (isJWT()) {
      // jwt call, 
      // NB jwt trumps bearer token, if we have both
      options.xhrFields = {withCredentials: true};
      options.beforeSend = function(xhr, settings) {
        //cui.log('jwt beforesend', getXsrfToken(), realmId);
        xhr.setRequestHeader('XSRFToken', getXsrfToken());
        //xhr.setRequestHeader('realmId', realmId);
        xhr.setRequestHeader('solutionInstanceId', getSolutionInstanceId());
      };
    } 
    else {
      // presume this is an oauth token-based call
      var authHeaderValue;
      if (options.cmdType === 'auth') {
        var encodedAuth = btoa(options.clientId + ':' + options.clientSecret);
        authHeaderValue = 'Basic ' + encodedAuth;           
      } else {
        var token = decodeURIComponent(getToken());
        authHeaderValue = 'Bearer ' + token;           
      }
      options.beforeSend = function(xhr, settings) { 
        xhr.setRequestHeader('Authorization', authHeaderValue);
      };
    } 
    return options;
  }

  function doCall(cmd, options) {
    //cui.log('doCall', cmd);

    // make it not fail...
    if (! options) {
      options = {};
    }

    var rc; 

    var dc = prepareCall(cmd, options);
    if (dc) {
      // attach cmdType to options{} so other fns can see it...
      options.cmdType = dc.cmdType;

      if (options.cmdType === 'popup') {
        rc = openPopup(dc.call, options);
      } else if (options.cmdType === 'redirect') {
        rc = redirect(dc.call, options);
      } else {
        options.url = dc.call;

        //cui.log('pc', options);
        // Set the contentType...        
        if (! options.contentType) {
          // If contentType was not previously set...
          // set 'accepts'...
          if (dc.accepts) {
            options.accepts = dc.accepts;
            if (options.data) {
              // ...set 'contentType' to match it.
              options.contentType = dc.accepts;
            }
          }
        }
        //cui.log('dc', dc, options);

        // Set authorization header...
        setAuthorizationHeader(options); 
       
        rc = doThrottleProofServiceCall(options);
      }
    }
    // else 'no such cmd' error!

    return rc;
  }
  // ------------------------------------------------------


  // -------------------------------------
  // Local config file settings
  // -------------------------------------
  /* DISABLED! 
   * interfering with angularApp container's loading of its own assets...
   * 
  function handleCuiConfig(obj) {
    cui.log('handleCuiConfig', obj);

    // Only handle specific override(s)... 
    if (obj.setServiceUrl) {
      setServiceUrl(obj.setServiceUrl);
    }

    if (obj.originUri) {
      setOriginUri(obj.originUri);
    }
    
    return;
  }

  // Allow local config overrides, in addition to calling externally...
  // NB $.getJSON will not work in chrome (CORS error), 
  // so use getScript and then parse it into json.
  $.getScript('cuijs-config.js')
    .done(function(data, textStatus) {
      cui.log('cuijs-config.js loaded:', data);

      // NB format of config file is extremely static !
      var parsedConfig = JSON.parse(data.replace('var config = ', ''));
      handleCuiConfig(parsedConfig);
    })
    .fail(function(jqxhr, settings, exception) {
      cui.log('cuijs-config.js load failed:', exception);
    });
  */
  // ------------------------------------------------------


  // -------------------------------------
  // Public methods
  // -------------------------------------
  return {
    // -------------------------
    // Helpers
    // -------------------------
    /**
     * The parseError() call is a helper function used inside `fail()` handlers.
     * It simplifies the process of parsing through the response object for any underlying error message returned by the APIs.
     * @name util_parseError
     * @param {String} response The response from the cui.js call.
     * @return {String} error
     * @example
     * myCuiJs.getOrganizations().then(function(response) {
     *   // Do something with response.
     * })
     * .fail(function(err) {
     *   // Do something with error.
     *   var errStr = myCuiJs.parseError(err);
     * });
     */
    parseError: function(response) {
      return parseError(response);
    },

    getDataCalls: function () {
      return dataCalls;
    },
    doCall: function () {
      return doCall.apply(null, arguments);
    },
    // -------------------------


    // -------------------------
    // Config
    // -------------------------
    /**
     * The setServiceUrl() call is made immediately after getting an instance of cui.api().
     * It will construct the proper base URL for all subsequent calls to Covisint APIs, 
     * based on the specified platform parameter.
     * @name util_setServiceUrl
     * @param {String} platform Either 'PRD', 'STG', 'QA'. Also allows any url to be set.
     * @example
     * var myCuiJs = cui.api();
     * myCuiJs.setServiceUrl('PRD');
     */
    setServiceUrl: function (platform) {
      return setServiceUrl(platform);
    },

    /**
     * The getServiceUrl() call is a helper method.
     * @name util_getServiceUrl
     * @return {String} The base-url of the APIs.
     * @example
     * var url = myCuiJs.getServiceUrl();
     * // ...url will be: 'https://api.us1.covisint.com'
     */
    getServiceUrl: function () {
      return getServiceUrl();
    },
    // -------------------------


    // -------------------------
    // IdM
    // -------------------------
    /**
     * The getOrganizations() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OrganizationV2.raml">API Organization</a> call.
     * @name idm_getOrganizations
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getOrganizations()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getOrganizations: function (options) {
      return doCall('ORGS', options);
    },

    /**
     * The getOrganizationsCount() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OrganizationV3.raml">API Organization</a> call.
     * @name idm_getOrganizationsCount
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getOrganizationsCount()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getOrganizationsCount: function (options) {
      return doCall('ORGS_COUNT', options);
    },

    /**
     * The getOrganization() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OrganizationV2.raml">API Organization</a> call.
     * @name idm_getOrganization
     * @param {Object} options 
     * @param {String} options.organizationId The id of the Organization being retrieved.
     * @example
     * myCuiJs.getOrganization({organizationId: 'your organization id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getOrganization: function (options) {
      return doCall('ORG', options);
    },

    /**
     * The getOrganizationRequests() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OrganizationV3.raml">API Organization</a> call.
     * @name idm_getOrganizationRequests
     * @param {Object} options 
     * @param {Object} options.data The data of the Organization request being created.
     * @example
     * myCuiJs.getOrganizationRequests({data: {'your organization data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getOrganizationRequests: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ORG_REQUESTS', options);
    },

    /**
     * The approveOrganizationRequests() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OrganizationV3.raml">API Organization</a> call.
     * @name idm_approveOrganizationRequests
     * @param {Object} options 
     * @param {Object} options.data The data of the Organization request being approved.
     * @example
     * myCuiJs.approveOrganizationRequests({data: {'your organization data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    approveOrganizationRequests: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ORG_REQUESTS_APPROVE', options);
    },

    /**
     * The denyOrganizationRequests() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OrganizationV3.raml">API Organization</a> call.
     * @name idm_denyOrganizationRequests
     * @param {Object} options 
     * @param {Object} options.data The data of the Organization request being denied.
     * @example
     * myCuiJs.denyOrganizationRequests({data: {'your organization data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    denyOrganizationRequests: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ORG_REQUESTS_DENY', options);
    },

    /**
     * The createOrganization() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OrganizationV2.raml">API Organization</a> call.
     * @name idm_createOrganization
     * @param {Object} options 
     * @param {Object} options.data The data of the Organization being created.
     * @example
     * myCuiJs.createOrganization({data: {'your organization data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createOrganization: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ORGS', options);
    },

    /**
     * The updateOrganization() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OrganizationV2.raml">API Organization</a> call.
     * @name idm_updateOrganization
     * @param {Object} options 
     * @param {String} options.id The id of the Organization being updated.
     * @param {Object} options.data The data of the Organization being updated.
     * @example
     * myCuiJs.updateOrganization({id: 'your organization id', data: {'your organization data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updateOrganization: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('ORG', options);
    },

    /**
     * The getOrganizationHierarchy() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OrganizationV2.raml">API Organization</a> call.
     * @name idm_getOrganizationHierarchy
     * @param {Object} options 
     * @param {String} options.id The id of the Organization whose hierarchy is being retrieved.
     * @example
     * myCuiJs.getOrganizationHierarchy({id: 'your organization id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getOrganizationHierarchy: function (options) {
      return doCall('ORG_HIERARCHY', options);
    },


    /**
     * The getAttributes() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeV1.raml">API Attribute</a> call.
     * @name idm_getAttributes
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getAttributes()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getAttributes: function (options) {
      return doCall('ATTRIBUTES', options);
    },

    /**
     * The createAttribute() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeV1.raml">API Attribute</a> call.
     * @name idm_createAttribute
     * @param {Object} options 
     * @param {Object} options.data The data of the attribute being created.
     * @example
     * myCuiJs.createAttribute({data: {'your attribute data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createAttribute: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ATTRIBUTES', options);
    },

    /**
     * The getAttribute() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeV1.raml">API Attribute</a> call.
     * @name idm_getAttribute
     * @param {Object} options 
     * @param {String} options.attributeId The id of the attribute being retrieved.
     * @example
     * myCuiJs.getAttribute({attributeId: 'your attribute id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getAttribute: function (options) {
      return doCall('ATTRIBUTE', options);
    },

    /**
     * The updateAttribute() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeV1.raml">API Attribute</a> call.
     * @name idm_updateAttribute
     * @param {Object} options 
     * @param {String} options.attributeId The id of the attribute being updated.
     * @param {Object} options.data The data of the attribute being updated.
     * @example
     * myCuiJs.updateAttribute({attributeId: 'your attribute id', data: 'your attribute data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updateAttribute: function (options) {
      options.type = 'PUT';
      options.data = JSON.stringify(options.data);
      return doCall('ATTRIBUTE', options);
    },

    /**
     * The deleteAttribute() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeV1.raml">API Attribute</a> call.
     * @name idm_deleteAttribute
     * @param {Object} options 
     * @param {String} options.attributeId The id of the attribute being deleted.
     * @example
     * myCuiJs.deleteAttribute({attributeId: 'your attribute id', data: 'your attribute data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deleteAttribute: function (options) {
      options.type = 'DELETE';
      return doCall('ATTRIBUTE', options);
    },


    /**
     * The getAttributeTemplates() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeV1.raml">API Attribute</a> call.
     * @name idm_getAttributeTemplates
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getAttributeTemplates()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getAttributeTemplates: function (options) {
      return doCall('ATTRIBUTE_TEMPLATES', options);
    },

    /**
     * The createAttributeTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeV1.raml">API Attribute</a> call.
     * @name idm_createAttributeTemplate
     * @param {Object} options 
     * @param {Object} options.data The data of the attribute template being created.
     * @example
     * myCuiJs.createAttributeTemplate({data: {'your attribute template data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createAttributeTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ATTRIBUTE_TEMPLATE', options);
    },

    /**
     * The getAttributeTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeV1.raml">API Attribute</a> call.
     * @name idm_getAttributeTemplate
     * @param {Object} options 
     * @param {String} options.attributeId The id of the attribute template being retrieved.
     * @example
     * myCuiJs.getAttributeTemplate({attributeId: 'your attribute template id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getAttributeTemplate: function (options) {
      return doCall('ATTRIBUTE_TEMPLATE', options);
    },

    /**
     * The updateAttributeTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeV1.raml">API Attribute</a> call.
     * @name idm_updateAttributeTemplate
     * @param {Object} options 
     * @param {String} options.attributeId The id of the attribute template being updated.
     * @param {Object} options.data The data of the attribute template being updated.
     * @example
     * myCuiJs.updateAttributeTemplate({attributeId: 'your attribute template id', data: 'your attribute template data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updateAttributeTemplate: function (options) {
      options.type = 'PUT';
      options.data = JSON.stringify(options.data);
      return doCall('ATTRIBUTE_TEMPLATE', options);
    },

    /**
     * The deleteAttributeTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeV1.raml">API Attribute</a> call.
     * @name idm_deleteAttributeTemplate
     * @param {Object} options 
     * @param {String} options.attributeId The id of the attribute template being deleted.
     * @example
     * myCuiJs.deleteAttributeTemplate({attributeId: 'your attribute template id', data: 'your attribute template data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deleteAttributeTemplate: function (options) {
      options.type = 'DELETE';
      return doCall('ATTRIBUTE_TEMPLATE', options);
    },


    /**
     * The getPersons() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_getPersons
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPersons()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersons: function (options) {
      return doCall('PERSONS', options);
    },

    /**
     * The getPersonsAdmins() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_getPersonsAdmins
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPersonsAdmins()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonsAdmins: function (options) {
      return doCall('PERSONS_ADMINS', options);
    },

    /**
     * The countPersons() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV3.raml">API Person</a> call.
     * @name idm_countPersons
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.countPersons()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    countPersons: function (options) {
      if (! options) {
        options = {};
      }
      options.accepts = 'text/plain';
      return doCall('PERSONS_COUNT', options);
    },

    /**
     * The registerPerson() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV3.raml">API Person</a> call.
     * @name idm_registerPerson
     * @param {Object} options 
     * @param {Object} options.data The data of the person being registered.
     * @example
     * myCuiJs.registerPerson({data: 'your registration data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    registerPerson: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('PERSON_REGISTER', options);
    },

    /**
     * The getRegistrationStatus() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV3.raml">API Person</a> call.
     * @name idm_getRegistrationStatus
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getRegistrationStatus()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getRegistrationStatus: function (options) {
      return doCall('PERSON_REGISTER_STATUS', options);
    },

    /**
     * The validateRegistration() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV3.raml">API Person</a> call.
     * @name idm_validateRegistration
     * @param {Object} options 
     * @param {Object} options.data The data of the person being created.
     * @example
     * myCuiJs.validateRegistration()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    validateRegistration: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('PERSON_REGISTER_VALIDATE', options);
    },

    /**
     * The createPerson() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_createPerson
     * @param {Object} options 
     * @param {Object} options.data The data of the person being created.
     * @example
     * myCuiJs.createPerson({data: {'your person data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createPerson: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('PERSONS', options);
    },

    /**
     * The getPersonRoles() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV3.raml">API Person</a> call.
     * @name idm_getPersonRoles
     * @param {Object} options 
     * @param {String} options.personId The id of the person whose roles are being retrieved.
     * @example
     * myCuiJs.getPersonRoles({personId: 'your person id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonRoles: function (options) {
      return doCall('PERSON_ROLES', options);
    },

    /**
     * The getPersonRolesOnly() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV3.raml">API Person</a> call. This call adds `onlyroles=true` as a mediaType parameter to the getRoles call.
     * @name idm_getPersonRolesOnly
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['personId'] The label for the personId property.
     * @param {String} options.qs[personId] The id of the person to activate.
     * @example
     * myCuiJs.getPersonRolesOnly({qs: [['personId', 'your person id']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonRolesOnly: function (options) {
      return doCall('PERSON_ROLES_ONLY', options);
    },

    /**
     * The activatePerson() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_activatePerson
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['personId'] The label for the personId property.
     * @param {String} options.qs[personId] The id of the person to activate.
     * @example
     * myCuiJs.activatePerson({qs: [['personId', 'your person id']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    activatePerson: function (options) {
      options.type = 'POST';
      return doCall('PERSON_ACTIVATE', options);
    },

    /**
     * The suspendPerson() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_suspendPerson
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['personId'] The label for the personId property.
     * @param {String} options.qs[personId] The id of the person to suspend.
     * @example
     * myCuiJs.suspendPerson({qs: [['personId', 'your person id']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    suspendPerson: function (options) {
      options.type = 'POST';
      return doCall('PERSON_SUSPEND', options);
    },

    /**
     * The unsuspendPerson() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_unsuspendPerson
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['personId'] The label for the personId property.
     * @param {String} options.qs[personId] The id of the person to unsuspend.
     * @example
     * myCuiJs.unsuspendPerson({qs: [['personId', 'your person id']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    unsuspendPerson: function (options) {
      options.type = 'POST';
      return doCall('PERSON_UNSUSPEND', options);
    },

    /**
     * The getPerson() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_getPerson
     * @param {Object} options 
     * @param {String} options.personId The id of the person being retrieved.
     * @example
     * myCuiJs.getPerson({personId: 'your person id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPerson: function (options) {
      return doCall('PERSON', options);
    },

    /**
     * The updatePerson() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_updatePerson
     * @param {Object} options 
     * @param {String} options.personId The id of the person being updated.
     * @example
     * myCuiJs.updatePerson({personId: 'your person id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updatePerson: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('PERSON', options);
    },

    /**
     * The validatePassword() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV3.raml">API Person</a> call.
     * @name idm_validatePassword
     * @param {Object} options 
     * @param {Object} options.data The data of the validation request.
     * @example
     * myCuiJs.validatePassword()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    validatePassword: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('PERSON_PASSWORD_VALIDATE', options);
    },

    /**
     * The updatePersonAttributes() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_updatePersonAttributes
     * @param {Object} options 
     * @param {String} options.personId The id of the person whose attributes are being updated.
     * @param {Object} options.data The data of the attributes.
     * @example
     * myCuiJs.updatePersonAttributes({personId: 'your person id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updatePersonAttributes: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('PERSON_ATTRIBUTES', options);
    },

    /**
     * The deletePersonAttributes() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_deletePersonAttributes
     * @param {String} options.personId The id of the person whose attributes are being deleted.
     * @param {Object} options 
     * @example
     * myCuiJs.deletePersonAttributes({personId: 'your person id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deletePersonAttributes: function (options) {
      options.type = 'DELETE';
      return doCall('PERSON_ATTRIBUTES', options);
    },

    /**
     * The getPersonAttributes() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_getPersonAttributes
     * @param {String} options.personId The id of the person whose attributes are being getd.
     * @param {Object} options 
     * @example
     * myCuiJs.getPersonAttributes({personId: 'your person id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonAttributes: function (options) {
      return doCall('PERSON_ATTRIBUTES', options);
    },

    /**
     * The getPersonInvitations() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_getPersonInvitations
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPersonInvitations()
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonInvitations: function (options) {
      return doCall('PERSONS_INVITE', options);
    },

    /**
     * The createPersonInvitation() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_createPersonInvitation
     * @param {Object} options 
     * @param {Object} options.data The data of the invitation.
     * @example
     * myCuiJs.createPersonInvitation({data: {'your invitation data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createPersonInvitation: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('PERSONS_INVITE', options);
    },

    /**
     * The getPersonInvitation() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_getPersonInvitation
     * @param {Object} options 
     * @param {String} options.invitationId The id of the invitation being retrieved.
     * @example
     * myCuiJs.getPersonInvitation({invitationId: 'your invitation id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonInvitation: function (options) {
      return doCall('PERSON_INVITE', options);
    },

    /**
     * The deletePersonInvitation() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_deletePersonInvitation
     * @param {Object} options 
     * @param {String} options.invitationId The id of the invitation being deleted.
     * @example
     * myCuiJs.deletePersonInvitation({invitationId: 'your invitation id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deletePersonInvitation: function (options) {
      options.type = 'DELETE';
      return doCall('PERSON_INVITE', options);
    },

    /**
     * The acceptPersonInvitation() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_acceptPersonInvitation
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['createPersonId'] The label for the createPersonId property.
     * @param {String} options.qs[createPersonId] The id of the person created during the registration process.
     * @param {String} options.qs['inviteId'] The label for the inviteId property.
     * @param {String} options.qs[inviteId] The id of the invite being accepted.
     * @example
     * myCuiJs.acceptPersonInvitation({qs: [['createPersonId','your person id'],['inviteId','your invite id']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    acceptPersonInvitation: function (options) {
      options.type = 'POST';
      return doCall('PERSONS_INVITE_ACCEPT', options);
    },

    /**
     * The getPersonRequests() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_getPersonRequests
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPersonRequests()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonRequests: function (options) {
      return doCall('PERSONS_REQUEST', options);
    },

    /**
     * The createPersonRequest() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV3.raml">API Person</a> call.
     * @name idm_createPersonRequest
     * @param {Object} options 
     * @param {Object} options.data The data of the person request.
     * @example
     * myCuiJs.createPersonRequest({data: 'your person request data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createPersonRequest: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('PERSONS_CREATE_REQUEST', options);
    },

    /**
     * The getPersonRequest() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_getPersonRequest
     * @param {Object} options 
     * @param {String} options.requestId The id of the person request being retrieved.
     * @example
     * myCuiJs.getPersonRequest({requestId: 'your person request id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonRequest: function (options) {
      return doCall('PERSON_REQUEST', options);
    },

    /**
     * The deletePersonRequest() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_deletePersonRequest
     * @param {Object} options 
     * @param {String} options.requestId The id of the person request being deleted.
     * @example
     * myCuiJs.deletePersonRequest({requestId: 'your person request id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deletePersonRequest: function (options) {
      options.type = 'DELETE';
      return doCall('PERSON_REQUEST', options);
    },

    /**
     * The approvePersonRequest() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_approvePersonRequest
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['requestId'] The label for the requestId property.
     * @param {String} options.qs[requestId] The id of the person request.
     * @example
     * myCuiJs.approvePersonRequest({qs: [['requestId','your person request id']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    approvePersonRequest: function (options) {
      options.type = 'POST';
      return doCall('PERSONS_REQUEST_APPROVE', options);
    },

    /**
     * The denyPersonRequest() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV3.raml">API Person</a> call.
     * @name idm_denyPersonRequest
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['requestId'] The label for the requestId property.
     * @param {String} options.qs[requestId] The id of the person request.
     * @example
     * myCuiJs.denyPersonRequest({qs: [['requestId','your person request id']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    denyPersonRequest: function (options) {
      options.type = 'POST';
      return doCall('PERSONS_REQUEST_DENY', options);
    },

    /**
     * The getPersonPassword() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_getPersonPassword
     * @param {Object} options 
     * @param {String} options.personId The id of the Person whose password is being retrieved.
     * @example
     * myCuiJs.getPersonPassword({personId: 'your person id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonPassword: function (options) {
      return doCall('PERSON_PASSWORD', options);
    },

    /**
     * The createPersonPassword() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_createPersonPassword
     * @param {Object} options 
     * @param {String} options.personId The id of the Person whose password is being created.
     * @param {Object} options.data The password data.
     * @example
     * myCuiJs.createPersonPassword({
     *   personId: 'your person id',
     *   data: 'your password data'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createPersonPassword: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('PERSON_PASSWORD', options);
    },

    /**
     * The updatePersonPassword() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/PersonV2.raml">API Person</a> call.
     * @name idm_updatePersonPassword
     * @param {Object} options 
     * @param {String} options.personId The id of the Person whose password is being updated.
     * @param {Object} options.data The password data.
     * @example
     * myCuiJs.updatePersonPassword({
     *   personId: 'your person id',
     *   data: 'your password data'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updatePersonPassword: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('PERSON_PASSWORD', options);
    },

    /**
     * The getPackages() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getPackages
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPackages()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPackages: function (options) {
      return doCall('PACKAGES', options);
    },

    /**
     * The getPackagesCount() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV3.raml">API Service</a> call.
     * @name idm_getPackagesCount
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPackagesCount()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPackagesCount: function (options) {
      return doCall('PACKAGES_COUNT', options);
    },

    /**
     * The createPackage() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_createPackage
     * @param {Object} options 
     * @param {Object} options.data The data of the package being created.
     * @example
     * myCuiJs.createPackage({data: 'your package data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createPackage: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('PACKAGES', options);
    },

    /**
     * The getPackageServices() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getPackageServices
     * @param {Object} options 
     * @param {String} options.packageId The id of the package whose services are being retrieved.
     * @example
     * myCuiJs.getPackageServices({packageId: 'your package id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPackageServices: function (options) {
      return doCall('PACKAGE_SERVICES', options);
    },

    /**
     * The getPackage() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getPackage
     * @param {Object} options 
     * @param {String} options.packageId The id of the package being retrieved.
     * @example
     * myCuiJs.getPackage({packageId: 'your package id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPackage: function (options) {
      return doCall('PACKAGE', options);
    },

    /**
     * The getServices() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getServices
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getServices()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getServices: function (options) {
      return doCall('SERVICES', options);
    },

    /**
     * The createService() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_createService
     * @param {Object} options 
     * @param {Object} options.data The data of the service being created.
     * @example
     * myCuiJs.createService({data: 'your service data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createService: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('SERVICES', options);
    },

    /**
     * The getService() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getService
     * @param {Object} options 
     * @param {String} options.id The id of the service being retrieved.
     * @example
     * myCuiJs.getService({id: 'your service id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getService: function (options) {
      return doCall('SERVICE', options);
    },

    /**
     * The assignService() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV2.raml">API Service</a> call.
     * @name idm_assignService
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['packageId'] The label for the packageId property.
     * @param {String} options.qs[packageId] The id of the package to which the service belongs.
     * @param {String} options.qs['serviceId'] The label for the serviceId property.
     * @param {String} options.qs[serviceId] The id of the service being assigned.
     * @example
     * myCuiJs.assignService({qs: [['packageId', 'your package id'],['serviceId', 'your service id']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    assignService: function (options) {
      if (! options) {
        options = {};
      }
      options.type = 'POST';
      return doCall('ASSIGN_SERVICE', options);
    },

    /**
     * The removeService() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV2.raml">API Service</a> call.
     * @name idm_removeService
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['packageId'] The label for the packageId property.
     * @param {String} options.qs[packageId] The id of the package to which the service belongs.
     * @param {String} options.qs['serviceId'] The label for the serviceId property.
     * @param {String} options.qs[serviceId] The id of the service being removed.
     * @example
     * myCuiJs.removeService({qs: [['packageId', 'your package id'],['serviceId', 'your service id']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    removeService: function (options) {
      if (! options) {
        options = {};
      }
      options.type = 'POST';
      return doCall('REMOVE_SERVICE', options);
    },

    /**
     * The getPersonPackages() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV3.raml">API Service</a> call.
     * @name idm_getPersonPackages
     * @param {Object} options 
     * @param {String} options.personId The id of the person whose packages are being retrieved.
     * @example
     * myCuiJs.getPersonPackages({personId: 'your person id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonPackages: function (options) {
      return doCall('PACKAGES_PERSON', options);
    },

    /**
     * The getPersonPackage() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV3.raml">API Service</a> call.
     * @name idm_getPersonPackage
     * @param {Object} options 
     * @param {String} options.personId The id of the person to which the package belongs.
     * @param {String} options.packageId The id of the package which is being retrieved.
     * @example
     * myCuiJs.getPersonPackage({
     *   personId: 'your person id',
     *   packageId: 'your group package id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonPackage: function (options) {
      return doCall('GRANT_PACKAGE_PERSON', options);
    },

    /**
     * The getRequestablePersonPackages() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV3.raml">API Service</a> call.
     * @name idm_getRequestablePersonPackages
     * @param {Object} options 
     * @param {String} options.organizationId The id of the person whose packages are being retrieved.
     * @example
     * myCuiJs.getRequestablePersonPackages({personId: 'your person id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getRequestablePersonPackages: function (options) {
      return doCall('PACKAGES_PERSONS_REQUESTABLE', options);
    },

    /**
     * The grantPersonPackage() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV3.raml">API Service</a> call.
     * @name idm_grantPersonPackage
     * @param {Object} options 
     * @param {String} options.personId The id of the person to which the package belongs.
     * @param {String} options.packageId The id of the package which is being granted.
     * @example
     * myCuiJs.grantPersonPackage({
     *   personId: 'your person id',
     *   packageId: 'your group package id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    grantPersonPackage: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('GRANT_PACKAGE_PERSON', options);
    },

    /**
     * The getOrganizationPackages() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV3.raml">API Service</a> call.
     * @name idm_getOrganizationPackages
     * @param {Object} options 
     * @param {String} options.organizationId The id of the organization whose packages are being retrieved.
     * @example
     * myCuiJs.getOrganizationPackages({organizationId: 'your organization id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getOrganizationPackages: function (options) {
      return doCall('PACKAGES_ORG', options);
    },

    /**
     * The getRequestableOrganizationPackages() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV3.raml">API Service</a> call.
     * @name idm_getRequestableOrganizationPackages
     * @param {Object} options 
     * @param {String} options.organizationId The id of the organization whose packages are being retrieved.
     * @example
     * myCuiJs.getRequestableOrganizationPackages({organizationId: 'your organization id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getRequestableOrganizationPackages: function (options) {
      return doCall('PACKAGES_ORGANIZATIONS_REQUESTABLE', options);
    },

    /**
     * The getOrganizationPackage() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV3.raml">API Service</a> call.
     * @name idm_getOrganizationPackage
     * @param {Object} options 
     * @param {String} options.organizationId The id of the organization to which the package belongs.
     * @param {String} options.packageId The id of the package which is being retrieved.
     * @example
     * myCuiJs.getOrganizationPackage({
     *   organizationId: 'your organization id',
     *   packageId: 'your group package id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getOrganizationPackage: function (options) {
      return doCall('GRANT_PACKAGE_ORG', options);
    },

    /**
     * The grantOrganizationPackage() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV3.raml">API Service</a> call.
     * @name idm_grantOrganizationPackage
     * @param {Object} options 
     * @param {String} options.organizationId The id of the organization to which the package belongs.
     * @param {String} options.packageId The id of the package which is being granted.
     * @example
     * myCuiJs.grantOrganizationPackage({
     *   organizationId: 'your organization id',
     *   packageId: 'your group package id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    grantOrganizationPackage: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('GRANT_PACKAGE_ORG', options);
    },

    /**
     * The getPackageRequests() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV2.raml">API Service</a> call.
     * @name idm_getPackageRequests
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPackageRequests()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPackageRequests: function (options) {
      return doCall('PACKAGE_REQUESTS', options);
    },

    /**
     * The createPackageRequest() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV2.raml">API Service</a> call.
     * @name idm_createPackageRequest
     * @param {Object} options 
     * @param {Object} options.data The request data.
     * @example
     * myCuiJs.createPackageRequest({data: {'your request data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createPackageRequest: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('PACKAGE_REQUESTS', options);
    },

    /**
     * The getPackageRequest() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV2.raml">API Service</a> call.
     * @name idm_getPackageRequest
     * @param {Object} options 
     * @param {String} options.id The id of the request being retrieved.
     * @example
     * myCuiJs.getPackageRequest({id: 'your request id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPackageRequest: function (options) {
      return doCall('PACKAGE_REQUEST', options);
    },

    /**
     * The deletePackageRequest() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV2.raml">API Service</a> call.
     * @name idm_deletePackageRequest
     * @param {Object} options 
     * @param {String} options.id The id of the request being deleted.
     * @param {Object} options.data The request data.
     * @example
     * myCuiJs.deletePackageRequest({id: 'your request id', data: {'your request data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deletePackageRequest: function (options) {
      options.type = 'DELETE';
      return doCall('PACKAGE_REQUEST', options);
    },

    /**
     * The approvePackageRequest() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV2.raml">API Service</a> call.
     * @name idm_approvePackageRequest
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['requestId'] The label for the requestId property.
     * @param {String} options.qs[requestId] The id of the request being approved.
     * @example
     * myCuiJs.approvePackageRequest({qs: [['requestId', 'your request id']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    approvePackageRequest: function (options) {
      if (! options) {
        options = {};
      }
      options.type = 'POST';
      return doCall('APPROVE_PACKAGE', options);
    },

    /**
     * The denyPackageRequest() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV2.raml">API Service</a> call.
     * @name idm_denyPackageRequest
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['requestId'] The label for the requestId property.
     * @param {String} options.qs[requestId] The id of the request being denied.
     * @example
     * myCuiJs.denyPackageRequest({qs: [['requestId', 'your request id']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    denyPackageRequest: function (options) {
      if (! options) {
        options = {};
      }
      options.type = 'POST';
      return doCall('DENY_PACKAGE', options);
    },

    /**
     * The getPackageGrants() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV2.raml">API Service</a> call.
     * @name idm_getPackageGrants
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPackageGrants()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPackageGrants: function (options) {
      return doCall('PACKAGE_GRANTS', options);
    },

    /**
     * The getPersonClaims() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV2.raml">API Service</a> call.
     * @name idm_getPersonClaims
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPersonClaims()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonClaims: function (options) {
      return doCall('CLAIMS_PERSON', options);
    },

    /**
     * The getPersonPackageClaims() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ServiceV2.raml">API Service</a> call.
     * @name idm_getPersonPackageClaims
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPersonPackageClaims()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPersonPackageClaims: function (options) {
      return doCall('CLAIMS_PACKAGE_PERSON', options);
    },

    /**
     * The getGroups() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getGroups
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getGroups()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getGroups: function (options) {
      return doCall('GROUPS', options);
    },

    /**
     * The getGroup() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getGroup
     * @param {Object} options 
     * @param {String} options.groupId The id of the group being retrieved.
     * @example
     * myCuiJs.getGroup({
     *   groupId: 'your group id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getGroup: function (options) {
      return doCall('GROUP', options);
    },

    /**
     * The createGroup() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_createGroup
     * @param {Object} options 
     * @param {Object} options.data The data of the group.
     * @example
     * myCuiJs.createGroup({
     *   data: {'your group data'}
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createGroup: function (options) {
      options.type = 'POST';
      options.data = JSON.stringify(options.data);
      return doCall('GROUPS', options);
    },

    /**
     * The updateGroup() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_updateGroup
     * @param {Object} options 
     * @param {String} options.groupId The id of the group which is being updated.
     * @param {Object} options.data The data of the group.
     * @example
     * myCuiJs.updateGroup({
     *   groupId: 'your group id',
     *   data: {'your group data'}
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updateGroup: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('GROUP', options);
    },

    /**
     * The getGroupEntitlements() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getGroupEntitlements
     * @param {Object} options 
     * @param {String} options.groupId The id of the group which is being retrieved.
     * @example
     * myCuiJs.getGroupEntitlements({
     *   groupId: 'your group id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getGroupEntitlements: function (options) {
      return doCall('GROUP_ENTITLEMENTS', options);
    },

    /**
     * The createGroupEntitlements() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_createGroupEntitlements
     * @param {Object} options 
     * @param {String} options.groupId The id of the group to which the member belongs.
     * @param {Object} options.data The data of the entitlement which is being created.
     * @example
     * myCuiJs.createGroupEntitlements({
     *   groupId: 'your group id',
     *   data: 'your group entitlement data'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createGroupEntitlements: function (options) {
      options.type = 'POST';
      options.data = JSON.stringify(options.data);
      return doCall('GROUP_ENTITLEMENTS', options);
    },

    /**
     * The getGroupEntitlement() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getGroupEntitlement
     * @param {Object} options 
     * @param {String} options.groupId The id of the group to which the member belongs.
     * @param {String} options.groupEntitlementId The id of the entitlement which is being retrieved.
     * @example
     * myCuiJs.getGroupEntitlement({
     *   groupId: 'your group id',
     *   groupEntitlementId: 'your group entitlement id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getGroupEntitlement: function (options) {
      return doCall('GROUP_ENTITLEMENT', options);
    },

    /**
     * The deleteGroupEntitlement() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_deleteGroupEntitlement
     * @param {Object} options 
     * @param {String} options.groupId The id of the group to which the member belongs.
     * @param {String} options.groupEntitlementId The id of the entitlement which is being deleted.
     * @example
     * myCuiJs.deleteGroupEntitlement({
     *   groupId: 'your group id',
     *   groupEntitlementId: 'your group entitlement id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deleteGroupEntitlement: function (options) {
      options.type = 'DELETE';
      return doCall('GROUP_ENTITLEMENT', options);
    },

    /**
     * The getGroupMemberships() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getGroupMemberships
     * @param {Object} options 
     * @param {String} options.groupId The id of the group being retrieved.
     * @example
     * myCuiJs.getGroupMemberships({
     *   groupId: 'your group id',
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getGroupMemberships: function (options) {
      return doCall('GROUP_MEMBERSHIPS', options);
    },

    /**
     * The createGroupMemberships() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_createGroupMemberships
     * @param {Object} options 
     * @param {String} options.groupId The id of the group to which the member belongs.
     * @param {Object} options.data The data of the membership which is being created.
     * @example
     * myCuiJs.createGroupMemberships({
     *   groupId: 'your group id',
     *   data: {'your group membership data'}
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createGroupMemberships: function (options) {
      options.type = 'POST';
      options.data = JSON.stringify(options.data);
      return doCall('CREATE_GROUP_MEMBERSHIPS', options);
    },

    /**
     * The getGroupMembership() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getGroupMembership
     * @param {Object} options 
     * @param {String} options.groupId The id of the group to which the member belongs.
     * @param {Object} options.groupMembershipId The id of the membership which is being retrieved.
     * @example
     * myCuiJs.getGroupMembership({
     *   groupId: 'your group id',
     *   groupMembershipId: 'your group membership id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getGroupMembership: function (options) {
      return doCall('GROUP_MEMBERSHIP', options);
    },

    /**
     * The deleteGroupMembership() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_deleteGroupMembership
     * @param {Object} options 
     * @param {String} options.groupId The id of the group to which the member belongs.
     * @param {Object} options.groupMembershipId The id of the membership which is being deleted.
     * @example
     * myCuiJs.deleteGroupMembership({
     *   groupId: 'your group id',
     *   groupMembershipId: 'your group membership id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deleteGroupMembership: function (options) {
      options.type = 'DELETE';
      return doCall('GROUP_MEMBERSHIP', options);
    },

    /**
     * The getMemberMemberships() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/GroupV2.raml">API Group</a> call.
     * @name idm_getMemberMemberships
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getMemberMemberships()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getMemberMemberships: function (options) {
      return doCall('MEMBER_MEMBERSHIPS', options);
    },


    /**
     * The getSecurityQuestions() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV3.raml">API Authentication</a> call.
     * @name idm_getSecurityQuestions
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getSecurityQuestions()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getSecurityQuestions: function (options) {
      return doCall('SECURITY_QUESTIONS', options);
    },

    /**
     * The createSecurityQuestions() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV3.raml">API Authentication</a> call.
     * @name idm_createSecurityQuestions
     * @param {Object} options 
     * @param {String} options.id The id of the Person whose security questions are being created.
     * @param {Object} options.data The security question data.
     * @example
     * myCuiJs.createSecurityQuestions({
     *   id: 'your person id',
     *   data: 'your security question data'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createSecurityQuestions: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('PERSON_SECURITY_QUESTIONS', options);
    },

    /**
     * The updateSecurityQuestions() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV3.raml">API Authentication</a> call.
     * @name idm_updateSecurityQuestions
     * @param {Object} options 
     * @param {String} options.id The id of the Person whose security questions are being updated.
     * @param {Object} options.data The security question data.
     * @example
     * myCuiJs.updateSecurityQuestions({
     *   id: 'your person id',
     *   data: 'your security question data'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updateSecurityQuestions: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('PERSON_SECURITY_QUESTIONS', options);
    },

    /**
     * The getPasswordPolicies() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV4.raml">API Authentication</a> call.
     * @name idm_getPasswordPolicies
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPasswordPolicies()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPasswordPolicies: function (options) {
      return doCall('PASSWORD_POLICIES', options);
    },

    /**
     * The createPasswordPolicies() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV4.raml">API Authentication</a> call.
     * @name idm_createPasswordPolicies
     * @param {Object} options 
     * @param {Object} options.data The policy data.
     * @example
     * myCuiJs.createPasswordPolicies({
     *   data: 'your policy data'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createPasswordPolicies: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('PASSWORD_POLICIES', options);
    },

    /**
     * The getPasswordPolicy() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV4.raml">API Authentication</a> call.
     * @name idm_getPasswordPolicy
     * @param {String} options.policyId The id of the Policy being retrieved.
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getPasswordPolicy({
     *   policyId: 'your policy id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getPasswordPolicy: function (options) {
      return doCall('PASSWORD_POLICY', options);
    },

    /**
     * The deletePasswordPolicy() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV4.raml">API Authentication</a> call.
     * @name idm_deletePasswordPolicy
     * @param {Object} options 
     * @param {String} options.policyId The id of the Policy being deleted.
     * @example
     * myCuiJs.deletePasswordPolicy({
     *   policyId: 'your policy id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deletePasswordPolicy: function (options) {
      options.type = 'DELETE';
      return doCall('PASSWORD_POLICY', options);
    },


    /**
     * The authnNonce() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV3.raml">API Authentication</a> call.
     * @name idm_authnNonce
     * @param {Object} options 
     * @param {Object} options.data The Nonce data.
     * @example
     * myCuiJs.authnNonce({data: {'your Nonce data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    authnNonce: function (options) {
      if (! options) {
        options = {};
      }
      options.type = 'POST';
      return doCall('AUTHN_NONCE', options);
    },

    /**
     * The authnNonceValidate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV4.raml">API Authentication</a> call.
     * @name idm_authnNonceValidate
     * @param {Object} options 
     * @example
     * myCuiJs.authnNonceValidate()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    authnNonceValidate: function (options) {
      options.type = 'PUT';
      return doCall('AUTHN_NONCE_VALIDATE', options);
    },

    /**
     * The sessionNonceValidate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV4.raml">API Authentication</a> call.
     * @name idm_sessionNonceValidate
     * @param {Object} options 
     * @param {Object} options.data The Nonce data.
     * @example
     * myCuiJs.sessionNonceValidate({data: {'your Nonce data'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    sessionNonceValidate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('SESSION_NONCE_VALIDATE', options);
    },

    /**
     * The getSecurityQuestionAccount() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV3.raml">API Authentication</a> call.
     * @name idm_getSecurityQuestionAccount
     * @param {Object} options 
     * @param {String} options.personId The id of the Person whose security question account is being retrieved.
     * @example
     * myCuiJs.getSecurityQuestionAccount({personId: 'your person id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getSecurityQuestionAccount: function (options) {
      return doCall('PERSON_SECURITY_QUESTION_ACCOUNT', options);
    },

    /**
     * The createSecurityQuestionAccount() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV3.raml">API Authentication</a> call.
     * @name idm_createSecurityQuestionAccount
     * @param {Object} options 
     * @param {String} options.personId The id of the Person whose security questions are being created.
     * @param {Object} options.data The security question account data.
     * @example
     * myCuiJs.createSecurityQuestionAccount({
     *   personId: 'your person id', 
     *   data: 'your security question data'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createSecurityQuestionAccount: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('PERSON_SECURITY_QUESTION_ACCOUNT', options);
    },

    /**
     * The updateSecurityQuestionAccount() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV3.raml">API Authentication</a> call.
     * @name idm_updateSecurityQuestionAccount
     * @param {Object} options 
     * @param {String} options.personId The id of the Person whose security questions are being updated.
     * @param {Object} options.data The security question account data.
     * @example
     * myCuiJs.updateSecurityQuestionAccount({
     *   personId: 'your person id', 
     *   data: 'your security question data'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updateSecurityQuestionAccount: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('PERSON_SECURITY_QUESTION_ACCOUNT', options);
    },

    /**
     * The authenticatePassword() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV3.raml">API Authentication</a> call.
     * @name idm_authenticatePassword
     * @param {Object} options 
     * @param {Object} options.data The data of the person being authenticated.
     * @example
     * myCuiJs.authenticatePassword({data: 'your person data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    authenticatePassword: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('AUTHENTICATE_PASSWORD', options);
    },

    /**
     * The lockPassword() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV3.raml">API Authentication</a> call.
     * @name idm_lockPassword
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['subject'] The label for the subject property.
     * @param {String} options.qs[subject] The subject whose password is being locked.
     * @example
     * myCuiJs.lockPassword({qs: [['subject','your subject']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    lockPassword: function (options) {
      if (! options) {
        options = {};
      }
      options.type = 'POST';
      return doCall('LOCK_PASSWORD', options);
    },

    /**
     * The unlockPassword() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AuthenticationV3.raml">API Authentication</a> call.
     * @name idm_unlockPassword
     * @param {Object} options 
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['subject'] The label for the subject property.
     * @param {String} options.qs[subject] The subject whose password is being unlocked.
     * @example
     * myCuiJs.unlockPassword({qs: [['subject','your subject']]})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    unlockPassword: function (options) {
      if (! options) {
        options = {};
      }
      options.type = 'POST';
      return doCall('UNLOCK_PASSWORD', options);
    },



    // -------------------------
    // IoT
    // -------------------------

    /**
     * The getApplications() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApplicationV1.raml">API Application</a> call.
     * @name iot_getApplications
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getApplications()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getApplications: function (options) {
      return doCall('APPLICATIONS', options);
    },

    /**
     * The createApplication() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApplicationV1.raml">API Application</a> call.
     * @name iot_createApplication
     * @param {Object} options
     * @param {Object} options.data The data of the Application being created.
     * @param {Boolean} options.delayForIndex (default `true`) Delays returning the promise until the created resource is actually available via an index-dependent call. The delay will normally be less than 1 second and never more than 2 seconds.
     * @example
     * myCuiJs.createApplication({data: 'your application data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createApplication: function (options) {
      if (_.isUndefined(options.delayForIndex)) {
        options.delayForIndex = true;
      }
      options.data = JSON.stringify(options.data);
      options.type = 'POST';      
      return doCall('APPLICATIONS', options);
    },

    /**
     * The getApplication() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApplicationV1.raml">API Application</a> call.
     * @name iot_getApplication
     * @param {Object} options
     * @param {String} options.applicationId The id of the Application being retrieved.
     * @example
     * myCuiJs.getApplication({applicationId: 'your application Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getApplication: function (options) {
      return doCall('APPLICATION', options);
    },

    /**
     * The updateApplication() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApplicationV1.raml">API Application</a> call.
     * @name iot_updateApplication
     * @param {Object} options
     * @param {String} options.applicationId The id of the Application being updated.
     * @example
     * myCuiJs.updateApplication({applicationId: 'your application Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updateApplication: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('APPLICATION', options);
    },

    /**
     * The deleteApplication() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApplicationV1.raml">API Application</a> call.
     * @name iot_deleteApplication
     * @param {Object} options
     * @param {String} options.applicationId The id of the Application being deleted.
     * @example
     * myCuiJs.deleteApplication({applicationId: 'your application Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deleteApplication: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'DELETE';
      return doCall('APPLICATION', options);
    },

    /**
     * The countApplications() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApplicationV1.raml">API Application</a> call.
     * @name iot_countApplications
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.countApplications()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the integer value returned from the API call.
     */    
    countApplications: function (options) {
      if (! options) {
        options = {};
      }
      options.accepts = 'text/plain';
      return doCall('APPLICATION_COUNT', options);
    },

    /**
     * The countDevices() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Application</a> call.
     * @name iot_countDevices
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.countDevices()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the integer value returned from the API call.
     */    
    countDevices: function (options) {
      if (! options) {
        options = {};
      }
      options.accepts = 'text/plain';
      return doCall('DEVICES_COUNT', options);
    },

    /**
     * The getDevices() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_getDevices
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getDevices()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getDevices: function (options) {
       return doCall('DEVICES', options);
    },

    /**
     * The getDevicesAndChildren() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * This call fetches all Commands, Events, and Attributes for each returned device.
     * @name iot_getDevicesAndChildren
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getDevicesAndChildren()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getDevicesAndChildren: function (options) {
      return doCall('DEVICES_CHILDREN', options);
    },

    /**
     * The createDeviceTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_createDeviceTag
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device to which the tag is associated.
     * @param {String} options.tag The value of the tag being created.
     * @example
     * myCuiJs.createDeviceTag({deviceId: 'your device Id', tag: 'your tag value'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createDeviceTag: function (options) {
      options.type = 'PUT';
      return doCall('DEVICE_TAG', options);
    },
  
    /**
     * The deleteDeviceTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_deleteDeviceTag
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device to which the tag is associated.
     * @param {String} options.tag The value of the tag being deleted.
     * @example
     * myCuiJs.deleteDeviceTag({deviceId: 'your device Id', tag: 'your tag value'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deleteDeviceTag: function (options) {
      options.type = 'DELETE';
      return doCall('DEVICE_TAG', options);
    },

    /**
     * The createDeviceFromTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_createDeviceFromTemplate
     * @param {Object} options
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['deviceTemplateId'] The label for the deviceTemplateId property.
     * @param {String} options.qs[deviceTemplateId] The id of the template from which the device will be created.
     * @example
     * myCuiJs.createDeviceFromTemplate({
     *   qs: [['deviceTemplateId', 'your device template id']]
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createDeviceFromTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('CREATE_DEVICE', options);
    },

    /**
     * The getDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_getDevice
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device being retrieved.
     * @example
     * myCuiJs.getDevice({deviceId: 'your device Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getDevice: function (options) {
      return doCall('GET_DEVICE', options);
    },

    /**
     * The updateDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_updateDevice
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device being updated.
     * @example
     * myCuiJs.updateDevice({deviceId: 'your device Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updateDevice: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('UPDATE_DEVICE', options);
    },

    /**
     * The migrateDeviceToNewTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_migrateDeviceToNewTemplate
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device being migrated.
     * @param {String} options.deviceTemplateId The id of the template to which the device will be associated.
     * @example
     * myCuiJs.migrateDeviceToNewTemplate({
     *   deviceId: 'your device id',
     *   deviceTemplateId:, 'your device template id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    migrateDeviceToNewTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('MIGRATE_DEVICE', options);
    },

    /**
     * The activateDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_activateDevice
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device being activated.
     * @example
     * myCuiJs.activateDevice({deviceId: 'your device Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    activateDevice: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ACTIVATE_DEVICE', options);
    },

    /**
     * The deactivateDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_deactivateDevice
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device being deactivated.
     * @example
     * myCuiJs.deactivateDevice({deviceId: 'your device Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deactivateDevice: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('DEACTIVATE_DEVICE', options);
    },

    /**
     * The registerDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_registerDevice
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device being registered.
     * @example
     * myCuiJs.registerDevice({deviceId: 'your device Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    registerDevice: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';

      // NB this endpoint breaks established model...so must be overriden here...
      options.contentType = 'application/vnd.com.covisint.platform.device.v2+json';
      options.accepts = 'application/json';

      return doCall('REGISTER_DEVICE', options);
    },

    /**
     * The deleteDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_deleteDevice
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device being deleted.
     * @example
     * myCuiJs.deleteDevice({deviceId: 'your device Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deleteDevice: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('DELETE_DEVICE', options);
    },

    /**
     * The resetDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_resetDevice
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device being reset.
     * @example
     * myCuiJs.resetDevice({deviceId: 'your device Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    resetDevice: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('RESET_DEVICE', options);
    },

    /**
     * The suspendDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_suspendDevice
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device being suspended.
     * @param {String} options.reason The reason for the action.
     * @example
     * myCuiJs.suspendDevice({
     *   deviceId: 'your device id',
     *   reason:, 'your reason for the action'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    suspendDevice: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('SUSPEND_DEVICE', options);
    },

    /**
     * The unsuspendDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_unsuspendDevice
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device being unsuspended.
     * @param {String} options.reason The reason for the action.
     * @example
     * myCuiJs.unsuspendDevice({
     *   deviceId: 'your device id',
     *   reason:, 'your reason for the action'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    unsuspendDevice: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('UNSUSPEND_DEVICE', options);
    },

    /**
     * The unlockDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceV3.raml">API Device</a> call.
     * @name iot_unlockDevice
     * @param {Object} options
     * @param {String} options.deviceId The id of the Device being unlocked.
     * @param {String} options.reason The reason for the action.
     * @example
     * myCuiJs.unlockDevice({
     *   deviceId: 'your device id',
     *   reason:, 'your reason for the action'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    unlockDevice: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('UNLOCK_DEVICE', options);
    },

    /**
     * The getDeviceTemplates() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceTemplateV1.raml">API deviceTemplates</a> call.
     * @name iot_getDeviceTemplates
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getDeviceTemplates()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getDeviceTemplates: function (options) {
      return doCall('DEVICE_TEMPLS', options);
    },

    /**
     * The countDeviceTemplates() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceTemplateV1.raml">API Application</a> call.
     * @name iot_countDeviceTemplates
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.countDeviceTemplates()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the integer value returned from the API call.
     */    
    countDeviceTemplates: function (options) {
      if (! options) {
        options = {};
      }
      options.accepts = 'text/plain';
      return doCall('DEVICE_TEMPLS_COUNT', options);
    },

    /**
     * The createDeviceTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceTemplateV1.raml">API deviceTemplates</a> call.
     * @name iot_createDeviceTemplate
     * @param {Object} options
     * @param {Object} options.data The data of the Device Template being created.
     * @param {Boolean} options.delayForIndex (default `true`) Delays returning the promise until the created resource is actually available via an index-dependent call. The delay will normally be less than 1 second and never more than 2 seconds.
     * @example
     * myCuiJs.createDeviceTemplate({data: 'your device template data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createDeviceTemplate: function (options) {
      if (_.isUndefined(options.delayForIndex)) {
        options.delayForIndex = true;
      }
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('CREATE_DEVICE_TEMPL', options);
    },

    /**
     * The createDeviceTemplateTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceTemplateV1.raml">API deviceTemplates</a> call.
     * @name iot_createDeviceTemplateTag
     * @param {Object} options
     * @param {String} options.deviceTemplateId The id of the Device Template being retrieved.
     * @param {String} options.tag The value of the tag being creatyed.
     * @example
     * myCuiJs.createDeviceTemplateTag({deviceTemplateId: 'your device template Id', tag: 'your tag value'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createDeviceTemplateTag: function (options) {
      options.type = 'PUT';
      return doCall('DEVICE_TEMPL_TAG', options);
    },

    /**
     * The deleteDeviceTemplateTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceTemplateV1.raml">API deviceTemplates</a> call.
     * @name iot_deleteDeviceTemplateTag
     * @param {Object} options
     * @param {String} options.deviceTemplateId The id of the Device Template being retrieved.
     * @param {String} options.tag The value of the tag being deleted.
     * @example
     * myCuiJs.deleteDeviceTemplateTag({deviceTemplateId: 'your device template Id', tag: 'your tag value'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deleteDeviceTemplateTag: function (options) {
      options.type = 'DELETE';
      return doCall('DEVICE_TEMPL_TAG', options);
    },

    /**
     * The getDeviceTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceTemplateV1.raml">API deviceTemplates</a> call.
     * @name iot_getDeviceTemplate
     * @param {Object} options
     * @param {String} options.deviceTemplateId The id of the Device Template being retrieved.
     * @example
     * myCuiJs.getDeviceTemplate({deviceTemplateId: 'your device template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getDeviceTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      return doCall('DEVICE_TEMPL', options);
    },

    /**
     * The activateDeviceTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceTemplateV1.raml">API deviceTemplates</a> call.
     * @name iot_activateDeviceTemplate
     * @param {Object} options
     * @param {String} options.deviceTemplateId The id of the Device Template being activated.
     * @example
     * myCuiJs.activateDeviceTemplate({deviceTemplateId: 'your device template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    activateDeviceTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ACTIVATE_DEVICE_TEMPL', options);
    },

    /**
     * The deactivateDeviceTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceTemplateV1.raml">API deviceTemplates</a> call.
     * @name iot_deactivateDeviceTemplate
     * @param {Object} options
     * @param {String} options.deviceTemplateId The id of the Device Template being deactivated.
     * @example
     * myCuiJs.deactivateDeviceTemplate({deviceTemplateId: 'your device template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deactivateDeviceTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('DEACTIVATE_DEVICE_TEMPL', options);
    },

    /**
     * The getEventSources() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventSourceV1.raml">API eventSource</a> call.
     * @name iot_getEventSources
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getEventSources()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getEventSources: function (options) {
      return doCall('EVENT_SRCS', options);
    },

    /**
     * The countEventSources() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventSourceV1.raml">API Application</a> call.
     * @name iot_countEventSources
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.countEventSources()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the integer value returned from the API call.
     */    
    countEventSources: function (options) {
      if (! options) {
        options = {};
      }
      options.accepts = 'text/plain';
      return doCall('EVENT_SRCS_COUNT', options);
    },

    /**
     * The createEventSource() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventSourceV1.raml">API eventSource</a> call.
     * @name iot_createEventSource
     * @param {Object} options
     * @param {Object} options.data The data of the Event Source being created.
     * @param {Boolean} options.delayForIndex (default `true`) Delays returning the promise until the created resource is actually available via an index-dependent call. The delay will normally be less than 1 second and never more than 2 seconds.
     * @example
     * myCuiJs.createEventSource({data: 'your event source data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createEventSource: function (options) {
      if (_.isUndefined(options.delayForIndex)) {
        options.delayForIndex = true;
      }
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('EVENT_SRCS', options);
    },

    /**
     * The createEventSourceTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventSourceV1.raml">API eventSource</a> call.
     * @name iot_createEventSourceTag
     * @param {Object} options
     * @param {String} options.eventSourceId The id of the Event Source to which the tag is associated.
     * @param {String} options.tag The value of the tag being created.
     * @example
     * myCuiJs.createEventSourceTag({eventSourceId: 'your event source Id', tag: 'your tag value'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createEventSourceTag: function (options) {
      options.type = 'PUT';
      return doCall('EVENT_SRC_TAG', options);
    },

    /**
     * The deleteEventSourceTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventSourceV1.raml">API eventSource</a> call.
     * @name iot_deleteEventSourceTag
     * @param {Object} options
     * @param {String} options.eventSourceId The id of the Event Source to which the tag is associated.
     * @param {String} options.tag The value of the tag being deleted.
     * @example
     * myCuiJs.deleteEventSourceTag({eventSourceId: 'your event source Id', tag: 'your tag value'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deleteEventSourceTag: function (options) {
      options.type = 'DELETE';
      return doCall('EVENT_SRC_TAG', options);
    },

    /**
     * The getEventSource() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventSourceV1.raml">API eventSource</a> call.
     * @name iot_getEventSource
     * @param {Object} options
     * @param {String} options.eventSourceId The id of the Event Source being retrieved.
     * @example
     * myCuiJs.getEventSource({eventSourceId: 'your event source Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getEventSource: function (options) {
      return doCall('EVENT_SRC', options);
    },

    /**
     * The updateEventSource() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventSourceV1.raml">API eventSource</a> call.
     * @name iot_updateEventSource
     * @param {Object} options
     * @param {String} options.eventSourceId The id of the Event Source being updated.
     * @example
     * myCuiJs.updateEventSource({eventSourceId: 'your event source Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    updateEventSource: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('EVENT_SRC', options);
    },

    /**
     * The deleteEventSource() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventSourceV1.raml">API eventSource</a> call.
     * @name iot_deleteEventSource
     * @param {Object} options
     * @param {String} options.eventSourceId The id of the Event Source being deleted.
     * @example
     * myCuiJs.deleteEventSource({eventSourceId: 'your event source Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deleteEventSource: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'DELETE';
      return doCall('EVENT_SRC', options);
    },

    /**
     * The getEventTemplates() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventTemplateV1.raml">API eventTemplates</a> call.
     * @name iot_getEventTemplates
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getEventTemplates()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getEventTemplates: function (options) {
      return doCall('EVENT_TEMPLS', options);
    },

    /**
     * The countEventTemplates() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/DeviceTemplateV1.raml">API Application</a> call.
     * @name iot_countEventTemplates
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.countEventTemplates()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the integer value returned from the API call.
     */    
    countEventTemplates: function (options) {
      if (! options) {
        options = {};
      }
      options.accepts = 'text/plain';
      return doCall('EVENT_TEMPLS_COUNT', options);
    },

    /**
     * The createEventTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventTemplateV1.raml">API eventTemplates</a> call.
     * @name iot_createEventTemplate
     * @param {Object} options
     * @param {Object} options.data The data of the Event Template being created.
     * @param {Boolean} options.delayForIndex (default `true`) Delays returning the promise until the created resource is actually available via an index-dependent call. The delay will normally be less than 1 second and never more than 2 seconds.
     * @example
     * myCuiJs.createEventTemplate({data: 'your event template data'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createEventTemplate: function (options) {
      if (_.isUndefined(options.delayForIndex)) {
        options.delayForIndex = true;
      }
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('EVENT_TEMPLS', options);
    },

    /**
     * The createEventTemplateTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventTemplateV1.raml">API eventTemplates</a> call.
     * @name iot_createEventTemplateTag
     * @param {Object} options
     * @param {String} options.eventTemplateId The id of the Event Template to which the tag is associated.
     * @param {String} options.tag The value of the tag being created.
     * @example
     * myCuiJs.createEventTemplateTag({tag: 'your tag value', eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    createEventTemplateTag: function (options) {
      options.type = 'PUT';
      return doCall('EVENT_TEMPL_TAG', options);
    },

    /**
     * The deleteEventTemplateTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventTemplateV1.raml">API eventTemplates</a> call.
     * @name iot_deleteEventTemplateTag
     * @param {Object} options
     * @param {String} options.eventTemplateId The id of the Event Template to which the tag is associated.
     * @param {String} options.tag The value of the tag being deleted.
     * @example
     * myCuiJs.deleteEventTemplateTag({tag: 'your tag value', eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deleteEventTemplateTag: function (options) {
      options.type = 'DELETE';
      return doCall('EVENT_TEMPL_TAG', options);
    },

    /**
     * The getEventTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventTemplateV1.raml">API eventTemplates</a> call.
     * @name iot_getEventTemplate
     * @param {Object} options
     * @param {String} options.eventTemplateId The id of the Event Template being retrieved.
     * @example
     * myCuiJs.getEventTemplate({eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    getEventTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      return doCall('EVENT_TEMPL', options);
    },

    /**
     * The activateEventTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventTemplateV1.raml">API eventTemplates</a> call.
     * @name iot_activateEventTemplate
     * @param {Object} options
     * @param {String} options.eventTemplateId The id of the Event Template being activated.
     * @example
     * myCuiJs.activateEventTemplate({eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    activateEventTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ACTIVATE_EVENT_TEMPL', options);
    },

    /**
     * The deactivateEventTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventTemplateV1.raml">API eventTemplates</a> call.
     * @name iot_deactivateEventTemplate
     * @param {Object} options
     * @param {String} options.eventTemplateId The id of the Event Template being deactivated.
     * @example
     * myCuiJs.deactivateEventTemplate({eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    deactivateEventTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('DEACTIVATE_EVENT_TEMPL', options);
    },

    /**
     * The bindEventTemplateField() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventTemplateV1.raml">API eventTemplates</a> call.
     * @name iot_bindEventTemplateField
     * @param {Object} options
     * @param {String} options.eventTemplateId The id of the Event Template to which the field is associated.
     * @example
     * myCuiJs.bindEventTemplateField({eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    bindEventTemplateField: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('BIND_EVENT_TEMPL', options);
    },

    /**
     * The unbindEventTemplateField() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventTemplateV1.raml">API eventTemplates</a> call.
     * @name iot_unbindEventTemplateField
     * @param {Object} options
     * @param {String} options.eventTemplateId The id of the Event Template to which the field is associated.
     * @example
     * myCuiJs.unbindEventTemplateField({eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */    
    unbindEventTemplateField: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('UNBIND_EVENT_TEMPL', options);
    },

    /**
     * The getEventThresholds() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventThresholdPolicyV1.raml">API eventTemplates thresholdPolicies</a> call.
     * @name iot_getEventThresholds
     * @param {Object} options
     * @param {String} options.eventTemplateId The id of the Event Template to which the policy is associated.
     * @example
     * myCuiJs.getEventThresholds({eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getEventThresholds: function (options) {
      options.data = JSON.stringify(options.data);
      return doCall('EVENT_TEMPL_THRESH', options);
    },

    /**
     * The createEventThreshold() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventThresholdPolicyV1.raml">API eventTemplates thresholdPolicies</a> call.
     * @name iot_createEventThreshold
     * @param {Object} options
     * @param {Object} options.data The data of the Threshold Policy being created.
     * @param {String} options.eventTemplateId The id of the Event Template to which the policy is associated.
     * @param {Boolean} options.delayForIndex (default `true`) Delays returning the promise until the created resource is actually available via an index-dependent call. The delay will normally be less than 1 second and never more than 2 seconds.
     * @example
     * myCuiJs.createEventThreshold({data: 'your threshold policy data', eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createEventThreshold: function (options) {
      if (_.isUndefined(options.delayForIndex)) {
        options.delayForIndex = true;
      }
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('EVENT_TEMPL_THRESH', options);
    },

    /**
     * The getEventThreshold() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventThresholdPolicyV1.raml">API eventTemplates thresholdPolicies</a> call.
     * @name iot_getEventThreshold
     * @param {Object} options
     * @param {String} options.thresholdPolicyId The id of the Threshold Policy being retrieved.
     * @param {String} options.eventTemplateId The id of the Event Template to which the policy is associated.
     * @example
     * myCuiJs.getEventThreshold({thresholdPolicyId: 'your threshold policy id', eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getEventThreshold: function (options) {
      options.data = JSON.stringify(options.data);
      return doCall('EVENT_TEMPL_THRESH_POLICY', options);
    },

    /**
     * The updateEventThreshold() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventThresholdPolicyV1.raml">API eventTemplates thresholdPolicies</a> call.
     * @name iot_updateEventThreshold
     * @param {Object} options
     * @param {String} options.thresholdPolicyId The id of the Threshold Policy being updated.
     * @param {String} options.eventTemplateId The id of the Event Template to which the policy is associated.
     * @example
     * myCuiJs.updateEventThreshold({thresholdPolicyId: 'your threshold policy id', eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    updateEventThreshold: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('EVENT_TEMPL_THRESH_POLICY', options);
    },

    /**
     * The deleteEventThreshold() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventThresholdPolicyV1.raml">API eventTemplates thresholdPolicies</a> call.
     * @name iot_deleteEventThreshold
     * @param {Object} options
     * @param {String} options.thresholdPolicyId The id of the Threshold Policy being deleted.
     * @param {String} options.eventTemplateId The id of the Event Template to which the policy is associated.
     * @example
     * myCuiJs.deleteEventThreshold({thresholdPolicyId: 'your threshold policy id', eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deleteEventThreshold: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'DELETE';
      return doCall('EVENT_TEMPL_THRESH_POLICY', options);
    },

    /**
     * The validateEventThresholdPolicy() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventThresholdPolicyV1.raml">API eventTemplates thresholdPolicies</a> call.
     * @name iot_validateEventThresholdPolicy
     * @param {Object} options
     * @param {String} options.thresholdPolicyId The id of the Threshold Policy being validated.
     * @param {String} options.eventTemplateId The id of the Event Template to which the policy is associated.
     * @example
     * myCuiJs.validateEventThresholdPolicy({thresholdPolicyId: 'your threshold policy id', eventTemplateId: 'your event template Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    validateEventThresholdPolicy: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('EVENT_TEMPL_THRESH_POLICY_VALIDATE', options);
    },

    /**
     * The getAttributeTypes() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeTypeV1.raml">API attributeTypes</a> call.
     * @name iot_getAttributeTypes
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getAttributeTypes()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getAttributeTypes: function (options) {
      return doCall('ATTR_TYPES', options);
    },

    /**
     * The countAttributeTypes() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeTypeV1.raml">API Application</a> call.
     * @name iot_countAttributeTypes
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.countAttributeTypes()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the integer value returned from the API call.
     */    
    countAttributeTypes: function (options) {
      if (! options) {
        options = {};
      }
      options.accepts = 'text/plain';
      return doCall('ATTR_TYPES_COUNT', options);
    },

    /**
     * The createAttributeType() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeTypeV1.raml">API attributeTypes</a> call.
     * @name iot_createAttributeType
     * @param {Object} options 
     * @param {Object} options.data The data of the Attribute Type being created.
     * @param {Boolean} options.delayForIndex (default `true`) Delays returning the promise until the created resource is actually available via an index-dependent call. The delay will normally be less than 1 second and never more than 2 seconds.
     * @example
     * myCuiJs.createAttributeType({
     *   data: 'your attribute type data'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createAttributeType: function (options) {
      if (_.isUndefined(options.delayForIndex)) {
        options.delayForIndex = true;
      }
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ATTR_TYPES', options);
    },

    /**
     * The createAttributeTypeTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeTypeV1.raml">API attributeTypes</a> call.
     * @name iot_createAttributeTypeTag
     * @param {Object} options 
     * @param {String} options.attributeTypeId The id of the Attribute Type to which the tag is associated.
     * @param {String} options.tag The value of the Tag being deleted.
     * @example
     * myCuiJs.createAttributeTypeTag({
     *   attributeTypeId: 'your attribute type id',
     *   tag: 'your tag value'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createAttributeTypeTag: function (options) {
      options.type = 'PUT';
      return doCall('ATTR_TYPE_TAG', options);
    },

    /**
     * The deleteAttributeTypeTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeTypeV1.raml">API attributeTypes</a> call.
     * @name iot_deleteAttributeTypeTag
     * @param {Object} options 
     * @param {String} options.attributeTypeId The id of the Attribute Type to which the tag is associated.
     * @param {String} options.tag The value of the Tag being deleted.
     * @example
     * myCuiJs.deleteAttributeTypeTag({
     *   attributeTypeId: 'your attribute type id',
     *   tag: 'your tag value'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deleteAttributeTypeTag: function (options) {
      options.type = 'DELETE';
      return doCall('ATTR_TYPE_TAG', options);
    },

    /**
     * The getAttributeType() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeTypeV1.raml">API attributeTypes</a> call.
     * @name iot_getAttributeType
     * @param {Object} options 
     * @param {String} options.attributeTypeId The id of the Attribute Type being retrieved.
     * @example
     * myCuiJs.getAttributeType({
     *   attributeTypeId: 'your attribute type id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getAttributeType: function (options) {
      options.data = JSON.stringify(options.data);
      return doCall('ATTR_TYPE', options);
    },

    /**
     * The activateAttributeType() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeTypeV1.raml">API attributeTypes</a> call.
     * @name iot_activateAttributeType
     * @param {Object} options 
     * @param {String} options.attributeTypeId The id of the Attribute Type being activated.
     * @example
     * myCuiJs.activateAttributeType({
     *   attributeTypeId: 'your attribute type id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    activateAttributeType: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ACTIVATE_ATTR_TYPE', options);
    },

    /**
     * The deactivateAttributeType() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeTypeV1.raml">API attributeTypes</a> call.
     * @name iot_deactivateAttributeType
     * @param {Object} options 
     * @param {String} options.attributeTypeId The id of the Attribute Type being deactivated.
     * @example
     * myCuiJs.deactivateAttributeType({
     *   attributeTypeId: 'your attribute type id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deactivateAttributeType: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('DEACTIVATE_ATTR_TYPE', options);
    },

    /**
     * The getCommandTemplates() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/CommandTemplateV1.raml">API commandTemplates</a> call.
     * @name iot_getCommandTemplates
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getCommandTemplates()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getCommandTemplates: function (options) {
      return doCall('COMMAND_TEMPLS', options);
    },

    /**
     * The countCommandTemplates() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/AttributeTypeV1.raml">API Application</a> call.
     * @name iot_countCommandTemplates
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.countCommandTemplates()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the integer value returned from the API call.
     */    
    countCommandTemplates: function (options) {
      if (! options) {
        options = {};
      }
      options.accepts = 'text/plain';
      return doCall('COMMAND_TEMPLS_COUNT', options);
    },

    /**
     * The createCommandTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/CommandTemplateV1.raml">API commandTemplates</a> call.
     * @name iot_createCommandTemplate
     * @param {Object} options 
     * @param {Object} options.data The command template's data object.
     * @param {Boolean} options.delayForIndex (default `true`) Delays returning the promise until the created resource is actually available via an index-dependent call. The delay will normally be less than 1 second and never more than 2 seconds.
     * @example
     * myCuiJs.createCommandTemplate({
     *   data: { 'your command template data'},
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createCommandTemplate: function (options) {
      if (_.isUndefined(options.delayForIndex)) {
        options.delayForIndex = true;
      }
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('COMMAND_TEMPLS', options);
    },

    /**
     * The createCommandTemplateTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/CommandTemplateV1.raml">API commandTemplates</a> call.
     * @name iot_createCommandTemplateTag
     * @param {Object} options 
     * @param {String} options.commandTemplateId The id of the Command Template to which the tag will be associated.
     * @param {String} options.tag The value of the Tag being created.
     * @example
     * myCuiJs.createCommandTemplateTag({
     *   commandTemplateId: 'your command template id',
     *   tag: 'your tag value'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createCommandTemplateTag: function (options) {
      options.type = 'PUT';
      return doCall('COMMAND_TEMPL_TAG', options);
    },

    /**
     * The deleteCommandTemplateTag() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/CommandTemplateV1.raml">API commandTemplates</a> call.
     * @name iot_deleteCommandTemplateTag
     * @param {Object} options 
     * @param {String} options.commandTemplateId The id of the Command Template to which the tag is associated.
     * @param {String} options.tag The value of the Tag being deleted.
     * @example
     * myCuiJs.deleteCommandTemplateTag({
     *   commandTemplateId: 'your command template id',
     *   tag: 'your tag value'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deleteCommandTemplateTag: function (options) {
      options.type = 'DELETE';
      return doCall('COMMAND_TEMPL_TAG', options);
    },

    /**
     * The getCommandTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/CommandTemplateV1.raml">API commandTemplates</a> call.
     * @name iot_getCommandTemplate
     * @param {Object} options 
     * @param {String} options.commandTemplateId The id of the Command Template being retrieved.
     * @example
     * myCuiJs.getCommandTemplate({
     *   commandTemplateId: 'your command template id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getCommandTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      return doCall('COMMAND_TEMPL', options);
    },

    /**
     * The activateCommandTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/CommandTemplateV1.raml">API commandTemplates</a> call.
     * @name iot_activateCommandTemplate
     * @param {Object} options 
     * @param {String} options.commandTemplateId The id of the Command Template being activated.
     * @example
     * myCuiJs.activateCommandTemplate({
     *   commandTemplateId: 'your command template id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    activateCommandTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ACTIVATE_COMMAND_TEMPL', options);
    },

    /**
     * The deactivateCommandTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/CommandTemplateV1.raml">API commandTemplates</a> call.
     * @name iot_deactivateCommandTemplate
     * @param {Object} options 
     * @param {String} options.commandTemplateId The id of the Command Template being deactivated.
     * @example
     * myCuiJs.deactivateCommandTemplate({
     *   commandTemplateId: 'your command template id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deactivateCommandTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('DEACTIVATE_COMMAND_TEMPL', options);
    },

    /**
     * The getStream() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/streamv1.raml">API streams</a> call.
     * @name iot_getStream
     * @param {Object} options 
     * @param {String} options.streamId The id of the Stream being retrieved.
     * @example
     * myCuiJs.getStream({streamId: 'your stream id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getStream: function (options) {
      return doCall('STREAM', options);
    },

    /**
     * The getStreams() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/streamv1.raml">API streams</a> call.
     * @name iot_getStreams
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getStreams()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getStreams: function (options) {
      return doCall('STREAMS', options);
    },

    /**
     * The countStreams() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/StreamV1.raml">API Application</a> call.
     * @name iot_countStreams
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.countStreams()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the integer value returned from the API call.
     */    
    countStreams: function (options) {
      if (! options) {
        options = {};
      }
      options.accepts = 'text/plain';
      return doCall('STREAMS_COUNT', options);
    },

    /**
     * The createStream() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/streamv1.raml">API streams</a> call.
     * @name iot_createStream
     * @param {Object} options
     * @param {Object} options.data The stream's data object.
     * @param {Boolean} options.delayForIndex (default `true`) Delays returning the promise until the created resource is actually available via an index-dependent call. The delay will normally be less than 1 second and never more than 2 seconds.
     * @example
     * myCuiJs.createStream({data: {'your stream data object'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createStream: function (options) {
      if (_.isUndefined(options.delayForIndex)) {
        options.delayForIndex = true;
      }
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('STREAMS', options);
    },

    /**
     * The deleteStream() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/streamv1.raml">API streams</a> call.
     * @name iot_deleteStream
     * @param {Object} options 
     * @param {String} options.streamId The id of the Stream being deleted.
     * @example
     * myCuiJs.deleteStream({streamId: 'your stream id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deleteStream: function (options) {
      options.type = 'DELETE';
      return doCall('STREAM', options);
    },

    /**
     * The activateStream() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/streamv1.raml">API streams</a> call.
     * @name iot_activateStream
     * @param {Object} options 
     * @param {String} options.streamId The id of the Stream being activated.
     * @param {Object<Array>} qs The query String object, which contains an array for each query string key-value pair.
     * @param {String} options.qs['streamId'] The label for the streamId property.
     * @param {String} options.qs[streamId] The id of the Stream being activated.
     * @example
     * myCuiJs.activateStream({
     *   qs: [['streamId','your stream id']], 
     *   streamId: 'your stream id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    activateStream: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ACTIVATE_STREAM', options);
    },

    /**
     * The deactivateStream() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/streamv1.raml">API streams</a> call.
     * @name iot_deactivateStream
     * @param {Object} options 
     * @param {String} options.streamId The id of the Stream being deactivated.
     * @param {Object<Array>} options.qs The Query String array, which contains an array for each query string key-value pair.
     * @param {String} options.qs['streamId'] The label for the streamId property.
     * @param {String} options.qs[streamId] The id of the Stream being deactivated.
     * @example
     * myCuiJs.deactivateStream({
     *   qs: [['streamId','your stream id']], 
     *   streamId: 'your stream id'
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deactivateStream: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('DEACTIVATE_STREAM', options);
    },

    /**
     * The getStreamDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/streamv1.raml">API streams</a> call.
     * @name iot_getStreamDevice
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @param {String} options.id The id of the Device being retrieved.
     * @param {String} options.streamId The id of the Stream being queried.
     * @example
     * myCuiJs.getStreamDevice({id: 'your device id', streamId: 'your stream Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getStreamDevice: function (options) {
      return doCall('STREAM_DEVICE', options);
    },

    /**
     * The getStreamDevices() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/streamv1.raml">API streams</a> call.
     * @name iot_getStreamDevices
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @param {String} options.streamId The id of the Stream being queried.
     * @example
     * myCuiJs.getStreamDevices({streamId: 'your stream Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getStreamDevices: function (options) {
      return doCall('STREAM_DEVICES', options);
    },

    /**
     * The createStreamDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/streamv1.raml">API streams</a> call.
     * @name iot_createStreamDevice
     * @param {Object} options 
     * @param {String} options.id The data of the Device being created.
     * @param {String} options.streamId The id of the Stream to which the device is associated.
     * @example
     * myCuiJs.createStreamDevice({data: {'your device data'}, streamId: 'your stream Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createStreamDevice: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('STREAM_DEVICE', options);
    },

    /**
     * The deleteStreamDevice() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/streamv1.raml">API streams</a> call.
     * @name iot_deleteStreamDevice
     * @param {Object} options
     * @param {String} options.id The id of the Device being deleted.
     * @param {String} options.streamId The id of the Stream to which the device is associated.
     * @example
     * myCuiJs.deleteStreamDevice({id: 'your device id', streamId: 'your stream Id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deleteStreamDevice: function (options) {
      options.type = 'DELETE';
      return doCall('STREAM_DEVICE', options);
    },

    /**
     * The getRoute() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RouteV1.raml">API routes</a> call.
     * @name iot_getRoute
     * @param {Object} options
     * @param {String} options.routeId The route Id to retrieve.
     * @example
     * myCuiJs.getRoute({routeId: 'your route id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getRoute: function (options) {
      return doCall('ROUTE', options);
    },

    /**
     * The getRoutes() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RouteV1.raml">API routes</a> call.
     * @name iot_getRoutes
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getRoutes()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getRoutes: function (options) {
      return doCall('ROUTES', options);
    },

    /**
     * The countRoutes() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/StreamV1.raml">API Application</a> call.
     * @name iot_countRoutes
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.countRoutes()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the integer value returned from the API call.
     */    
    countRoutes: function (options) {
      if (! options) {
        options = {};
      }
      options.accepts = 'text/plain';
      return doCall('ROUTES_COUNT', options);
    },

    /**
     * The createRoute() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RouteV1.raml">API routes</a> call.
     * @name iot_createRoute
     * @param {Object} options
     * @param {Object} options.data The Route's data
     * @param {Boolean} options.delayForIndex (default `true`) Delays returning the promise until the created resource is actually available via an index-dependent call. The delay will normally be less than 1 second and never more than 2 seconds.
     * @example
     * myCuiJs.createRoute({data: {'your route data object'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createRoute: function (options) {
      if (_.isUndefined(options.delayForIndex)) {
        options.delayForIndex = true;
      }
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ROUTES', options);
    },

    /**
     * The updateRoute() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RouteV1.raml">API routes</a> call.
     * @name iot_updateRoute
     * @param {Object} options
     * @param {String} options.routeId The route Id to update.
     * @param {Object} options.data The Route's data
     * @example
     * myCuiJs.updateRoute({routeId: 'your route id', data: {'your route data object'}})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    updateRoute: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('ROUTE', options);
    },


    /**
     * The deleteRoute() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RouteV1.raml">API routes</a> call.
     * @name iot_deleteRoute
     * @param {Object} options
     * @param {String} options.routeId The route Id to delete.
     * @example
     * myCuiJs.deleteRoute({routeId: 'your route id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deleteRoute: function (options) {
      options.type = 'DELETE';
      return doCall('ROUTE', options);
    },

    /**
     * The sendCommand() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/sendCommandV1.raml">API message/command</a> call.
     * @name iot_sendCommand
     * @param {Object} options
     * @param {String} options.streamId The streamId on which the event will be broadcast.
     * @param {String} options.data[messageId] The message Id associated with the command.
     * @param {String} options.data[deviceId] The device Id associated with the command.
     * @param {String} options.data[commandId] The command Id associated with the command.
     * @param {String} options.data[encodingType] 'base64'
     * @param {String} options.data[message] The base64-encoded message.
     * @example
     * myCuiJs.sendCommand({
     *   streamId: 'your stream id', 
     *   data: {
     *     messageId: 'your message id',
     *     deviceId: 'your device id',
     *     commandId: 'your command template id',
     *     encodingType: 'base64',
     *     message: 'your base64-encoded message'
     *   }
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    sendCommand: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('SEND_COMMAND', options);
    },

    /**
     * The sendEvent() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/sendEventV1.raml">API message/event</a> call.
     * @name iot_sendEvent
     * @param {Object} options
     * @param {String} options.streamId The streamId on which the event will be broadcast.
     * @param {String} options.data[messageId] The message Id associated with the event.
     * @param {String} options.data[deviceId] The device Id associated with the event.
     * @param {String} options.data[eventTemplateId] The event template Id associated with the event.
     * @param {String} options.data[encodingType] 'base64'
     * @param {String} options.data[message] The base64-encoded message.
     * @example
     * myCuiJs.sendEvent({
     *   streamId: 'your stream id', 
     *   data: {
     *     messageId: 'your message id',
     *     deviceId: 'your device id',
     *     eventTemplateId: 'your event template id',
     *     encodingType: 'base64',
     *     message: 'your base64-encoded message'
     *   }
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    sendEvent: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('SEND_EVENT', options);
    },

    /**
     * The searchEvents() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventSearchV1.raml">API Event Search</a> call.
     * @name iot_searchEvents
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @param {String} options.startTime The start time, in milliseconds since the epoch, for which to retrieve events.
     * @param {String} options.endTime The value 'now' or an end time, in milliseconds since the epoch, for which to retrieve events.
     * @example
     * myCuiJs.searchEvents({
     *   startTime: 'your start time', 
     *   endTime: 'your end time', 
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    searchEvents: function (options) {
      // NB this endpoint breaks established model...so must be overriden here...
      options.contentType = 'application/x-www-form-urlencoded';
      options.accepts = 'application/json';
      return doCall('SEARCH_EVENTS', options);
    },

    /**
     * The countEvents() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/EventSearchV1.raml">API Event Search</a> call.
     * @name iot_countEbvents
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @param {String} options.startTime The start time, in milliseconds since the epoch, for which to retrieve event counts.
     * @param {String} options.endTime The value 'now' or an end time, in milliseconds since the epoch, for which to retrieve event counts.
     * @example
     * myCuiJs.countEvents({
     *   startTime: 'your start time', 
     *   endTime: 'your end time', 
     * })
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    countEvents: function (options) {
      // NB this endpoint breaks established model...so must be overriden here...
      options.contentType = 'application/x-www-form-urlencoded';
      options.accepts = 'application/json';
      return doCall('COUNT_EVENTS', options);
    },

    /**
     * The getTracking() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/TrackingV1.raml">API tracking</a> call.
     * @name iot_getTracking
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getTracking()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getTracking: function (options) {
      return doCall('SEARCH_TRACKING', options);
    },

    /**
     * The getTrackingSubprocess() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/TrackingV1.raml">API tracking</a> call.
     * @name iot_getTrackingSubprocess
     * @param {Object} options
     * @param {String} options.messageId The messageId obtained from an earlier call to getTracking()
     * @example
     * myCuiJs.getTrackingSubprocess({messageId: 'your message id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getTrackingSubprocess: function (options) {
      return doCall('TRACKING_SUBPROCESS', options);
    },

    /**
     * The getProcessorAudits() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/TrackingV1.raml">API tracking</a> call.
     * @name iot_getProcessorAudits
     * @param {Object} options
     * @param {String} options.messageId The messageId obtained from an earlier call to getTracking()
     * @example
     * myCuiJs.getProcessorAudits({messageId: 'your message id'})
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getProcessorAudits: function (options) {
      return doCall('PROCESSOR_AUDITS', options);
    },

    /**
     * The getActionDefinitionTemplates() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_getActionDefinitionTemplates
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getActionDefinitionTemplates()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getActionDefinitionTemplates: function (options) {
      return doCall('ACTION_DEFINITION_TEMPLATES', options);
    },

    /**
     * The createActionDefinitionTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_createActionDefinitionTemplate
     * @param {Object} options 
     * @param {Object} options.data The data of actionDefinitionTemplate being created.
     * @example
     * myCuiJs.createActionDefinitionTemplate()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createActionDefinitionTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ACTION_DEFINITION_TEMPLATES', options);
    },

    /**
     * The getActionDefinitionTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_getActionDefinitionTemplate
     * @param {Object} options 
     * @param {String} options.actionDefinitionTemplateId The id of actionDefinitionTemplate being retrieved.
     * @example
     * myCuiJs.getActionDefinitionTemplate()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getActionDefinitionTemplate: function (options) {
      return doCall('ACTION_DEFINITION_TEMPLATE', options);
    },


    /**
     * The getActionDefinitions() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_getActionDefinitions
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getActionDefinitions()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getActionDefinitions: function (options) {
      return doCall('ACTION_DEFINITIONS', options);
    },

    /**
     * The createActionDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_createActionDefinition
     * @param {Object} options 
     * @param {Object} options.data The data of actionDefinition being created.
     * @example
     * myCuiJs.createActionDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createActionDefinition: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('ACTION_DEFINITIONS', options);
    },

    /**
     * The getActionDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_getActionDefinition
     * @param {Object} options 
     * @param {String} options.actionDefinitionId The id of actionDefinition being retrieved.
     * @example
     * myCuiJs.getActionDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getActionDefinition: function (options) {
      return doCall('ACTION_DEFINITION', options);
    },

    /**
     * The updateActionDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_updateActionDefinition
     * @param {Object} options 
     * @param {String} options.actionDefinitionId The id of actionDefinition being updated.
     * @param {Object} options.data The data of actionDefinition being updated.
     * @example
     * myCuiJs.updateActionDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    updateActionDefinition: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('ACTION_DEFINITION', options);
    },

    /**
     * The getTriggerDefinitionTemplates() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_getTriggerDefinitionTemplates
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getTriggerDefinitionTemplates()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getTriggerDefinitionTemplates: function (options) {
      return doCall('TRIGGER_DEFINITION_TEMPLATES', options);
    },

    /**
     * The createTriggerDefinitionTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_createTriggerDefinitionTemplate
     * @param {Object} options 
     * @param {Object} options.data The data of triggerDefinitionTemplate being created.
     * @example
     * myCuiJs.createTriggerDefinitionTemplate()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createTriggerDefinitionTemplate: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('TRIGGER_DEFINITION_TEMPLATES', options);
    },

    /**
     * The getTriggerDefinitionTemplate() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_getTriggerDefinitionTemplate
     * @param {Object} options 
     * @param {String} options.triggerDefinitionTemplateId The id of triggerDefinitionTemplate being retrieved.
     * @example
     * myCuiJs.getTriggerDefinitionTemplate()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getTriggerDefinitionTemplate: function (options) {
      return doCall('TRIGGER_DEFINITION_TEMPLATE', options);
    },

    /**
     * The getTriggerDefinitions() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_getTriggerDefinitions
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getTriggerDefinitions()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getTriggerDefinitions: function (options) {
      return doCall('TRIGGER_DEFINITIONS', options);
    },

    /**
     * The createTriggerDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_createTriggerDefinition
     * @param {Object} options 
     * @param {Object} options.data The data of triggerDefinition being created.
     * @example
     * myCuiJs.createTriggerDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createTriggerDefinition: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('TRIGGER_DEFINITIONS', options);
    },

    /**
     * The getTriggerDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_getTriggerDefinition
     * @param {Object} options 
     * @param {String} options.triggerDefinitionId The id of triggerDefinition being retrieved.
     * @example
     * myCuiJs.getTriggerDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getTriggerDefinition: function (options) {
      return doCall('TRIGGER_DEFINITION', options);
    },

    /**
     * The updateTriggerDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_updateTriggerDefinition
     * @param {Object} options 
     * @param {String} options.triggerDefinitionId The id of triggerDefinition being updated.
     * @param {Object} options.data The data of triggerDefinition being updated.
     * @example
     * myCuiJs.updateTriggerDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    updateTriggerDefinition: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('TRIGGER_DEFINITION', options);
    },

    /**
     * The deleteTriggerDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_deleteTriggerDefinition
     * @param {Object} options 
     * @param {String} options.triggerDefinitionId The id of triggerDefinition being deleted.
     * @example
     * myCuiJs.deleteTriggerDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deleteTriggerDefinition: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'DELETE';
      return doCall('TRIGGER_DEFINITION', options);
    },

    /**
     * The getRuleDefinitions() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_getRuleDefinitions
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getRuleDefinitions()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getRuleDefinitions: function (options) {
      return doCall('RULE_DEFINITIONS', options);
    },

    /**
     * The createRuleDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_createRuleDefinition
     * @param {Object} options 
     * @param {Object} options.data The data of ruleDefinition being created.
     * @example
     * myCuiJs.createRuleDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createRuleDefinition: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('RULE_DEFINITIONS', options);
    },

    /**
     * The getRuleDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_getRuleDefinition
     * @param {Object} options 
     * @param {String} options.ruleDefinitionId The id of ruleDefinition being retrieved.
     * @example
     * myCuiJs.getRuleDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getRuleDefinition: function (options) {
      return doCall('RULE_DEFINITION', options);
    },

    /**
     * The updateRuleDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_updateRuleDefinition
     * @param {Object} options 
     * @param {String} options.ruleDefinitionId The id of ruleDefinition being updated.
     * @param {Object} options.data The data of ruleDefinition being updated.
     * @example
     * myCuiJs.updateRuleDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    updateRuleDefinition: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('RULE_DEFINITION', options);
    },

    /**
     * The deleteRuleDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_deleteRuleDefinition
     * @param {Object} options 
     * @param {String} options.ruleDefinitionId The id of ruleDefinition being deleted.
     * @example
     * myCuiJs.deleteRuleDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deleteRuleDefinition: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'DELETE';
      return doCall('RULE_DEFINITION', options);
    },

    /**
     * The deactivateRuleDefinition() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/RuleDefinitionV1.raml">API rule definition</a> call.
     * @name iot_deactivateRuleDefinition
     * @param {Object} options 
     * @param {String} options.ruleDefinitionId The id of ruleDefinition being deactivated.
     * @example
     * myCuiJs.deactivateRuleDefinition()
     * .then(function(response) {
     *   // Do something with response
     * })
     * .fail(function(err) {
     *   // Handle error
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deactivateRuleDefinition: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('RULE_DEFINITION_DEACTIVATE', options);
    },

    // -------------------------
    // -------------------------

    // -------------------------
    // Auth
    // -------------------------
    getXsrfToken: function () {
      return getXsrfToken();
    },
    getToken: function () {
      return getToken();
    },
    setToken: function (token) {
      return setToken(token);
    },
    clearToken: function () {
      return clearToken();
    },

    /**
     * The doSysAuth() call wraps a specific use-case of the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OauthV3.raml">API token</a> call.
     * Once obtained, this token will be: 
     * * automatically used as the `Bearer` token on all subsequent calls.
     * * automatically refreshed before it expires.
     * @name  auth_doSysAuth
     * @param {Object} options 
     * @param {String} options.clientId The client id value associated with the Solution's Default (or specific) Application.
     * @param {String} options.clientSecret The client secret value associated with the Solution's Default (or specific) Application.
     * @example
     * myCuiJs.doSysAuth({
     *   clientId: 'your client id',
     *   clientSecret: 'your client secret'
     * })
     * .then(function(token) {
     *   // Do something, now that the token is available.
     * })
     * .fail(function(err) {
     *   // Handle error.
     * });
     * @return {Promise} 
     */
    doSysAuth: function (options) {
      return doSysAuth(options);
    },

    /**
     * The getTokens() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OauthV3.raml">API token</a> call.
     * @name  auth_getTokens
     * @param {Object} options Optional filtering, paging, and/or sorting key-value pairs.
     * @example
     * myCuiJs.getTokens()
     * .then(function(response) {
     *   // Do something.
     * })
     * .fail(function(err) {
     *   // Handle error.
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getTokens: function (options) {
      return getTokens(options);
    },

    /**
     * The revokeToken() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OauthV3.raml">API revoke</a> call.
     * @name  auth_revokeToken
     * @param {String} token The token being revoked.
     * @example
     * myCuiJs.revokeToken('your token')
     * .then(function(response) {
     *   // Do something, now that the token is revoked.
     * })
     * .fail(function(err) {
     *   // Handle error.
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    revokeToken: function (token) {
      return revokeToken(token);
    },

    /**
     * The introspectToken() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OauthV3.raml">API introspect</a> call.
     * @name  auth_introspectToken
     * @param {String} token The token being introspected.
     * @example
     * myCuiJs.introspectToken('your token')
     * .then(function(response) {
     *   // Do something.
     * })
     * .fail(function(err) {
     *   // Handle error.
     * });
     * @return {Promise} The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    introspectToken: function (token) {
      return introspectToken(token);
    },


    /**
     * The doThreeLeggedOAuth() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OauthV3.raml">API authorization</a> call.
     * A successful call will result in a redirection to the authorization server in order to receive the resource owner's consent. 
     * The redirection will be to the login page or directly to the consent page (if the user is already authenticated and login is not forced). 
     * Once consent is granted then the authorization server will send the user agent to the pre-designated `redirect_uri` with query parameters state, scope, and code.
     *
     * NOTE: 
     * * The developer must configure the `redirect_uri`, per application.
     * * The developer must include a `myCuiJs.handleAuthResponse()` call inside the redirect_uri, for cuijs to properly process the returned token and resolve the Promise.
     * 
     * @name  auth_doThreeLeggedOAuth
     * @param {Object} options 
     * @param {String} options.clientId The client id value associated with the Solution's Default (or specific) Application.
     * @example
     * // Part 1. Making the call.
     * myCuiJs.doThreeLeggedOAuth({
     *   clientId: 'your client id'
     * })
     * .then(function(token) {
     *   // Do something, now that the token is available.
     * })
     * .fail(function(err) {
     *   // Handle error.
     * });
     *
     * // Part 2. Catching the returned token. 
     * // This call must be inside whatever page is designated as the `redirect_uri`.
     * myCuiJs.handleAuthResponse();
     * @return {Promise}
     */
    doThreeLeggedOAuth: function (options) {
      return doThreeLeggedOAuth(options);
    },

    /**
     * The handleAuthResponse() call is part 2 of a doThreeLeggedOAuth() call.
     * This call should be placed early-on inside the `redirect_uri` page.
     * That way cuijs can properly process the returned token and resolve the Promise.
     * 
     * @name  auth_handleAuthResponse
     * @example
     * // Catching the returned 3-legged OAuth token. 
     * // This call must be inside whatever page is designated as the `redirect_uri`.
     * myCuiJs.handleAuthResponse();
     */
    handleAuthResponse: function () {
      return doHandleOAuthResponse();
    },

    /**
     * Set the cuijs setAuthHandler.
     * This handler is then automatically called whenever an API call results in a 401 (unauthorized).
     * The supplied handler must return {Promise}.
     * @name auth_setAuthHandler
     * @param  {Function} fn The name of your authorization handler function 
     * @return {Void}
     * @example
     *  function myAuthHandler() {
     *    return myCuiJs.doSysAuth({
     *      clientId: 'your client id',
     *      clientSecret: 'your client secret'
     *    })
     *    .then(function (token) {
     *      cui.log('my App now has the token');
     *    });
     *  }
     *  myCuiJs.setAuthHandler(myAuthHandler);
     */
    setAuthHandler: function (fn) {
      return setAuthHandler(fn);
    },

    /**
     * Disable the cuijs auto-refresh token handler for Bearer Tokens.
     * By default auto-refresh of Bearer tokens is enabled. To turn it off, make this call at any time.
     * The call can be made before or after actually getting a token.
     * @name auth_disableAutoRefresh
     * @return {Void}
     * @example
     *  function myAuthHandler() {
     *    return myCuiJs.doSysAuth({
     *      clientId: 'your client id',
     *      clientSecret: 'your client secret'
     *    })
     *    .then(function (token) {
     *      myCuiJs.disableAutoRefresh();
     *    });
     *  }
     */
    disableAutoRefresh: function () {
      return disableAutoRefresh();
    },

    /**
     * Enable the cuijs auto-refresh token handler for Bearer Tokens.
     * By default auto-refresh of Bearer tokens is enabled. This call is only needed if auto-refresh was explicitly disabled it, earlier.
     * The call can be made before or after actually getting a token.
     * @name auth_enableAutoRefresh
     * @return {Void}
     * @example
     *  myCuiJs.enableAutoRefresh();
     */
    enableAutoRefresh: function () {
      return enableAutoRefresh();
    },

    /**
     * The covAuth() call combines the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/OauthV4.raml">API authorization</a> calls with an SSO login to the App's Realm.
     * A successful call will result in a pop-up window to the App's realm in order to handle login. 
     * Once login credentials are provided and access is granted, the pop-up will close and the SSO authorization server will send the user agent to the specified `authRedirect` with a parameter that triggers a JWT-based session between the App and API platform.
     * By default, the current `window.location.hostname` is used to derive the proper SSO login endpoint. 
     * This is fine when the App is running from its Production server, but must be overriden when App is being developed locally. The developer will set `originUri` to the actual production login Url of the realm
     * (as specified for the App instance, in the Solution Center) .
     * NOTE: 
     * * The developer will override the `originUri` option value. In production it is optional.
     * * The developer may override the `authRedirect` option value. By default it is the current App page/route.
     * * The developer must include a `myCuiJs.handleCovAuthResponse()` call inside the `authRedirect`, for cuijs to properly process the returned token and resolve the Promise.
     * 
     * @name  auth_covAuth
     * @param {Object} options 
     * @param {String} options.originUri The login URL value associated with the Solution's Instance. Optional in production. Required during local development.
     * @param {String} options.authRedirect The App page which handles parsing the SSO login response. In the pop-up scenarion, this is always the path to the App's home page/route. Optional. Defaults to the currewnt App page/route.
     * @example
     * // Part 1. Making the call.
     * myCuiJs.covAuth({
     *   originUri: 'your App login URL override'
     *   authRedirect: 'your App home page/route override'
     * })
     * .then(function(token) {
     *   // Do something, now that the token is available.
     * })
     * .fail(function(err) {
     *   // Handle error.
     * });
     *
     * // Part 2. Catching the returned token. 
     * // This call MUST be inside whatever page is designated as the `authRedirect`.
     * myCuiJs.handleCovAuthResponse();
     * @return {Promise}
     */
    covAuth: function (options) {
      return startCovAuth(options);
    },
    handleCovAuthResponse: function (options) {
      return handleCovAuthResponse(options);
    },
    covAuthInfo: function (options) {
      return covAuthInfo(options);
    },
    covLogout: function (options) {
      return startCovLogout(options);
    },

    // ---------------------------------
    // undocumented utilities...used to bypass authInfo service.
    setCovAuthInfo: function (options) {
      return setAuthInfo(options);
    },
    getCovAuthInfo: function (options) {
      return getAuthInfo(options);
    },
    doCovAuth: function (options) {
      return doCovAuth(options);
    },
    // ---------------------------------


    // -------------------------

    // -------------------------
    // Admin
    // -------------------------
    /**
     * The getClientApplications() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_getClientApplications
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose applications are being retrieved. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getClientApplications: function (options) {
      return doCall('CLIENT_APPS', options);
    },

    /**
     * The createClientApplication() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_createClientApplication
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application is being created. 
     * @param  {Object} options.data The data of the application being created. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    createClientApplication: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'POST';
      return doCall('CREATE_CLIENT_APP', options);
    },

    /**
     * The getClientApplication() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_getClientApplication
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application is being retrieved. 
     * @param  {Object} options.clientId The id of the application being retrieved. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getClientApplication: function (options) {
      return doCall('CLIENT_APP', options);

    },

    /**
     * The updateClientApplication() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_updateClientApplication
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application is being updated. 
     * @param  {Object} options.clientId The id of the application being updated. 
     * @param  {Object} options.data The data of the application being updated. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    updateClientApplication: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('CLIENT_APP_UPD', options);
    },

    /**
     * The deleteClientApplication() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_deleteClientApplication
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application is being deleted. 
     * @param  {Object} options.clientId The id of the application being deleted. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    deleteClientApplication: function (options) {
      options.type = 'DELETE';
      return doCall('CLIENT_APP_UPD', options);
    },

    /**
     * The getClientApplicationOauth() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_getClientApplicationOauth
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application OAuth is being retrieved. 
     * @param  {Object} options.clientId The id of the oauth being retrieved. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getClientApplicationOauth: function (options) {
      return doCall('CLIENT_APP_OAUTH', options);
    },

    /**
     * The updateClientApplicationOauth() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_updateClientApplicationOauth
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application OAuth is being retrieved. 
     * @param  {Object} options.clientId The id of the application being updated. 
     * @param  {Object} options.data The data of the oauth being updated. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    updateClientApplicationOauth: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('CLIENT_APP_OAUTH', options);
    },

    /**
     * The getClientApplicationScopes() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_getClientApplicationScopes
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application Scope is being retrieved. 
     * @param  {Object} options.clientId The id of the application being retrieved. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getClientApplicationScopes: function (options) {
      return doCall('CLIENT_APP_SCOPE', options);
    },

    /**
     * The updateClientApplicationScope() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_updateClientApplicationScope
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application Scope is being retrieved. 
     * @param  {Object} options.clientId The id of the application being updated. 
     * @param  {Object} options.data The data of the scope being updated. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    updateClientApplicationScope: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('CLIENT_APP_SCOPE', options);
    },

    /**
     * The getSolutionInstanceOauth() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_getSolutionInstanceOauth
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application OAuth is being retrieved. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getSolutionInstanceOauth: function (options) {
      return doCall('SOLUINST_OAUTH', options);
    },

    /**
     * The updateSolutionInstanceOauth() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_updateSolutionInstanceOauth
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application OAuth is being retrieved. 
     * @param  {Object} options.data The data of the oauth being updated. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    updateSolutionInstanceOauth: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('SOLUINST_OAUTH', options);
    },

    /**
     * The getSolutionInstanceScopes() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_getSolutionInstanceScopes
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application Scope is being retrieved. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getSolutionInstanceScopes: function (options) {
      return doCall('SOLUINST_SCOPE', options);
    },

    /**
     * The updateSolutionInstanceScope() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_updateSolutionInstanceScope
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose application Scope is being retrieved. 
     * @param  {Object} options.data The data of the scope being updated. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    updateSolutionInstanceScope: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('SOLUINST_SCOPE', options);
    },

    /**
     * The getSolutionInstanceScopeDescriptions() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_getSolutionInstanceScopeDescriptions
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose scope descriptions are being retrieved. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    getSolutionInstanceScopeDescriptions: function (options) {
      return doCall('SOLUINST_SCOPE_DESC', options);
    },

    /**
     * The updateSolutionInstanceScopeDescription() call wraps the <a target="_blank" href="https://developer.covisint.com/api-console/?raml=https://developer.covisint.com/documents/guest/raml/201512/ApiManageV1.raml">API management</a> calls.
     * @name  admin_updateSolutionInstanceScopeDescription
     * @param  {Object} options 
     * @param  {Object} options.solutionInstanceId The id of the Instance whose scope descriptions are being updated. 
     * @param  {Object} options.data The data of the scope being updated. 
     * @return {Promise}  The promise function contains a `response` parameter, which is the JSON returned from the API call.
     */
    updateSolutionInstanceDescription: function (options) {
      options.data = JSON.stringify(options.data);
      options.type = 'PUT';
      return doCall('SOLUINST_SCOPE_DESC', options);
    },
    // -------------------------
    // -------------------------

    /**
     * Set desired version of specified Api.
     * By default, cui.js will always use the latest PRD version of each Api.
     * However, when a specific version of an Api (earlier or later) is required, 
     * use this call to override the default behavior.
     * Typically this call would be made immediately after initializing cui.js in the App.
     * @name util_setVersionOverrides
     * @param  {Object} options 
     * @param {Object<Array>} options.overrides The array of api version override arrays
     * @param {String} options.overrides[ApiName] The name of the APi being overriden. Must match the Api name in the RAML, converted to lowercase.
     * @param {Number} options.overrides[Version] The version number of the Api to use. Omit the 'v' and just use the integer.
     * @return {Void}
     * @example
     * myCuiJs.setServiceUrl('STG');
     * myCuiJs.setVersionOverrides({
     *   [
     *     ['device', 2]
     *   ]
     * });
     */
    setVersionOverrides: function (overrides) {
      return setVersionOverrides(overrides);
    },

    // -------------------------
    /**
     * Get the cuijs version
     * @name util_version
     * @return {String} The version in major.minor.patch format
     * @example
     * var versionStr = cui.api().version();
     */
    version: function () {
      //cui.log('cuijs v' + cui.INFO.version);
      return cui.INFO.version;
    }
    // ----------------------------------------
  };
};
// --------------------------------------------



})(window.cui = window.cui || {});
