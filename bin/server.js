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
        callback(0);
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
        if (stream && authb64string) {
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
            res.writeHead(401, {
                'WWW-Authenticate': 'Basic realm="Login please"'
            });
            res.end('Unauthorized');
        }
    } else {
        res.writeHead(401, {
            'WWW-Authenticate': 'Basic realm="Login please"'
        });
        res.end('Unauthorized');
    }
});

var incoming = function (allowness, c, sourcetype) {
    if (source) {
        if (allowness > 1) {
            source.once('close', function () {
                source = c;
                c.once('close', function () {
                    source = false;
                });
                c.once('error', function (e) {
                    console.log(e);
                });
                c.pipe(stream);
                c.setTimeout(5000, function () {
                    c.destroy();
                });
                if (sourcetype === 'shoutcast') {
                    c.write('OK2\r\nicy-caps:11\r\n\r\n');
                }
            });
            source.destroy();
        } else {
            c.end('invalid password');
        }
    } else {
        if (allowness > 0) {
            source = c;
            c.once('close', function () {
                source = false;
            });
            c.once('error', function (e) {
                console.log(e);
            });
            c.pipe(stream);
            c.setTimeout(5000, function () {
                c.destroy();
            });
            if (sourcetype === 'shoutcast') {
                c.write('OK2\r\nicy-caps:11\r\n\r\n');
            }
        } else {
            c.end('invalid password');
        }
    }
};

var processincoming= net.createServer(function (c) {
    var timedout = false;
    var authtimeout = false;
    var authdata = '';
    var authlistener = false;
    var firstlinereceived = false;
    
    var authlistener = function (chunk) {
        authdata += chunk.toString();
        
        // Only allow 10 kiB of data for header and kill the connection if the header exceeds this size
        if (authdata > 10*1024) {
            c.destroy();
        }
        
        // If the first line does not begin with "SOURCE ..." or "CONTROL ..." (CONTROL is the admin control header for the api), assume it is a normal shoutcast source
        if (!firstlinereceived && /\r\n|\r|\n/.test(authdata)) {
            firstlinereceived = true;
            var firstline = (authdata.split(/\r\n|\r|\n/)[0]);
            if (firstline.split(' ')[0] !== 'SOURCE' && firstline.split(' ')[0] !== 'CONTROL') {
                clearTimeout(authtimeout);
                c.removeListener('data', authlistener);
                userapi(firstline, 'shoutcast', function (allowness) {
                    incoming(allowness, c, 'shoutcast');
                });
                return;
            }
        }
        
        if (/\r\n\r\n|\r\r|\n\n/.test(authdata)) {
            // End of auth header reached
            
            // Unlisten for the authdata event
            clearTimeout(authtimeout);
            c.removeListener('data', authlistener);
            
            // Grab only the header without the double-newline, which is the indicator for the authdata end event
            authdata = authdata.split(/\r\n\r\n|\r\r|\n\n/)[0];
            
            // Make an array ...
            var authdataArray = authdata.split(/\r\n|\r|\n/);
            
            // ... and also an object (separator: ":", key: [0], value: [1]) of the authdata provided by the client
            var authdataObject = {};
            authdataArray.forEach(function (authdataArray_line) {
                authdataArray_line = authdataArray_line.split(':');
                authdataObject[authdataArray_line.shift().toLowerCase().trim()] = authdataArray_line.join(':').trim();
            });
            
            console.log(authdataObject);
            
            // Grab the user:pass pair out of the authdata (either from the authorization header or the first line)
            var userpass = 'nobody:nopass';
            
            if (authdataArray[0].split(' ')[0] === 'SOURCE' || authdataObject.authorization) {
                userpass = authdataObject.authorization.split(' ');
                if (userpass[0] === 'Basic') {
                    userpass = new Buffer(userpass[1], 'base64').toString()
                }
                
                // Pass user:pass pair to userapi which checks if the user is allowed to be a source and then call incoming which decides if the response from userapi is good or bad
                userapi(userpass, 'icecast', function (allowness) {
                    incoming(allowness, c, 'icecast');
                });
            }
        }
    };
    
    authtimeout = setTimeout(function () {
        c.removeListener('data', authlistener);
        c.destroy();
    }, 5000);
    
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
    var dolisten = function () {
        config.server.incomingports.forEach(function (incomingport) {
            processincoming.listen(incomingport, config.server.listenip, function () {
                console.log('processincoming listening on ' + config.server.listenip + ':' + incomingport);
            });
        });
    };
    processincoming.on('error', function (e) {
        console.log(e);
        setTimeout(function () {
            dolisten();
        }, 1000);
    });
    dolisten();
    
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

if (process.argv[2]) {
    parseandsetconfig(fs.readFileSync(process.argv[2]), function () {
        config.userapi = url.parse(config.userapi, true);
        init();
    });
} else {
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
}

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