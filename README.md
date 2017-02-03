<b>Features:</b>

This project’s goal was to demonstrate users how easy it is to connect their devices with the applications. Once the devices and applications have been defined and configured within the IoT dashboard, Covisint IoT-Workbench facilitates the publishing and retrieval of messages between devices and applications. This project uses the Covisint IoT platform internally supporting many of the industry standard messaging protocols such as MQTT, AMQP, WebSockets, and Stomp. for devices sending events and applications sending commands. As an add-on, it facilitates the ease of managing different workflows that one needs for connecting devices with applications using an application called COVS-red, built on Node-RED - a visual tool for wiring together hardware devices, APIs and online services.
<br />
<br><b>Getting Started</b>

Please follow the instructions detailed below to get a copy of the project up and running on your local machine for development and testing purposes. Make sure the following software are installed on your machine:
<ol>
<li>Git</li>
<li>NPM</li>
<li>Node</li>
<li>Bower</li>
<li>Grunt Command Line Interface (grunt-cli)</li>
</ol>

<br><b>Installation:</b>
<ol>
<li>Get the latest node by cloning the project using <b>git clone</b></li>
<li>Run the <b><i>npm install</i></b> command to download and install all the required node/npm libraries</li>
<li>Run the <b><i>grunt</i></b> command to setup/update project specific files. It will perform the following tasks for you:</li>
<ul>
<li>Download Bower dependencies</li>
<li>Download all the required NPM modules for COVS Red nodes</li>
<li>Execute NPM link commands to establish the linkage between COVS-Red (Node-red) and COVS Nodes</li>
<li>Move files to the specific directories</li>
</ul>
</ol>

<br><b>API Reference:<b>
<ul>
<li>Access to the Covisint’s IoT Solution Instance with ClientID and SecretKey must be known.</li>
<li>Access to connecting a device with an application is based on Device and Application Stream information. That stream information must be known to the user before using the system. Such information was made known to the user while defining devices and applications within the IoT-dashboard.</li>
<li>Authentication and authorization is based on CliendID/SecretKey. OAuth Identity Services API is used – please refer to https://developer.covisint.com.</li>
<li>Covisint’s CUI.js API calls are used for retrieving device and application configured information.</li>
<li>Node.js provided nodes for messaging protocols such as MQTT, AMQP etc. are used for the configuration and constructing messages.</li>
</ul>

<br><b>Starting the Node Application:<b>
The following section describes “how to use the application” illustrating – stream configuration, device and application selection, sending events, commands etc.
<ol>
<li>From a command prompt window, in the directory where the IoT Workbench is installed, execute <b><i>node app.js</i></b>. This bring the application running in background under localhost, port 1880.</li>
</ol>

<br />
User guide located at: <a href="https://git.covisintrnd.com/arch-skunk/iot-workbench/wikis/web-application-user-guide">https://git.covisintrnd.com/arch-skunk/iot-workbench/wikis/web-application-user-guide</a>
<br />
Check out <a href="https://git.covisintrnd.com/arch-skunk/iot-workbench/wikis/pages">https://git.covisintrnd.com/arch-skunk/iot-workbench/wikis/pages</a> for sample flows. 
<br />

<br><b>Contributors:</b><br>
The following Solution Architects and Developers have contributed to the design and development of this application over a period of 3 to 4 weeks.
<ul>
	<li>Karl Mozurkewich
	<li>Anuj Tyagi
	<li>Gaurav Kumar
	<li>Sreyams Jain
	<li>Vineet Kumar Sinha
	<li>Riddhi Chouhan
	<li>Vijay Vardhan
</ul>
