require(`dotenv`).config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

// Basic bits
const	got = require(`got`),
			cheerio = require(`cheerio`),
			os = require(`os`),
			inquirer = require(`inquirer`),
			{ PerformanceObserver, performance } = require('perf_hooks');

// Server bits
const	fs = require(`fs`),
	 		zlib = require(`zlib`),
			tar = require(`tar`),
			https = require(`https`),
			credentials = {key: privateKey, cert: certificate},
			express = require(`express`),
			app = express(),
			httpsServer = https.createServer(credentials, app),
			ftpd = require(`simple-ftpd`),
			dhcp = require(`dhcp`),
			tftp = require(`tftp`);

try {
	var privateKey = fs.readFileSync(`files/certs/domain-key.txt`);
	var certificate = fs.readFileSync(`files/certs/domain-crt.txt`);
} catch {}

app.use(`/`, express.static(`files`));

var variables = {
	[`1stServerSettings`]: {},
	[`8021XSupplicant`]: {},
	actions: [],
	auth: {	adminPassword: `6633222` },
	configFiles: {
		DT700: ``,
		DT800: ``,
		DT900: ``,
	},
	ClientIPAddress: {},
	configurationItemCodes: {},
	configuredDevices: [],
	debug: false,
	dump: false,
	deviceQueue: [],
	Encryption: {},
	PhoneFirmware: {},
	ProxySettings: {},
	hosts: [],
	ignoreDevices: [],
	//license: {},
	LicenseRequest: {},
	LicenseSettings: {},
	LicenseServerSettings: {},
	LANPortSettings: {},
	LLDPSettings: {},
	NetworkSettings: {},
	overWriteFirmwareVersion: false,
	overWriteFirmwareVersionWith: `10.0.0.0`,
	PCPortSettings: {},
	Popup: {},
	server: false,
	ServerAddressURI: {},
	setDataTypes: {
	},
	SIPServerPort: {},
	SpareIPSettings: {},
	system: {
		certificateState: {
			rootCert : [],
			clientCert : []
		},
		downloadProtocol: ``,
		downloadHttps: false,
		forceInsecure: false,
		listArray: [],
		loop: true,
		loopTimer: 30000,
		maxRetries: 3,
		processCounter: 0,
		protocolType: `https`,
		retry: true,
		retryCounter: 0
	},
	upgradedDevices: [],
	VoiceRecSettings: {},
	verbose: false,
};

// Critical flags
if(process.argv.indexOf(`--verbose`) != -1){
	variables.verbose = true;
}
if(process.argv.indexOf(`--debug`) != -1){
	variables.verbose = true;
	variables.debug = true;
}
if(process.argv.indexOf(`--dump`) != -1){
	variables.verbose = true;
	variables.debug = true;
	variables.dump = true;
}
if(process.argv.indexOf(`--factory-values`) != -1){
	variables.actions.unshift(`factory-values`);
}
logFile = (message, fileName) => {
	// Ensure log directory
	if(!fs.existsSync(`./files`)){
		if(variables.debug){
			logMessage(`Debug - Creating ./files`)
		}
		fs.mkdirSync(`./files`);
	}
	if(!fs.existsSync(`./files/logs`)){
		if(variables.debug){
			logMessage(`Debug - Creating ./files/logs`)
		}
		fs.mkdirSync(`./files/logs`);
	}
	// Append information to a log file.
	fs.appendFile(`./files/logs/${fileName}`, `${message}\n`, `utf8`, (err) => {
	});
}

padZero = (input) => {
	// Pad digits with 0 if needed and returns two-digit format.
	if(input < 10){
		input = `0${input}`;
		return(input);
	} else {
		return(input);
	}
}

theDate = (returnType) => {
	// Returns date or data/time.
	var dateFnc = new Date();
	var date = `${dateFnc.getFullYear()}-${(dateFnc.getMonth() + 1)}-${dateFnc.getDate()}`;
	var time =  `${dateFnc.getHours()}:${padZero(dateFnc.getMinutes())}:${padZero(dateFnc.getSeconds())}`;
	var dateTime = `${date}-${time}`;
	if(returnType == `date`){
		return date;
	} else if(returnType == `dateTime`){
	return dateTime;
	}
}

logMessage = (message) => {
	// Log information to console, file, or both.
	let dateTime = theDate(`dateTime`);
	console.log(`${dateTime} - ${message}`);
	logFile(`${dateTime} - ${message}`, `${theDate('date')}.log`);
}

miliToMinSec = (ms) => {
  let mins = Math.floor(ms / 60000);
  var secs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}:${(secs < 10 ? '0' : '')}${secs}`;
}

cleanupDirectory = (directoryName, callback) => {
	if(variables.verbose){
		logMessage(`Verbose - Cleaning up directory: ${directoryName}`)
	}
	if(fs.existsSync(directoryName)){
		fs.readdirSync(directoryName, { withFileTypes: true }).forEach((file, firmwareIndex) => {
			if(file.isFile()){
				if(variables.debug){
					logMessage(`Debug - Removing file: ${file.name}`)
				}
				fs.unlink(`${directoryName}/${file.name}`, () => {});
			} else {
				if(variables.debug){
					logMessage(`Debug - Removing directory: ${file.name}`)
				}
				fs.rmdirSync(`${directoryName}/${file.name}`, { recursive: true });
			}
		});
	}
	callback();
}

collectFirmwareInformation = (callback) => {
	if(!fs.existsSync(`./files`)){
		if(variables.debug){
			logMessage(`Debug - Creating ./files`)
		}
		fs.mkdirSync(`./files`);
	}
	if(!fs.existsSync(`./files/firmware`)){
		if(variables.debug){
			logMessage(`Debug - Creating ./files/firmware`)
		}
		fs.mkdirSync(`./files/firmware`);
	}
	if(!fs.existsSync(`./files/firmware/temp`)){
		if(variables.debug){
			logMessage(`Debug - Creating ./files/firmware/temp`)
		}
    fs.mkdirSync(`./files/firmware/temp`);
	}
	let firmwareFiles = fs.readdirSync(`./files/firmware`, { withFileTypes: true });
	let fileCount = 0;
	let completedCount = 0;
	firmwareFiles.forEach((file, firmwareIndex) => {
		if(file.isFile() && file.name.match(/.tgz/)){
			fileCount++;
			if(variables.debug){
				logMessage(`Debug - Inspecting ./files/firmware/${file.name}`)
			}
			let fileContents = fs.createReadStream(`./files/firmware/${file.name}`);
			let writeStream = fs.createWriteStream(`./files/firmware/temp/${file.name.split(`.`)[0]}.tar`);;
			let unzip = zlib.createGunzip();
			var extraction = fileContents.pipe(unzip).pipe(writeStream);
			extraction.on(`finish`,() => {
				if (!fs.existsSync(`./files/firmware/temp/${file.name.split(`.`)[0]}`)){
					fs.mkdirSync(`./files/firmware/temp/${file.name.split(`.`)[0]}`);
					tar.x({ C: `./files/firmware/temp/${file.name.split(`.`)[0]}`, file: `./files/firmware/temp/${file.name.split(`.`)[0]}.tar` }, () =>{
						let updateDocument = { firmwareName: file.name };
						let directoryName =`./files/firmware/temp/${file.name.split(`.`)[0]}`
						fs.readdir(directoryName, { withFileTypes: true }, (err, files) => {
							files.forEach((file, i) => {
								if(file.isFile()){
									if(file.name.match(/fwver.txt/)){
										let firmwareVersion = fs.readFileSync(`${directoryName}/${file.name}`).toString();
										// FIX THIS!
										updateDocument.version = firmwareVersion.match(/\d*.\d*.\d*.\d*/)[0];
										if(variables.overWriteFirmwareVersion){
												updateDocument.version = updateDocument.overWriteFirmwareVersionWith;
										}
									}
									if(file.name.match(/hwver.txt/)){
										let hardwareVersion = fs.readFileSync(`${directoryName}/${file.name}`).toString();
										updateDocument.hardwareVersion = hardwareVersion.match(/\d*.\d*.\d*.\d*/)[0];
									}
								}
							});
							if(!updateDocument.hasOwnProperty(`hardwareVersion`)){
								switch (updateDocument.firmwareName) {
									case `itlisips.tgz`:
										updateDocument.hardwareVersion = `9.1.3.0`;
										break;
									case `itlisipv.tgz`:
										updateDocument.hardwareVersion = `9.1.3.3`;
										break;
									case `itlisipe.tgz`:
										updateDocument.hardwareVersion = `9.1.3.4`;
										break;
									default:
										findDocument.firmwareName = updateDocument.firmwareName;
								}
							}
							if(variables.debug){
								logMessage(`Debug - ${JSON.stringify(updateDocument)}`);
							}
						fs.rmdirSync(`./files/firmware/temp/${file.name.split(`.`)[0]}`, { recursive: true });
						fs.unlink(`./files/firmware/temp/${file.name.split(`.`)[0]}.tar`, () => {});
						variables.PhoneFirmware[updateDocument.hardwareVersion] = { 'version': updateDocument.version, 'firmwareName': updateDocument.firmwareName };
						logMessage(`Discovered Firmware - Hardware Version: ${updateDocument.hardwareVersion}, Firmware Version: ${updateDocument.version}, File Name ${updateDocument.firmwareName}`);
						completedCount++;
						if(variables.debug){
							logMessage(`Debug - Completed File Count: ${completedCount} | Total File Count: ${fileCount}`);
						}
						if(fileCount == completedCount){
							if(variables.debug){
								logMessage(`Debug - Firmware files processing completed`);
							}
								callback();
						}
					});
				});
			}
		});
	}
});
	if(fileCount == 0){
		logMessage(`No Firmware Available`);
		callback();
	}
}

if(process.env.hasOwnProperty(`downloadProtocol`)){
	if(process.env.downloadProtocol.toLowerCase() == `https`){
		variables.system.downloadProtocol = `2`;
		if(variables.verbose){
			logMessage(`Verbose - Download protocol set to https via .env file`);
		}
	} else if(process.env.downloadProtocol.toLowerCase() == `tftp`){
		variables.system.downloadProtocol = `1`;
		if(variables.verbose){
			logMessage(`Verbose - Download protocol set to tftp via .env file`);
		}
	} else {
		variables.system.downloadProtocol = `0`;
		if(variables.verbose){
			logMessage(`Verbose - Download protocol set to ftp via .env file`);
		}
	}
}

if(process.env.forceInsecure.toLowerCase() == `true`){
	variables.system.forceInsecure = true;
	if(variables.verbose){
		logMessage(`Verbose - Forcing insecure http via .env file`);
	}
}

var networkInterfaces = os.networkInterfaces();
let networkAddresses = [];
for (const property in networkInterfaces) {
	if(networkInterfaces[property][1] != undefined && networkInterfaces[property][1].hasOwnProperty(`address`) && !networkInterfaces[property][1].address.match(/^127|^196/)){
		networkAddresses.push(networkInterfaces[property][1].address);
	}
}

httpGet = (uriHost, uriPath, getInfo, deviceInformation, callback) => {
	let sessionID = null;
	let macAddress = `MAC address Information Unavailable`
	if(deviceInformation != null){
		macAddress = deviceInformation.macAddress;
	}
	// Handle HTTP Get requests.
	if(variables.debug){
		logMessage(`Debug - Handle HTTP Get Function - httpGet`);
		logMessage(`Debug - uriHost: ${uriHost}`);
		logMessage(`Debug - uriPath: ${uriPath}`);
		logMessage(`Debug - getInfo: ${getInfo}`);
		logMessage(`Debug - macAddress: ${macAddress}`);
	}
	if(macAddress == null) {
		if(variables.debug){
			logMessage(`Debug - Request to httpGet function missing MAC Address`)
		}
		macAddress = uriHost.replace(/http:\/\//,``);
	}
	got(uriHost + uriPath).then(response => {
		let $ = cheerio.load(response.body);
		if(variables.dump){
			logMessage(`▼ ▼ ▼ ▼ Dump ▼ ▼ ▼ ▼\n\n${response.body}`);
			logMessage(`▲ ▲ ▲ ▲ Dump ▲ ▲ ▲ ▲`);
		}
		if(response.body.match(/Terminal is busy/)){
			logMessage(`ERROR-Terminal Busy: ${macAddress}`);
			callback(sessionID, null);
		} else {
			if(variables.verbose){
				logMessage(`Verbose - Page Title [${macAddress}]: ${$('title').text()}`);
			}
			if(uriPath.match(/(password=)/)){
				try {
						sessionID = response.body.match(/session=(\w*)/)[1];
				} catch {
					logMessage(`Logon Exception [${macAddress}]: Are your credentials correct?`);
					callback(sessionID, null);
					return;
				}
			}
			if(getInfo){
				if(variables.verbose){
					logMessage(`Verbose - Getting Device Information`);
				}
				got(`${uriHost}/header.cgi`).then( infoResponse => {
					if(variables.debug){
						logMessage(`Debug - header.cgi`);
					}
					var deviceInformation = {
						deviceSeries: infoResponse.body.match(/DT\d\d\d/)[0],
						hardwareVersion: infoResponse.body.match(/\d.\d.\d.\d/g)[0],
						firmwareVersion: infoResponse.body.match(/\d.\d.\d.\d/g)[1],
						macAddress: infoResponse.body.match(/\w\w:\w\w:\w\w:\w\w:\w\w:\w\w/)[0]
					};
					if(deviceInformation.deviceSeries == `DT700`){
						deviceInformation.hardwareVersion = infoResponse.body.match(/\d.\d.\d.\d/g)[1];
						deviceInformation.firmwareVersion = infoResponse.body.match(/\d.\d.\d.\d/g)[2];
					}
				if(variables.debug){
					logMessage(`Debug - Device Information [${macAddress}]: Series - ${deviceInformation.deviceSeries} | HW Version - ${deviceInformation.hardwareVersion} | FW Version - ${deviceInformation.firmwareVersion}`);
				}
				if(variables.dump){
					logMessage(`▼ ▼ ▼ ▼ Dump ▼ ▼ ▼ ▼\n\n${JSON.stringify(deviceInformation)}`);
					logMessage(`▲ ▲ ▲ ▲ Dump ▲ ▲ ▲ ▲`);
				}
				callback(sessionID, deviceInformation);
			});
		} else {
			callback(sessionID, null);
		}
		}
	})
	// ▼▼▼▼ Comment for testing uncomment for release ▼▼▼▼
	.catch(error => {
		if(variables.debug){
			logMessage(`Debug - Catch got() error`);
			logMessage(error);
		}
		logMessage(`Error [${macAddress}]: ${uriHost}${uriPath} - ${error.name}`);
		callback(sessionID, null);
	});
	// ▲▲▲▲ Comment for testing uncomment for release ▲▲▲▲
}

checkVersion = (runningVersion, availableVersion) => {
	let runningVersionArray = runningVersion.split(`.`);
	let availableVersionArray = availableVersion.split(`.`);
	let returnValue= false
	for (var i = 0; i < runningVersionArray.length; i++) {
		if(parseInt(runningVersionArray[i]) < parseInt(availableVersionArray[i])){
			return(true);
			i = runningVersionArray.length;
		}
	}
	return(returnValue);
}

checkHttp = (host, macAddress, callback) => {
	// Set security mode for device.
	if(variables.debug){
		logMessage(`Debug - Check HTTP Function - checkHttp`);
	}
	let protocolType = `https`;
	if(variables.system.forceInsecure){
			callback(false, host, `http`);
	} else {
		got(`http://${host}/header.cgi`).then( response => {
			if(variables.dump){
				logMessage(`▼ ▼ ▼ ▼ Dump ▼ ▼ ▼ ▼\n\n${response.body}`);
				logMessage(`▲ ▲ ▲ ▲ Dump ▲ ▲ ▲ ▲`);
			}
			if(response.body.match(/9.1.[0-5].\d/g)){
				if(variables.verbose){
					logMessage(`Verbose - Security Mode [${macAddress}]: ${host}/DT700 detected, using http/ftp`);
				}
				protocolType = `http`;
			} else if(response.body.match(/9.1.[6-7].\d/g)){
				if(variables.verbose){
					logMessage(`Verbose - Security Mode [${macAddress}]: ${host}/DT800+ detected, using https`);
				}
				protocolType = `https`;
			}
			callback(false, host, protocolType);
		});
	}
}

generateRootElements = (body, host, callback) => {
	let $ = cheerio.load(body);
	if(variables.dump){
		logMessage(`▼ ▼ ▼ ▼ Dump ▼ ▼ ▼ ▼\n\n${body}`);
		logMessage(`▲ ▲ ▲ ▲ Dump ▲ ▲ ▲ ▲`);
	}
	if(variables.debug){
		logMessage(`Debug - Page Title [${host}]:  ${$('title').text()}`);
	}
	let rootElements = [];
	let configurationItemCodes = {};
	$(`div`).each(function() {
		if($(this)[`0`].hasOwnProperty(`attribs`) && $(this)[`0`].attribs.id != undefined && $(this)[`0`].attribs.id.length == 7){
			//let rootElements = $(this).text().split('\n');
			let rootElement = $(this).text().split('\n')[1].substring(1,$(this).text().split('\n')[1].length).replace(/[\s-&\.\/]/g,'');
			if(variables.debug){
				logMessage(`Debug - Root Element Name ${rootElement}, Root Element ID ${$(this)['0'].attribs.id}`);
			}
			configurationItemCodes[rootElement] = {};
			rootElements.push({ 'rootName': rootElement, 'rootId': $(this)['0'].attribs.id})
		}
	});
	if(variables.dump){
		logMessage(`▼ ▼ ▼ ▼ Dump ▼ ▼ ▼ ▼\n\n${JSON.stringify(rootElements)}`);
		logMessage(`▲ ▲ ▲ ▲ Dump ▲ ▲ ▲ ▲`);
	}
	callback(rootElements, configurationItemCodes);
}

generateConfigElements = (body, rootElements, configurationItemCodes, callback) => {
	let $ = cheerio.load(body);
	let rootItem = ``;
	let configItemCode = ``;
	$(`a`).each(function() {
		let thisLink = $(this);
		// Check for attribs and text to validate that the item is correct.
		if(thisLink[`0`].hasOwnProperty(`attribs`) && typeof thisLink.text() == `string`){
			// Breaks here with DT700 Phones
			if(thisLink[`0`].attribs.onclick.match(/config=(.{7})'\)\;$/)){
				// This works for DT8xx and DT9xx phones
				configItemCode = thisLink[`0`].attribs.onclick.match(/config=(.{7})'\)\;$/)[1];
			} else if (thisLink[`0`].attribs.onclick.match(/config=(.{7})'\;$/)){
				// This works for DT7xx phones
				configItemCode = thisLink[`0`].attribs.onclick.match(/config=(.{7})'\;$/)[1];
			}
			var configItemName = thisLink.text().replace(/[\(\)\/&\s\-\.]/g,``);
			if(rootElements.indexOf(rootElements.find( ({ rootId }) => rootId === configItemCode )) >=0 ){
				if(variables.debug){
					logMessage(`Debug - Matching Root Item Found [${configItemName}] Code: ${configItemCode}`);
				}
				// Set root item (scoped outside of each function) for config items.
				rootItem = configItemName;
			} else {
				// Do not overwrite already initialized values.
				if(!configurationItemCodes[rootItem].hasOwnProperty(configItemName)){
					configurationItemCodes[rootItem][configItemName] = configItemCode;
				}
				if(variables.debug){
					logMessage(`Debug - Configuation Item [${rootItem}.${configItemName}] Code: ${configItemCode}`);
					logMessage(`Debug - configurationItemCodes[${rootItem}][${configItemName}]: ${configurationItemCodes[rootItem][configItemName]}`);
				}
			}
			}
	});
	if(variables.dump){
			logMessage(`▼ ▼ ▼ ▼ Dump ▼ ▼ ▼ ▼\n\n${JSON.stringify(configurationItemCodes)}`);
			logMessage(`▲ ▲ ▲ ▲ Dump ▲ ▲ ▲ ▲`);
		}
	callback(configurationItemCodes);
}


logonDevice = (host, macAddress, protocolType, callback) => {
	// Logon
	let deviceInformation = { 'macAddress' : macAddress };
	if(variables.debug){
		logMessage(`Debug - Logon Function - logonDevice`);
	}
	if(variables.verbose){
		logMessage(`Verbose - URL Accessed [${macAddress}]: ${protocolType}://${host}/index.cgi?username=ADMIN&password=${variables.auth.adminPassword}`);
	}
	httpGet(`${protocolType}://${host}`, `/index.cgi?username=ADMIN&password=${variables.auth.adminPassword}`, true, deviceInformation, (sessionID, deviceInformation) => {
		if(variables.verbose){
			logMessage(`Verbose - Session ID from Logon [${macAddress}]: ${sessionID}`);
		}
		if(sessionID == null ){
			httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&set=all`, false, deviceInformation, (sessionID, deviceInformation) => {
				callback(false, host, protocolType, sessionID, deviceInformation, null);
				return;
			});
		} else {
			// Seems that my set values like to change... Need to get parse values from the menu.cgi first.
			if(variables.verbose){
				logMessage(`Verbose - Processing Configuration Variables: ${host}`);
			}
			got(`${protocolType}://${host}/menu.cgi?session=${sessionID}`).then(response => {
				generateRootElements(response.body, host, (rootElements, configurationItemCodes) => {
					generateConfigElements(response.body, rootElements, configurationItemCodes, (configurationItemCodes) => {
						callback(false, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
					});
				});
			})
			// ▼▼▼▼ Comment for testing uncomment for release ▼▼▼▼
			.catch(error => {
				logMessage(`${host} - ${error.name}`);
			});
			// ▲▲▲▲ Comment for testing uncomment for release ▲▲▲▲
		}
	});
}


logoffDevice = (host, macAddress, protocolType, sessionID, callback) => {
	// Logoff
	let deviceInformation = { 'macAddress' : macAddress };
	if(variables.debug){
		logMessage(`Debug - Logoff Function - logoffDevice`);
		logMessage(macAddress);
	}
	httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&set=all`, false, deviceInformation, (sessionID, deviceInformation) => {
		if(variables.verbose){
		logMessage(`Verbose - Save and Reset [${host}]: ${host}`);
		}
		variables.deviceQueue = variables.deviceQueue.filter( mac => mac !== macAddress );
		callback(false, host, protocolType, sessionID);
	});
}


upgradeDevice = (host, protocolType, sessionID, deviceInformation, macAddress, callback) => {
	let startTimer = performance.now();
	// Upgrade Device
	if(variables.debug){
		logMessage(`Debug - Upgrade Device Function [${macAddress}]: upgradeDevice`);
		logMessage(`Debug - Session ID [${macAddress}]: ${sessionID}`);
		if(deviceInformation != null){
			logMessage(`Debug - Device Information [${macAddress}]: host=${host}, protocolType=${protocolType}, sessionID=${sessionID}\n\t\t\t deviceSeries=${deviceInformation.deviceSeries}, hardwareVersion=${deviceInformation.hardwareVersion}, firmwareVersion=${deviceInformation.firmwareVersion}`);
		}
	}
	if(variables.system.skipUpgrade || deviceInformation == undefined || !deviceInformation.hasOwnProperty(`hardwareVersion`) || deviceInformation.hardwareVersion == undefined){
		if(variables.debug){
			let endTimer = performance.now();
			logMessage(`Upgrade Function Time [${macAddress}]: ${miliToMinSec(endTimer - startTimer)}`);
			logMessage(`Debug - Session ID [${macAddress}]: ${sessionID}`);
		}
		callback(false, host, protocolType, sessionID, deviceInformation);
	} else {
		if(variables.PhoneFirmware.hasOwnProperty(deviceInformation.hardwareVersion) && variables.PhoneFirmware[deviceInformation.hardwareVersion].version == deviceInformation.firmwareVersion){
			if(variables.debug){
				let endTimer = performance.now();
				logMessage(`Upgrade Function Time [${macAddress}]: ${miliToMinSec(endTimer - startTimer)}`);
				logMessage(`Debug - Session ID [${macAddress}]: ${sessionID}`);
			}
			callback(false, host, protocolType, sessionID, deviceInformation);
		} else {
			if(variables.PhoneFirmware.hasOwnProperty(deviceInformation.hardwareVersion)){
				var latestVersion = variables.PhoneFirmware[deviceInformation.hardwareVersion].version;
			} else {
				var latestVersion = `Unknown`;
			}
			logMessage(`Upgrade available [${macAddress}]: ${host} | ${deviceInformation.deviceSeries}/${deviceInformation.hardwareVersion} | Current Version = ${deviceInformation.firmwareVersion} | Latest Version = ${latestVersion}`);
			if(variables.system.protocolType == `http`){
				protocolType = variables.system.protocolType;
			}
			if(variables.system.downloadHttps){
				if(variables.debug){
					logMessage(`Debug - URL Accessed [${macAddress}]: ${protocolType}://${host}/index.cgi?session=${sessionID}&config=423054e`);
				}
				got(`${protocolType}://${host}/index.cgi?session=${sessionID}&config=423054e`).then(response => {
					if(variables.dump){
						logMessage(`▼ ▼ ▼ ▼ Dump ▼ ▼ ▼ ▼\n\n${response.body}`);
						logMessage(`▲ ▲ ▲ ▲ Dump ▲ ▲ ▲ ▲`);
					}
					var $ = cheerio.load(response.body);
					if(response.body.match(/Terminal is busy/)){
						logMessage(`Error [${macAddress}]: Terminal Busy`);
					}
					if(variables.verbose){
						logMessage(`Verbose - Page Title [${host}]:  ${$('title').text()}`);
					}
					if(variables.PhoneFirmware.hasOwnProperty(deviceInformation.hardwareVersion)){
						var firmwareName = variables.PhoneFirmware[deviceInformation.hardwareVersion].firmwareName;
					} else {
						var firmwareName = response.body.match(/(\w+.tgz)/)[0];
					}
					if(!variables.PhoneFirmware.hasOwnProperty(deviceInformation.hardwareVersion)){
						logMessage(`!EXCEPTION! [${macAddress}]: Device Series: ${deviceInformation.deviceSeries} | Hardware Version: ${deviceInformation.hardwareVersion} | Firmware Version: ${deviceInformation.firmwareVersion} | File Name: ${firmwareName}`);
					}
					if(variables.system.downloadAddress != undefined && variables.system.downloadAddress.length >= 7){
						let upgradeURI = `${protocolType}://${host}/index.cgi?session=${sessionID}&download=423054e&trans=${variables.system.downloadProtocol}&adr=${variables.system.downloadAddress}&type=ip&dir=firmware&file=${firmwareName}&name=&pass=`;
						if(variables.verbose){
							logMessage(`Verbose - URL Accessed [${macAddress}]: ${upgradeURI}`);
						}
						got(upgradeURI).then(response => {
							if(variables.debug){
								let endTimer = performance.now();
								logMessage(`Upgrade Function Time [${macAddress}]: ${miliToMinSec(endTimer - startTimer)}`);
								logMessage(`Debug - Session ID [${macAddress}]: ${sessionID}`);
							}
							callback(false, host, protocolType, sessionID, deviceInformation);
						})
						// ▼▼▼▼ Comment for testing uncomment for release ▼▼▼▼
						.catch(error => {
							logMessage(`ERROR-[${macAddress}]: ${upgradeURI} - ${error.name}`);
						});
						// ▲▲▲▲ Comment for testing uncomment for release ▲▲▲▲
					}
				})
				// ▼▼▼▼ Comment for testing uncomment for release ▼▼▼▼
				.catch(error => {
					logMessage(`${host} - ${error.name}`);
				});
				// ▲▲▲▲ Comment for testing uncomment for release ▲▲▲▲
			} else {
				let upgradeURI = ``
				if(variables.debug){
					logMessage(`Debug - URL Accessed [${macAddress}]: ${protocolType}://${host}/index.cgi?session=${sessionID}&config=42304b1`);
				}
				got(`${protocolType}://${host}/index.cgi?session=${sessionID}&config=42304b1`).then(response => {
					if(variables.dump){
						logMessage(`▼ ▼ ▼ ▼ Dump ▼ ▼ ▼ ▼\n\n${response.body}`);
						logMessage(`▲ ▲ ▲ ▲ Dump ▲ ▲ ▲ ▲`);
					}
					var $ = cheerio.load(response.body);
					if(response.body.match(/Terminal is busy/)){
						logMessage(`Terminal Busy`);
					}
					if(variables.verbose){
					logMessage(`Verbose - Page Title [${host}]: ${$('title').text()}`);
					}
					if(variables.PhoneFirmware.hasOwnProperty(deviceInformation.hardwareVersion)){
						var firmwareName = variables.PhoneFirmware[deviceInformation.hardwareVersion].firmwareName;
					} else {
						var firmwareName = response.body.match(/(\w+.tgz)/)[0];
					}
					if(!variables.PhoneFirmware.hasOwnProperty(deviceInformation.hardwareVersion)){
						logMessage(`!EXCEPTION! [${macAddress}]: Device Series: ${deviceInformation.deviceSeries} | Hardware Version: ${deviceInformation.hardwareVersion} | Firmware Version: ${deviceInformation.firmwareVersion} | File Name: ${firmwareName}`);
					}
					upgradeURI = `${protocolType}://${host}/index.cgi?session=${sessionID}&download=42304b1&trans=${variables.system.downloadProtocol}&adr=${variables.system.downloadAddress}&type=ip&dir=firmware&file=${firmwareName}&name=&pass=`;
					if(variables.debug){
						logMessage(`Debug - URL Accessed [${macAddress}]: ${upgradeURI}`);
					}
					if(variables.system.downloadAddress != undefined && variables.system.downloadAddress.length >= 7){
						if(variables.verbose){
							logMessage(`Upgrade Endpoint`);
						}
						if(variables.debug){
						logMessage(`Debug - URL Accessed: ${upgradeURI}`);
						}
						got(upgradeURI).then(response => {
							if(variables.debug){
								let endTimer = performance.now();
								logMessage(`Upgrade Function Time [${macAddress}]: ${miliToMinSec(endTimer - startTimer)}`);
								logMessage(`Debug - Session ID [${macAddress}]: ${sessionID}`);
							}
							callback(false, host, protocolType, sessionID, deviceInformation);
						})
						// ▼▼▼▼ Comment for testing uncomment for release ▼▼▼▼
						.catch(error => {
							logMessage(`ERROR-[${macAddress}]: ${upgradeURI} - ${error.name}`);
						});
						// ▲▲▲▲ Comment for testing uncomment for release ▲▲▲▲
					}
				})
				// ▼▼▼▼ Comment for testing uncomment for release ▼▼▼▼
				.catch(error => {
					logMessage(`ERROR-[${macAddress}]: ${upgradeURI} - ${error.name}`);
				});
				// ▲▲▲▲ Comment for testing uncomment for release ▲▲▲▲
			}
		}
	}
}


configureDevice = (host, protocolType, sessionID, deviceInformation, callback) => {
	if(variables.debug && deviceInformation != null){
		logMessage(`Debug - Configure Device Function [${deviceInformation.macAddress}]: configureDevice`);
	}
	if(variables.configFiles[deviceInformation.deviceSeries].length){
		if(variables.verbose){
			logMessage(`Debug - Configuration File [${deviceInformation.macAddress}]: Configuration file found`);
		}
		if(protocolType == `http`){
			if(variables.verbose){
				logMessage(`Verbose - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&download=4230467&trans=0&adr=${variables.system.downloadAddress}&type=ip&dir=config&file=${variables.configFiles[deviceInformation.deviceSeries]}&name=ADMIN&pass=6633222`);
			}
			got(`${protocolType}://${host}/index.cgi?session=${sessionID}&download=4230467&trans=0&adr=${variables.system.downloadAddress}&type=ip&dir=config&file=${variables.configFiles[deviceInformation.deviceSeries]}&name=ADMIN&pass=6633222`).then(response => {
				logMessage(`Configuration File [${deviceInformation.macAddress}]: Configuration done by configuration file`);
				callback(false, host, protocolType, sessionID, deviceInformation);
			})
			// ▼▼▼▼ Comment for testing uncomment for release ▼▼▼▼
			.catch(error => {
				logMessage(`ERROR-[${deviceInformation.macAddress}]: ${protocolType}://${host}/index.cgi?session=${sessionID}&download=4230467&trans=0&adr=${variables.system.downloadAddress}&type=ip&dir=config&file=${variables.configFiles[deviceInformation.deviceSeries]}&name=ADMIN&pass=6633222 - ${error.name}`);
				callback(true, host, protocolType, sessionID, deviceInformation);
			});
			// ▲▲▲▲ Comment for testing uncomment for release ▲▲▲▲
		} else {
			if(variables.verbose){
				logMessage(`Verbose - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&download=4230467&trans=2&adr=${variables.system.downloadAddress}&type=ip&dir=files/config&file=${variables.configFiles[deviceInformation.deviceSeries]}&name=&pass=`);
			}
			got(`${protocolType}://${host}/index.cgi?session=${sessionID}&download=4230467&trans=2&adr=${variables.system.downloadAddress}&type=ip&dir=files/config&file=${variables.configFiles[deviceInformation.deviceSeries]}&name=&pass=`).then(response => {
				logMessage(`Configuration File [${deviceInformation.macAddress}]: Configuration done by configuration file`);
				callback(false, host, protocolType, sessionID, deviceInformation);
			})
			// ▼▼▼▼ Comment for testing uncomment for release ▼▼▼▼
			.catch(error => {
				logMessage(`ERROR-[${host}]: ${protocolType}://${host}/index.cgi?session=${sessionID}&download=4230467&trans=2&adr=${variables.system.downloadAddress}&type=ip&dir=files/config&file=${variables.configFiles[deviceInformation.deviceSeries]}&name=&pass= - ${error.name}`);
				callback(true, host, protocolType, sessionID, deviceInformation);
			});
			// ▲▲▲▲ Comment for testing uncomment for release ▲▲▲▲
		}
	} else {
		logMessage(`Configuration File [${deviceInformation.macAddress}]: No configuration file found. Running manual configuration.`);
		callback(false, host, protocolType, sessionID, deviceInformation);
	}
}


loadArgsFromEnv = (callback) => {
	// Load arguments from .env file
	if(variables.verbose){
		logMessage(`Verbose - Loading arguments from .env file`);
	}

	// Phone Tool Settings
	if(process.env.skipUpgrade.length && process.env.skipUpgrade.match(/true/i)){
		variables.system.skipUpgrade = true;
		if(variables.verbose){
			logMessage(`Verbose - Skipping upgrade`);
		}
		if(variables.debug){
			logMessage(`Debug - variables.system.skipUpgrade = ${variables.system.skipUpgrade}`);
		}
	}
	if(process.env.adminPassword.length){
		variables.auth.adminPassword = process.env.adminPassword;
		if(variables.verbose){
			logMessage(`Verbose - Using specific admin password`);
		}
		if(variables.debug){
			logMessage(`Debug - variables.auth.adminPassword = ${variables.auth.adminPassword}`);
		}
	}


	// Network Settings
	if(process.env.dhcp.length){
		variables.setDataTypes[`NetworkSettings.DHCPMode`] = `itemOnly`;
		if(process.env.dhcp.match(/true|enable/)){
			variables.actions.push(`NetworkSettings.DHCPMode`);
			variables.NetworkSettings.DHCPMode = 1;
			if(variables.verbose){
				logMessage(`Verbose - Enable DHCP`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.NetworkSettings.DHCPMode = ${variables.NetworkSettings.DHCPMode}`);
			}
		} else if(process.env.dhcp.match(/false|disable/)) {
			variables.actions.push(`NetworkSettings.DHCPMode`);
			variables.NetworkSettings.DHCPMode = 0;
			if(variables.verbose){
				logMessage(`Verbose - Disable DHCP`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.NetworkSettings.DHCPMode = ${variables.NetworkSettings.DHCPMode}`);
			}
		}
	}
	if(process.env.ipAddress.length){
		variables.setDataTypes[`NetworkSettings.IPAddres`] = `ip`;
		if(require(`net`).isIP(process.env.ipAddress)){
			variables.actions.push(`NetworkSettings.IPAddress`);
			variables.NetworkSettings.IPAddress = process.env.ipAddress;
			if(variables.verbose){
				logMessage(`Verbose - Set IP address`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.NetworkSettings.IPAddress = ${variables.NetworkSettings.IPAddress}`);
			}
		}
	}
	if(process.env.defaultGateway.length){
		variables.setDataTypes[`NetworkSettings.DefaultGateway`] = `ip`;
		if(require(`net`).isIP(process.env.defaultGateway)){
			variables.actions.push(`NetworkSettings.DefaultGateway`);
			variables.NetworkSettings.DefaultGateway = process.env.defaultGateway;
			if(variables.verbose){
				logMessage(`Verbose - Set Default Gateway`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.NetworkSettings.DefaultGateway = ${variables.NetworkSettings.DefaultGateway}`);
			}
		}
	}
	if(process.env.subnetMask.length){
		variables.setDataTypes[`NetworkSettings.SubnetMask`] = `ip`;
		if(require(`net`).isIP(process.env.subnetMask)){
			variables.actions.push(`NetworkSettings.SubnetMask`);
			variables.NetworkSettings.SubnetMask = process.env.subnetMask;
			if(variables.verbose){
				logMessage(`Verbose - Set Subnet Mask`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.NetworkSettings.SubnetMask = ${variables.NetworkSettings.SubnetMask}`);
			}
		}
	}
	if(process.env.dnsAddress.length){
		variables.setDataTypes[`NetworkSettings.DNSAddress`] = `ip`;
		if(require(`net`).isIP(process.env.dnsAddress)){
			variables.actions.push(`NetworkSettings.DNSAddress`);
			variables.NetworkSettings.DNSAddress = process.env.dnsAddress;
			if(variables.verbose){
				logMessage(`Verbose - Set DNS Address`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.NetworkSettings.DNSAddress = ${variables.NetworkSettings.DNSAddress}`);
			}
		}
	}

	 // Network Settings > Advanced Settings  > LAN Port Settings
	 if(process.env.lanPortVlanMode.length){
 		variables.setDataTypes[`LANPortSettings.VLANMode`] = `itemOnly`;
	 	if(process.env.lanPortVlanMode.match(/true|enable/)){
	 		variables.actions.push(`LANPortSettings.VLANMode`);
	 		variables.LANPortSettings.VLANMode = 1;
			if(variables.verbose){
				logMessage(`Verbose - Disable LAN VLAN`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LANPortSettings.VLANMode = ${variables.LANPortSettings.VLANMode}`);
			}
	 	} else if(process.env.lanPortVlanMode.match(/false|disable/)){
	 		variables.actions.push(`LANPortSettings.VLANMode`);
	 		variables.LANPortSettings.VLANMode = 0;
			if(variables.verbose){
				logMessage(`Verbose - Enable LAN VLAN`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LANPortSettings.VLANMode = ${variables.LANPortSettings.VLANMode}`);
			}
	 	}
	 }
	 if(process.env.lanPortVlanId.length){
 		variables.setDataTypes[`LANPortSettings.VLANID`] = `itemOnly`;
	 	if(parseInt(process.env.lanPortVlanId) >= 0 && parseInt(process.env.lanPortVlanId) < 4095){
	 		variables.actions.push(`LANPortSettings.VLANID`);
	 		variables.LANPortSettings.VLANID = parseInt(process.env.lanPortVlanId);
			if(variables.verbose){
				logMessage(`Verbose - Set LAN VLAN ID`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LANPortSettings.VLANID = ${variables.LANPortSettings.VLANID}`);
			}
	 	}
	 }
	 if(process.env.lanPortVlanPriority.length){
 		variables.setDataTypes[`LANPortSettings.VLANPriority`] = `itemOnly`;
	 	if(parseInt(process.env.lanPortVlanPriority) >= 0 && parseInt(process.env.lanPortVlanPriority) < 8){
	 		variables.actions.push(`LANPortSettings.VLANPriority`);
	 		variables.LANPortSettings.VLANPriority = parseInt(process.env.lanPortVlanPriority);
			if(variables.verbose){
				logMessage(`Verbose - Set LAN VLAN Priority`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LANPortSettings.VLANPriority = ${variables.LANPortSettings.VLANPriority}`);
			}
	 	}
	 }

	 // Network Settings > Advanced Settings  > PC Port Settings
	 if(process.env.pcPortVlanMode.length){
 		variables.setDataTypes[`PCPortSettings.PortVLANMode`] = `itemOnly`;
	 	if(process.env.pcPortVlanMode.match(/true|enable/)){
	 		variables.actions.push(`PCPortSettings.PortVLANMode`);
	 		variables.PCPortSettings.PortVLANMode = 1;
			if(variables.verbose){
				logMessage(`Verbose - Enable PC VLAN`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.PCPortSettings.PortVLANMode = ${variables.PCPortSettings.PortVLANMode}`);
			}
	 	} else if(process.env.pcPortVlanMode.match(/false|disable/)){
	 		variables.actions.push(`PCPortSettings.PortVLANMode`);
	 		variables.PCPortSettings.PortVLANMode = 0;
			if(variables.verbose){
				logMessage(`Verbose - Disable PC VLAN`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.PCPortSettings.PortVLANMode = ${variables.PCPortSettings.PortVLANMode}`);
			}
	 	}
	 }
	 if(process.env.pcPortVlanId.length){
 		variables.setDataTypes[`PCPortSettings.PortVLANID`] = `itemOnly`;
	 	if(parseInt(process.env.pcPortVlanId) >= 0 && parseInt(process.env.pcPortVlanId) < 4095){
	 				variables.actions.push(`PCPortSettings.PortVLANID`);
	 				variables.PCPortSettings.PortVLANID = parseInt(process.env.pcPortVlanId);
					if(variables.verbose){
						logMessage(`Verbose - Set PC VLAN ID`);
					}
					if(variables.debug){
						logMessage(`Debug - variables.PCPortSettings.PortVLANID = ${variables.PCPortSettings.PortVLANID}`);
					}
	 			}
	 }
	 if(process.env.pcPortVlanPriority.length){
 		variables.setDataTypes[`PCPortSettings.PortVLANPriority`] = `itemOnly`;
	 	if(parseInt(process.env.pcPortVlanPriority) >= 0 && parseInt(process.env.pcPortVlanPriority) < 8){
	 		variables.actions.push(`PCPortSettings.PortVLANPriority`);
	 		variables.PCPortSettings.PortVLANPriority = parseInt(process.env.pcPortVlanPriority);
			if(variables.verbose){
				logMessage(`Verbose - Set PC VLAN Priority`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.PCPortSettings.PortVLANPriority = ${variables.PCPortSettings.PortVLANPriority}`);
			}
	 	}
	 }
	 if(process.env.pcPortAvailable.length){
 		variables.setDataTypes[`PCPortSettings.PortAvailable`] = `itemOnly`;
	 	if(process.env.pcPortAvailable.match(/true|auto/)){
	 				variables.actions.push(`PCPortSettings.PortAvailable`);
	 				variables.PCPortSettings.PortAvailable = 0;
					if(variables.verbose){
						logMessage(`Verbose - Enable PC Port`);
					}
					if(variables.debug){
						logMessage(`Debug - variables.PCPortSettings.PortAvailable = ${variables.PCPortSettings.PortAvailable}`);
					}
	 			} else if(process.env.pcPortAvailable.match(/false|disable/)){
	 				variables.actions.push(`PCPortSettings.PortAvailable`);
	 				variables.PCPortSettings.PortAvailable = 1;
					if(variables.verbose){
						logMessage(`Verbose - Disable PC Port`);
					}
					if(variables.debug){
						logMessage(`Debug - variables.PCPortSettings.PortAvailable = ${variables.PCPortSettings.PortAvailable}`);
					}
	 			}
	 }
	 if(process.env.pcPortSecurity.length){
 		variables.setDataTypes[`PCPortSettings.PCPortSecurity`] = `itemOnly`;
	 	if(process.env.pcPortSecurity.match(/true|enable/)){
	 				variables.actions.push(`PCPortSettings.PCPortSecurity`);
	 				variables.PCPortSettings.PCPortSecurity = 1;
					if(variables.verbose){
						logMessage(`Verbose - Enable PC Port Security`);
					}
					if(variables.debug){
						logMessage(`Debug - variables.PCPortSettings.PCPortSecurity = ${variables.PCPortSettings.PCPortSecurity}`);
					}
	 			} else if(process.env.pcPortSecurity.match(/false|disable/)){
	 				variables.actions.push(`PCPortSettings.PCPortSecurity`);
	 				variables.PCPortSettings.PCPortSecurity = 0;
					if(variables.verbose){
						logMessage(`Verbose - Disable PC Port Security`);
					}
					if(variables.debug){
						logMessage(`Debug - variables.PCPortSettings.PCPortSecurity = ${variables.PCPortSettings.PCPortSecurity}`);
					}
	 			}
	 }

	// Network Settings > Advanced Settings > LLDP Setting
	if(process.env.lldp.length){
		variables.setDataTypes[`LLDPSettings.LLDPMode`] = `itemOnly`;
		if(process.env.lldp.match(/true|enable/)){
			variables.LLDPSettings.LLDPMode = 1;
			variables.actions.push(`LLDPSettings.LLDPMode`);
			if(variables.verbose){
				logMessage(`Verbose - Enable LLDP`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LLDPSettings.LLDPMode = ${variables.LLDPSettings.LLDPMode}`);
			}
		} else if(process.env.lldp.match(/false|disable/)) {
			variables.LLDPSettings.LLDPMode = 0;
			variables.actions.push(`LLDPSettings.LLDPMode`);
			if(variables.verbose){
				logMessage(`Verbose - Disable LLDP`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LLDPSettings.LLDPMode = ${variables.LLDPSettings.LLDPMode}`);
			}
		}
	}

	// Network Settings > Advanced Settings > Spare IP Settings
	if(process.env.spareBackupMode.length){
		variables.setDataTypes[`SpareIPSettings.SpareBackupIPMode`] = `itemOnly`;
		if(process.env.spareBackupMode.match(/false|disable/)){
			variables.actions.push(`SpareIPSettings.SpareBackupIPMode`);
			variables.SpareIPSettings.SpareBackupIPMode = 0;
			if(variables.verbose){
				logMessage(`Verbose - Disable Spare/Backup IP`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.SpareIPSettings.SpareBackupIPMode = ${variables.SpareIPSettings.SpareBackupIPMode}`);
			}
		} else if(process.env.spareBackupMode.match(/spare/)){
			variables.actions.push(`SpareIPSettings.SpareBackupIPMode`);
			variables.SpareIPSettings.SpareBackupIPMode = 1;
			if(variables.verbose){
				logMessage(`Verbose - Enable Spare IP`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.SpareIPSettings.SpareBackupIPMode = ${variables.SpareIPSettings.SpareBackupIPMode}`);
			}
		} else if(process.env.spareBackupMode.match(/backup/)){
			variables.actions.push(`SpareIPSettings.SpareBackupIPMode`);
			variables.SpareIPSettings.SpareBackupIPMode = 2;
			if(variables.verbose){
				logMessage(`Verbose - Enable Backup IP`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.SpareIPSettings.SpareBackupIPMode = ${variables.SpareIPSettings.SpareBackupIPMode}`);
			}
		}
	}


// SIP Settings > Server Address & URI
	if(process.env.sipServer1.length){
		variables.setDataTypes[`ServerAddressURI.1stServerAddress`] = `ip`;
		variables.setDataTypes[`SIPServerPort.1stServerPort`] = `itemOnly`;
		variables.ServerAddressURI[`1stServerAddress`] = process.env.sipServer1.split(`:`)[0];
		if(process.env.sipServer1.split(`:`)[1] == undefined){
			variables.SIPServerPort[`1stServerPort`] = 5060;
		} else {
			variables.SIPServerPort[`1stServerPort`] = process.env.sipServer1.split(`:`)[1];
		}
		if(require(`net`).isIP(variables.ServerAddressURI[`1stServerAddress`]) && parseInt(process.env.sipServer1.split(`:`)[1]) >= 1024 && parseInt(process.env.sipServer1.split(`:`)[1]) <= 65535){
			variables.actions.push(`ServerAddressURI.1stServerAddress`);
			variables.actions.push(`SIPServerPort.1stServerPort`);
			if(variables.verbose){
				logMessage(`Verbose - Set SIP Server 1`);
			}
		}
		if(variables.debug){
			logMessage(`Debug - variables.ServerAddressURI.1stServerAddress = ${variables.ServerAddressURI[`1stServerAddress`]}`);
			logMessage(`Debug - variables.SIPServerPort.1stServerPort = ${variables.SIPServerPort[`1stServerPort`]}`);
		}
	}
	if(process.env.sipServer2.length){
		variables.setDataTypes[`ServerAddressURI.2ndServerAddress`] = `ip`;
		variables.setDataTypes[`SIPServerPort.2ndServerPort`] = `itemOnly`;
		variables.ServerAddressURI[`2ndServerAddress`] = process.env.sipServer2.split(`:`)[0];
		if(process.env.sipServer2.split(`:`)[1] == undefined){
			variables.SIPServerPort[`2ndServerPort`] = 5060;
		} else {
			variables.SIPServerPort[`2ndServerPort`] = process.env.sipServer2.split(`:`)[1];
		}
		if(require(`net`).isIP(variables.ServerAddressURI[`2ndServerAddress`]) && parseInt(process.env.sipServer2.split(`:`)[1]) >= 1024 && parseInt(process.env.sipServer2.split(`:`)[1]) <= 65535){
			variables.actions.push(`ServerAddressURI.2ndServerAddress`);
			variables.actions.push(`SIPServerPort.2ndServerPort`);
			if(variables.verbose){
				logMessage(`Verbose - Set SIP Server 2`);
			}
		}
		if(variables.debug){
			logMessage(`Debug - variables.ServerAddressURI.2ndServerAddress = ${variables.ServerAddressURI[`2ndServerAddress`]}`)
			logMessage(`Debug - variables.SIPServerPort.2ndServerPort = ${variables.SIPServerPort[`2ndServerPort`]}`);
		}
	}
	if(process.env.sipServer3.length){
		variables.setDataTypes[`ServerAddressURI.3rdServerAddress`] = `ip`;
		variables.setDataTypes[`SIPServerPort.3rdServerPort`] = `itemOnly`;
		variables.ServerAddressURI[`3rdServerAddress`] = process.env.sipServer3.split(`:`)[0];
		if(process.env.sipServer3.split(`:`)[1] == undefined){
			variables.SIPServerPort[`3rdServerPort`] = 5060;
		} else {
			variables.SIPServerPort[`3rdServerPort`] = process.env.sipServer3.split(`:`)[1];
		}
		if(require(`net`).isIP(variables.ServerAddressURI[`3rdServerAddress`]) && parseInt(process.env.sipServer3.split(`:`)[1]) >= 1024 && parseInt(process.env.sipServer3.split(`:`)[1]) <= 65535){
			variables.actions.push(`ServerAddressURI.3rdServerAddress`);
			variables.actions.push(`SIPServerPort.3rdServerPort`);
			if(variables.verbose){
				logMessage(`Verbose - Set SIP Server 3`);
			}
		}
		if(variables.debug){
			logMessage(`Debug - variables.ServerAddressURI.3rdServerAddress = ${variables.ServerAddressURI[`3rdServerAddress`]}`)
			logMessage(`Debug - variables.SIPServerPort.3rdServerPort = ${variables.SIPServerPort[`3rdServerPort`]}`);
		}
	}
	if(process.env.sipServer4.length){
		variables.setDataTypes[`ServerAddressURI.4thServerAddress`] = `ip`;
		variables.setDataTypes[`SIPServerPort.4thServerPort`] = `itemOnly`;
		variables.ServerAddressURI[`4thServerAddress`] = process.env.sipServer4.split(`:`)[0];
		if(process.env.sipServer4.split(`:`)[1] == undefined){
			variables.SIPServerPort[`4thServerPort`] = 5060;
		} else {
			variables.SIPServerPort[`4thServerPort`] = process.env.sipServer4.split(`:`)[1];
		}
		if(require(`net`).isIP(variables.ServerAddressURI[`4thServerAddress`]) && parseInt(process.env.sipServer4.split(`:`)[1]) >= 1024 && parseInt(process.env.sipServer4.split(`:`)[1]) <= 65535){
			variables.actions.push(`ServerAddressURI.4thServerAddress`);
			variables.actions.push(`SIPServerPort.4thServerPort`);
			if(variables.verbose){
				logMessage(`Verbose - Set SIP Server 4`);
			}
		}
		if(variables.debug){
			logMessage(`Debug - variables.ServerAddressURI.4thServerAddress = ${variables.ServerAddressURI[`4thServerAddress`]}`)
			logMessage(`Debug - variables.SIPServerPort.4thServerPort = ${variables.SIPServerPort[`4thServerPort`]}`);
		}
	}

	// SIP Settings > Encryption
	if(process.env.encryptionAuthMode.length){
		variables.setDataTypes[`Encryption.AuthenticationMode`] = `itemOnly`;
		if(process.env.encryptionAuthMode.match(/true|enable/i)){
			variables.Encryption.AuthenticationMode = 1;
			variables.actions.push(`Encryption.AuthenticationMode`);
			if(variables.verbose){
				logMessage(`Verbose - Enable Encryption`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.Encryption.AuthenticationMode = ${variables.Encryption.AuthenticationMode}`)
			}
		} else if(process.env.encryptionAuthMode.match(/false|disable/i)){
			variables.Encryption.AuthenticationMode = 0;
			variables.actions.push(`Encryption.AuthenticationMode`);
			if(variables.verbose){
				logMessage(`Verbose - Disable Encryption`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.Encryption.AuthenticationMode = ${variables.Encryption.AuthenticationMode}`)
			}
		}
	}
	if(process.env.oneTimePassword.length){
		variables.setDataTypes[`Encryption.OneTimePassword`] = `itemOnly`;
		variables.Encryption.OneTimePassword = process.env.oneTimePassword;
		variables.actions.push(`Encryption.OneTimePassword`);
		if(variables.verbose){
			logMessage(`Verbose - Set Encryption OTP`);
		}
		if(variables.debug){
			logMessage(`Debug - variables.Encryption.OneTimePassword = ${variables.Encryption.OneTimePassword}`)
		}
	}

	// Security Settings > Push Server > Client IP Address
	if(process.env.pushServer1.length){
		variables.setDataTypes[`ClientIPAddress.Client1`] = `ip`;
		if(require(`net`).isIP(process.env.pushServer1)){
			variables.actions.push(`ClientIPAddress.Client1`);
			variables.ClientIPAddress.Client1 = process.env.pushServer1;
			if(variables.verbose){
				logMessage(`Verbose - Set Push Server 1`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.ClientIPAddress.Client1 = ${variables.ClientIPAddress.Client1}`)
			}
		}
	}
	if(process.env.pushServer2.length){
		variables.setDataTypes[`ClientIPAddress.Client2`] = `ip`;
		if(require(`net`).isIP(process.env.pushServer2)){
			variables.actions.push(`ClientIPAddress.Client2`);
			variables.ClientIPAddress.Client2 = process.env.pushServer2;
			if(variables.verbose){
				logMessage(`Verbose - Set Push Server 2`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.ClientIPAddress.Client2 = ${variables.ClientIPAddress.Client2}`)
			}
		}
	}
	if(process.env.pushServer3.length){
		variables.setDataTypes[`ClientIPAddress.Client3`] = `ip`;
		if(require(`net`).isIP(process.env.pushServer3)){
			variables.actions.push(`ClientIPAddress.Client3`);
			variables.ClientIPAddress.Client3 = process.env.pushServer3;
			if(variables.verbose){
				logMessage(`Verbose - Set Push Server 3`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.ClientIPAddress.Client3 = ${variables.ClientIPAddress.Client3}`)
			}
		}
	}
	if(process.env.pushServer4.length){
		variables.setDataTypes[`ClientIPAddress.Client4`] = `ip`;
		if(require(`net`).isIP(process.env.pushServer4)){
			variables.actions.push(`ClientIPAddress.Client4`);
			variables.ClientIPAddress.Client4 = process.env.pushServer4;
			if(variables.verbose){
				logMessage(`Verbose - Set Push Server 4`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.ClientIPAddress.Client4 = ${variables.ClientIPAddress.Client4}`)
			}
		}
	}

	//Security Settings > Admin Password
	if(process.env.newPassword.length){
		variables.setDataTypes[`ClientIPAddress.AdminPassword`] = `2xDupeItems`;
		variables.ClientIPAddress.AdminPassword = process.env.newPassword;
		variables.actions.push(`ClientIPAddress.AdminPassword`);
		if(variables.verbose){
			logMessage(`Verbose - Set New Admin Password`);
		}
		if(variables.debug){
			logMessage(`Debug - variables.ClientIPAddress.AdminPassword = ${variables.ClientIPAddress.AdminPassword}`)
		}
	}

	// Security Settings > 802.1x Supplicant
	if(process.env.eapSupplicant.length){
		variables.setDataTypes[`8021XSupplicant.Supplicant`] = `itemOnly`;
		if(process.env.eapSupplicant.match(/disable/i)){
			variables[`8021XSupplicant`].Supplicant = 0;
			variables.actions.push(`8021XSupplicant.Supplicant`);
			if(variables.verbose){
				logMessage(`Verbose - Enable EAP Supplicant`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.8021XSupplicant.Supplicant = ${variables[`8021XSupplicant`].Supplicant}`)
			}
		} else if(process.env.eapSupplicant.match(/enable/i)){
			variables[`8021XSupplicant`].Supplicant = 1;
			variables.actions.push(`8021XSupplicant.Supplicant`);
			if(variables.verbose){
				logMessage(`Verbose - Enable EAP Supplicant`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.8021XSupplicant.Supplicant = ${variables[`8021XSupplicant`].Supplicant}`)
			}
		}
	}


	// Application Settings > Directory URL
	if(process.env.xmlDirectoryURI.length){
		variables.setDataTypes[`ProxySettings.DirectoryURL`] = `itemOnly`;
		variables.actions.push(`ProxySettings.DirectoryURL`);
		variables.ProxySettings.DirectoryURL  = encodeURI(process.env.xmlDirectoryURI);
		if(variables.verbose){
			logMessage(`Verbose - Set XML Directory URI`);
		}
		if(variables.debug){
			logMessage(`Debug - variables.ProxySettings.DirectoryURL = ${variables.ProxySettings.DirectoryURL}`)
		}
	}

	// Application Settings > Menu Key Mode
	if(process.env.menuKeyMode.length){
		variables.setDataTypes[`Popup.MenuKeyMode`] = `itemOnly`;
		if(process.env.menuKeyMode.match(/true|enable/i)){
			variables.Popup.MenuKeyMode = 1;
			variables.actions.push(`Popup.MenuKeyMode`);
			if(variables.verbose){
				logMessage(`Verbose - Enable Menu Key Mode`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.Popup.MenuKeyMode = ${variables.Popup.MenuKeyMode}`)
			}
		} else if(process.env.menuKeyMode.match(/false|disable/i)){
			variables.Popup.MenuKeyMode = 0;
			variables.actions.push(`Popup.MenuKeyMode`);
			if(variables.verbose){
				logMessage(`Verbose - Disable Menu Key Mode`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.Popup.MenuKeyMode = ${variables.Popup.MenuKeyMode}`)
			}
		}
	}

	// Application Settings > Voice Rec Settings
	if(process.env.voiceRecording.length){
		variables.setDataTypes[`VoiceRecSettings.VoiceRecording`] = `itemOnly`;
		if(process.env.voiceRecording.match(/automatic/i)){
			variables.VoiceRecSettings.VoiceRecording = 0;
			variables.actions.push(`VoiceRecSettings.VoiceRecording`);
			if(variables.verbose){
				logMessage(`Verbose - Automatic Voice Recording`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.VoiceRecSettings.VoiceRecording = ${variables.VoiceRecSettings.VoiceRecording}`)
			}
		} else if(process.env.voiceRecording.match(/disable/i)){
			variables.VoiceRecSettings.VoiceRecording = 1;
			variables.actions.push(`VoiceRecSettings.VoiceRecording`);
			if(variables.verbose){
				logMessage(`Verbose - Disable Voice Recording`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.VoiceRecSettings.VoiceRecording = ${variables.VoiceRecSettings.VoiceRecording}`)
			}
		}
	}
	if(process.env.recordingMode.length){
		variables.setDataTypes[`VoiceRecSettings.RecordingMode`] = `itemOnly`;
		if(process.env.recordingMode.match(/static/i)){
			variables.VoiceRecSettings.RecordingMode = 0;
			variables.actions.push(`VoiceRecSettings.RecordingMode`);
			if(variables.verbose){
				logMessage(`Verbose - Static Recording Mode`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.VoiceRecSettings.RecordingMode = ${variables.VoiceRecSettings.RecordingMode}`)
			}
		} else if(process.env.recordingMode.match(/dynamic/i)){
			variables.VoiceRecSettings.RecordingMode = 1;
			variables.actions.push(`VoiceRecSettings.RecordingMode`);
			if(variables.verbose){
				logMessage(`Verbose - Dynamic Recording Mode`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.VoiceRecSettings.RecordingMode = ${variables.VoiceRecSettings.RecordingMode}`)
			}
		}
	}
	if(process.env.recordingSegments.length){
		variables.setDataTypes[`VoiceRecSettings.RecSegments`] = `itemOnly`;
		if(process.env.recordingSegments.match(/all/i)){
			variables.VoiceRecSettings.RecSegments = 0;
			variables.actions.push(`VoiceRecSettings.RecSegments`);
			if(variables.verbose){
				logMessage(`Verbose - All Recording Segments`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.VoiceRecSettings.RecSegments = ${variables.VoiceRecSettings.RecSegments}`)
			}
		} else if(process.env.recordingSegments.match(/talk/i)){
			variables.VoiceRecSettings.RecSegments = 1;
			variables.actions.push(`VoiceRecSettings.RecSegments`);
			if(variables.verbose){
				logMessage(`Verbose - Talk Only Recording Segments`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.VoiceRecSettings.RecSegments = ${variables.VoiceRecSettings.RecSegments}`)
			}
		}
	}
	if(process.env.autoRecordStart.length){
		variables.setDataTypes[`VoiceRecSettings.AutoRecStart`] = `itemOnly`;
		if(process.env.autoRecordStart.match(/false|disable/i)){
			variables.VoiceRecSettings.AutoRecStart = 0;
			variables.actions.push(`VoiceRecSettings.AutoRecStart`);
			if(variables.verbose){
				logMessage(`Verbose - Disable Auto Record Start`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.VoiceRecSettings.AutoRecStart = ${variables.VoiceRecSettings.AutoRecStart}`)
			}
		} else if(process.env.autoRecordStart.match(/true|enable/i)){
			variables.VoiceRecSettings.AutoRecStart = 1;
			variables.actions.push(`VoiceRecSettings.AutoRecStart`);
			if(variables.verbose){
				logMessage(`Verbose - Enable Auto Record Start`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.VoiceRecSettings.AutoRecStart = ${variables.VoiceRecSettings.AutoRecStart}`)
			}
		}
	}
	if(process.env.recordToneLevel.length){
		variables.setDataTypes[`VoiceRecSettings.RecToneLevel`] = `itemOnly`;
		if(parseInt(process.env.recordToneLevel) >= 0 && parseInt(process.env.recordToneLevel) <= 48){
			variables.VoiceRecSettings.RecToneLevel = parseInt(process.env.recordToneLevel);
			variables.actions.push(`VoiceRecSettings.RecToneLevel`);
			if(variables.verbose){
				logMessage(`Verbose - Set Record Tone Level`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.VoiceRecSettings.RecToneLevel = ${variables.VoiceRecSettings.RecToneLevel}`)
			}
		}
	}
	if(process.env.recordingIcon.length){
		variables.setDataTypes[`VoiceRecSettings.RecIcon`] = `itemOnly`;
		if(process.env.recordingIcon.match(/false|disable/i)){
			variables.VoiceRecSettings.RecIcon = 0;
			variables.actions.push(`VoiceRecSettings.RecIcon`);
			if(variables.verbose){
				logMessage(`Verbose - Disable Recording Icon`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.VoiceRecSettings.RecIcon = ${variables.VoiceRecSettings.RecIcon}`)
			}
		} else if(process.env.recordingIcon.match(/true|enable/i)){
			variables.VoiceRecSettings.RecIcon = 1;
			variables.actions.push(`VoiceRecSettings.RecIcon`);
			if(variables.verbose){
				logMessage(`Verbose - Enable Recording Icon`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.VoiceRecSettings.RecIcon = ${variables.VoiceRecSettings.RecIcon}`)
			}
		}
	}

	//Application Settings > Voice Rec Settings > Rec Server Settings > 1st Server Settings
	if(process.env.recordingServerOneIpAddress.length){
		variables.setDataTypes[`1stServerSettings.IPAddress`] = `ip`;
		if(require(`net`).isIP(process.env.recordingServerOneIpAddress)){
			variables.actions.push(`1stServerSettings.IPAddress`);
			variables[`1stServerSettings`].IPAddress = process.env.recordingServerOneIpAddress;
			if(variables.verbose){
				logMessage(`Verbose - Set Record Server 1 IP Address`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.1stServerSettings.IPAddress = ${variables[`1stServerSettings`].IPAddress}`)
			}
		}
	}


	// License Settings > License Method
	if(process.env.licenseServerType.length){
		variables.setDataTypes[`LicenseSettings.LicenseMethod`] = `itemOnly`;
		if(process.env.licenseServerType.match(/tcp|server/i)){
			variables.actions.push(`LicenseSettings.LicenseMethod`);
			variables.LicenseSettings.LicenseMethod = 1;
			if(variables.verbose){
				logMessage(`Verbose - Set TCP License Method`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LicenseSettings.LicenseMethod = ${variables.LicenseSettings.LicenseMethod}`)
			}
		} else if(process.env.licenseServerType.match(/sip|pbx/i)) {
			variables.actions.push(`LicenseSettings.LicenseMethod`);
			variables.LicenseSettings.LicenseMethod = 0;
			if(variables.verbose){
				logMessage(`Verbose - Set SIP License Method`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LicenseSettings.LicenseMethod = ${variables.LicenseSettings.LicenseMethod}`)
			}
		}
	}

	// TCP License Settings > License Server Settings
	if(process.env.licenseServerIP.length){
		variables.setDataTypes[`LicenseServerSettings.ServerAddress`] = `ip`;
		if(require(`net`).isIP(process.env.licenseServerIP)){
		variables.actions.push(`LicenseServerSettings.ServerAddress`);
			variables.LicenseServerSettings.ServerAddress = process.env.licenseServerIP;
			if(variables.verbose){
				logMessage(`Verbose - Set License Server IP Address`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LicenseServerSettings.ServerAddress = ${variables.LicenseServerSettings.ServerAddress}`)
			}
		}
	}

	// TCP License Settings > License Request
	if(process.env.gigabitEthernet.length){
		variables.setDataTypes[`LicenseRequest.GigabitEthernet`] = `itemOnly`;
		if(process.env.gigabitEthernet.match(/true|enable/i)){
			variables.LicenseRequest.GigabitEthernet = 1;
			variables.actions.push(`LicenseRequest.GigabitEthernet`);
			if(variables.verbose){
				logMessage(`Verbose - Enable Gigabit Ethernet`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LicenseRequest.GigabitEthernet = ${variables.LicenseRequest.GigabitEthernet}`)
			}
		} else if(process.env.gigabitEthernet.match(/false|disable/i)){
			variables.LicenseRequest.GigabitEthernet = 0;
			variables.actions.push(`LicenseRequest.GigabitEthernet`);
			if(variables.verbose){
				logMessage(`Verbose - Disable Gigabit Ethernet`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LicenseRequest.GigabitEthernet = ${variables.LicenseRequest.GigabitEthernet}`)
			}
		}
	}
	if(process.env.lineKeys.length){
		variables.setDataTypes[`LicenseRequest.LineKey`] = `itemOnly`;
		if(process.env.lineKeys == `32`){
			variables.LicenseRequest.LineKey = 2;
			variables.actions.push(`LicenseRequest.LineKey`);
			if(variables.verbose){
				logMessage(`Verbose - Set 32 Line Keys`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LicenseRequest.LineKey = ${variables.LicenseRequest.LineKey}`)
			}
		} else if(process.env.lineKeys == `16`){
			variables.LicenseRequest.LineKey = 1;
			variables.actions.push(`LicenseRequest.LineKey`);
			if(variables.verbose){
				logMessage(`Verbose - Set 16 Line Keys`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LicenseRequest.LineKey = ${variables.LicenseRequest.LineKey}`)
			}
		} else if(process.env.lineKeys == `8`){
			variables.LicenseRequest.LineKey = 0;
			variables.actions.push(`LicenseRequest.LineKey`);
			if(variables.verbose){
				logMessage(`Verbose - Set 8 Line Keys`);
			}
			if(variables.debug){
				logMessage(`Debug - variables.LicenseRequest.LineKey = ${variables.LicenseRequest.LineKey}`)
			}
		}
	}
	cleanupDirectory(`./files/firmware/temp`, () => {
			callback(true);
	});
}


checkConfigFiles = (callback) => {
	try {
		if(process.env.dt700ConfigFile.length){
			let dt700File = fs.readFileSync(`./files/config/${process.env.dt700ConfigFile}`);
			variables.configFiles.DT700 = `${process.env.dt700ConfigFile}`;
		}
	} catch {
		logMessage(`DT700 Configuration File - ${process.env.ignoreFileName} - Not found`);
	}
	try {
		if(process.env.dt800ConfigFile.length){
			let dt800File = fs.readFileSync(`./files/config/${process.env.dt800ConfigFile}`);
			variables.configFiles.DT800 = `${process.env.dt800ConfigFile}`;
		}
	} catch {
		logMessage(`DT800 Configuration File - ${process.env.ignoreFileName} - Not found`);
	}
	try {
		if(process.env.dt900ConfigFile.length){
			let dt900File = fs.readFileSync(`./files/config/${process.env.dt900ConfigFile}`);
			variables.configFiles.DT900 = `${process.env.dt900ConfigFile}`;
		}
	} catch {
		logMessage(`DT900 Configuration File - ${process.env.ignoreFileName} - Not found`);
	}
	finally {
		callback();
	}
}

startFtpServer = () => {
	logMessage(`Starting FTP Server`);
	// FTP Server events.
	const ftpServer = require(`simple-ftpd`);
	try {
		ftpServer({ host: variables.system.downloadAddress, port: 21, root: `files` }, (session) => {
			session.on(`pass`, (username, password, cb) => {
			if (username === `ADMIN` && password === `6633222`) {
			  session.readOnly = true,
			  session.root = `files`
			  cb(null, `Welcome admin`);
			} else {
			  cb(null, `Welcome guest`);
			}
			});
			session.on(`stat`, fs.stat);
			session.on(`readdir`, fs.readdir);
			session.on(`read`, (pathName, offset, cb) => {
			cb(null, fs.createReadStream(pathName, { start: offset }))
			})
		});
	} catch {
		logMessage(`Error starting FTP server`);
	}
}

startTftpServer = () => {
	logMessage(`Starting TFTP Server`);
	if(variables.system.downloadProtocol == `1`){
		var server = tftp.createServer ({
		  host: variables.system.downloadAddress,
		  port: 69,
		  root: `./files`,
		  denyPUT: true
		});
		try {
				server.listen();
		} catch {
			logMessage(`Error starting TFTP server`);
		}

		server.on (`error`, (error) => {
		  // Errors from the main socket. The current transfers are not aborted.
		  logMessage(error);
		});
		server.on (`request`, (req, res) => {
		  req.on (`error`, (error) => {
			// Error from the request. The connection is already closed.
			logMessage(`[${req.stats.remoteAddress}:${req.stats.remotePort}] (${req.file} - ${error.message})`);
		  });
		});
	}
}

startDhcpListener = () => {
	// DHCP Listener events.
	var dhcpProcess = dhcp.createBroadcastHandler();
	try{
		dhcpProcess.on(`message`, (data) => {
			data.chaddr = data.chaddr.toLowerCase();
			if((data.options.hasOwnProperty(60) && data.options[60].match(/NECDT700/)) && ((data.ciaddr != `0.0.0.0`) || (data.options.hasOwnProperty(50) && data.options[50] != `0.0.0.0`) )) {
				if(data.ciaddr == `0.0.0.0` && data.options.hasOwnProperty(50) && data.options[50] != `0.0.0.0`){
					data.ciaddr = data.options[50];
				}
				if(variables.debug){
					logMessage(`Debug - Device Queue`);
					if(variables.deviceQueue.length == 0){
						logMessage(`\tNone`);
					} else {
						logMessage(`\t${variables.deviceQueue}`);
					}
					logMessage(`Debug - Upgraded Device List`);
					if(variables.upgradedDevices.length == 0){
						logMessage(`\tNone`);
					} else {
						logMessage(`\t${variables.upgradedDevices}`);
					}
					logMessage(`Debug - Configured Device List`);
					if(variables.configuredDevices.length == 0){
						logMessage(`\tNone`);
					} else {
						logMessage(`\t${variables.configuredDevices}`);
					}
					logMessage(`Debug - Current Device: ${data.chaddr}`);
					logMessage(`Debug - Ignored Device List`);
					if(variables.ignoreDevices.length == 0){
						logMessage(`\tNone`);
					} else {
						logMessage(`\t${variables.ignoreDevices}`);
					}
				}
				if(variables.actions.length){
					if(variables.ignoreDevices.indexOf(data.chaddr) == -1){
						if(variables.deviceQueue.indexOf(data.chaddr) == -1 || variables.configuredDevices.indexOf(data.chaddr) == -1){
							if(variables.debug){
								logMessage(`Debug - Device not in device queue or configured device list`);
							}
							variables.deviceQueue.push(data.chaddr);
							logMessage(`Discovered NEC Phone: ${data.chaddr}/${data.options[60]}/${data.ciaddr}`);
							checkHttp(data.ciaddr, data.chaddr, (err, host, protocolType) => {
								if(err){
									if(variables.debug){
										logMessage(`Debug - checkHttp callback`);
										logMessage(err);
									}
								} else {
									if(variables.configuredDevices.indexOf(data.chaddr) == -1){
										logonDevice(host, data.chaddr, protocolType, (err, host, protocolType, sessionID, deviceInformation, configurationItemCodes) => {
											if(variables.debug){
												logMessage(`Debug - logonDevice callback`);
												logMessage(`Debug - ${JSON.stringify(deviceInformation)}`);
											}
											if(err){
												logMessage(err);
											} else {
												if(variables.upgradedDevices.indexOf(data.chaddr) == -1){
													// Upgrade Device if not already upgraded.
													upgradeDevice(host, protocolType, sessionID, deviceInformation, data.chaddr,(err, host, protocolType, sessionID, deviceInformation) => {
														if(variables.debug){
															logMessage(`Debug - upgradeDevice callback`);
														}
														if(err){
															logMessage(err);
															variables.upgradedDevices.push(data.chaddr);
														} else {
															variables.upgradedDevices.push(data.chaddr);
															if(variables.configuredDevices.indexOf(data.chaddr) == -1){
																configureDevice(host, protocolType, sessionID, deviceInformation, (err, host, protocolType, sessionID, deviceInformation) => {
																	if(err){
																		variables.configuredDevices.push(data.chaddr);
																		logoffDevice(host, macAddress, protocolType, sessionID, (err, host, protocolType, sessionID) => {
																		});
																	} else {
																		variables.configuredDevices.push(data.chaddr);
																		executeActions(0, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
																	}
																});
															}
														}
													});
												} else {
													if(variables.verbose){
														logMessage(`Verbose - Device Already Upgraded [${data.chaddr}]: Moving to configuration`);
													}
													if(variables.configuredDevices.indexOf(data.chaddr) == -1){
													} else {
														configureDevice(host, protocolType, sessionID, deviceInformation, (err, host, protocolType, sessionID, deviceInformation) => {
															if(err){
																logoffDevice(host, macAddress, protocolType, sessionID, (err, host, protocolType, sessionID) => {
																});
															} else {
																executeActions(0, host, protocolType, sessionID, deviceInformation.deviceSeries, configurationItemCodes);
															}
														});
													}
												}
											}
										});
									} else {
										logMessage(`Ignoring Completed Device [${data.chaddr}]`);
									}
								}
							});
						} else {
						}
					} else {
						logMessage(`Ignoring Device in Ignore List [${data.chaddr}]`);
					}
				} else {
					logMessage(`Nothing to do [${data.chaddr}]`);
				}
			}
		});
	} catch {
		logMessage(`DHCP Listener Error`);
	}
	dhcpProcess.listen();
}

promptForIp = (callback) => {
	console.log(`--------------------------------------------------------------\nSelect an IP address on this computer to use for HTTPS and FTP.\nEnter the corresponding number for the list item below, or select 'Other' to enter an IP address:`);
	// No IPv6
	networkAddresses = networkAddresses.filter( address => !address.includes(`:`));
	networkAddresses.push(`Other`);
	var ipAddresses = [
		{
		type: `list`,
		name: `selectedAddress`,
		message: `What is your IP address`,
		choices: networkAddresses
		}
	];
	inquirer.prompt(
		ipAddresses
	)
	.then(answers => {
		if(answers.selectedAddress == `Other`){
			userInputIp(`What is your IPv4 address`, (result) => {
				callback(result);
			});
		} else {
			variables.system.downloadAddress = answers.selectedAddress;
			if(variables.verbose){
					logMessage(`Verbose - Using IP Address: ${variables.system.downloadAddress}`);
			}
			callback(false);
		}
	})
	.catch(error => {
		if(error.isTtyError) {
		  // Prompt couldn't be rendered in the current environment
			logMessage(`Prompt Rendering Error: ${JSON.stringify(error)}`);
		} else {
		  // Something else when wrong
			logMessage(`Error: ${JSON.stringify(error)}`);
		}
	});
}

userInputIp = (message,callback) => {
	inquirer.prompt({
		type: `input`,
		name: `selectedAddress`,
		message: message,
		choices: networkAddresses
	})
	.then(answers => {
		if(require(`net`).isIP(answers.selectedAddress)){
			variables.system.downloadAddress = answers.selectedAddress;
			callback(false);
		} else {
			userInputIp(`Invalid Entry - What is your IPv4 address`);
		}
	})
	.catch(error => {
		if(error.isTtyError) {
			logMessage(`Prompt Rendering Error: ${JSON.stringify(error)}`);
		} else {
				logMessage(`Error: ${JSON.stringify(error)}`);
		}
	});
}

getIgnoreList = (callback) => {
	try{
		if(process.env.ignoreFileName.length){
			let ignoreFile = fs.readFileSync(process.env.ignoreFileName).toString(`utf8`).split(`\n`);
			ignoreFile.forEach((line) => {
				if(line.match(/..-..-..-..-..-../)){
					variables.ignoreDevices.push(line.match(/..-..-..-..-..-../)[0].toLowerCase());
				}
			});
		}
	} catch {
		logMessage(`Ignore file - ${process.env.ignoreFileName} - not found`);
	} finally {
		callback();
	}
}

getEAPconfig = (callback) => {
	try {
			let eapFile = fs.readFileSync(process.env.eapFileName).toString(`utf8`).split(`\n`);
			variables.system.eapFile = [];
			for(var i=0;i<eapFile.length;i++){
				if(i>0){
					let tempArray = eapFile[i].split(`,`);
					if(tempArray.length>1 && tempArray[0].length == 17){
						let tempObject = {
							macAddress: tempArray[0].replace(/:/g,`-`).toLowerCase(),
							tlsPassword: tempArray[2],
							eapAccount: tempArray[3],
							eapPassword: tempArray[4]
						};
						if(tempArray[1].toLowerCase() == `md5`){
							tempObject.eapSupplicant = `1`;
							tempObject.eapMethod = `0`;
						} else if(tempArray[1].toLowerCase() == `tls`){
							tempObject.eapSupplicant = `1`;
							tempObject.eapMethod = `1`;
						} else {
							tempObject.eapSupplicant = `0`;
							tempObject.eapMethod = `0`;
						}

						if(tempArray[5].toLowerCase() == `yes` | tempArray[5].toLowerCase() == `y` | tempArray[5].toLowerCase() == `enable` | tempArray[5].toLowerCase() == `enabled` | tempArray[5].toLowerCase() == `true` | tempArray[5].toLowerCase() == `auto` | tempArray[5].toLowerCase() == `automatic`){
							tempObject.pcPortAvailable = `0`;
						} else {
							tempObject.pcPortAvailable = `1`;
						}
						if(tempArray[6].toLowerCase() == `yes` | tempArray[6].toLowerCase() == `y` | tempArray[6].toLowerCase() == `enable` |tempArray[6].toLowerCase() == `enabled` | tempArray[6].toLowerCase() == `true`) {
							tempObject.eapolForwarding = `1`;
						} else {
							tempObject.eapolForwarding = `0`;
						}
						variables.system.eapFile.push(tempObject);
					}
				}
			}
		var returnMessage = { error: false, message: `EAP file - ${process.env.eapFileName} - Loaded` };
	} catch {
		var returnMessage = { error: true, message: `EAP file - Not found` };
	} finally {
		callback(returnMessage);
	}
}

getEAPconfig((res) => {
	logMessage(res.message);
});

for (var i=0;i < process.argv.length; i++){
	if(process.argv[i] == `--downloadHTTPS`){
		variables.system.downloadHTTPS = true;
	}
	if(process.argv[i] == `--server`){
		//Disable loop for server mode.
		variables.system.loop = false;
		getIgnoreList(() => {
			if(variables.debug){
				logMessage(`Debug - Device information loaded from file`);
				if(variables.ignoreDevices.length == 0){
					logMessage(`\tNone`);
				} else {
					logMessage(`\t${variables.ignoreDevices}`);
				}
			}
			checkConfigFiles(() => {
				loadArgsFromEnv((noError) => {
					if(variables.debug){
						logMessage(`Debug - Environment information loaded from file`);
						logMessage(`Debug - Action List = ${variables.actions}`);
					}
					promptForIp((err) => {
						if(err){

						} else {
							collectFirmwareInformation(()=>{
								if(process.env.useBuiltinHTTPSServer == `true`){
									logMessage(`Starting HTTPS Server`);
									httpsServer.listen(443);
								}
								logMessage(`Starting DHCP Listener`);
								startDhcpListener();
								if(process.env.useBuiltinFTPServer.match(/true/i)){
									startFtpServer();
								}
								if(process.env.useBuiltinTFTPServer.match(/true/i)){
									startTftpServer();
								}
							});
						}
					});
				});
			});
		});
	}
	if(process.argv[i] == `--hosts`){
		if(process.argv[i+1] != undefined){
			process.argv[i+1].split(`,`).forEach((host)=>{
				if(require(`net`).isIP(host)){
					variables.hosts.push(host);
				}
			});
		}
	}
	if(process.argv[i] == `--noretry`){
		variables.system.retry = false;
		if(variables.verbose){
		logMessage(`Automatic retry disabled`);
		}
	}
	if(process.argv[i] == `--max-retry` && process.argv[i+1].match(/^\d$/)){
		variables.system.maxRetries = parseInt(process.argv[i+1]);
	}
	if(process.argv[i] == `--manual-timer` && process.argv[i+1].match(/^\d{1,3}$/)){
		variables.system.loopTimer =  process.argv[i+1] * 1000;
		logMessage(variables.system.loopTimer);
	}
	if(process.argv[i] == `--http`){
		variables.system.protocolType = `http`;
	}
	if(process.argv[i] == `--host-range` && process.argv[i+1] != undefined){
		let network = process.argv[i+1].split(`-`)[0].match(/(\d+.\d+.\d+.)/)[0];
		let fromHost = parseInt(process.argv[i+1].split(`-`)[0].match(/(\d+$)/)[0]);
		let toHost = parseInt(process.argv[i+1].split(`-`)[1].match(/(\d+$)/));
		while(fromHost <= toHost){
			let tempHost = network + fromHost;
			if(require(`net`).isIP(tempHost)){
				variables.hosts.push(tempHost);
			}
			fromHost++;
		}
	}
	if(process.argv[i] == `--ipan-csv` && process.argv[i+1] != undefined){
		let file = fs.readFileSync(process.argv[i+1]).toString(`utf8`).split(`\n`);
		file = file.splice(5,file.length);
		for(var counter=0;counter<file.length;counter++ ){
			file[counter] = file[counter].split(`,`);
			if(file[counter][1] == `SIP Multi-Function Telephone`){
				variables.system.listArray.push([file[counter][3].replace(/\s/g,``),file[counter][21],file[counter][22].replace(/\b0+(?=\d)/g,``),file[counter][20].replace(/\b0+(?=\d)/g,``)]);
			}
		}
	}
	if(process.argv[i] == `--ipan-filter` && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/model/i)){
			variables.system.listArray.forEach((listEntry)=>{
				if(listEntry[1].match(new RegExp(process.argv[i+1].split(/=/)[1], `i`))){
					variables.hosts.push(listEntry[0]);
				}
			});
		}
		if(process.argv[i+1].match(/version/i)){
			variables.system.listArray.forEach((listEntry)=>{
				if(listEntry[1].match(new RegExp(process.argv[i+1].split(/=/)[3], `i`))){
					variables.hosts.push(listEntry[0]);
				}
			});
		}
		if(process.argv[i+1].match(/all/i)){
			variables.system.listArray.forEach((listEntry)=>{
				variables.hosts.push(listEntry[0]);
			});
		}
	}
	if(process.argv[i] == `admin-password` && process.argv[i+1] != undefined){
		variables.auth.adminPassword = process.argv[i+1];
	}
	if(process.argv[i] == `new-password` && process.argv[i+1] != undefined){
		variables.actions.push(`new-password`);
		variables.auth.newPassword = process.argv[i+1];
	}
	if(process.argv[i] == `NetworkSettings.DHCPMode` && process.argv[i+1] != undefined){
		variables.actions.push(`NetworkSettings.DHCPMode`);
		if(process.argv[i+1].match(/true|enable/)){
			variables.NetworkSettings.DHCPMode = 1;
		} else if(process.argv[i+1].match(/false|disable/)) {
			variables.NetworkSettings.DHCPMode = 0;
		}
	}
	if(process.argv[i].match(/NetworkSettings.IPAddress/i) && process.argv[i+1] != undefined){
		if(require(`net`).isIP(process.argv[i+1])){
			variables.actions.push(`NetworkSettings.IPAddress`);
			variables.NetworkSettings.IPAddress = process.argv[i+1];
		}
	}
	if(process.argv[i].match(/NetworkSettings.SubnetMask/i) && process.argv[i+1] != undefined){
		if(require(`net`).isIP(process.argv[i+1])){
			variables.actions.push(`NetworkSettings.SubnetMask`);
			variables.NetworkSettings.SubnetMask = process.argv[i+1];
		}
	}
	if(process.argv[i].match(/NetworkSettings.DefaultGateway/i) && process.argv[i+1] != undefined){
		if(require(`net`).isIP(process.argv[i+1])){
			variables.actions.push(`NetworkSettings.DefaultGateway`);
			variables.network.defaultGateway = process.argv[i+1];
		}
	}
	if(process.argv[i].match(/NetworkSettings.DNSAddress/i) && process.argv[i+1] != undefined){
		if(require(`net`).isIP(process.argv[i+1])){
			variables.actions.push(`NetworkSettings.DNSAddress`);
			variables.NetworkSettings.DNSAddress = process.argv[i+1];
		}
	}
	if(process.argv[i].match(/LLDPSettings.LLDPMode/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/true|enable/)){
			variables.actions.push(`LLDPSettings.LLDPMode`);
			variables.LLDPSettings.LLDPMode = 1;
		} else if(process.argv[i+1].match(/false|disable/)){
			variables.actions.push(`LLDPSettings.LLDPMode`);
			variables.LLDPSettings.LLDPMode = 0;
		}
	}
	if(process.argv[i].match(/LANPortSettings.VLANMode/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/true|enable/)){
			variables.actions.push(`LANPortSettings.VLANMode`);
			variables.ports.lanPort.vlanMode = 1;
		} else if(process.argv[i+1].match(/false|disable/)){
			variables.actions.push(`LANPortSettings.VLANMode`);
			variables.ports.lanPort.vlanMode = 0;
		}
	}
	if(process.argv[i].match(/LANPortSettings.VLANID/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1] >= 0 && process.argv[i+1] < 4095){
			variables.actions.push(`LANPortSettings.VLANID`);
			variables.ports.lanPort.vlanId = process.argv[i+1];
		}
	}
	if(process.argv[i].match(/LANPortSettings.VLANPriority/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1] >= 0 && process.argv[i+1] < 8){
			variables.actions.push(`LANPortSettings.VLANPriority`);
			variables.ports.lanPort.vlanPriority = process.argv[i+1];
		}
	}
	if(process.argv[i].match(/PCPortSettings.PortVLANMode/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/true|enable/)){
			variables.actions.push(`PCPortSettings.PortVLANMode`);
			variables.ports.pcPort.vlanMode = 1;
		} else if(process.argv[i+1].match(/false|disable/)){
			variables.actions.push(`PCPortSettings.PortVLANMode`);
			variables.ports.pcPort.vlanMode = 0;
		}
	}
	if(process.argv[i].match(/PCPortSettings.PortVLANID/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1] >= 0 && process.argv[i+1] < 4095){
			variables.actions.push(`PCPortSettings.PortVLANID`);
			variables.ports.pcPort.vlanId = process.argv[i+1];
		}
	}
	if(process.argv[i].match(/PCPortSettings.PortVLANPriority/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1] >= 0 && process.argv[i+1] < 8){
			variables.actions.push(`PCPortSettings.PortVLANPriority`);
			variables.ports.pcPort.vlanPriority = process.argv[i+1];
		}
	}
	if(process.argv[i].match(/PCPortSettings.PortAvailable/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/true|auto/)){
			variables.actions.push(`PCPortSettings.PortAvailable`);
			variables.ports.pcPort.available = 0;
		} else if(process.argv[i+1].match(/false|disable/)){
			variables.actions.push(`PCPortSettings.PortAvailable`);
			variables.ports.pcPort.available = 1;
		}
	} if(process.argv[i].match(/PCPortSettings.PCPortSecurity/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/true|enable/)){
			variables.actions.push(`PCPortSettings.PCPortSecurity`);
			variables.ports.pcPort.security = 1;
		} else if(process.argv[i+1].match(/false|disable/)){
			variables.actions.push(`PCPortSettings.PCPortSecurity`);
			variables.ports.pcPort.security = 0;
		}
	}
	if(process.argv[i].match(/SpareIPSettings.SpareBackupIPMode/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/false|disable/)){
			variables.actions.push(`SpareIPSettings.SpareBackupIPMode`);
			variables.network.spare.spareMode = 0;
		} else if(process.argv[i+1].match(/spare/)){
			variables.actions.push(`SpareIPSettings.SpareBackupIPMode`);
			variables.network.spare.spareMode = 1;
		} else if(process.argv[i+1].match(/backup/)){
			variables.actions.push(`SpareIPSettings.SpareBackupIPMode`);
			variables.network.spare.spareMode = 2;
		}
	}
	if(process.argv[i].match(/sip-servers/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1] != undefined){
			let tempArray = process.argv[i+1].split(`,`);
			if(tempArray[0] != undefined){
				variables.sip.sipServer1 = tempArray[0].split(`:`);
		  	if(variables.sip.sipServer1[1] == undefined){
					variables.sip.sipServer1[1] = 5060;
				}
				if(require(`net`).isIP(variables.sip.sipServer1[0]) && parseInt(variables.sip.sipServer1[1]) >= 1024 && parseInt(variables.sip.sipServer1[1]) <= 65535){
					variables.actions.push(`sip-server-1`);
				}
			}
			if(tempArray[1] != undefined){
				variables.sip.sipServer2 = tempArray[1].split(`:`);
		  	if(variables.sip.sipServer2[1] == undefined){
					variables.sip.sipServer2[1] = 5060;
				}
				if(require(`net`).isIP(variables.sip.sipServer2[0]) && parseInt(variables.sip.sipServer2[1]) >= 1024 && parseInt(variables.sip.sipServer2[1]) <= 65535){
					variables.actions.push(`sip-server-2`);
				}
			}
			if(tempArray[2] != undefined){
				variables.sip.sipServer3 = tempArray[2].split(`:`);
		  	if(variables.sip.sipServer3[1] == undefined){
					variables.sip.sipServer3[1] = 5060;
				}
				if(require(`net`).isIP(variables.sip.sipServer3[0]) && parseInt(variables.sip.sipServer3[1]) >= 1024 && parseInt(variables.sip.sipServer3[1]) <= 65535){
					variables.actions.push(`sip-server-3`);
				}
			}
			if(tempArray[3] != undefined){
				variables.sip.sipServer4 = tempArray[3].split(`:`);
		  	if(variables.sip.sipServer4[1] == undefined){
					variables.sip.sipServer4[1] = 5060;
				}
				if(require(`net`).isIP(variables.sip.sipServer4[0]) && parseInt(variables.sip.sipServer4[1]) >= 1024 && parseInt(variables.sip.sipServer4[1]) <= 65535){
					variables.actions.push(`sip-server-4`);
				}
			}
		}
	}
	if(process.argv[i].match(/sip-server-1/i) && process.argv[i+1] != undefined){
		variables.sip.sipServer1 = process.argv[i+1].split(`:`);
		if(require(`net`).isIP(variables.sip.sipServer1[0]) && parseInt(variables.sip.sipServer1[1]) >= 1024 && parseInt(variables.sip.sipServer1[1]) <= 65535){
			variables.actions.push(`sip-server-1`);
		}
	}
	if(process.argv[i].match(/sip-server-2/i) && process.argv[i+1] != undefined){
		variables.sip.sipServer2 = process.argv[i+1].split(`:`);
		if(require(`net`).isIP(variables.sip.sipServer2[0]) && parseInt(variables.sip.sipServer2[1]) >= 1024 && parseInt(variables.sip.sipServer2[1]) <= 65535){
			variables.actions.push(`sip-server-2`);
		}
	}
	if(process.argv[i].match(/sip-server-3/i) && process.argv[i+1] != undefined){
		variables.sip.sipServer3 = process.argv[i+1].split(`:`);
		if(require(`net`).isIP(variables.sip.sipServer3[0]) && parseInt(variables.sip.sipServer3[1]) >= 1024 && parseInt(variables.sip.sipServer3[1]) <= 65535){
			variables.actions.push(`sip-server-3`);
		}
	}
	if(process.argv[i].match(/sip-server-4/i) && process.argv[i+1] != undefined){
		variables.sip.sipServer4 = process.argv[i+1].split(`:`);
		if(require(`net`).isIP(variables.sip.sipServer4[0]) && parseInt(variables.sip.sipServer4[1]) >= 1024 && parseInt(variables.sip.sipServer4[1]) <= 65535){
			variables.actions.push(`sip-server-4`);
		}
	}
if(process.argv[i].match(/menu-key-mode/i) && process.argv[i+1] != undefined){
		if(process.argv[i].match(/true|enable/i)){
			variables.menuKeyMode = 1;
			variables.actions.push(`menu-key-mode`);
		} else if(process.argv[i].match(/false|disable/i)){
			variables.menuKeyMode = 0;
			variables.actions.push(`menu-key-mode`);
		}
	}
	if(process.argv[i].match(/voice-recording/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/automatic/i)){
			variables.VoiceRecSettings.VoiceRecording = 0;
			variables.actions.push(`voice-recording`);
		} else if(process.argv[i+1].match(/disable/i)){
			variables.VoiceRecSettings.VoiceRecording = 1;
			variables.actions.push(`voice-recording`);
		}
	}
	if(process.argv[i].match(/recording-mode/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/static/i)){
			variables.VoiceRecSettings.RecordingMode = 0;
			variables.actions.push(`recording-mode`);
		} else if(process.argv[i+1].match(/dynamic/i)){
			variables.VoiceRecSettings.RecordingMode = 1;
			variables.actions.push(`recording-mode`);
		}
	}
	if(process.argv[i].match(/recording-segments/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/all/i)){
			variables.VoiceRecSettings.RecSegments = 0;
			variables.actions.push(`recording-segments`);
		} else if(process.argv[i+1].match(/talk/i)){
			variables.VoiceRecSettings.RecSegments = 1;
			variables.actions.push(`recording-segments`);
		}
	}
	if(process.argv[i].match(/auto-record-start/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/false|disable/i)){
			variables.VoiceRecSettings.AutoRecStart = 0;
			variables.actions.push(`auto-record-start`);
		} else if(process.argv[i+1].match(/true|enable/i)){
			variables.VoiceRecSettings.AutoRecStart = 1;
			variables.actions.push(`auto-record-start`);
		}
	}
	if(process.argv[i].match(/record-tone-level/i) && process.argv[i+1] != undefined){
		let tempVar = parseInt(process.argv[i+1]);
		if(tempVar>=0 && tempVar<=48){
			variables.recording.recordToneLevel = tempVar;
			variables.actions.push(`record-tone-level`);
		}
	}
	if(process.argv[i].match(/recording-icon/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/false|disable/i)){
			variables.recording.recordingIcon = 0;
			variables.actions.push(`recording-icon`);
		} else if(process.argv[i+1].match(/true|enable/i)){
			variables.recording.recordingIcon = 1;
			variables.actions.push(`recording-icon`);
		}
	}
	if(process.argv[i].match(/recording-server-1-address/i) && process.argv[i+1] != undefined){
		variables.actions.push(`recording-server-1-address`);
		variables.recording.serverOne.ipAddress = process.argv[i+1];
	}
	if(process.argv[i].match(/license-server-type/i) && process.argv[i+1] != undefined){
		variables.actions.push(`license-server-type`);
		if(process.argv[i+1].match(/tcp|server/i)){
			variables.license.licenseServerType = 1;
		} else {
			variables.license.licenseServerType = 0;
		}
	}
	if(process.argv[i].match(/license-server/i) && process.argv[i+1] != undefined){
		variables.actions.push(`license-server`);
		variables.license.licenseServerIP = process.argv[i+1];
	}
	if(process.argv[i].match(/gigabit-ethernet/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/true|enable/i)){
			variables.license.gigabitEthernet = 1;
			variables.actions.push(`gigabit-ethernet`);
		} else if(process.argv[i+1].match(/false|disable/i)){
			variables.license.gigabitEthernet = 0;
			variables.actions.push(`gigabit-ethernet`);
		}
	}
	if(process.argv[i].match(/line-keys/i) && process.argv[i+1] != undefined){
		variables.actions.push(`line-keys`);
		if(process.argv[i+1] == `32`){
			variables.license.lineKeys = 2;
		} else if(process.argv[i+1] == `16`){
			variables.license.lineKeys = 1;
		} else {
			variables.license.lineKeys = 0;
		}
	}
	if(process.argv[i].match(/license-user-prefix/i) && process.argv[i+1] != undefined){
		variables.actions.push(`license-user-prefix`);
		variables.license.userPrefix = process.argv[i+1];
	}
	if(process.argv[i].match(/encryption-auth-mode/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/true|enable/i)){
			variables.encryption.authMode = 1;
			variables.actions.push(`encryption-auth-mode`);
		} else if(process.argv[i+1].match(/false|disable/i)){
			variables.encryption.authMode = 0;
			variables.actions.push(`encryption-auth-mode`);
		}
	}
	if(process.argv[i].match(/encryption-icon/i) && process.argv[i+1] != undefined){
		if(process.argv[i+1].match(/true|enable/i)){
			variables.encryption.encryptionIcon = 1;
			variables.actions.push(`encryption-icon`);
		} else if(process.argv[i+1].match(/false|disable/i)){
			variables.encryption.encryptionIcon = 0;
			variables.actions.push(`encryption-icon`);
		}
	}
	if(process.argv[i].match(/encryption-otp/i) && process.argv[i+1] != undefined){
		variables.actions.push(`encryption-otp`);
		variables.encryption.oneTimePassword  = process.argv[i+1];
	}
	if(process.argv[i].match(/xml-directory/) && process.argv[i+1] != undefined){
		variables.actions.push(`xml-directory`);
		variables.ProxySettings.DirectoryURL  = encodeURI(process.argv[i+1]);
	}
	if(process.argv[i].match(/push-server-1/i) && process.argv[i+1] != undefined){
		variables.security.pushServer1 = process.argv[i+1];
		if(require(`net`).isIP(variables.security.pushServer1)){
			variables.actions.push(`push-server-1`);
		}
	}
	if(process.argv[i].match(/push-server-2/i) && process.argv[i+1] != undefined){
		variables.security.pushServer2 = process.argv[i+1];
		if(require(`net`).isIP(variables.security.pushServer2)){
			variables.actions.push(`push-server-2`);
		}
	}
	if(process.argv[i].match(/push-server-3/i) && process.argv[i+1] != undefined){
		variables.security.pushServer3 = process.argv[i+1];
		if(require(`net`).isIP(variables.security.pushServer3)){
			variables.actions.push(`push-server-3`);
		}
	}
	if(process.argv[i].match(/push-server-4/i) && process.argv[i+1] != undefined){
		variables.security.pushServer4 = process.argv[i+1];
		if(require(`net`).isIP(variables.security.pushServer4)){
			variables.actions.push(`push-server-4`);
		}
	}
	if(process.argv[i].match(/--upgrade/i)){
		httpsServer.listen(443);
		const ftpd = require(`simple-ftpd`);
		ftpd({ host: variables.system.downloadAddress, port: 21, root: `files` }, (session) => {
			session.on(`pass`, (username, password, cb) => {
			if (username === `ADMIN` && password === `6633222`) {
			  session.readOnly = true,
			  session.root = `files`
			  cb(null, `Welcome admin`);
			} else {
			  cb(null, `Welcome guest`);
			}
			});
			session.on(`stat`, fs.stat);
			session.on(`readdir`, fs.readdir);
			session.on(`read`, (pathName, offset, cb) => {
			cb(null, fs.createReadStream(pathName, { start: offset }))
			})
		});
		variables.actions = [];
		var networkInterfaces = os.networkInterfaces();
		let networkAddresses = [];

		for (const property in networkInterfaces) {
			if(networkInterfaces[property][1] != undefined && networkInterfaces[property][1].hasOwnProperty(`address`)){
				networkAddresses.push(networkInterfaces[property][1].address);
			}
		}
		console.log(`--------------------------------------------------------------\nSelect an IP address on this computer to use for HTTPS and FTP.\nEnter the corresponding number for the list item below, or enter an IP address:`);
		for(var optionNumber=0;optionNumber<networkAddresses.length;optionNumber++){
			console.log(`\t ${optionNumber} - ${networkAddresses[optionNumber]}`);
		}
	}
	if(process.argv[i].match(/--force-reboot/i)){
		variables.actions = [`force-reboot`];
		variables.system.maxRetries = 0;
	}
	if(process.argv[i].match(/help/i)){
		variables.actions = [];
		showHelp();
	}
}
if(process.argv.length == 2){
	showHelp();
}
if(variables.debugTwo){
	logMessage(`D2`);
	logMessage(variables);
}

loopHosts = () => {
	if(variables.system.loop){
		if(variables.verbose){
			logMessage(`Debug - Loop Hosts Function - loopHosts`);
		}
		if(variables.actions.indexOf(`upgrade`) < 0){
			if(variables.actions.length){
				if(variables.verbose && !variables.server){
				logMessage(`Verbose - Hosts: ${variables.hosts}`);
				}
				if(variables.system.retry && variables.system.retryCounter < variables.system.maxRetries){
					variables.system.retryCounter++;
					if(variables.verbose){
						logMessage(`Verbose - Loop set to ${variables.system.loopTimer}ms`);
					}
					setTimeout(loopHosts, variables.system.loopTimer);
				}
			}
		}
		if(variables.hosts != undefined){
			variables.hosts.forEach((host)=>{
				//variables.system.processCounter++;
				processHost(host);
			});
			if(variables.hosts.length == 0 && variables.system.loop){
				process.exit(0);
			} else {
			}
		}
	} else {
		process.exit(0);
	}
}

processHost = (host) => {
	var protocolType = variables.system.protocolType;
	if(variables.actions.length){
		if(variables.actions[0] == `force-reboot`){
			if(variables.verbose){
				logMessage(`Verbose - URL Accessed: http://${host}/index.cgi?session=ThisIsGarbage&set=all`);
			}
			httpGet(`http://${host}`, `/index.cgi?session=ThisIsGarbage&set=all`, false, null, (sessionID, deviceInformation) => {
				logMessage(`Force Logout and reboot for ${host}`);
			});
		}
		else {
			got(`http://${host}/header.cgi`).then( response => {
				if(variables.dump){
					logMessage(`▼ ▼ ▼ ▼ Dump ▼ ▼ ▼ ▼\n\n${response.body}`);
					logMessage(`▲ ▲ ▲ ▲ Dump ▲ ▲ ▲ ▲`);
				}
				if(response.body.match(/9.1.[0-5].\d/g) || variables.system.forceInsecure){
					if(variables.verbose){
						logMessage(`Verbose - Security Mode: Force Insecure set or DT700 detected, using http`);
					}
					protocolType = `http`;
				} else if(response.body.match(/9.1.[6-7].\d/g)){
					if(variables.verbose){
						logMessage(`Verbose - Security Mode: DT800+ detected, using https`);
					}
					protocolType = `https`;
				}
				logMessage(`Logon: ${host}`);
				// Logon
				if(variables.verbose){
					logMessage(`Verbose - Process Counter: ${variables.system.processCounter}`);
				}
				if(variables.verbose){
					logMessage(`Verbose - URL Accessed: ${protocolType}://${host}/index.cgi?username=ADMIN&password=${variables.auth.adminPassword}`);
				}
				httpGet(`${protocolType}://${host}`, `/index.cgi?username=ADMIN&password=${variables.auth.adminPassword}`, true, null, (sessionID, deviceInformation) => {
					if(variables.verbose){
						logMessage(`Verbose - Session ID from Logon: ${sessionID}`);
					}
					if(sessionID == null ){
						variables.system.processCounter--;
						if(variables.verbose){
							logMessage(`Verbose - Process Counter: ${variables.system.processCounter}`);
							logMessage(`Verbose - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&set=all`);
						}
						httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&set=all`, false, null, (sessionID, deviceInformation) => {
							logMessage(`Logon aborted - ${host}`)
							if(variables.system.processCounter <= 0 && variables.system.loop){
								process.exit(0);
							};
						});
					} else {
						executeActions(0, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
					}
				});
			})
			// ▼▼▼▼ Comment for testing uncomment for release ▼▼▼▼
			.catch( error => {
				logMessage(`${host} - ${error.name}`);
			});
			// ▲▲▲▲ Comment for testing uncomment for release ▲▲▲▲
		}
	}
}

executeActions = (count, host, protocolType, sessionID, deviceInformation, configurationItemCodes) => {
	if(variables.verbose){
		logMessage(`Verbose - Process Counter: ${variables.system.processCounter}`);
		logMessage(`Verbose - Action Index (count): ${count}`);
		logMessage(`Verbose - Action: ${variables.actions[count]}`);
		logMessage(`Verbose - Device IP Address (host): ${host}`);
		logMessage(`Verbose - protocolType: ${protocolType}`);
		logMessage(`Verbose - sessionID: ${sessionID}`);
		if(deviceInformation != null){
			logMessage(`Verbose - deviceSeries: ${deviceInformation.deviceSeries}`);
		}
		logMessage(`Verbose - actions: ${variables.actions.join(',')}`);
	}
	if(count < variables.actions.length){
		// New Method (Should cut down on code if it works properly)
		let setCode = undefined;
		if(variables.setDataTypes.hasOwnProperty(variables.actions[count])){
			if(configurationItemCodes.hasOwnProperty(variables.actions[count].split('.')[0])){
				setCode = configurationItemCodes[variables.actions[count].split('.')[0]][variables.actions[count].split('.')[1]];
			}
			let setItem = variables[variables.actions[count].split('.')[0]][variables.actions[count].split('.')[1]];
			let setDataType = variables.setDataTypes[variables.actions[count]];
			let uriResource = ``;
			if(setCode == undefined){
				logMessage(`Method not supported: ${variables.actions[count]}`);
				executeActions(count+1, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
			} else {
				if(variables.verbose){
					logMessage(`Verbose - Set Data Via New Method: ${variables.actions[count]}`);
				}
				if(variables.debug){
						logMessage(`Debug - Set Data Via New Method: Data Type = ${setDataType}, Action = ${variables.actions[count]}`);
						logMessage(`Debug - Set Data Via New Method: setCode = ${setCode}, setItem = ${setItem}`);
				}
				switch (setDataType) {
					case `itemOnly`:
						uriResource = `/index.cgi?session=${sessionID}&set=${setCode}&item=${setItem}`;
						break;
					case `ip`:
						uriResource = `/index.cgi?session=${sessionID}&set=${setCode}&item=${setItem}&type=ip`;
						break;
					case `2xDupeItems`:
						uriResource = `/index.cgi?session=${sessionID}&set=${setCode}&item1=${setItem}&item2=${setItem}`;
						break;
					default:

				}
				if(variables.debug){
					logMessage(`Debug - URL Accessed: ${protocolType}://${host}${uriResource}`);
				}
				httpGet(`${protocolType}://${host}`, uriResource, false, deviceInformation, (returnedSessionID, deviceInformation) => {
					executeActions(count+1, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
				});
			}
		}
		// Factory Values
		 else if(variables.actions[count] == `factory-values`){
			if(variables.verbose){
				logMessage(`Verbose - Set Factory Values`);
			}
			if(variables.debug){
				logMessage(`Debug - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&data_clear=4110430`);
			}
			httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&data_clear=4110430`, false, deviceInformation, (sessionID, deviceInformation) => {
				executeActions(count+1, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
			});
		}
		// else if(variables.actions[count] == `eap-supplicant`){
		// 	if(variables.verbose){
		// 			logMessage(`Verbose - 802.1x Supplicant Security Section`);
		// 		}
		// 	variables.system.eapFile.forEach((entry) =>{
		// 		if(entry.macAddress == deviceInformation.macAddress.toLowerCase().replace(/:/g,`-`)){
		// 			// 802.1x Supplicant
		// 			if(variables.verbose){
		// 				logMessage(`Verbose - Set 802.1x Supplicant`);
		// 			}
		// 			if(variables.debug){
		// 				logMessage(`Debug - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&set=4150435&item=${entry.eapSupplicant}`);
		// 			}
		// 			httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&set=4150435&item=${entry.eapSupplicant}`, false, deviceInformation, (sessionID, deviceInformation) => {
		// 				// 802.1x EAP Method
		// 				if(variables.verbose){
		// 					logMessage(`Verbose - Set 802.1x EAP Method`);
		// 				}
		// 				if(variables.debug){
		// 					logMessage(`Debug - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&set=4150436&item=${entry.eapMethod}`);
		// 				}
		// 				httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&set=4150436&item=${entry.eapMethod}`, false, deviceInformation, (sessionID, deviceInformation) => {
		// 					// 802.1x EAP Account
		// 					if(variables.verbose){
		// 						logMessage(`Verbose - Set 802.1x EAP Account`);
		// 					}
		// 					if(variables.debug){
		// 						logMessage(`Debug - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&set=4150437&item=${entry.eapAccount}`);
		// 					}
		// 					httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&set=4150437&item=${entry.eapAccount}`, false, deviceInformation, (sessionID, deviceInformation) => {
		// 						// 802.1x EAP Password
		// 						if(variables.verbose){
		// 							logMessage(`Verbose - Set 802.1x EAP Password`);
		// 						}
		// 						if(variables.debug){
		// 							logMessage(`Debug - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&set=4150580&item=${entry.eapPassword}`);
		// 						}
		// 						httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&set=4150580&item=${entry.eapPassword}`, false, deviceInformation, (sessionID, deviceInformation) => {
		// 							// 802.1x EAPOL VLAN Mode
		// 							if(variables.verbose){
		// 								logMessage(`Verbose - Set 802.1x EAPOL VLAN Mode`);
		// 							}
		// 							if(variables.debug){
		// 								logMessage(`Debug - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&set=4150439&item=0`);
		// 							}
		// 							httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&set=4150439&item=0`, false, deviceInformation, (sessionID, deviceInformation) => {
		// 								// PC Port - EAPOL Forwarding
		// 								if(variables.verbose){
		// 									logMessage(`Verbose - PC Port - EAPOL Forwarding`);
		// 								}
		// 								if(variables.debug){
		// 									logMessage(`Debug - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&set=41e0456&item=${entry.eapolForwarding}`);
		// 								}
		// 								httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&set=41e0456&item=${entry.eapolForwarding}`, false, deviceInformation, (sessionID, deviceInformation) => {
		// 									// Certificate - PKCS#12 Password - (Certificate import will fail if this is not done first)
		// 									if(variables.verbose){
		// 										logMessage(`Verbose - Set Certificate - PKCS#12 Password`);
		// 									}
		// 									if(variables.debug){
		// 										logMessage(`Debug - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&set=46105a5&item=${entry.tlsPassword}`);
		// 									}
		// 									httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&set=46105a5&item=${entry.tlsPassword}`, false, deviceInformation, (sessionID, deviceInformation) => {
		// 										if(variables.system.certificateState.rootCert.indexOf(entry.macAddress) == -1){
		// 											// Certificate - Download Root Certificate (Reboots After - I should move this before the Client Cert)
		// 											if(variables.verbose){
		// 												logMessage(`Verbose - Download Root Certificate`);
		// 											}
		// 											if(variables.debug){
		// 												logMessage(`Debug - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&download=45f0593&trans=${variables.system.downloadProtocol}&adr=${variables.system.downloadAddress}&type=ip&dir=certs&file=rootcert.der&name=&pass=`);
		// 											}
		// 											httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&download=45f0593&trans=${variables.system.downloadProtocol}&adr=${variables.system.downloadAddress}&type=ip&dir=certs&file=rootcert.der&name=&pass=`, false, deviceInformation, (sessionID, deviceInformation) => {
		// 											});
		// 										} else if(variables.system.certificateState.clientCert.indexOf(entry.macAddress) == -1){
		// 											// Certificate - Download Client Certificate (Reboots After)
		// 											if(variables.verbose){
		// 												logMessage(`Verbose - Download Client PKCS#12 Certificate`);
		// 											}
		// 											if(variables.debug){
		// 												logMessage(`Debug - URL Accessed: ${protocolType}://${host}/index.cgi?session=${sessionID}&download=45f0591&trans=${variables.system.downloadProtocol}&adr=${variables.system.downloadAddress}&type=ip&dir=certs&file=${deviceInformation.macAddress.replace(/:/g,'')}-eap.p12&name=&pass=`);
		// 											}
		// 											httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&download=45f0591&trans=${variables.system.downloadProtocol}&adr=${variables.system.downloadAddress}&type=ip&dir=certs&file=${deviceInformation.macAddress.replace(/:/g,'')}-eap.p12&name=&pass=`, false, deviceInformation.macAddress, (sessionID, deviceInformation) => {
		//
		// 											});
		// 										}
		// 									});
		// 								});
		// 							});
		// 						});
		// 					});
		// 				});
		// 			});
		// 		}
		// 	});
		// }
		// Upgrade Endpoint
		// else if(variables.actions[count] == `upgrade`) {
		// 	if(deviceInformation.deviceSeries == `DT700`){
		// 		got(`${protocolType}://${host}/index.cgi?session=${sessionID}&config=42304b1`).then(response => {
		// 			if(variables.dump){
		// 				logMessage(`▼ ▼ ▼ ▼ Dump ▼ ▼ ▼ ▼\n\n${response.body}`);
		// 				logMessage(`▲ ▲ ▲ ▲ Dump ▲ ▲ ▲ ▲`);
		// 			}
		// 			var $ = cheerio.load(response.body);
		// 			if(response.body.match(/Terminal is busy/)){
		// 				logMessage(`Terminal Busy`);
		// 			}
		// 			if(variables.verbose){
		// 				logMessage(`Verbose - Page Title: ${host}/${(`title`).text()}`);
		// 			}
		// 			if(variables.debug){
		// 				logMessage(response.body);
		// 			}
		// 			let firmwareName = response.body.match(/(\w+.tgz)/)[0];
		// 			if(variables.system.downloadAddress != undefined && variables.system.downloadAddress.length >= 7){
		// 				let upgradeURI = `${protocolType}://${host}/index.cgi?session=${sessionID}&download=42304b1&trans=0&adr=${variables.system.downloadAddress}&type=ip&dir=&file=${firmwareName}&name=&pass=`;
		// 				if(variables.verbose){
		// 					logMessage(`Upgrade Endpoint`);
		// 					logMessage(upgradeURI);
		// 				}
		// 				got(upgradeURI).then(response => {
		// 					executeActions(count+1, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
		// 				}).catch(error => {
		// 					executeActions(count+1, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
		// 				});
		// 			}
		// 		}).catch(error => {
		// 			logMessage(`${host} - ${error.name}`);
		// 			executeActions(count+1, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
		// 		});
		// 	} else {
		// 		got(`${protocolType}://${host}/index.cgi?session=${sessionID}&config=423054e`).then(response => {
		// 			if(variables.dump){
		// 				logMessage(`▼ ▼ ▼ ▼ Dump ▼ ▼ ▼ ▼\n\n${response.body}`);
		// 				logMessage(`▲ ▲ ▲ ▲ Dump ▲ ▲ ▲ ▲`);
		// 			}
		// 			var $ = cheerio.load(response.body);
		// 			if(response.body.match(/Terminal is busy/)){
		// 				logMessage(`Terminal Busy`);
		// 			}
		// 			if(variables.verbose){
		// 				logMessage(`Page title:  ${$('title').text()}`);
		// 			}
		// 			if(variables.debug){
		// 				logMessage(response.body);
		// 			}
		// 			let firmwareName = response.body.match(/(\w+.tgz)/)[0];
		// 			if(variables.system.downloadAddress != undefined && variables.system.downloadAddress.length >= 7){
		// 				let upgradeURI = `${protocolType}://${host}/index.cgi?session=${sessionID}&download=423054e&trans=2&adr=${variables.system.downloadAddress}&type=ip&dir=firmware&file=${firmwareName}&name=&pass=`;
		// 				got(upgradeURI).then(response => {
		// 					executeActions(count+1, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
		// 				}).catch(error => {
		// 					logMessage(`${host} - ${error.name}`);
		// 					executeActions(count+1, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
		// 				});
		// 			}
		// 		}).catch(error => {
		// 			logMessage(`${host} - ${error.name}`);
		// 			executeActions(count+1, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
		// 		});
		// 	}
		// }
		else {
			executeActions(count+1, host, protocolType, sessionID, deviceInformation, configurationItemCodes);
		}
	} else {
		variables.system.processCounter--;
		if(variables.verbose){
			logMessage(`Process Counter: ${variables.system.processCounter}`);
		}
		httpGet(`${protocolType}://${host}`, `/index.cgi?session=${sessionID}&set=all`, false, null, (sessionID, deviceInformation) => {
			logMessage(`Change complete. Device rebooting`);
			// Fix
		// 	fs.appendFile(`ignore.csv`, `${deviceInformation.macAddress.replace(/:/g,`-`)}\n` , (err) => {
		// 	  if (err) {
		// 	    logMessage(`Ignore File Write Error`);
		// 			logMessage(err);
		// 	  }
		// 	  else {
		// 	  }
		// });
			if(variables.system.processCounter <= 0){
				variables.hosts = variables.hosts.filter(arrayHost => arrayHost != host);
			};
			if(variables.hosts.length == 0 && variables.system.loop){
				process.exit(0);
			}
		});
	}
}

function showHelp() {
	console.log(`\n\t Flags`);
	console.log(`\t\t --force-reboot \n \t\t\t Force device reboot in command line mode`);
	console.log(`\t\t --factory-values \n \t\t\t Factory reset device from command lime mode`);
	console.log(`\t\t --http \n \t\t\t force HTTP connections in command line mode`);
	console.log(`\t\t --max-retry \n \t\t\t Maximum retries for command line mode`);
	console.log(`\t\t --manual-timer \n \t\t\t Retry timer for command line mode`);
	console.log(`\t\t --noretry \n \t\t\t  Do not retry in command line mode`);
	console.log(`\t\t --verbose \n \t\t\t Verbose logging`);
	console.log(`\t\t --debug \n \t\t\t Debug logging`);
	console.log(`\t\t --server \n \t\t\t Run as a server and discover devices via DHCP requests`);

	// Command line arguments need to be re-coded after moving to new method data set function

	// console.log(`\n\t Administration`);
	// console.log(`\t\t admin-password xxxxxxxxxxxxxxxxxxxxxx`);
	// console.log(`\t\t new-password xxxxxxxxxxxxxxxxxxxxxx`);
	// console.log(`\n\t Device Selection`);
	// console.log(`\t\t --hosts [xxx.xxx.xxx.xxx|xxx.xxx.xxx.xxx,xxx.xxx.xxx.xxx,...]`);
	// console.log(`\t\t --host-range xxx.xxx.xxx.xxx-xxx`);
	// console.log(`\t\t --ipan-csv xxxxxxxxxxxxxx.csv`);
	// console.log(`\t\t --ipan-filter [model xxx|version x.x.x.x|all]`);
	//
	// console.log(`\n\t LAN Settings`);
	// console.log(`\t\t LLDPSettings.LLDPMode [true|false]: Enable or disable LLDP`);
	// console.log(`\t\t LANPortSettings.VLANMode [true|false]`);
	// console.log(`\t\t LANPortSettings.VLANID [1-1001,1006-4063]`);
	// console.log(`\t\t LANPortSettings.VLANPriority [1-7]`);
	// console.log(`\t\t PCPortSettings.PortVLANMode [true|false]`);
	// console.log(`\t\t PCPortSettings.PortVLANID [1-1001,1006-4063]`);
	// console.log(`\t\t PCPortSettings.PortVLANPriority [1-7]`);
	// console.log(`\t\t PCPortSettings.PortAvailable [true|false]`);
	// console.log(`\t\t PCPortSettings.PCPortSecurity [true|false]`);
	//
	// console.log(`\n\t IP Settings`);
	// console.log(`\t\t NetworkSettings.DHCPMode [true|false]`);
	// console.log(`\t\t NetworkSettings.IPAddress xxx.xxx.xxx.xxx`);
	// console.log(`\t\t NetworkSettings.SubnetMask xxx.xxx.xxx.xxx`);
	// console.log(`\t\t NetworkSettings.DefaultGateway xxx.xxx.xxx.xxx`);
	// console.log(`\t\t NetworkSettings.DNSAddress xxx.xxx.xxx.xxx`);
	// console.log(`\t\t SpareIPSettings.SpareBackupIPMode [disable|spare|backup]`);
	//
	// console.log(`\n\t SIP Settings`);
	// console.log(`\t\t sip-servers xxx.xxx.xxx.xxx:xxxx,xxx.xxx.xxx.xxx:xxxx,xxx.xxx.xxx.xxx:xxxx,xxx.xxx.xxx.xxx:xxxx`);
	// console.log(`\t\t sip-server-1 xxx.xxx.xxx.xxx:xxxx`);
	// console.log(`\t\t sip-server-2 xxx.xxx.xxx.xxx:xxxx`);
	// console.log(`\t\t sip-server-3 xxx.xxx.xxx.xxx:xxxx`);
	// console.log(`\t\t sip-server-4 xxx.xxx.xxx.xxx:xxxx`);
	// console.log(`\n\t License Information *- For DT8xx+`);
	// console.log(`\t\t license-server-type [sip|tcp] *- For DT9xx+`);
	// console.log(`\t\t license-server xxx.xxx.xxx.xxx`);
	// console.log(`\t\t gigabit-ethernet [true|false]`);
	// console.log(`\t\t line-keys [32|16|8]`);
	//
	// console.log(`\n\t DT9xx New UI`);
	// console.log(`\t\t menu-key-mode [disable|enable]`);
	//
	// console.log(`\n\t Recording Settings`);
	// console.log(`\t\t voice-recording [automatic|diable]`);
	// console.log(`\t\t recording-mode [static|dynamic]`);
	// console.log(`\t\t recording-segments [all|talk]`);
	// console.log(`\t\t auto-record-start [true|false]`);
	// console.log(`\t\t record-tone-level [0-48]`);
	// console.log(`\t\t recording-icon [true|false]`);
	// console.log(`\t\t recording-server-1-address xxx.xxx.xxx.xxx`);
	//
	// console.log(`\n\t Encryption Settings`);
	// console.log(`\t\t encryption-auth-mode [true|false]`);
	// console.log(`\t\t encryption-icon [true|false]`);
	// console.log(`\t\t encryption-otp xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`);
	//
	// console.log(`\n\t XML Applications`);
	// console.log(`\t\t xml-directory http|https://xxxxxxxx/yyyyy`);
}

if(variables.system.loop){
	loopHosts();
}
