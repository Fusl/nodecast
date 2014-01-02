#!/usr/bin/env node

'use strict';
/*jslint
   browser: false, devel: false, node: true, rhino: false, passfail: false,
   bitwise: false, debug: false, eqeq: false, evil: false, forin: false,
   newcap: false, nomen: true, plusplus: true, regexp: false, unparam: false,
   sloppy: false, stupid: false, sub: false, vars: false, white: false,
   indent: 4, maxlen: 256
*/

var config = {};

var functions = require('./functions.js');
var http = functions.http;
var net = functions.net;
var util = functions.util;
var trimnl = functions.trimnl;
var url = functions.url;
var unrefcopy = functions.unrefcopy;
var Streampass = functions.streampass;

var stream = new Streampass();

var userapi = function (authstring, method, callback) {
    var resBody = '',
        urlform = unrefcopy(config.userapi);
    urlform.query.authstring = authstring;
    urlform.query.method = method;
    http.get(url.format(urlform), function (res) {
        res.on('data', function (chunk) {
            resBody += chunk;
        });
        res.once('end', function () {
            callback(parseInt(resBody, 0));
        });
    }).on('error', function (e) {
        console.log(e);
        callback(1);
    });
};

var passclients = {};
var source = false;

/*
 * Client> tobi:test123
 * Server> OK
 * Client> [mp3]
 */

var passoutgoing = http.createServer(function (req, res) {
    var authheader = req.headers.authorization;
    if (authheader) {
        var authb64string = authheader.split(' ')[1];
        if (authb64string) {
            var authrawstring = new Buffer(authb64string, 'base64').toString();
            userapi(authrawstring, 'listen', function (success) {
                if (success !== 1) {
                    req.socket.destroy();
                } else {
                    var streamdatacallback = function (chunk) {
                        if (res.writable === true) {
                            res.write(chunk);
                        }
                    };
                    var streamendcallback = function () {
                        stream.removeListener('data', streamdatacallback);
                        req.socket.destroy();
                    };
                    stream.on('data', streamdatacallback);
                    res.once('close', function () {
                        stream.removeListener('data', streamdatacallback);
                    });
                }
            });
        } else {
            req.socket.destroy();
        }
    } else {
        req.socket.destroy();
    }
});

var incoming = function (allowness, c, sourcetype) {
    if (source) {
        if (allowness > 1) {
            source.once('close', function () {
                source = c;
                c.on('close', function () {
                    source = false;
                });
                c.pipe(stream);
                if (sourcetype === 'shoutcast') {
                    c.write('OK\n');
                }
            });
            source.destroy();
        } else {
            c.destroy();
        }
    } else {
        if (allowness > 0) {
            source = c;
            c.on('close', function () {
                source = false;
            });
            c.pipe(stream);
            if (sourcetype === 'shoutcast') {
                c.write('OK\n');
            }
        } else {
            c.destroy();
        }
    }
};

var shoutcastincoming = net.createServer(function (c) {
    c.setTimeout(5000, function () {
        c.destroy();
    });
    c.once('data', function (chunk) {
        var auth = trimnl(chunk);
        userapi(auth, 'shoutcast', function (allowness) {
            incoming(allowness, c, 'shoutcast');
        });
    });
});

var icecastincoming = net.createServer(function (c) {
    c.setTimeout(5000, function () {
        c.destroy();
    });
    var authdata = '';
    var authlistener = function (chunk) {
        authdata += chunk.toString();
        if (authdata.split('\r\n\r\n').length > 1) {
            c.removeListener('data', authlistener);
            authdata = authdata.split(/(\r\n\r\n|\r\r|\n\n)/)[0].split(/(\r\n|\r|\n)/);
            authdata.shift();
            var tmpauthdata = {};
            authdata.forEach(function (authdataparts) {
                var authdatapart = authdataparts.split(':');
                if (authdatapart.length > 1) {
                    tmpauthdata[authdatapart.shift().toLowerCase()] = authdatapart.join(':').trimLeft();
                }
            });
            try {
                authdata = new Buffer(tmpauthdata.authorization.split(' ')[1], 'base64').toString();
            } catch (e) {}
            if (authdata) {
                userapi(authdata, 'icecast', function (allowness) {
                    incoming(allowness, c, 'icecast');
                });
            } else {
                c.write('Hacking attempt!\n');
                c.destroy();
            }
        } else {
            if (authdata.length > 1048576) {
                c.write('Hacking attempt!\n');
                c.destroy();
            }
        }
    };
    c.on('data', authlistener);
});

var parseandsetconfig = function (input, callback) {
    input = JSON.parse(input);
    config = input.config;
    if (typeof callback === 'function') {
        callback();
    }
};

var init = function () {
    icecastincoming.on('listening', function () {
        console.log('icecastincoming listening on ' + config.server.listenip + ':' + config.server.listenicecastport);
    });
    icecastincoming.on('error', function (e) {
        console.log(e);
        setTimeout(function () {
            icecastincoming.listen(config.server.listenicecastport, config.server.listenip);
        }, 1000);
    });
    icecastincoming.listen(config.server.listenicecastport, config.server.listenip);
    shoutcastincoming.on('listening', function () {
        console.log('shoutcastincoming listening on ' + config.server.listenip + ':' + config.server.listenshoutcastport);
    });
    shoutcastincoming.on('error', function (e) {
        console.log(e);
        setTimeout(function () {
            shoutcastincoming.listen(config.server.listenshoutcastport, config.server.listenip);
        }, 1000);
    });
    shoutcastincoming.listen(config.server.listenshoutcastport, config.server.listenip);
    passoutgoing.on('listening', function () {
        console.log('passoutgoing listening on ' + config.server.listenip + ':' + config.server.listenport);
    });
    passoutgoing.on('error', function (e) {
        console.log(e);
        setTimeout(function () {
            passoutgoing.listen(config.server.listenport, config.server.listenip);
        });
    });
    passoutgoing.listen(config.server.listenport, config.server.listenip);
};

var stdin = '';
process.stdin.on('data', function (chunk) {
    stdin += chunk;
});
process.stdin.on('close', function () {
    parseandsetconfig(stdin, function () {
        config.userapi = url.parse(config.userapi, true);
        init();
    });
});

/*
Examples from edcast:
Icecast2:
Client> SOURCE /test123 ICE/1.0
Client> content-type: audio/mpeg
Client> Authorization: Basic c291cmNlOnRvYmklM0F0ZXN0MTIz
Client> ice-name: This is my server name
Client> ice-url: http://www.oddsock.org
Client> ice-genre: Rock
Client> ice-bitrate: 128
Client> ice-private: 0
Client> ice-public: 1
Client> ice-description: This is my server description
Client> ice-audio-info: ice-samplerate=44100;ice-bitrate=128;ice-channels=2
Client>
Client> [mp3]
Shoutcast:
Client> tobi:test123
Server> OK
Client> [mp3]
*/