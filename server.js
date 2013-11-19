#!/usr/local/bin/node

// THIS NODECAST PROGRAM IS STILL UNFINISHED AND COULD CAUSE YOUR SERVER TO CRASH, BURN OR VANISH!!!

'use strict';
/*jslint
   browser: false, devel: false, node: true, rhino: false, passfail: false,
   bitwise: false, debug: false, eqeq: false, evil: false, forin: false,
   newcap: false, nomen: true, plusplus: true, regexp: false, unparam: false,
   sloppy: false, stupid: false, sub: false, vars: false, white: false,
   indent: 4, maxlen: 256
*/

var config = {
    'server': {
        'configpath': '/home/fusl/nodecast/server.json',
        'listenip': '0.0.0.0',
        'listenshoutcastport': 4001,
        'listenicecastport': 4000,
        'listencontrolport': 4002,
        'master': true,
        'version': '0.0.3'
    },
    'userapi': 'http://localhost/userapi.php'
};

var http = require('http'),
    net = require('net'),
    util = require('util'),
    parseChunk = function (chunk) {
        return chunk.toString().replace(/(\r\n|\r|\n|\n\r)/, '');
    };

var userapi = function (authstring, method, callback) {
    callback(3);
};

var passstream = function (chunk) {
    Object.keys(passclients).forEach(function (passclientkey) {
        passclients[passclientkey].res.write(chunk);
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
            userapi(authrawstring, 'listen', function () {
                var userid = Math.random().toString(16) + Math.random().toString(16);
                passclients[userid] = {'req': req, 'res': res};
                req.once('close', function () {
                    delete passclients[userid];
                });
            });
        } else {
            req.end();
        }
    } else {
        req.end();
    }
});

var incoming = function (allowness, c, sourcetype) {
    if (source) {
        if (allowness > 1) {
            source.once('close', function () {
                passincoming(c);
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
            passincoming(c);
            if (sourcetype === 'shoutcast') {
                c.write('OK\n');
            }
        } else {
            c.destroy();
        }
    }
};

var passincoming = function (c) {
    source = c;
    c.on('close', function () {
        source = false;
    });
    c.on('data', function (chunk) {
        passstream(chunk);
    });
    console.log("passed");
};

var shoutcastincoming = net.createServer(function (c) {
    c.setTimeout(5000, function() {
        c.destroy();
    });
    c.once('data', function (chunk) {
        var auth = parseChunk(chunk);
        userapi(auth, 'shoutcast', function (allowness) {
            incoming(allowness, c, 'shoutcast');
        });
    });
}).listen(config.server.listenshoutcastport, config.server.listenip);

var icecastincoming = net.createServer(function (c) {
    c.setTimeout(5000, function () {
        //c.destroy();
    });
    var authdata = '';
    var authlistener = function (chunk) {
        authdata += chunk.toString();
        if (authdata.split('\r\n\r\n').length > 1) {
            c.removeListener('data', authlistener);
            authdata = authdata.split(/(\r\n\r\n|\r\r|\n\n)/)[0].split(/(\r\n|\r|\n)/);
            authdata.shift();
            var tmpauthdata = {};
            Object.keys(authdata).forEach(function (authdatakey) {
                var authdatapart = authdata[authdatakey].split(':');
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
                c.destroy();
            }
        }
    };
    c.on('data', authlistener);
});
icecastincoming.on('listen', function () {
    console.log('icecastincoming listening on ' + config.server.listenip + ':' + config.server.listenicecastport);
});
icecastincoming.on('error', function (e) {
    console.log(e);
    setTimeout(function () {
        icecastincoming.listen(config.server.listenicecastport, config.server.listenip);
    }, 1000);
});
icecastincoming.listen(config.server.listenicecastport, config.server.listenip);

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