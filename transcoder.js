#!/usr/bin/env node

'use strict';
/*jslint
   browser: false, devel: false, node: true, rhino: false, passfail: false,
   bitwise: false, debug: false, eqeq: false, evil: false, forin: false,
   newcap: false, nomen: true, plusplus: true, regexp: false, unparam: false,
   sloppy: false, stupid: false, sub: false, vars: false, white: false,
   indent: 4, maxlen: 256
*/

// Configuration (Modify these to your needs)
var config = {};
var mounts = {};
var sources = {};

var functions = require('./functions.js');
var http = functions.http;
var in_array = functions.in_array;
var os = functions.os;
var child_process = functions.child_process;
var uniqid = functions.uniqid;
var util = functions.util;
var log = functions.log;
var Streampass = functions.streampass;

var mountstreamsin = {};
var mountstreamsout = {};

var mount = function (mountpoint) {
    var options = [],
        proc = false;
    
    log('Spawning mount(' + mountpoint + ')');
    
    mounts[mountpoint]._ = {};
    mounts[mountpoint]._.clients = {};
    mounts[mountpoint]._.source = false;
    
    if (!mountstreamsin[mountpoint]) {
        mountstreamsin[mountpoint] = new Streampass();
    }
    
    if (!mountstreamsout[mountpoint]) {
        mountstreamsout[mountpoint] = new Streampass();
        mountstreamsout[mountpoint].setMaxListeners(0);
    }
    
    if (typeof mounts[mountpoint].options === 'object' && mounts[mountpoint].options instanceof Array) {
        options = mounts[mountpoint].options;
    } else {
        if (mounts[mountpoint].debug !== true && config.global.debug !== true) {
            options.push('-loglevel', 'quiet');
        }
        
        options.push('-ac', 2);
        options.push('-acodec', 'pcm_u8');
        
        if (Number(mounts[mountpoint].analyzeduration) >= 0) {
            options.push('-analyzeduration', mounts[mountpoint].analyzeduration);
        } else if (Number(config.global.analyzeduration) >= 0) {
            options.push('-analyzeduration', config.global.analyzeduration);
        } else {
            options.push('-analyzeduration', 5000);
        }
        
        if (Number(config.global.convertsamplerate) > 0) {
            options.push('-ar', config.global.convertsamplerate);
        } else {
            options.push('-ar', 48000);
        }
        
        options.push('-f', 'u8');
        options.push('-re');
        options.push('-i', 'pipe:0');
        
        if (Number(mounts[mountpoint].bitrate) > 0) {
            options.push('-ab', mounts[mountpoint].bitrate + 'k');
        } else if (Number(config.global.bitrate) > 0) {
            options.push('-ab', config.global.bitrate);
        } else {
            options.push('-ab', '128k');
        }
        
        if (Number(mounts[mountpoint].channels) > 0) {
            options.push('-ac', mounts[mountpoint].channels);
        } else if (Number(config.global.channels) > 0) {
            options.push('-ac', config.global.channels);
        } else {
            options.push('-ac', 2);
        }
        
        if (typeof mounts[mountpoint].codec === 'string' && mounts[mountpoint].codec.trim() !== '') {
            options.push('-acodec', mounts[mountpoint].codec);
        } else if (typeof config.global.codec === 'string' && config.global.codec.trim() !== '') {
            options.push('-acodec', config.global.codec);
        } else {
            options.push('-acodec', 'libmp3lame');
        }
        
        if (Number(mounts[mountpoint].samplerate) > 0) {
            options.push('-ar', mounts[mountpoint].samplerate);
        } else if (Number(config.global.samplerate) > 0) {
            options.push('-ar', config.global.samplerate);
        } else {
            options.push('-ar', 48000);
        }
        
        if (typeof mounts[mountpoint].format === 'string' && mounts[mountpoint].format.trim() !== '') {
            options.push('-f', mounts[mountpoint].format);
        } else if (typeof config.global.format === 'string' && config.global.format.trim() !== '') {
            options.push('-f', config.global.format);
        } else {
            options.push('-f', 'mp3');
        }
        
        options.push('-flags2', 'local_header');
        options.push('-strict', '-2');
        options.push('pipe:1');
        
        mounts[mountpoint].options = options;
    }
    
    proc = child_process.spawn(mounts[mountpoint].converterpath, options);
    
    proc.once('error', function (e) {});
    proc.stdin.once('error', function (e) {});
    proc.stdout.once('error', function (e) {});
    proc.stderr.once('error', function (e) {});
    
    if (mounts[mountpoint].debug === true || config.global.debug === true) {
        proc.stderr.on('data', function (chunk) {
            process.stderr.write(chunk);
        });
    } else {
        proc.stderr.resumt(); // This fixes broken ffmpeg builds, which don't accept -loglevel quiet and still output data on stderr
    }
    
    proc.stdout.on('data', function (chunk) {
        mountstreamsout[mountpoint].write(chunk);
    });
    
    mountstreamsin[mountpoint].on('data', function (chunk) {
        if (proc.stdin.writable && (!proc.stdin._writableState.length || !mounts[mountpoint].unsyncdiscard)) {
            proc.stdin.write(chunk);
        }
    });
    
    proc.once('close', function () {
        mount(mountpoint);
    });
};

var source = function (sourcename, callbacktodo) {
    if (sources[sourcename].isjingle) {
        log('Spawning source(' + sourcename + ')');
    }
    
    var suicide = false,
        options = [],
        proc = false,
        timeout = false,
        docallback = false,
        nextcallback = false;
    
    sources[sourcename]._ = {};
    sources[sourcename]._.id = sourcename + '_' + uniqid('', true);
    
    if (typeof sources[sourcename].options === 'object' && sources[sourcename].options instanceof Array) {
        options = sources[sourcename].options;
    } else {
        if (sources[sourcename].debug !== true && config.global.debug !== true) {
            options.push('-loglevel', 'quiet');
        }
        
        if (Number(sources[sourcename].analyzeduration) >= 0) {
            options.push('-analyzeduration', mounts[sourcename].analyzeduration);
        } else if (Number(config.global.analyzeduration) >= 0) {
            options.push('-analyzeduration', config.global.analyzeduration);
        } else {
            options.push('-analyzeduration', 0);
        }
        
        if (sources[sourcename].nativerate === true || config.global.nativerate === true) {
            options.push('-re');
        }
        
        if (typeof sources[sourcename].url === 'string' && sources[sourcename].url.trim() !== '') {
            options.push('-i', sources[sourcename].url);
        } else if (typeof config.global.url === 'string' && config.global.url.trim() !== '') {
            options.push('-i', config.global.url);
        } else {
            options.push('-i', 'http://mp3.tb-stream.net/');
        }
        
        if (Number(sources[sourcename].channels) > 0) {
            options.push('-ac', sources[sourcename]);
        } else if (Number(config.global.channels) > 0) {
            options.push('-ac', config.global.channels);
        } else {
            options.push('-ac', 2);
        }
        
        options.push('-acodec', 'pcm_u8');
        
        if (Number(sources[sourcename].fadein) > 0) {
            options.push('-af', 'afade=t=in:ss=0:d=' + sources[sourcename].fadein);
        } else if (Number(config.global.fadein) > 0) {
            options.push('-af', 'afade=t=in:ss=0:d=' + config.global.fadein);
        }
        
        if (Number(config.global.convertsamplerate) > 0) {
            options.push('-ar', config.global.convertsamplerate);
        } else {
            options.push('-ar', 48000);
        }
        
        options.push('-f', 'u8');
        options.push('-sn', '-vn');
        options.push('pipe:1');
        sources[sourcename].options = options;
    }
    
    proc = child_process.spawn(sources[sourcename].converterpath, options);
    
    proc.once('error', function (e) {});
    proc.stdin.once('error', function (e) {});
    proc.stdout.once('error', function (e) {});
    proc.stderr.once('error', function (e) {});
    
    if (sources[sourcename].debug === true || config.global.debug === true) {
        proc.stderr.on('data', function (chunk) {
            process.stderr.write(chunk);
        });
    } else {
        proc.stderr.resumt(); // This fixes broken ffmpeg builds, which don't accept -loglevel quiet and still output data on stderr
    }
    
    if (Number(sources[sourcename].timeout) > 0) {
        timeout = {};
    }
    
    proc.stdout.on('data', function (chunk) {
        if (suicide === true) {
            return;
        }
        
        Object.keys(sources[sourcename].destinations).forEach(function (destinationkey) {
            if (!mounts[destinationkey]._.source || sources[mounts[destinationkey]._.source].destinations[destinationkey].priority < sources[sourcename].destinations[destinationkey].priority) {
                if (mounts[destinationkey]._.source) {
                    log('Switched ' + destinationkey + ' from ' + mounts[destinationkey]._.source + ' to ' + sourcename);
                } else {
                    log('Switched ' + destinationkey + ' from none to ' + sourcename);
                }
                
                mounts[destinationkey]._.source = sourcename;
            }
            if (mounts[destinationkey]._.source === sourcename) {
                mountstreamsin[destinationkey].write(chunk);
            }
        });
        
        if (timeout) {
            clearTimeout(timeout);
            
            timeout = setTimeout(function () {
                if (suicide === true) {
                    return;
                }
                suicide = true;
                
                Object.keys(sources[sourcename].destinations).forEach(function (destinationkey) {
                    if (mounts[destinationkey]._.source === sourcename) {
                        mounts[destinationkey]._.source = false;
                        log('Switched ' + destinationkey + ' from ' + sourcename + ' to none');
                    }
                });
                
                proc.kill();
                
                if (typeof callbacktodo === 'object' && callbacktodo instanceof Array && callbacktodo.length > 0) {
                    nextcallback = callbacktodo.shift();
                    source(nextcallback, callbacktodo);
                } else if (typeof sources[sourcename].callback === 'object' && sources[sourcename].callback instanceof Array && sources[sourcename].callback.length > 0 && docallback) {
                    callbacktodo = sources[sourcename].callback.slice(0);
                    nextcallback = callbacktodo.shift();
                    source(nextcallback, callbacktodo);
                } else {
                    setTimeout(function () {
                        source(sourcename);
                    }, (typeof sources[sourcename].retrywait === 'number' ? sources[sourcename].retrywait : 0));
                }
            }, sources[sourcename].timeout);
        }
    });

    proc.once('close', function () {
        if (suicide === true) {
            return;
        }
        suicide = true;
        
        Object.keys(sources[sourcename].destinations).forEach(function (destinationkey) {
            if (mounts[destinationkey]._.source === sourcename) {
                mounts[destinationkey]._.source = false;
                log('Switched ' + destinationkey + ' from ' + sourcename + ' to none');
            }
        });
        if (typeof callbacktodo === 'object' && callbacktodo instanceof Array && callbacktodo.length > 0) {
            nextcallback = callbacktodo.shift();
            source(nextcallback, callbacktodo);
        } else if (typeof sources[sourcename].callback === 'object' && sources[sourcename].callback instanceof Array && sources[sourcename].callback.length > 0 && docallback) {
            callbacktodo = sources[sourcename].callback.slice(0);
            nextcallback = callbacktodo.shift();
            source(nextcallback, callbacktodo);
        } else {
            setTimeout(function () {
                source(sourcename);
            }, (typeof sources[sourcename].retrywait === 'number' ? sources[sourcename].retrywait : 0));
        }
    });
};

var server = http.createServer(function (req, res) {
    if (req.method.toUpperCase() !== 'GET') {
        log(req.socket.remoteAddress + ':' + req.socket.remotePort + ' tried method ' + req.method.toUpperCase());
        req.socket.destroy();
    } else if (config.statuspage &&
               config.statuspage.readable &&
               config.statuspage.readable.path &&
               req.url === config.statuspage.readable.path &&
               ((in_array('*', config.statuspage.readable.allowedips) ||
                 in_array('0.0.0.0', config.statuspage.readable.allowedips) ||
                 in_array(req.socket.remoteAddress, config.statuspage.readable.allowedips)) ||
                (in_array('*', config.statuspage.allowedips) ||
                 in_array('0.0.0.0', config.statuspage.allowedips) ||
                 in_array(req.socket.remoteAddress, config.statuspage.allowedips)))) {
        res.writeHead(200, {
            'content-type': 'text/plain',
            'connection': 'close'
        });
        var uptime = process.uptime(),
            systemload = Math.round(os.loadavg()[0] * 100) + '% (' + os.loadavg().join(' ') + ')',
            memoryheap = process.memoryUsage();
        memoryheap = Math.round(memoryheap.heapUsed / memoryheap.heapTotal * 100) + '%';
        res.write('Uptime: ' + uptime + '\n' +
                  'System load: ' + systemload + '\n' +
                  'Memory heap: ' + memoryheap + '\n');
        Object.keys(mounts).forEach(function (mountpoint) {
            res.write('Mount ' + mountpoint + '\n');
            if (!mounts[mountpoint]._) {
                res.write(' Offline');
            } else {
                if (mounts[mountpoint]._.source._) {
                    res.write(' Source ' + mounts[mountpoint]._.source._.id + ' ' + mounts[mountpoint]._.source.url + '\n');
                } else {
                    res.write(' Source null\n');
                }
                Object.keys(mounts[mountpoint]._.clients).forEach(function (clientid) {
                    res.write(' Client ' + clientid + ' ' + mounts[mountpoint]._.clients[clientid].req.socket.remoteAddress + ':' + mounts[mountpoint]._.clients[clientid].req.socket.remotePort + '\n');
                });
            }
        });
        res.end();
    } else if (config.statuspage &&
               config.statuspage.parseable &&
               config.statuspage.parseable.path &&
               req.url === config.statuspage.parseable.path &&
               ((in_array('*', config.statuspage.parseable.allowedips) ||
                 in_array('0.0.0.0', config.statuspage.parseable.allowedips) ||
                 in_array(req.socket.remoteAddress, config.statuspage.parseable.allowedips)) ||
                (in_array('*', config.statuspage.allowedips) ||
                 in_array('0.0.0.0', config.statuspage.allowedips) ||
                 in_array(req.socket.remoteAddress, config.statuspage.allowedips)))) {
        res.writeHead(200, {
            'content-type': 'application/json',
            'connection': 'close'
        });
        //res.end(JSON.stringify({'config':config,'mounts':mounts,'sources':sources,'jingles':jingles}));
        res.end(util.format('%j', {'config': config, 'mounts': mounts, 'sources': sources}));
    } else if (config.statuspage &&
               config.statuspage.inspect &&
               config.statuspage.inspect.path &&
               req.url === config.statuspage.inspect.path &&
               ((in_array('*', config.statuspage.inspect.allowedips) ||
                 in_array('0.0.0.0', config.statuspage.inspect.allowedips) ||
                 in_array(req.socket.remoteAddress, config.statuspage.inspect.allowedips)) ||
                (in_array('*', config.statuspage.allowedips) ||
                 in_array('0.0.0.0', config.statuspage.allowedips) ||
                 in_array(req.socket.remoteAddress, config.statuspage.allowedips)))) {
        res.writeHead(200, {
            'content-type': 'application/json',
            'connection': 'close'
        });
        res.end(util.inspect({'config': config, 'mounts': mounts, 'sources': sources}, config.statuspage.inspect.options));
    } else if (!mounts[req.url] ||
               (!in_array('*', mounts[req.url].allowedips) &&
                !in_array('0.0.0.0', mounts[req.url].allowedips) &&
                !in_array(req.socket.remoteAddress, mounts[req.url].allowedips) &&
                !in_array('*', config.server.allowedips) &&
                !in_array('0.0.0.0', config.server.allowedips) &&
                !in_array(req.socket.remoteAddress, config.server.allowedips))) {
        log(req.socket.remoteAddress + ' tried to connect');
        req.socket.destroy();
    } else {
        var clientid = req.socket.remoteAddress + '_' + uniqid('', true),
            mountpoint = req.url,
            connecttime = new Date(),
            headers = {},
            noticenum = 0,
            streamdatacallback = false;
        streamdatacallback = function (chunk) {
            if (res.writable === true && !res.socket._writableState.length) {
                res.write(chunk);
            }
        };
        log(clientid + ' connected to mountpoint ' + req.url);
        res.sendDate = false;
        
        headers.connection = 'close';
        
        if (typeof mounts[mountpoint].contenttype === 'string' && mounts[mountpoint].contenttype.trim() !== '') {
            headers['content-type'] = mounts[mountpoint].contenttype;
        } else if (typeof config.global.contenttype === 'string' && config.global.contenttype.trim() !== '') {
            headers['content-type'] = config.global.contenttype;
        }
        
        if (Number(mounts[mountpoint].bitrate) > 0) {
            headers['icy-br'] = mounts[mountpoint].bitrate;
        } else if (Number(config.global.bitrate) > 0) {
            headers['icy-br'] = config.global.bitrate;
        } else {
            headers['icy-br'] = 128;
        }
        
        if (typeof mounts[mountpoint].genre === 'string' && mounts[mountpoint].genre.trim() !== '') {
            headers['icy-genre'] = mounts[mountpoint].genre;
        } else if (typeof config.global.genre === 'string' && config.global.genre !== '') {
            headers['icy-genre'] = config.global.genre;
        }
        
        if (Number(mounts[mountpoint].metaint) > 0) {
            headers['icy-metaint'] = mounts[mountpoint].metaint;
        } else if (Number(config.global.metaint) > 0) {
            headers['icy-br'] = config.global.metaint;
        }
        
        if (typeof mounts[mountpoint].name === 'string' && mounts[mountpoint].name.trim() !== '') {
            headers['icy-name'] = mounts[mountpoint].name;
        } else if (typeof config.global.name === 'string' && config.global.name !== '') {
            headers['icy-name'] = config.global.name;
        } else {
            headers['icy-name'] = mountpoint;
        }
        
        if (mounts[req.url].notices) {
            mounts[req.url].notices.forEach(function (notice) {
                noticenum++;
                headers['icy-notice' + noticenum] = notice;
            });
        }
        headers['icy-pub'] = ((mounts[req.url].ispublic || config.global.ispublic) ? 1 : 0);
        
        if (typeof mounts[mountpoint].url === 'string' && mounts[mountpoint].url.trim() !== '') {
            headers['icy-url'] = mounts[mountpoint].url;
        } else if (typeof config.global.url === 'string' && config.global.url !== '') {
            headers['icy-url'] = config.global.url;
        } else {
            headers['icy-url'] = req.headers.host + mountpoint;
        }
        
        res.writeHead(200, headers);
        mounts[req.url]._.clients[clientid] = {'req': req, 'res': res};
        mountstreamsout[mountpoint].on('data', streamdatacallback);
        res.once('close', function () {
            mountstreamsout[mountpoint].removeListener('data', streamdatacallback);
            log(clientid + ' disconnected from mountpoint ' + req.url + ' after ' + (((new Date()) - connecttime) / 1000) + 's');
            delete mounts[req.url]._.clients[clientid];
        });
    }
});

var parseandsetconfig = function (input, callback) {
    input = JSON.parse(input);
    config = input.config;
    mounts = input.mounts;
    sources = input.sources;
    if (typeof callback === 'function') {
        callback();
    }
};

var init = function () {
    if (typeof mounts !== 'object' || typeof sources !== 'object' || typeof config !== 'object' || typeof config.server !== 'object' || typeof config.server.port !== 'number') {
        console.error("No mounts/sources/config/config.server/config.server.port found in configuration");
        process.exit(1);
    }
    Object.keys(mounts).forEach(function (mountpoint) {
        log('Spawning mount(' + mountpoint + ')');
        if (typeof mounts[mountpoint].converterpath !== 'string' || mounts[mountpoint].converterpath.trim() === '') {
            if (typeof config.global.converterpath === 'string' && config.global.converterpath.trim() !== '') {
                mounts[mountpoint].converterpath = config.global.converterpath;
            } else {
                mounts[mountpoint].converterpath = '/usr/bin/ffmpeg';
            }
        }
        mount(mountpoint);
    });
    
    Object.keys(sources).forEach(function (sourcekey) {
        Object.keys(sources[sourcekey].destinations).forEach(function (destinationkey) {
            if (typeof sources[sourcekey].destinations[destinationkey].priority !== 'number') {
                sources[sourcekey].destinations[destinationkey].priority = 0;
            }
            if (typeof mounts[destinationkey] !== 'object') {
                delete sources[sourcekey].destinations[destinationkey];
            }
        });
        if (typeof sources[sourcekey].converterpath !== 'string' || sources[sourcekey].converterpath.trim() === '') {
            if (typeof config.global.converterpath === 'string' && config.global.converterpath.trim() !== '') {
                sources[sourcekey].converterpath = config.global.converterpath;
            } else {
                sources[sourcekey].converterpath = '/usr/bin/ffmpeg';
            }
        }
        if (!sources[sourcekey].isjingle) {
            log('Spawning source(' + sourcekey + ')');
            source(sourcekey);
        }
    });
    
    server.listen(config.server.port, config.server.ip);
};

var stdin = '';
process.stdin.on('data', function (chunk) {
    stdin += chunk;
});
process.stdin.on('close', function () {
    parseandsetconfig(stdin, function () {
        init();
    });
});