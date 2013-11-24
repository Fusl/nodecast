#!/usr/local/bin/node

"use strict";
/*jslint maxlen: 1000 */
/*jslint plusplus: true */
/*jslint nomen: true*/

// Configuration (Modify these to your needs)
var config = {
    'global': {
        'converterpath': '/usr/bin/ffmpeg',
        'convertsamplerate': 48000,
        'rescaninterval': 60000
    },
    'server': {
        'ip': '0.0.0.0',
        'port': '6666',
        'allowedips': ['127.0.0.1']
    },
    'statuspage': {
        'allowedips': ['127.0.0.1'],
        'readable': {
            'path': '/status',
            'allowedips': ['10.135.192.26']
        },
        'parseable': { // Calling this url crashes the entire process completely, because [Circular] elements can't be converted to json ("TypeError: Converting circular structure to JSON")
            'path': '/status?json',
            'allowedips': ['10.135.0.2']
        },
        'inspect': { // Only call this url if you really need to, because the processing of this call takes a very very very long time and often (nearly everytime) blocks the entire process until the inspection data is completely transmitted to the client!!!
            'path': '/status?inspect',
            'allowedips': ['10.135.0.1'],
            'options': {
                'showHidden': true,
                'depth': null
            }
        }
    }
};
var playlists = {
    '/handsup': {
        'directorymaps': {
            'default': '/home/fusl/Music/sets/'
        },
        'calendarmaps': {
            'fallback': 'default',
            0: 'default',
            1: 'default',
            2: 'default',
            3: 'default',
            4: 'default',
            5: 'default',
            6: 'default',
            7: 'default',
            8: 'default',
            9: 'default',
            10: 'default',
            11: 'default',
            12: 'default',
            13: 'default',
            14: 'default',
            15: 'default',
            16: 'default',
            17: 'default',
            18: 'default',
            19: 'default',
            20: 'default',
            21: 'default',
            22: 'default',
            23: 'default'
        }
    },
    '/house': {
        'directorymaps': {
            'default': '/home/fusl/nodecast/playlists/house/'
        },
        'calendarmaps': {
            'fallback': 'default',
            0: 'default',
            1: 'default',
            2: 'default',
            3: 'default',
            4: 'default',
            5: 'default',
            6: 'default',
            7: 'default',
            8: 'default',
            9: 'default',
            10: 'default',
            11: 'default',
            12: 'default',
            13: 'default',
            14: 'default',
            15: 'default',
            16: 'default',
            17: 'default',
            18: 'default',
            19: 'default',
            20: 'default',
            21: 'default',
            22: 'default',
            23: 'default'
        }
    }
};

var functions = require('./functions.js');
var child_process = functions.child_process;
var fs = functions.fs;
var http = functions.http;
var in_array = functions.in_array;
var log = functions.log;
var os = functions.os;
var path = functions.path;
var shuffle = functions.shuffle;
var uniqid = functions.uniqid;
var util = functions.util;

var rescan = function () {
    Object.keys(playlists).forEach(function (playlistkey) {
        if (typeof playlists[playlistkey]._ !== 'object') {
            playlists[playlistkey]._ = {};
        }
        Object.keys(playlists[playlistkey].directorymaps).forEach(function (directorymapkey) {
            findfiles(playlists[playlistkey].directorymaps[directorymapkey], function (files) {
                playlists[playlistkey]._[directorymapkey] = files;
            });
        });
    });
};

var findfiles = function (dir, callback) {
    child_process.exec('find "' + dir + '" -type f', function (error, stdout, stderr) {
        var files = [];
        stdout.split("\n").forEach(function (file, fileIndex) {
            if (file.trim() !== '') {
                files.push(file);
            }
        });
        if (typeof callback === 'function') {
            callback(files);
        }
    });
};

var getrandfile = function (playlistkey) {
    var directorymapkey = false;
    if (typeof playlists[playlistkey].calendarmaps[(new Date()).getHours()] === 'string') {
        directorymapkey = playlists[playlistkey].calendarmaps[(new Date()).getHours()];
    } else if (typeof playlists[playlistkey].calendarmaps.falback === 'string') {
        directorymapkey = playlists[playlistkey].calendarmaps.fallback;
    } else if (typeof playlists[playlistkey].calendarmaps['default'] === 'string') {
        directorymapkey = playlists[playlistkey].calendarmaps['default'];
    }
    if (typeof playlists[playlistkey]._ === 'object') {
        if (typeof playlists[playlistkey]._[directorymapkey] === 'object') {
            return shuffle(playlists[playlistkey]._[directorymapkey])[0];
        }
    }
    return false;
};

rescan();

var server = http.createServer(function (req, res) {
    if (req.method.toUpperCase() !== 'GET') {
        log(req.socket.remoteAddress + ':' + req.socket.remotePort + ' tried method ' + req.method.toUpperCase());
        req.socket.destroy();
    } else if (config.statuspage && config.statuspage.readable && config.statuspage.readable.path && req.url === config.statuspage.readable.path && ((in_array('*', config.statuspage.readable.allowedips) || in_array('0.0.0.0', config.statuspage.readable.allowedips) || in_array(req.socket.remoteAddress, config.statuspage.readable.allowedips)) || (in_array('*', config.statuspage.allowedips) || in_array('0.0.0.0', config.statuspage.allowedips) || in_array(req.socket.remoteAddress, config.statuspage.allowedips)))) {
        res.writeHead(200, {
            'content-type': 'text/plain',
            'connection': 'close'
        });
        var uptime = process.uptime();
        var systemload = Math.round(os.loadavg()[0] * 100) + '% (' + os.loadavg().join(' ') + ')';
        var memoryheap = process.memoryUsage();
        memoryheap = Math.round(memoryheap.heapUsed / memoryheap.heapTotal * 100) + '%';
        res.write('Uptime: ' + uptime + '\n' +
                  'System load: ' + systemload + '\n' +
                  'Memory heap: ' + memoryheap + '\n');
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
        res.end(JSON.stringify({'config': config, 'playlists': playlists}));
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
        res.end(util.inspect({'config': config, 'playlists': playlists}, config.statuspage.inspect.options));
    } else if (!playlists[req.url] ||
               (!in_array('*', config.server.allowedips) &&
                !in_array('0.0.0.0', config.server.allowedips) &&
                !in_array(req.socket.remoteAddress, config.server.allowedips))) {
        log(req.socket.remoteAddress + ' tried to connect');
        req.socket.destroy();
    } else {
        var clientid = req.socket.remoteAddress + '_' + uniqid('', true);
        var playlistkey = req.url;
        var connecttime = new Date();
        log(clientid + ' connected to playlist ' + playlistkey);
        res.sendDate = false;
        res.writeHead(200, {'connection': 'close'});
        var file = getrandfile(playlistkey);
        if (!file) {
            log(clientid + ' disconnected from playlist ' + playlistkey + ' after ' + (((new Date()) - connecttime) / 1000) + 's by no file event');
            res.end();
        } else {
            log(clientid + ' gets ' + file);
            var decoder = child_process.spawn(config.global.converterpath, [
                '-loglevel', 'warning',
                '-analyzeduration', '5000',
                '-re',
                '-i', file,
                '-ac', 2,
                '-acodec', 'flac',
                '-ar', 48000,
                '-f', 'flac',
                '-preset', 'ultrafast',
                '-sample_fmt', 's16',
                '-sn', '-vn',
                'pipe:1'
            ]);
            decoder.stderr.on('data', function (chunk) {
                process.stderr.write(chunk);
            });
            res.once('close', function () {
                log(clientid + ' disconnected from playlist ' + playlistkey + ' after ' + (((new Date()) - connecttime) / 1000) + 's by client close event');
                decoder.kill();
            });
            decoder.stdout.once('close', function () {
                log(clientid + ' disconnected from playlist ' + playlistkey + ' after ' + (((new Date()) - connecttime) / 1000) + 's by decoder end event');
                res.end();
            });
            decoder.stdout.pipe(res, {end: false});
        }
    }
});

server.listen(config.server.port, config.server.ip);

if (typeof config.global.rescaninterval === 'number' &&
    config.global.rescaninterval >= 0 &&
    parseInt(config.global.rescaninterval, 0) === config.global.rescaninterval) {
    setInterval(function () {
        rescan();
    }, config.global.rescaninterval);
}