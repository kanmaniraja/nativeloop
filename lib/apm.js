"use strict";
/***
 *                          __     _  __       __                     
 *       ____ ___   ____   / /_   (_)/ /___   / /_   ___   _____ ____ 
 *      / __ `__ \ / __ \ / __ \ / // // _ \ / __ \ / _ \ / ___// __ \ 
 *     / / / / / // /_/ // /_/ // // //  __// / / //  __// /   / /_/ / 
 *    /_/ /_/ /_/ \____//_.___//_//_/ \___//_/ /_/ \___//_/    \____/ 
 *                                                                    
 *                  mobile solutions for everyday heroes
 *                                                                    
 * @file 
 * Wraps the Appcelerator Performance Module.  Adds console output, if in development mode 
 * and the debug property is set to true.
 * @module nativeloop/apm
 * @see {@link http://docs.appcelerator.com/platform/latest/#!/api/Modules.Performance|Appcelerator Performance Module API Documentation}
 * @author Brenton House <brenton.house@gmail.com>
 * @copyright Copyright (c) 2016 by Superhero Studios Incorporated.  All Rights Reserved.
 * @license Licensed under the terms of the MIT License (MIT)
 * @version 1.0.0
 * @since 1.0.0
 */

// property to store apm instance, if enabled.
var apm;

/**
 * @property {string} appid - APM appid.  Defaults to property com-appcelerator-apm-id.
 * @property {string} username - Name used to differentiate user metadata for crash reports.
 * @property {boolean} optOutStatus - Has user opted out of sending information.
 * @property {object} metadata - Additional information about the user.
 * @property {string} userUUID - Unique id of the user.
 * @property {boolean} didCrash - Did the app crash on last load.  Not used without APM.
 * @property {boolean} debug - Specifies whether the app should output to console, in addition to APM.
 * @property {boolean} shouldCollectLogcat - Should app collect logcat data on Android devices.
 */
var wrapper = {
	appid: Ti.App.Properties.getString( 'com-appcelerator-apm-id' ) || 'unknown',
	username: 'anonymous',
	optOutStatus: false,
	metadata: {},
	userUUID: Ti.App.guid,
	didCrash: false,
	debug: false,
	shouldCollectLogcat: false,
}

/**
 * Returns true if the application crashed on the previous session else returns false.
 * @function didCrashOnLastAppLoad
 * @returns {boolean}
 * @since 1.0.0
 */
wrapper.didCrashOnLastAppLoad = function () {
	if ( apm ) {
		return apm.didCrashOnLastAppLoad();
	}
	return wrapper.didCrash;
};

/**
 * Returns true if the user opt out to send information else returns false.
 * @function getOptOutStatus
 * @returns {boolean}
 * @since 1.0.0
 */
wrapper.getOptOutStatus = function () {
	if ( apm ) {
		return apm.getOptOutStatus();
	}
	return wrapper.optOutStatus;
};

/**
 * Returns a string consisting of the UUID generated by Crittercism for user identification.
 * @function getUserUUID
 * @returns {string}
 * @since 1.0.0
 */
wrapper.getUserUUID = function () {
	if ( apm ) {
		return apm.getUserUUID();
	}
	return wraper.userUUID;
};

/**
 * On the Android platform, you can optionally pass in initialization parameters.
 * @summary Initializes the module.
 * @function init
 * @param {string} [appid] - APM App ID found in the tiapp.xml file or the Appcelerator Performance dashboard.<p>By default, if this parameter is not specified, the module uses the value stored as the com-appcelerator-apm-id key in the tiapp.xml file to initialize the module.
 * @param {object} [config] - Android-specific initialization parameters.
 * @param {string} [config.notificationTitle] - This parameter determines the title shown on notification alerts sent from Crittercism.
 * @param {boolean} [config.shouldCollectLogcat=false] - If true, enables collecting logcat data on Android devices running Google API Level 16 (Jelly Bean) and higher.
 * @since 1.0.0
 */
wrapper.init = function ( appid, config ) {

	wrapper.appid = appid || Ti.App.Properties.getString( 'com-appcelerator-apm-id' ) || wrapper.appid;
	config = config || {};

	if ( !_.isUndefined( config.shouldCollectLogcat ) ) {
		wrapper.shouldCollectLogcat = config.shouldCollectLogcat;
	}

	// Attempt to load the APM module and initialize.
	try {
		apm = require( 'com.appcelerator.apm' );
		apm.init( wrapper.appid, config );
	} catch ( error ) {
		Ti.API.warn( 'com.appcelerator.apm module is not available' );
	}

};

/**
 * These breadcrumbs are collected and passed to the Performance service. 
 * The most recent 100 breadcrumbs before the crash occurred are displayed on the Performance Dashboard.
 * @summary Leaves a breadcrumb trail in your code to get a playback of events leading up to a crash.
 * @function leaveBreadcrumb
 * @param {string} breadcrumb - Up to 140 characters to identify the event or application state.
 * @since 1.0.0
 */
wrapper.leaveBreadcrumb = function ( breadcrumb ) {
	ENV_DEVELOPMENT && wrapper.debug && Ti.API.trace( '[APM] breadcrumb → ' + breadcrumb );
	apm && apm.leaveBreadcrumb( breadcrumb );
};

/**
 * Crittercism limits the logging of handled errors to one per minute. 
 * Up to five errors are buffered and are subsequently sent after the one minute limit.
 * @summary Used to track handled errors.
 * @function logHandledException
 * @param {Error} error - Error to log.
 * @since 1.0.0
 */
wrapper.logHandledException = function ( error ) {
	ENV_DEVELOPMENT && Ti.API.error( '[APM] exception → ' + JSON.stringify( error, null, 2 ) );
	try {
		apm && apm.logHandledException( error );
	} catch ( ex ) {
		Ti.API.error( "[APM] Error calling apm.logHandledException() → "  + ex );
	}
};

/**
 * The data is stored in a dictionary and displayed on the developer portal when viewing a user profile.
 * @summary Used to set a single pair of arbitrary user metadata.
 * @function setMetadata
 * @params {string} key - Metadata key.
 * @params {string|number} value - Metadata value. Can be either an integer or string.
 * @since 1.0.0
 */
wrapper.setMetadata = function ( key, value ) {
	wrapper.metadata[ key ] = value;
	ENV_DEVELOPMENT && Ti.API.info( '[APM] metadata → key: ' + JSON.stringify( key, null, 2 ) + ' value: ' + JSON.stringify( value, null, 2 ) );
	apm && wrapper.apm.setMetadata( key, value );
};

/**
 * Sets the users opt-out status from sending any and all information to the Performance service.
 * @function setOptOutStatus
 * @params {boolean} optOutStatus - If set to true, data is not sent to the Performance service.
 * @since 1.0.0
 */
wrapper.setOptOutStatus = function ( optOutStatus ) {
	wrapper.optOutStatus = optOutStatus;
	ENV_DEVELOPMENT && Ti.API.info( '[APM] Setting optOutStatus to ' + optOutStatus );
	apm && apm.setOptOutStatus( optOutStatus );
};

/**
 * Updates only if there has been a change to the username from previous settings.
 * @summary Sets a username to differentiate user metadata for crash reports.
 * @function setUsername
 * @params {string} username - Up to 32 characters to set to identify a user.
 * @since 1.0.0
 */
wrapper.setUsername = function ( username ) {
	wrapper.username = username;
	ENV_DEVELOPMENT && Ti.API.info( '[APM] Setting username to ' + username );
	apm && apm.setUsername( username );
};

module.exports = wrapper;