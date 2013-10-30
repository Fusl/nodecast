#!/usr/local/bin/node

// Configuration (Modify these to your needs)
var configs = {
	global: {
		converterpath: '/usr/bin/ffmpeg',
		convertsamplerate: 48000
	},
	server: {
		ip: '0.0.0.0',
		port: '7777',
		allowedips: ['127.0.0.1', '10.135.0.2', '10.135.192.26']
	}
};
var streams = {
	'/main-192': {
		name: 'RaveOne.FM Mainstream 192k',
		url: 'http://raveone.fm/',
		genre: 'RaveOne.FM Mainstream 192k',
		bitrate: 192,
		samplerate: 48000,
		codec: 'libmp3lame',
		format: 'mp3',
		metaint: 8192,
		contenttype: 'audio/mpeg',
		notices: ["This is", "a", "teststream"],
		allowedips: ['127.0.0.1', '10.135.0.2', '10.135.192.26']
	},
	'/main-128': {
		name: 'RaveOne.FM Mainstream 128k',
		url: 'http://raveone.fm/',
		genre: 'RaveOne.FM Mainstream 128k',
		bitrate: 128,
		samplerate: 44100,
		codec: 'libmp3lame',
		format: 'mp3',
		metaint: 8192,
		contenttype: 'audio/mpeg',
		allowedips: ['127.0.0.1', '10.135.0.2', '10.135.192.26']
	}
};
var sources = {
	'dj': {
		url: 'http://10.135.0.2:8080/',
		retrywait: 1000,
		adafterdisconnect: true,
		unsyncdiscard: true,
		timeout: 1000,
		destinations: {
			'/main-192': {
				priority: 10
			},
			'/main-128': {
				priority: 10
			}
		}
	},
	'playlist': {
		url: 'http://localhost:8080/',
		retrywait: 1000,
		unsyncdiscard: true,
		timeout: 1000,
		destinations: {
			'/main-192': {
				priority: 9
			},
			'/main-128': {
				priority: 9
			}
		}
	}
};
var adsources = {
	'ad1': {
		url: 'http://localhost/streamad/streamad.php',
		readrealtime: true,
		isad: true,
		listen: 'SIGUSR2',
		destinations: {
			'/stream1': {
				priority: 9
			}
		}
	}
};

// Libraries and functions
var http = require('http');
var in_array = function(needle,haystack,argStrict){var key='',strict=!!argStrict;if(strict){for(key in haystack){if(haystack[key]===needle){return true;}}}else{for(key in haystack){if(haystack[key]==needle){return true;}}}return false;}
var isset = function(){var a=arguments,l=a.length,i=0,undef;if(l===0){throw new Error('Empty isset');}while(i!==l){if(a[i]===undef||a[i]===null){return false;}i++;}return true;};
var os = require('os');
var spawn = require('child_process').spawn;
var str_repeat = function(input,multiplier){var y='';while(true){if(multiplier&1){y+=input;}multiplier>>=1;if(multiplier){input+=input;}else{break;}}return y;}
var uniqid = function(prefix,more_entropy){if(typeof prefix==='undefined'){prefix='';}var retId;var formatSeed=function(seed,reqWidth){seed=parseInt(seed,10).toString(16);if(reqWidth<seed.length){return seed.slice(seed.length-reqWidth);}if(reqWidth>seed.length){return Array(1+(reqWidth-seed.length)).join('0')+seed;}return seed;};if(!this.php_js){this.php_js={};}if(!this.php_js.uniqidSeed){this.php_js.uniqidSeed=Math.floor(Math.random()*0x75bcd15);}this.php_js.uniqidSeed++;retId=prefix;retId+=formatSeed(parseInt(new Date().getTime()/1000,10),8);retId+=formatSeed(this.php_js.uniqidSeed,5);if(more_entropy){retId+=(Math.random()*10).toFixed(8).toString();}return retId;}
var util = require('util');
var clrlinepad = '\r'+str_repeat(' ', process.stdout.columns)+str_repeat('\b', process.stdout.columns);
var log = function(msg){if(typeof msg==='undefined'){return};process.stdout.write(clrlinepad);util.log(msg);/*dostatoutput();*/};

process.stdout.on('resize', function() {
	clrlinepad = '\r'+str_repeat(' ', process.stdout.columns)+str_repeat('\b', process.stdout.columns);
});

var stream = function(mountpoint) {
	streams[mountpoint]._ = {};
	streams[mountpoint]._.clients = {};
	streams[mountpoint]._.desynced = false;
	streams[mountpoint]._.source = {};

	var options = [];

	if(!streams[mountpoint].debug && !configs.global.debug) {
		options.push('-loglevel', 'quiet');
	};

	options.push('-acodec', 'flac');

	if(streams[mountpoint].analyzeduration && typeof streams[mountpoint].analyzeduration === 'number' && streams[mountpoint].analyzeduration >= 0 && Math.floor(streams[mountpoint].analyzeduration) === streams[mountpoint].analyzeduration) {
		options.push('-analyzeduration', streams[mountpoint].analyzeduration);
	} else if(configs.global.analyzeduration && typeof configs.global.analyzeduration === 'number' && configs.global.analyzeduration >= 0 && Math.floor(configs.global.analyzeduration) === configs.global.analyzeduration) {
		options.push('-analyzeduration', configs.global.analyzeduration);
	} else {
		options.push('-analyzeduration', 5000);
	};

	options.push('-f', 'flac');

	options.push('-re');

	options.push('-i', 'pipe:0');

	if(streams[mountpoint].bitrate && typeof streams[mountpoint].bitrate === 'number' && streams[mountpoint].bitrate > 0 && Math.floor(streams[mountpoint].bitrate) === streams[mountpoint].bitrate) {
		options.push('-ab', streams[mountpoint].bitrate+'k');
	} else if(configs.global.bitrate && typeof configs.global.bitrate === 'number' && configs.global.bitrate > 0 && Math.floor(configs.global.bitrate) === configs.global.bitrate) {
		options.push('-ab', configs.global.bitrate);
	} else {
		options.push('-ab', '128k');
	};

	if(streams[mountpoint].channels && typeof streams[mountpoint].channels === 'number' && streams[mountpoint].channels > 0 && Math.floor(streams[mountpoint].channels) === streams[mountpoint].channels) {
		options.push('-ac', streams[mountpoint].channels);
	} else if(configs.global.channels && typeof configs.global.channels === 'number' && configs.global.channels > 0 && Math.floor(configs.global.channels) === configs.global.channels) {
		options.push('-ac', config.global.channels);
	} else {
		options.push('-ac', 2);
	};

	if(streams[mountpoint].codec && typeof streams[mountpoint].codec === 'string' && streams[mountpoint].codec.trim() !== '') {
		options.push('-acodec', streams[mountpoint].codec);
	} else if(configs.global.codec && typeof configs.global.codec === 'string' && configs.global.codec.trim() !== '') {
		options.push('-acodec', configs.global.codec);
	} else {
		options.push('-acodec', 'libmp3lame');
	};

	if(streams[mountpoint].samplerate && typeof streams[mountpoint].samplerate === 'number' && streams[mountpoint].samplerate > 0 && Math.floor(streams[mountpoint].samplerate) === streams[mountpoint].samplerate) {
		options.push('-ar', streams[mountpoint].samplerate);
	} else if(configs.global.samplerate && typeof configs.global.samplerate === 'number' && configs.global.samplerate > 0 && Math.floor(configs.global.samplerate) === configs.global.samplerate) {
		options.push('-ar', configs.global.samplerate);
	} else {
		options.push('-ar', 44100);
	};

	if(streams[mountpoint].format && typeof streams[mountpoint].format === 'string' && streams[mountpoint].format.trim() !== '') {
		options.push('-f', streams[mountpoint].format);
	} else if(configs.global.format && typeof configs.global.format === 'string' && configs.global.format.trim() !== '') {
		options.push('-f', configs.global.format);
	} else {
		options.push('-f', 'mp3');
	};

	options.push('-flags2', 'local_header');

	options.push('-preset', 'ultrafast');

	options.push('-strict', '-2');

	options.push('pipe:1');

	streams[mountpoint]._.proc = spawn(configs.global.converterpath, options);

	if(streams[mountpoint].debug || configs.global.debug) {
		streams[mountpoint]._.proc.stderr.on('data', function(chunk) {
			process.stderr.write(chunk);
		});
	};

	streams[mountpoint]._.proc.stdout.on('data', function(chunk) {
		Object.keys(streams[mountpoint]._.clients).forEach(function(clientid) {
			if(streams[mountpoint]._.clients[clientid] && streams[mountpoint]._.clients[clientid].res.writable) {
				if(streams[mountpoint]._.clients[clientid].unsynced = !streams[mountpoint]._.clients[clientid].res.write(chunk)) {
					streams[mountpoint]._.clients[clientid].res.once('drain', function() {
						streams[mountpoint]._.clients[clientid].unsynced = false;
					});
				};
			};
		});
		/*dostatoutput();*/
	});

	streams[mountpoint]._.proc.stdin.on('drain', function() {
		streams[mountpoint]._.desynced = false;
	});

	streams[mountpoint]._.proc.once('close', function() {
		stream(mountpoint);
	});
};

var source = function(sourcename) {
	var suicide = false;
	sources[sourcename]._ = {};
	sources[sourcename]._.id = uniqid('', true);

	var options = [];

	if(!sources[sourcename].debug && !configs.global.debug) {
		options.push('-loglevel', 'quiet');
	};

	if(sources[sourcename].analyzeduration && typeof sources[sourcename].analyzeduration === 'number' && sources[sourcename].analyzeduration >= 0 && Math.floor(sources[sourcename].analyzeduration) === sources[sourcename].analyzeduration) {
		options.push('-analyzeduration', streams[mountpoint].analyzeduration);
	} else if(configs.global.analyzeduration && typeof configs.global.analyzeduration === 'number' && configs.global.analyzeduration >= 0 && Math.floor(configs.global.analyzeduration) === configs.global.analyzeduration) {
		options.push('-analyzeduration', configs.global.analyzeduration);
	} else {
		options.push('-analyzeduration', 5000);
	};

	if(sources[sourcename].url && typeof sources[sourcename].url === 'string' && sources[sourcename].url.trim() !== '') {
		options.push('-i', sources[sourcename].url);
	} else if(configs.global.url && typeof configs.global.url === 'string' && configs.global.url.trim() !== '') {
		options.push('-i', configs.global.url);
	} else {
		options.push('-i', 'http://mp3.tb-stream.net/');
	};

	if(sources[sourcename].channels && typeof sources[sourcename].channels === 'number' && sources[sourcename].channels > 0 && Math.floor(sources[sourcename].channels) === sources[sourcename].channels) {
		options.push('-ac', sources[sourcename]);
	} else if(configs.global.channels && typeof configs.global.channels === 'number' && configs.global.channels > 0 && Math.floor(configs.global.channels) === configs.global.channels) {
		options.push('-ac', config.global.channels);
	} else {
		options.push('-ac', 2);
	};

	options.push('-acodec', 'flac');

	if(configs.global.convertsamplerate && typeof configs.global.convertsamplerate === 'number' && configs.global.convertsamplerate > 0 && Math.floor(configs.global.convertsamplerate) === configs.global.convertsamplerate) {
		options.push('-ar', configs.global.convertsamplerate);
	} else {
		options.push('-ar', 44100);
	};

	options.push('-f', 'flac');

	options.push('-preset', 'ultrafast');

	options.push('-sample_fmt', 's16');

	options.push('-sn', '-vn');

	options.push('pipe:1');

	sources[sourcename]._.proc = spawn(configs.global.converterpath, options);

	if(sources[sourcename].timeout) {
		sources[sourcename]._.timeout = {};
	};
	sources[sourcename]._.proc.stdout.on('data', function(chunk) {
		if(suicide) {
			return;
		};
		if(sources[sourcename].timeout) {
			clearTimeout(sources[sourcename]._.timeout);
		};
		Object.keys(sources[sourcename].destinations).forEach(function(destinationkey) {
			if(streams[destinationkey]) {
				if(!streams[destinationkey]._.source || !streams[destinationkey]._.source._ || streams[destinationkey]._.source.destinations[destinationkey].priority < sources[sourcename].destinations[destinationkey].priority) {
					if(streams[destinationkey]._.source && streams[destinationkey]._.source._) {
						log("Switched "+destinationkey+" from "+streams[destinationkey]._.source.url+" to "+sources[sourcename].url);
					} else {
						log("Switched "+destinationkey+" from none to "+sources[sourcename].url);
					};
					streams[destinationkey]._.source = sources[sourcename];
				};
				if(streams[destinationkey]._.source._.id === sources[sourcename]._.id) {
					if(streams[destinationkey]._.proc.stdin.writable && (!streams[destinationkey]._.desynced && sources[sourcename].unsyncdiscard)) {
						streams[destinationkey]._.desynced = !streams[destinationkey]._.proc.stdin.write(chunk);
					};
				};
			};
		});
		if(sources[sourcename].timeout) {
			sources[sourcename]._.timeout = setTimeout(function() {
				if(suicide) {
					return;
				};
				suicide = true;
				Object.keys(sources[sourcename].destinations).forEach(function(destinationkey) {
					if(streams[destinationkey] && streams[destinationkey]._.source && streams[destinationkey]._.source._ && streams[destinationkey]._.source._.id === sources[sourcename]._.id) {
						streams[destinationkey]._.source = {};
					};
				});
				sources[sourcename]._.proc.kill();
				if(sources[sourcename].adafterdisconnect && false) {
					// TODO: write and call the advertisement function
				} else {
					setTimeout(function() {
						source(sourcename);
					}, ((typeof sources[sourcename].retrywait === 'number')?sources[sourcename].retrywait:0));
				};
			}, sources[sourcename].timeout);
		};
	});
	sources[sourcename]._.proc.once('close', function() {
		if(suicide) {
			return;
		};
		suicide = true;
		log(sourcename+" closed");
		Object.keys(sources[sourcename].destinations).forEach(function(destinationkey) {
			if(streams[destinationkey] && streams[destinationkey]._.source && streams[destinationkey]._.source._ && streams[destinationkey]._.source._.id === sources[sourcename].id) {
				streams[destinationkey]._.source = {};
			};
		});
		if(sources[sourcename].adafterdisconnect && false) {
			// TODO: write and call the advertisement function
		} else {
			setTimeout(function() {
				source(sourcename);
			}, ((typeof sources[sourcename].retrywait === 'number')?sources[sourcename].retrywait:0));
		};
	});
};

Object.keys(streams).forEach(function(streamkey) {
	log('Spawning mountpoint '+streamkey);
	stream(streamkey);
});

Object.keys(sources).forEach(function(sourcekey) {
	log('Spawning source '+sourcekey+' ('+sources[sourcekey].url+')');
	source(sourcekey);
});

var server = http.createServer(function(req, res) {
	if((typeof streams[req.url] !== 'object') || (!in_array('*', streams[req.url].allowedips) && !in_array('0.0.0.0', streams[req.url].allowedips) && !in_array(req.socket.remoteAddress, streams[req.url].allowedips) && !in_array('*', configs.server.allowedips) && !in_array('0.0.0.0', configs.server.allowedips) && !in_array(req.socket.remoteAddress, configs.server.allowedips))) {
		log(req.socket.remoteAddress+' tried to connect');
		req.socket.destroy();
	} else {
		log(req.socket.remoteAddress+' connected to mountpoint '+req.url);
		res.sendDate = false;
		var headers = {};
		headers['connection'] = 'close';
		headers['content-type'] = streams[req.url].contenttype;
		headers['icy-br'] = streams[req.url].bitrate;
		headers['icy-genre'] = streams[req.url].genre;
		headers['icy-metaint'] = streams[req.url].metaint;
		headers['icy-name'] = streams[req.url].name;
		if(typeof streams[req.url].notices === 'object') {
			var noticenum = 0;
			Object.keys(streams[req.url].notices).forEach(function(notice) {
				noticenum++;
				headers['icy-notice'+noticenum] = streams[req.url].notices[notice];
			});
		};
		headers['icy-pub'] = ((streams[req.url].ispublic)?1:0);
		headers['icy-url'] = streams[req.url].url;
		res.writeHead(200, headers);
		var clientid = uniqid('', true);
		streams[req.url]._.clients[clientid] = {'unsynced': false, 'req': req, 'res': res};
		res.once('close', function() {
			delete streams[req.url]._.clients[clientid];
		});
	};
}).listen(configs.server.port, configs.server.ip);

/*var dostatoutput = function() {
	var uptime = Math.floor(process.uptime());
	process.stdout.write(clrlinepad);
	process.stdout.write(new Date()+' uptime='+uptime+' type='+curstreamtype+'\r');
};*/

/*encode();
dodjinput();
setInterval(function() {
	dostatoutput();
}, 5000);
dostatoutput();
setTimeout(function() {
	doplinput();
}, 1000);
process.on('SIGUSR2', function() {
	log('SIGUSR2 received');
	doadinput();
});*/
