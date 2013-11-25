#!/usr/local/bin/node

"use strict";

// Configuration (Modify these to your needs)
var config = {
    global: {
        converterpath: '/usr/local/bin/ffmpeg',
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
        parseable: {
            path: '/status?json',
            allowedips: ['10.135.0.2']
        },
        inspect: {
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
    '/main-192.mp3': {
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
    '/main-128.mp3': {
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
    '/main-128.aac': {
        name: 'RaveOne.FM Mainstream AAC',
        url: 'http://raveone.fm/',
        genre: 'RaveOne.FM Mainstream AAC',
        bitrate: 64,
        samplerate: 44100,
        codec: 'libaacplus',
        format: 'adts',
        metaint: 8192,
        contenttype: 'audio/x-aac',
        allowedips: ['127.0.0.1', '10.135.0.2', '10.135.192.26']
    },
    '/main-64.aac': {
        name: 'RaveOne.FM Mainstream Low-AAC',
        url: 'http://raveone.fm/',
        genre: 'RaveOne.FM Mainstream Low-AAC',
        bitrate: 64,
        samplerate: 44100,
        codec: 'libaacplus',
        format: 'adts',
        metaint: 8192,
        contenttype: 'audio/x-aac',
        allowedips: ['127.0.0.1', '10.135.0.2', '10.135.192.26']
    }
};
var sources = {
    'dj': {
        url: 'http://localhost:8080/',
        retrywait: 100,
        //jingleafterdisconnect: 'adjingle',
        callback: function () {
            source('adjingle', function () {
                source('dj');
            });
        },
        unsyncdiscard: true,
        timeout: 1000,
        destinations: {
            '/main-192.mp3': {
                priority: 10
            },
            '/main-128.mp3': {
                priority: 10
            },
            '/main-128.aac': {
                priority: 10
            },
            '/main-64.aac': {
                priority: 10
            }
        }
    },
    'playlist': {
        url: 'http://127.0.0.1:6666/handsup',
        retrywait: 0,
        unsyncdiscard: true,
        timeout: 1000,
        destinations: {
            '/main-192.mp3': {
                priority: 9
            },
            '/main-128.mp3': {
                priority: 9
            },
            '/main-128.aac': {
                priority: 9
            },
            '/main-64.aac': {
                priority: 9
            }
        }
    },
    'adjingle': {
        url: 'http://10.135.0.2/streamad/streamad.php',
        isjingle: true,
        listen: 'SIGUSR2',
        nativerate: true,
        atHours: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
        destinations: {
            '/main-192.mp3': {
                priority: 9
            },
            '/main-128.mp3': {
                priority: 9
            },
            '/main-128.aac': {
                priority: 9
            },
            '/main-64.aac': {
                priority: 9
            }
        }
    }
};

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
        mountstreamsin[mountpoint].setMaxListeners(0);
    }
    if (!mountstreamsin[mountpoint].readable || !mountstreamsin[mountpoint].writable) {
        mountstreamsin[mountpoint].destroy();
        mountstreamsin[mountpoint] = new Streampass();
        mountstreamsin[mountpoint].setMaxListeners(0);
    }
    if (!mountstreamsout[mountpoint]) {
        mountstreamsout[mountpoint] = new Streampass();
        mountstreamsout[mountpoint].setMaxListeners(0);
    }
    if (!mountstreamsout[mountpoint].readable || !mountstreamsout[mountpoint].writable) {
        mountstreamsout[mountpoint].destroy();
        mountstreamsout[mountpoint] = new Streampass();
        mountstreamsout[mountpoint].setMaxListeners(0);
    }
    
    if (mounts[mountpoint].debug !== true && config.global.debug !== true) {
        options.push('-loglevel', 'quiet');
    }
    
    if (typeof mounts[mountpoint].options === 'object' && mounts[mountpoint].options instanceof Array) {
        options = mounts[mountpoint].options;
    } else {
        options.push('-acodec', 'flac');
        
        if (typeof mounts[mountpoint].analyzeduration === 'number' && mounts[mountpoint].analyzeduration >= 0 && parseInt(mounts[mountpoint].analyzeduration, 0) === mounts[mountpoint].analyzeduration) {
            options.push('-analyzeduration', mounts[mountpoint].analyzeduration);
        } else if (typeof config.global.analyzeduration === 'number' && config.global.analyzeduration >= 0 && parseInt(config.global.analyzeduration, 0) === config.global.analyzeduration) {
            options.push('-analyzeduration', config.global.analyzeduration);
        } else {
            options.push('-analyzeduration', 5000);
        }
        
        options.push('-f', 'flac');
        
        options.push('-re');
        
        options.push('-i', 'pipe:0');
        
        if (typeof mounts[mountpoint].bitrate === 'number' && mounts[mountpoint].bitrate > 0 && parseInt(mounts[mountpoint].bitrate, 0) === mounts[mountpoint].bitrate) {
            options.push('-ab', mounts[mountpoint].bitrate + 'k');
        } else if (typeof config.global.bitrate === 'number' && config.global.bitrate > 0 && parseInt(config.global.bitrate, 0) === config.global.bitrate) {
            options.push('-ab', config.global.bitrate);
        } else {
            options.push('-ab', '128k');
        }
        
        if (typeof mounts[mountpoint].channels === 'number' && mounts[mountpoint].channels > 0 && parseInt(mounts[mountpoint].channels, 0) === mounts[mountpoint].channels) {
            options.push('-ac', mounts[mountpoint].channels);
        } else if (typeof config.global.channels === 'number' && config.global.channels > 0 && parseInt(config.global.channels, 0) === config.global.channels) {
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
        
        if (typeof mounts[mountpoint].samplerate === 'number' && mounts[mountpoint].samplerate > 0 && parseInt(mounts[mountpoint].samplerate, 0) === mounts[mountpoint].samplerate) {
            options.push('-ar', mounts[mountpoint].samplerate);
        } else if (typeof config.global.samplerate === 'number' && config.global.samplerate > 0 && parseInt(config.global.samplerate, 0) === config.global.samplerate) {
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
    
    proc.once('error', function (e) {
        log(e);
    });
    
    if (mounts[mountpoint].debug === true || config.global.debug === true) {
        proc.stderr.on('data', function (chunk) {
            process.stderr.write(chunk);
        });
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

var source = function (sourcename) {
    if (sources[sourcename].isjingle) {
        log('Spawning source(' + sourcename + ')');
    }
    var suicide = false,
        options = [],
        proc = false,
        timeout = false,
        docallback = false;
    sources[sourcename]._ = {};
    sources[sourcename]._.id = sourcename + '_' + uniqid('', true);
    
    if (typeof sources[sourcename].options === 'object' && sources[sourcename].options instanceof Array) {
        options = sources[sourcename].options;
    } else {
        if (sources[sourcename].debug !== true && config.global.debug !== true) {
            options.push('-loglevel', 'quiet');
        }
        
        if (typeof sources[sourcename].analyzeduration === 'number' && sources[sourcename].analyzeduration >= 0 && parseInt(sources[sourcename].analyzeduration, 0) === sources[sourcename].analyzeduration) {
            options.push('-analyzeduration', mounts[sourcename].analyzeduration);
        } else if (typeof config.global.analyzeduration === 'number' && config.global.analyzeduration >= 0 && parseInt(config.global.analyzeduration, 0) === config.global.analyzeduration) {
            options.push('-analyzeduration', config.global.analyzeduration);
        } else {
            options.push('-analyzeduration', 5000);
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
        
        if (typeof sources[sourcename].channels === 'number' && sources[sourcename].channels > 0 && parseInt(sources[sourcename].channels, 0) === sources[sourcename].channels) {
            options.push('-ac', sources[sourcename]);
        } else if (typeof config.global.channels === 'number' && config.global.channels > 0 && parseInt(config.global.channels, 0) === config.global.channels) {
            options.push('-ac', config.global.channels);
        } else {
            options.push('-ac', 2);
        }
        
        options.push('-acodec', 'flac');
        
        if (typeof config.global.convertsamplerate === 'number' && config.global.convertsamplerate > 0 && parseInt(config.global.convertsamplerate, 0) === config.global.convertsamplerate) {
            options.push('-ar', config.global.convertsamplerate);
        } else {
            options.push('-ar', 48000);
        }
        
        options.push('-f', 'flac');
        
        options.push('-sample_fmt', 's16');
        
        options.push('-sn', '-vn');
        
        options.push('pipe:1');
        
        sources[sourcename].options = options;
    }
    
    proc = child_process.spawn(sources[sourcename].converterpath, options);
    
    if (sources[sourcename].debug === true || config.global.debug === true) {
        proc.stderr.on('data', function (chunk) {
            process.stderr.write(chunk);
        });
    }
    
    if (typeof sources[sourcename].timeout === 'number' && sources[sourcename].timeout > 0 && parseInt(sources[sourcename].timeout, 0) === sources[sourcename].timeout) {
        timeout = {};
    }
    
    proc.stdout.once('data', function (chunk) {
        var firstchunk = chunk;
        docallback = true;
        proc.stdout.on('data', function (chunk) {
            if (suicide === true) {
                return;
            }
            Object.keys(sources[sourcename].destinations).forEach(function (destinationkey) {
                if (mounts[destinationkey]) {
                    if (!mounts[destinationkey]._.source || sources[mounts[destinationkey]._.source].destinations[destinationkey].priority < sources[sourcename].destinations[destinationkey].priority) {
                        if (mounts[destinationkey]._.source) {
                            log('Switched ' + destinationkey + ' from ' + mounts[destinationkey]._.source.sourcename + ' to ' + sourcename);
                        } else {
                            log('Switched ' + destinationkey + ' from none to ' + sourcename);
                        }
                        mounts[destinationkey]._.source = sourcename;
                    }
                    if (mounts[destinationkey]._.source === sourcename) {
                        if (firstchunk) {
                            mountstreamsin[destinationkey].write(firstchunk);
                        }
                        mountstreamsin[destinationkey].write(chunk);
                    }
                }
            });
            if (firstchunk) {
                firstchunk = false;
            }
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
                    if (typeof sources[sourcename].callback === 'function' && docallback) {
                        sources[sourcename].callback();
                    } else {
                        setTimeout(function () {
                            source(sourcename);
                        }, (typeof sources[sourcename].retrywait === 'number' ? sources[sourcename].retrywait : 0));
                    }
                }, sources[sourcename].timeout);
            }
        });
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
        if (typeof sources[sourcename].callback === 'function' && docallback) {
            sources[sourcename].callback();
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
            noticenum = 0;
        log(clientid + ' connected to mountpoint ' + req.url);
        res.sendDate = false;
        
        headers.connection = 'close';
        
        if (typeof mounts[mountpoint].contenttype === 'string' && mounts[mountpoint].contenttype.trim() !== '') {
            headers['content-type'] = mounts[mountpoint].contenttype;
        } else if (typeof config.global.contenttype === 'string' && config.global.contenttype.trim() !== '') {
            headers['content-type'] = config.global.contenttype;
        }
        
        if (typeof mounts[mountpoint].bitrate === 'number' && mounts[mountpoint].bitrate > 0 && parseInt(mounts[mountpoint].bitrate, 0) === mounts[mountpoint].bitrate) {
            headers['icy-br'] = mounts[mountpoint].bitrate;
        } else if (typeof config.global.bitrate === 'number' && config.global.bitrate > 0 && parseInt(config.global.bitrate, 0) === config.global.bitrate) {
            headers['icy-br'] = config.global.bitrate;
        } else {
            headers['icy-br'] = 128;
        }
        
        if (typeof mounts[mountpoint].genre === 'string' && mounts[mountpoint].genre.trim() !== '') {
            headers['icy-genre'] = mounts[mountpoint].genre;
        } else if (typeof config.global.genre === 'string' && config.global.genre !== '') {
            headers['icy-genre'] = config.global.genre;
        }
        
        if (typeof mounts[mountpoint].metaint === 'number' && mounts[mountpoint].metaint > 0 && parseInt(mounts[mountpoint].metaint, 0) === mounts[mountpoint].metaint) {
            headers['icy-metaint'] = mounts[mountpoint].metaint;
        } else if (typeof config.global.metaint === 'number' && config.global.metaint > 0 && parseInt(config.global.metaint, 0) === config.global.metaint) {
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
            Object.keys(mounts[req.url].notices).forEach(function (notice) {
                noticenum++;
                headers['icy-notice' + noticenum] = mounts[req.url].notices[notice];
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
        var streamdatacallback = function (chunk) {
            if (res.writable === true && !res.socket._writableState.length) {
                res.write(chunk);
            }
        };
        mountstreamsout[mountpoint].on('data', streamdatacallback);
        res.once('close', function () {
            mountstreamsout[mountpoint].removeListener('data', streamdatacallback);
            log(clientid + ' disconnected from mountpoint ' + req.url + ' after ' + (((new Date()) - connecttime) / 1000) + 's');
            delete mounts[req.url]._.clients[clientid];
        });
    }
});

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