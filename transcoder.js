#!/usr/local/bin/node

// Configuration (Modify these to your needs)
var config = {
	global: {
		version: '0.0.2',
		converterpath: '/usr/bin/ffmpeg',
		convertsamplerate: 48000
	},
	server: {
		ip: '0.0.0.0',
		port: '7777',
		allowedips: ['127.0.0.1', '10.135.0.2', '10.135.192.26']
	},
	statuspage: {
		allowedips: ['127.0.0.1'],
		readable: {
			path: '/status',
			allowedips: ['10.135.192.26']
		},
		parseable: { // Calling this url crashes the entire process completely, because [Circular] elements can't be converted to json ("TypeError: Converting circular structure to JSON")
			path: '/status?json',
			allowedips: ['10.135.0.2']
		},
		inspect: { // Only call this url if you really need to, because the processing of this call takes a very very very long time and often (nearly everytime) blocks the entire process until the inspection data is completely transmitted to the client!!!
			path: '/status?inspect',
			allowedips: ['10.135.0.1'],
			options: {
				'showHidden': true,
				'depth': null
			}
		}
	}
};
var mounts = {
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
		notices: ['This is', 'a', 'teststream'],
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
	},
	'/main-aac': {
		name: 'RaveOne.FM Mainstream AAC',
		url: 'http://raveone.fm/',
		genre: 'RaveOne.FM Mainstream AAC',
		bitrate: 128,
		samplerate: 44100,
		codec: 'libfaac',
		format: 'adts',
		metaint: 8192,
		contenttype: 'audio/x-aac',
		allowedips: ['127.0.0.1', '10.135.0.2', '10.135.192.26']
	}
};
var sources = {
	'dj': {
		url: 'http://localhost:8080/',
		retrywait: 1000,
		jingleafterdisconnect: 'adjingle',
		unsyncdiscard: true,
		timeout: 1000,
		destinations: {
			'/main-192': {
				priority: 10
			},
			'/main-128': {
				priority: 10
			},
			'/main-aac': {
				priority: 10
			}
		}
	},
	'playlist': {
		url: 'http://10.135.0.2:8080/',
		retrywait: 1000,
		unsyncdiscard: true,
		timeout: 1000,
		destinations: {
			'/main-192': {
				priority: 9
			},
			'/main-128': {
				priority: 9
			},
			'/main-aac': {
				priority: 9
			}
		}
	}
};
var jingles = {
	'adjingle': {
		url: 'http://10.135.0.2/streamad/streamad.php',
		listen: 'SIGUSR2',
		destinations: {
			'/main-192': {
				priority: 9
			},
			'/main-128': {
				priority: 9
			},
			'/main-aac': {
				priority: 10
			}
		}
	}
};

var http = require('http');
var in_array = function(needle,haystack,argStrict){var key='',strict=!!argStrict;if(strict){for(key in haystack){if(haystack[key]===needle){return true;}}}else{for(key in haystack){if(haystack[key]==needle){return true;}}}return false;}
var isset = function(){var a=arguments,l=a.length,i=0,undef;if(l===0){throw new Error('Empty isset');}while(i!==l){if(a[i]===undef||a[i]===null){return false;}i++;}return true;};
var os = require('os');
var shuffle = function(inputArr){var valArr=[],k='',i=0,strictForIn=false,populateArr=[];for(k in inputArr){if(inputArr.hasOwnProperty(k)){valArr.push(inputArr[k]);if(strictForIn){delete inputArr[k];}}}valArr.sort(function(){return 0.5-Math.random();});this.php_js=this.php_js||{};this.php_js.ini=this.php_js.ini||{};strictForIn=this.php_js.ini['phpjs.strictForIn']&&this.php_js.ini['phpjs.strictForIn'].local_value&&this.php_js.ini['phpjs.strictForIn'].local_value!=='off';populateArr=strictForIn?inputArr:populateArr;for(i=0;i<valArr.length;i++){populateArr[i]=valArr[i];}return strictForIn||populateArr;};
var spawn = require('child_process').spawn;
var str_repeat = function(input,multiplier){var y='';while(true){if(multiplier&1){y+=input;}multiplier>>=1;if(multiplier){input+=input;}else{break;}}return y;}
var uniqid = function(prefix,more_entropy){if(typeof prefix==='undefined'){prefix='';}var retId;var formatSeed=function(seed,reqWidth){seed=parseInt(seed,10).toString(16);if(reqWidth<seed.length){return seed.slice(seed.length-reqWidth);}if(reqWidth>seed.length){return Array(1+(reqWidth-seed.length)).join('0')+seed;}return seed;};if(!this.php_js){this.php_js={};}if(!this.php_js.uniqidSeed){this.php_js.uniqidSeed=Math.floor(Math.random()*0x75bcd15);}this.php_js.uniqidSeed++;retId=prefix;retId+=formatSeed(parseInt(new Date().getTime()/1000,10),8);retId+=formatSeed(this.php_js.uniqidSeed,5);if(more_entropy){retId+=(Math.random()*10).toFixed(8).toString();}return retId;}
var util = require('util');
var clrlinepad = '\r'+str_repeat(' ', process.stdout.columns)+str_repeat('\b', process.stdout.columns);
var log = function(msg){if(typeof msg==='undefined'){return};process.stdout.write(clrlinepad);util.log(msg);/*dostatoutput();*/};

process.stdout.on('resize', function() {
	clrlinepad = '\r'+str_repeat(' ', process.stdout.columns)+str_repeat('\b', process.stdout.columns);
});

var mount = function(mountpoint) {
	log('Spawning mount('+mountpoint+')');
	mounts[mountpoint]._ = {};
	mounts[mountpoint]._.clients = {};
	mounts[mountpoint]._.desynced = false;
	mounts[mountpoint]._.source = {};

	var options = [];

	if(mounts[mountpoint].debug !== true && config.global.debug !== true) {
		options.push('-loglevel', 'quiet');
	};

	options.push('-acodec', 'flac');

	if(typeof mounts[mountpoint].analyzeduration === 'number' && mounts[mountpoint].analyzeduration >= 0 && parseInt(mounts[mountpoint].analyzeduration) === mounts[mountpoint].analyzeduration) {
		options.push('-analyzeduration', mounts[mountpoint].analyzeduration);
	} else if(typeof config.global.analyzeduration === 'number' && config.global.analyzeduration >= 0 && parseInt(config.global.analyzeduration) === config.global.analyzeduration) {
		options.push('-analyzeduration', config.global.analyzeduration);
	} else {
		options.push('-analyzeduration', 5000);
	};

	options.push('-f', 'flac');

	options.push('-re');

	options.push('-i', 'pipe:0');

	if(typeof mounts[mountpoint].bitrate === 'number' && mounts[mountpoint].bitrate > 0 && parseInt(mounts[mountpoint].bitrate) === mounts[mountpoint].bitrate) {
		options.push('-ab', mounts[mountpoint].bitrate+'k');
	} else if(typeof config.global.bitrate === 'number' && config.global.bitrate > 0 && parseInt(config.global.bitrate) === config.global.bitrate) {
		options.push('-ab', config.global.bitrate);
	} else {
		options.push('-ab', '128k');
	};

	if(typeof mounts[mountpoint].channels === 'number' && mounts[mountpoint].channels > 0 && parseInt(mounts[mountpoint].channels) === mounts[mountpoint].channels) {
		options.push('-ac', mounts[mountpoint].channels);
	} else if(typeof config.global.channels === 'number' && config.global.channels > 0 && parseInt(config.global.channels) === config.global.channels) {
		options.push('-ac', config.global.channels);
	} else {
		options.push('-ac', 2);
	};

	if(typeof mounts[mountpoint].codec === 'string' && mounts[mountpoint].codec.trim() !== '') {
		options.push('-acodec', mounts[mountpoint].codec);
	} else if(typeof config.global.codec === 'string' && config.global.codec.trim() !== '') {
		options.push('-acodec', config.global.codec);
	} else {
		options.push('-acodec', 'libmp3lame');
	};

	if(typeof mounts[mountpoint].samplerate === 'number' && mounts[mountpoint].samplerate > 0 && parseInt(mounts[mountpoint].samplerate) === mounts[mountpoint].samplerate) {
		options.push('-ar', mounts[mountpoint].samplerate);
	} else if(typeof config.global.samplerate === 'number' && config.global.samplerate > 0 && parseInt(config.global.samplerate) === config.global.samplerate) {
		options.push('-ar', config.global.samplerate);
	} else {
		options.push('-ar', 44100);
	};

	if(typeof mounts[mountpoint].format === 'string' && mounts[mountpoint].format.trim() !== '') {
		options.push('-f', mounts[mountpoint].format);
	} else if(typeof config.global.format === 'string' && config.global.format.trim() !== '') {
		options.push('-f', config.global.format);
	} else {
		options.push('-f', 'mp3');
	};

	options.push('-flags2', 'local_header');

	options.push('-preset', 'ultrafast');

	options.push('-strict', '-2');

	options.push('pipe:1');

	mounts[mountpoint]._.proc = spawn(config.global.converterpath, options);

	if(mounts[mountpoint].debug === true || config.global.debug === true) {
		mounts[mountpoint]._.proc.stderr.on('data', function(chunk) {
			process.stderr.write(chunk);
		});
	};

	mounts[mountpoint]._.proc.stdout.on('data', function(chunk) {
		Object.keys(mounts[mountpoint]._.clients).forEach(function(clientid) {
			if(mounts[mountpoint]._.clients[clientid] && mounts[mountpoint]._.clients[clientid].res.writable === true) {
				if(mounts[mountpoint]._.clients[clientid].unsynced = !mounts[mountpoint]._.clients[clientid].res.write(chunk)) {
					mounts[mountpoint]._.clients[clientid].res.once('drain', function() {
						mounts[mountpoint]._.clients[clientid].unsynced = false;
					});
				};
			};
		});
		/*dostatoutput();*/
	});

	mounts[mountpoint]._.proc.stdin.on('drain', function() {
		mounts[mountpoint]._.desynced = false;
	});

	mounts[mountpoint]._.proc.once('close', function() {
		mount(mountpoint);
	});
};

var source = function(sourcename) {
	var suicide = false;
	sources[sourcename]._ = {};
	sources[sourcename]._.id = sourcename+'_'+uniqid('', true);

	var options = [];

	if(sources[sourcename].debug !== true && config.global.debug !== true) {
		options.push('-loglevel', 'quiet');
	};

	if(typeof sources[sourcename].analyzeduration === 'number' && sources[sourcename].analyzeduration >= 0 && parseInt(sources[sourcename].analyzeduration) === sources[sourcename].analyzeduration) {
		options.push('-analyzeduration', mounts[sourcename].analyzeduration);
	} else if(typeof config.global.analyzeduration === 'number' && config.global.analyzeduration >= 0 && parseInt(config.global.analyzeduration) === config.global.analyzeduration) {
		options.push('-analyzeduration', config.global.analyzeduration);
	} else {
		options.push('-analyzeduration', 5000);
	};

	if(sources[sourcename].nativerate === true || config.global.nativerate === true) {
		options.push('-re');
	};

	if(typeof sources[sourcename].url === 'string' && sources[sourcename].url.trim() !== '') {
		options.push('-i', sources[sourcename].url);
	} else if(typeof config.global.url === 'string' && config.global.url.trim() !== '') {
		options.push('-i', config.global.url);
	} else {
		options.push('-i', 'http://mp3.tb-stream.net/');
	};

	if(typeof sources[sourcename].channels === 'number' && sources[sourcename].channels > 0 && parseInt(sources[sourcename].channels) === sources[sourcename].channels) {
		options.push('-ac', sources[sourcename]);
	} else if(typeof config.global.channels === 'number' && config.global.channels > 0 && parseInt(config.global.channels) === config.global.channels) {
		options.push('-ac', config.global.channels);
	} else {
		options.push('-ac', 2);
	};

	options.push('-acodec', 'flac');

	if(typeof config.global.convertsamplerate === 'number' && config.global.convertsamplerate > 0 && parseInt(config.global.convertsamplerate) === config.global.convertsamplerate) {
		options.push('-ar', config.global.convertsamplerate);
	} else {
		options.push('-ar', 44100);
	};

	options.push('-f', 'flac');

	options.push('-preset', 'ultrafast');

	options.push('-sample_fmt', 's16');

	options.push('-sn', '-vn');

	options.push('pipe:1');

	sources[sourcename]._.proc = spawn(config.global.converterpath, options);

	if(sources[sourcename].debug === true || config.global.debug === true) {
		sources[sourcename]._.proc.stderr.on('data', function(chunk) {
			process.stderr.write(chunk);
		});
	};

	if(typeof sources[sourcename].timeout === 'number' && sources[sourcename].timeout > 0 && parseInt(sources[sourcename].timeout) === sources[sourcename].timeout) {
		sources[sourcename]._.timeout = {};
	} else {
		sources[sourcename]._.timeout = false;
	};

	sources[sourcename]._.proc.stdout.once('data', function(chunk) {
		var firstchunk = chunk;
		sources[sourcename]._.proc.stdout.on('data', function(chunk) {
			if(suicide === true) {
				return;
			};
			Object.keys(sources[sourcename].destinations).forEach(function(destinationkey) {
				if(mounts[destinationkey]) {
					if(!mounts[destinationkey]._.source._ || mounts[destinationkey]._.source.destinations[destinationkey].priority < sources[sourcename].destinations[destinationkey].priority) {
						if(mounts[destinationkey]._.source._) {
							log('Switched '+destinationkey+' from '+mounts[destinationkey]._.source.url+' to '+sources[sourcename].url);
						} else {
							log('Switched '+destinationkey+' from none to '+sources[sourcename].url);
						};
						mounts[destinationkey]._.source = sources[sourcename];
					};
					if(mounts[destinationkey]._.source._.id === sources[sourcename]._.id) {
						if(mounts[destinationkey]._.proc.stdin.writable === true && (mounts[destinationkey]._.desynced === false && sources[sourcename].unsyncdiscard === true)) {
							if(firstchunk) {
								mounts[destinationkey]._.desynced = !mounts[destinationkey]._.proc.stdin.write(firstchunk);
							};
							mounts[destinationkey]._.desynced = !mounts[destinationkey]._.proc.stdin.write(chunk);
						};
					};
				};
			});
			if(firstchunk) {
				firstchunk = false;
			};
			if(sources[sourcename]._.timeout) {
				clearTimeout(sources[sourcename]._.timeout);
				sources[sourcename]._.timeout = setTimeout(function() {
					if(suicide === true) {
						return;
					};
					suicide = true;
					Object.keys(sources[sourcename].destinations).forEach(function(destinationkey) {
						if(mounts[destinationkey] && mounts[destinationkey]._.source && mounts[destinationkey]._.source._ && mounts[destinationkey]._.source._.id === sources[sourcename]._.id) {
							mounts[destinationkey]._.source = {};
						};
					});
					sources[sourcename]._.proc.kill();
					if(sources[sourcename].jingleafterdisconnect && typeof sources[sourcename].jingleafterdisconnect === 'string' && jingles[sources[sourcename].jingleafterdisconnect]) {
						jingle(sources[sourcename].jingleafterdisconnect, function() {
							source(sourcename);
						});
					} else {
						setTimeout(function() {
							source(sourcename);
						}, ((typeof sources[sourcename].retrywait === 'number')?sources[sourcename].retrywait:0));
					};
				}, sources[sourcename].timeout);
			};
		});
	});
	sources[sourcename]._.proc.once('close', function() {
		if(suicide === true) {
			return;
		};
		suicide = true;
		Object.keys(sources[sourcename].destinations).forEach(function(destinationkey) {
			if(mounts[destinationkey] && mounts[destinationkey]._.source && mounts[destinationkey]._.source._ && mounts[destinationkey]._.source._.id === sources[sourcename]._.id) {
				mounts[destinationkey]._.source = {};
			};
		});
		if(sources[sourcename].jingleafterdisconnect && typeof sources[sourcename].jingleafterdisconnect === 'string' && jingles[sources[sourcename].jingleafterdisconnect]) {
			jingle(sources[sourcename].jingleafterdisconnect, function() {
				source(sourcename);
			});
		} else {
			setTimeout(function() {
				source(sourcename);
			}, ((typeof sources[sourcename].retrywait === 'number')?sources[sourcename].retrywait:0));
		};
	});
};

var jingle = function(jinglename, callback) {
	log('Spawning jingle('+jinglename+')');
	var usable = false;
	jingles[jinglename]._ = {};
	jingles[jinglename]._.id = jinglename+'_'+uniqid('', true);

	var options = [];

	if(jingles[jinglename].debug !== true && config.global.debug !== true) {
		options.push('-loglevel', 'quiet');
	};

	if(typeof jingles[jinglename].analyzeduration === 'number' && jingles[jinglename].analyzeduration >= 0 && parseInt(jingles[jinglename].analyzeduration) === jingles[jinglename].analyzeduration) {
		options.push('-analyzeduration', jingles[jingle].analyzeduration);
	} else if(config.global.analyzeduration && typeof config.global.analyzeduration === 'number' && config.global.analyzeduration >= 0 && parseInt(config.global.analyzeduration) === config.global.analyzeduration) {
		options.push('-analyzeduration', config.global.analyzeduration);
	} else {
		options.push('-analyzeduration', 5000);
	};

	options.push('-re');

	if(typeof jingles[jinglename].url === 'string' && jingles[jinglename].url.trim() !== '') {
		options.push('-i', jingles[jinglename].url);
	} else if(typeof config.global.jingleurl === 'string' && config.global.jingleurl.trim() !== '') {
		options.push('-i', config.global.jingleurl);
	} else {
		options.push('-i', 'http://localhost/streamad.php');
	};

	if(typeof jingles[jinglename].channels === 'number' && jingles[jinglename].channels > 0 && parseInt(jingles[jinglename].channels) === jingles[jinglename].channels) {
		options.push('-ac', jingles[jinglename]);
	} else if(typeof config.global.channels === 'number' && config.global.channels > 0 && parseInt(config.global.channels) === config.global.channels) {
		options.push('-ac', config.global.channels);
	} else {
		options.push('-ac', 2);
	};

	options.push('-acodec', 'flac');

	if(typeof config.global.convertsamplerate === 'number' && config.global.convertsamplerate > 0 && parseInt(config.global.convertsamplerate) === config.global.convertsamplerate) {
		options.push('-ar', config.global.convertsamplerate);
	} else {
		options.push('-ar', 44100);
	};

	options.push('-f', 'flac');

	options.push('-preset', 'ultrafast');

	options.push('-sample_fmt', 's16');

	options.push('-sn', '-vn');

	options.push('pipe:1');

	jingles[jinglename]._.proc = spawn(config.global.converterpath, options);

	if(jingles[jinglename].debug === true || config.global.debug === true) {
		jingles[jinglename]._.proc.stderr.on('data', function(chunk) {
			process.stderr.write(chunk);
		});
	};

	Object.keys(jingles[jinglename].destinations).forEach(function(destinationkey) {
		if(mounts[destinationkey]) {
			if(!mounts[destinationkey]._.source._ || mounts[destinationkey]._.source.destinations[destinationkey].priority < jingles[jinglename].destinations[destinationkey].priority) {
				if(mounts[destinationkey]._.source && mounts[destinationkey]._.source._) {
					log('Switched '+destinationkey+' from '+mounts[destinationkey]._.source.url+' to '+jingles[jinglename].url);
				} else {
					log('Switched '+destinationkey+' from none to '+jingles[jinglename].url);
				};
				mounts[destinationkey]._.source = jingles[jinglename];
				usable = true;
			};
		};
	});

	if(usable === true) {
		jingles[jinglename]._.proc.stdout.on('data', function(chunk) {
			Object.keys(jingles[jinglename].destinations).forEach(function(destinationkey) {
				if(mounts[destinationkey]) {
					if(mounts[destinationkey]._.source._.id === jingles[jinglename]._.id) {
						if(mounts[destinationkey]._.proc.stdin.writable) {
							mounts[destinationkey]._.desynced = !mounts[destinationkey]._.proc.stdin.write(chunk);
						};
					};
				};
			});
		});
	};
	jingles[jinglename]._.proc.once('close', function() {
		Object.keys(jingles[jinglename].destinations).forEach(function(destinationkey) {
			if(mounts[destinationkey] && mounts[destinationkey]._.source && mounts[destinationkey]._.source._ && mounts[destinationkey]._.source._.id === jingles[jinglename]._.id) {
				mounts[destinationkey]._.source = {};
			};
		});
		if(typeof callback === 'function') {
			callback();
		};
	});
	if(usable === false) {
		jingles[jinglename]._.proc.kill();
	};
};

Object.keys(mounts).forEach(function(mountpoint) {
	mount(mountpoint);
});

Object.keys(sources).forEach(function(sourcekey) {
	log('Spawning source('+sourcekey+')');
	source(sourcekey);
});

var server = http.createServer(function(req, res) {
	if (req.method.toUpperCase() !== 'GET') {
		log(req.socket.remoteAddress+':'+req.socket.remotePort+' tried method '+req.method.toUpperCase());
		req.socket.destroy();
	} else if(config.statuspage && config.statuspage.readable && config.statuspage.readable.path && req.url === config.statuspage.readable.path && ((in_array('*', config.statuspage.readable.allowedips) || in_array('0.0.0.0', config.statuspage.readable.allowedips) || in_array(req.socket.remoteAddress, config.statuspage.readable.allowedips)) || (in_array('*', config.statuspage.allowedips) || in_array('0.0.0.0', config.statuspage.allowedips) || in_array(req.socket.remoteAddress, config.statuspage.allowedips)))) {
		res.writeHead(200, {
			'content-type': 'text/plain',
			'connection': 'close'
		});
		var uptime = process.uptime();
		var systemload = Math.round(os.loadavg()[0]*100)+'% ('+os.loadavg().join(' ')+')';
		var memoryheap = process.memoryUsage();
		memoryheap = Math.round(memoryheap.heapUsed/memoryheap.heapTotal*100)+'%';
		res.write(
			'Uptime: '+uptime+'\n'+
			'System load: '+systemload+'\n'+
			'Memory heap: '+memoryheap+'\n'
		);
		Object.keys(mounts).forEach(function(mountpoint) {
			res.write('Mount '+mountpoint+'\n');
			if(!mounts[mountpoint]._) {
				res.write(' Offline');
			} else {
				if(mounts[mountpoint]._.source._) {
					res.write(' Source '+mounts[mountpoint]._.source._.id+' '+mounts[mountpoint]._.source.url+'\n');
				} else {
					res.write(' Source null\n');
				};
				Object.keys(mounts[mountpoint]._.clients).forEach(function(clientid) {
					res.write(' Client '+clientid+' '+mounts[mountpoint]._.clients[clientid].req.socket.remoteAddress+':'+mounts[mountpoint]._.clients[clientid].req.socket.remotePort+'\n');
				});
			};
		});
		res.end();
	} else if(config.statuspage && config.statuspage.parseable && config.statuspage.parseable.path && req.url === config.statuspage.parseable.path && ((in_array('*', config.statuspage.parseable.allowedips) || in_array('0.0.0.0', config.statuspage.parseable.allowedips) || in_array(req.socket.remoteAddress, config.statuspage.parseable.allowedips)) || (in_array('*', config.statuspage.allowedips) || in_array('0.0.0.0', config.statuspage.allowedips) || in_array(req.socket.remoteAddress, config.statuspage.allowedips)))) {
		res.writeHead(200, {
			'content-type': 'application/json',
			'connection': 'close'
		});
		res.end(JSON.stringify({'config':config,'mounts':mounts,'sources':sources,'jingles':jingles}));
	} else if(config.statuspage && config.statuspage.inspect && config.statuspage.inspect.path && req.url === config.statuspage.inspect.path && ((in_array('*', config.statuspage.inspect.allowedips) || in_array('0.0.0.0', config.statuspage.inspect.allowedips) || in_array(req.socket.remoteAddress, config.statuspage.inspect.allowedips)) || (in_array('*', config.statuspage.allowedips) || in_array('0.0.0.0', config.statuspage.allowedips) || in_array(req.socket.remoteAddress, config.statuspage.allowedips)))) {
		res.writeHead(200, {
			'content-type': 'application/json',
			'connection': 'close'
		});
		res.end(util.inspect({'config':config,'mounts':mounts,'sources':sources,'jingles':jingles}, config.statuspage.inspect.options));
	} else if(!mounts[req.url] || (!in_array('*', mounts[req.url].allowedips) && !in_array('0.0.0.0', mounts[req.url].allowedips) && !in_array(req.socket.remoteAddress, mounts[req.url].allowedips) && !in_array('*', config.server.allowedips) && !in_array('0.0.0.0', config.server.allowedips) && !in_array(req.socket.remoteAddress, config.server.allowedips))) {
		log(req.socket.remoteAddress+' tried to connect');
		req.socket.destroy();
	} else {
		log(req.socket.remoteAddress+' connected to mountpoint '+req.url);
		res.sendDate = false;
		var headers = {};
		headers['connection'] = 'close';
		headers['content-type'] = mounts[req.url].contenttype;
		headers['icy-br'] = mounts[req.url].bitrate;
		headers['icy-genre'] = mounts[req.url].genre;
		headers['icy-metaint'] = mounts[req.url].metaint;
		headers['icy-name'] = mounts[req.url].name;
		if(mounts[req.url].notices) {
			var noticenum = 0;
			Object.keys(mounts[req.url].notices).forEach(function(notice) {
				noticenum++;
				headers['icy-notice'+noticenum] = mounts[req.url].notices[notice];
			});
		};
		headers['icy-pub'] = ((mounts[req.url].ispublic)?1:0);
		headers['icy-url'] = mounts[req.url].url;
		res.writeHead(200, headers);
		var clientid = uniqid('', true);
		mounts[req.url]._.clients[clientid] = {'unsynced': false, 'req': req, 'res': res};
		res.once('close', function() {
			delete mounts[req.url]._.clients[clientid];
		});
	};
}).listen(config.server.port, config.server.ip);

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
