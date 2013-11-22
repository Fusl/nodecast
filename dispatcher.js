#!/usr/local/bin/node

"use strict";

// Configuration (Modify these to your needs)
var config = {
    version: '0.0.6',
    ip: '0.0.0.0',
    port: 8000,
    maxclients: 10,
    preventclientoverflow: true,
    prebuffertime: 15000,
    servecrossdomainxml: true,
    servelistenpls: true,
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
        },
        mountslist: {
            path: '/mountslist',
            allowedips: ['10.135.0.3']
        }
    }
};
var mounts = {
    '/main-192.mp3': {
        url: 'http://localhost:7777/main-192.mp3',
        metaurl: 'http://localhost/meta.php?stream=main-192',
        maxclients: 10
    },
    '/main-128.mp3': {
        url: 'http://localhost:7777/main-128.mp3',
        metaurl: 'http://localhost/meta.php?stream=main-128',
        maxclients: 10
    },
    '/main-128.aac': {
        url: 'http://localhost:7777/main-128.aac',
        metaurl: 'http://localhost/meta.php?stream=main-aac',
        maxclients: 10
    },
    '/main-64.aac': {
        url: 'http://localhost:7777/main-64.aac',
        metaurl: 'http://localhost/meta.php?stream=main-64.aac',
        maxclients: 10
    }
};

var functions = require('./functions.js');
var http = functions.http;
var in_array = functions.http;
var os = functions.os;
var icystring = functions.icystring;
var util = functions.util;
var log = functions.log;
var uniqid = functions.uniqid;

var makemeta = function (metadata) {
    if (typeof metadata === 'string') {
        metadata = {StreamTitle: metadata};
    } else if (!metadata || typeof metadata === 'object') {
        return '';
    }
    var string = icystring(metadata),
        length = Buffer.byteLength(string),
        buflen = Math.ceil(length / 16),
        buffer = new Buffer(buflen * 16 + 1),
        written = buffer.write(string, 1);
    buffer[0] = buflen;
    buffer.fill(0, written + 1);
    return buffer;
};

var server = http.createServer(function (req, res) {
    if (req.method.toUpperCase() !== 'GET') {
        log(req.socket.remoteAddress + ':' + req.socket.remotePort + ' tried method ' + req.method.toUpperCase());
        res.write('<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">' +
                  '<html>' +
                  '<head>' +
                  '<title>405 Method Not Allowed</title>' +
                  '</head>' +
                  '<body>' +
                  '<h1>Method Not Allowed</h1>' +
                  '<p>The requested method ' +
                  req.method.toUpperCase() +
                  'is not allowed on this server.</p>' +
                  '<hr>' +
                  '<address>nodecast Server at ' +
                  req.socket.localAddress +
                  ' Port ' +
                  req.socket.localPort +
                  '</address>' +
                  '</body>' +
                  '</html>');
    } else if (req.url === '/crossdomain.xml' && config.servecrossdomainxml) {
        res.writeHead(200, {
            'content-type': 'text/xml',
            'connection': 'close'
        });
        res.end('<?xml version="1.0"?>' +
                '<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">' +
                '<cross-domain-policy>' +
                '<allow-access-from domain="*" to-ports="*" />' +
                '</cross-domain-policy>');
    } else if (req.url === '/listen.pls' && config.servelistenpls) {
        res.writeHead(200, {
            'content-type': 'audio/x-scpls',
            'connection': 'close'
        });
        res.write('[playlist]\n');
        res.write('NumberOfEntries=' + Object.keys(mounts).length + '\n\n');
        var filenum = 0;
        Object.keys(mounts).forEach(function (mountpoint) {
            if (!mounts[mountpoint].notinlistenpls && mounts[mountpoint]._) {
                filenum++;
                res.write('File' + filenum + '=http://' + req.headers.host + mountpoint + '\n');
                res.write('Title' + filenum + '=' + mounts[mountpoint]._.headers['icy-name'] + '\n');
                res.write('Length' + filenum + '=-1\n');
            }
        });
        res.end();
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
            listener = 0,
            prebuffersize = 0,
            bytesrcvd = 0,
            bytessent = 0,
            systemload = Math.round(os.loadavg()[0] * 100) + '% (' + os.loadavg().join(' ') + ')',
            memoryheap = process.memoryUsage();
        memoryheap = Math.round(memoryheap.heapUsed / memoryheap.heapTotal * 100) + '%';
        Object.keys(mounts).forEach(function (mountpoint) {
            listener += Object.keys(mounts[mountpoint]._.clients).length;
            bytesrcvd += mounts[mountpoint]._.bytesrcvd;
            bytessent += mounts[mountpoint]._.bytessent;
            Object.keys(mounts[mountpoint]._.prebuffers).forEach(function (prebufferkey) {
                prebuffersize += mounts[mountpoint]._.prebuffers[prebufferkey].length;
            });
        });
        res.write('Uptime: ' + uptime + '\n' +
                  'Listener: ' + listener + '\n' +
                  'Bytes received: ' + bytesrcvd + '\n' +
                  'Bytes sent: ' + bytessent + '\n' +
                  'System load: ' + systemload + '\n' +
                  'Memory heap: ' + memoryheap + '\n' +
                  'Prebuffer size: ' + prebuffersize + '\n');
        Object.keys(mounts).forEach(function (mountpoint) {
            res.write('Mount ' + mountpoint + '\n');
            Object.keys(mounts[mountpoint]._.prebuffers).forEach(function (prebufferkey) {
                prebuffersize += mounts[mountpoint]._.prebuffers[prebufferkey].length;
            });
            res.write(' Prebuffer ' + prebuffersize + ' (' + Object.keys(mounts[mountpoint]._.prebuffers).length + ')\n');
            Object.keys(mounts[mountpoint]._.clients).forEach(function (clientid) {
                res.write(' Client ' + clientid + ' ' + mounts[mountpoint]._.clients[clientid].req.socket.remoteAddress + ':' + mounts[mountpoint]._.clients[clientid].req.socket.remotePort + ' ' + mounts[mountpoint]._.clients[clientid].status.sent + ' ' +
                          mounts[mountpoint]._.clients[clientid].status.overflowed + '\n');
            });
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
        res.end(JSON.stringify({'config': config, 'mounts': mounts}));
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
        res.end(util.inspect({'config': config, 'mounts': mounts}, config.statuspage.inspect.options));
    } else if (config.statuspage &&
               config.statuspage.mountslist &&
               config.statuspage.mountslist.path &&
               req.url === config.statuspage.mountslist.path &&
               ((in_array('*', config.statuspage.mountslist.allowedips) ||
                 in_array('0.0.0.0', config.statuspage.mountslist.allowedips) ||
                 in_array(req.socket.remoteAddress, config.statuspage.mountslist.allowedips)) ||
                (in_array('*', config.statuspage.allowedips) ||
                 in_array('0.0.0.0', config.statuspage.allowedips) ||
                 in_array(req.socket.remoteAddress, config.statuspage.allowedips)))) {
        res.writeHead(200, {
            'content-type': 'application/json',
            'connection': 'close'
        });
        var mountslist = [];
        Object.keys(mounts).forEach(function (mountname) {
            mountslist.push(mountname);
        });
        res.end(JSON.stringify(mountslist));
    } else if (mounts[req.url] && mounts[req.url]._) {
        var sumclients = 0,
            clientrealheaders = mounts[req.url]._.headers,
            clientmetaint = 0,
            clientid = uniqid('', true),
            clientstatus = {};
        Object.keys(mounts).forEach(function (mountpoint) {
            if (mounts[mountpoint]._ && mounts[mountpoint]._.clients) {
                sumclients += Object.keys(mounts[mountpoint]._.clients).length;
            }
        });
        if ((!config.maxclients ||
             config.maxclients > sumclients) &&
            (!mounts[req.url].maxclients ||
             mounts[req.url].maxclients > Object.keys(mounts[req.url]._.clients).length)) {
            
            if (req.headers['icy-metadata']) {
                clientmetaint = clientrealheaders['icy-metaint'];
            } else {
                clientmetaint = 0;
                delete clientrealheaders['icy-metaint'];
            }
            res.sendDate = false;
            res.writeHead(200, clientrealheaders);
            clientstatus = {'overflowed': false, 'sent': 0, 'metaint': clientmetaint, 'metaintcycle': 0};
            var resprebuffers = mounts[req.url]._.prebuffers;
            Object.keys(resprebuffers).forEach(function (resprebufferkey) {
                var chunk = resprebuffers[resprebufferkey];
                if (clientstatus.metaint && clientstatus.metaintcycle + chunk.length > clientstatus.metaint) {
                    var remainchunk = new Buffer(chunk.length);
                    chunk.copy(remainchunk);
                    while (clientstatus.metaintcycle + remainchunk.length > clientstatus.metaint) {
                        res.write(remainchunk.slice(0, clientstatus.metaint - clientstatus.metaintcycle));
                        res.write(mounts[req.url]._.meta);
                        remainchunk = remainchunk.slice(clientstatus.metaint - clientstatus.metaintcycle, chunk.length);
                        clientstatus.metaintcycle = 0;
                        clientstatus.sent += mounts[req.url]._.meta.length;
                        mounts[req.url]._.bytessent += mounts[req.url]._.meta.length;
                    }
                    if (remainchunk.length > 0) {
                        res.write(remainchunk);
                        clientstatus.metaintcycle = remainchunk.length;
                    }
                } else {
                    res.write(chunk);
                    clientstatus.metaintcycle += chunk.length;
                }
                clientstatus.sent += chunk.length;
                mounts[req.url]._.bytessent += chunk.length;
            });
            mounts[req.url]._.clients[clientid] = {'status': clientstatus, 'req': req, 'res': res};
            res.once('close', function () {
                delete mounts[req.url]._.clients[clientid];
            });
        } else {
            res.end('No slot available');
        }
    } else {
        res.end('<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">' +
                '<html>' +
                '<head>' +
                '<title>404 Not Found</title>' +
                '</head>' +
                '<body>' +
                '<h1>Not Found</h1>' +
                '<p>The requested URL ' +
                req.url +
                ' was not found on this server.</p>' +
                '<hr>' +
                '<address>nodecast Server at ' +
                req.socket.localAddress +
                ' Port ' +
                req.socket.localPort +
                '</address>' +
                '</body>' +
                '</html>');
    }
});
server.listen(config.port, config.ip);

var clienting = function (mountpoint) {
    log('Spawned clienting(' + mountpoint + ')');
    if (!mounts[mountpoint].prebuffertime) {
        if (!config.prebuffertime) {
            mounts[mountpoint].prebuffertime = false;
        } else {
            mounts[mountpoint].prebuffertime = config.prebuffertime;
        }
    }
    if (mounts[mountpoint].prebuffertime === 0) {
        mounts[mountpoint].prebuffertime = false;
    }
    http.get(mounts[mountpoint].url, function (res) {
        if (!mounts[mountpoint]._) {
            mounts[mountpoint]._ = {};
            mounts[mountpoint]._.headers = {};
            mounts[mountpoint]._.clients = {};
            mounts[mountpoint]._.prebuffers = [];
            mounts[mountpoint]._.bytesrcvd = 0;
            mounts[mountpoint]._.bytessent = 0;
            mounts[mountpoint]._.meta = new Buffer([0]);
        }
        mounts[mountpoint]._.headers = res.headers;
        Object.keys(mounts[mountpoint]._.headers).forEach(function (headerkey) {
            if (typeof mounts[mountpoint]._.headers[headerkey] === 'string' &&
                parseInt(mounts[mountpoint]._.headers[headerkey], 0) + '' === mounts[mountpoint]._.headers[headerkey] &&
                parseInt(mounts[mountpoint]._.headers[headerkey], 0) + 1 - 1 === parseInt(mounts[mountpoint]._.headers[headerkey], 0)) {
                mounts[mountpoint]._.headers[headerkey] = parseInt(mounts[mountpoint]._.headers[headerkey], 0);
            }
        });
        res.on('data', function (chunk) {
            Object.keys(mounts[mountpoint]._.clients).forEach(function (clientid) {
                if (mounts[mountpoint]._.clients[clientid].res.writable && !(mounts[mountpoint]._.clients[clientid].res.socket._writableState.length !== 0 && mounts[mountpoint].preventclientoverflow)) {
                    if (mounts[mountpoint]._.clients[clientid].status.metaint && mounts[mountpoint]._.clients[clientid].status.metaintcycle + chunk.length > mounts[mountpoint]._.clients[clientid].status.metaint) {
                        var remainchunk = new Buffer(chunk.length);
                        chunk.copy(remainchunk);
                        while (mounts[mountpoint]._.clients[clientid].status.metaintcycle + remainchunk.length > mounts[mountpoint]._.clients[clientid].status.metaint) {
                            mounts[mountpoint]._.clients[clientid].res.write(remainchunk.slice(0, mounts[mountpoint]._.clients[clientid].status.metaint - mounts[mountpoint]._.clients[clientid].status.metaintcycle));
                            mounts[mountpoint]._.clients[clientid].res.write(mounts[mountpoint]._.meta);
                            remainchunk = remainchunk.slice(mounts[mountpoint]._.clients[clientid].status.metaint - mounts[mountpoint]._.clients[clientid].status.metaintcycle, chunk.length);
                            mounts[mountpoint]._.clients[clientid].status.metaintcycle = 0;
                            mounts[mountpoint]._.clients[clientid].status.sent += mounts[mountpoint]._.meta.length;
                            mounts[mountpoint]._.bytessent += mounts[mountpoint]._.meta.length;
                        }
                        if (remainchunk.length > 0) {
                            mounts[mountpoint]._.clients[clientid].res.write(remainchunk);
                            mounts[mountpoint]._.clients[clientid].status.metaintcycle = remainchunk.length;
                        }
                    } else {
                        mounts[mountpoint]._.clients[clientid].res.write(chunk);
                        mounts[mountpoint]._.clients[clientid].status.metaintcycle += chunk.length;
                    }
                    mounts[mountpoint]._.clients[clientid].status.sent += chunk.length;
                    mounts[mountpoint]._.bytessent += chunk.length;
                }
            });
            if (mounts[mountpoint].prebuffertime) {
                mounts[mountpoint]._.prebuffers.push(chunk);
                setTimeout(function () {
                    mounts[mountpoint]._.prebuffers.shift();
                }, mounts[mountpoint].prebuffertime);
            }
        });
        res.once('close', function (chunk) {
            setTimeout(function () {
                clienting(mountpoint);
            }, 100);
        });
    }).once('error', function (e) {
        setTimeout(function () {
            clienting(mountpoint);
        }, 100);
        log(mountpoint + '  ' + e);
    });
};

Object.keys(mounts).forEach(function (mountpoint) {
    clienting(mountpoint);
});

setInterval(function () {
    Object.keys(mounts).forEach(function (mountpoint) {
        if (mounts[mountpoint]._ &&
            mounts[mountpoint]._.headers['icy-metaint'] &&
            typeof mounts[mountpoint]._.headers['icy-metaint'] === 'number' &&
            mounts[mountpoint]._.headers['icy-metaint'] > 0 &&
            Math.floor(mounts[mountpoint]._.headers['icy-metaint']) === mounts[mountpoint]._.headers['icy-metaint']) {
            
            var metaurl = false;
            if (typeof mounts[mountpoint].metaurl === 'string' && mounts[mountpoint].metaurl.trim() !== '') {
                metaurl = mounts[mountpoint].metaurl;
            } else if (typeof config.metaurl === 'string' && config.metaurl.trim() !== '') {
                metaurl = config.metaurl;
            }
            if (metaurl) {
                var metareqdata = '';
                http.get(metaurl, function (res) {
                    res.on('data', function (chunk) {
                        metareqdata += chunk;
                    });
                    res.on('end', function () {
                        mounts[mountpoint]._.meta = makemeta(metareqdata);
                    });
                }).on('error', function (e) {
                    log('getting meta-info for '+mountpoint+' from '+mounts[mountpoint].metaurl+': '+e);
                });
            }
        }
    });
}, 1000);