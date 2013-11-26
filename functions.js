'use strict';

/*jslint
   browser: false, devel: false, node: true, rhino: false, passfail: false,
   bitwise: false, debug: false, eqeq: false, evil: false, forin: false,
   newcap: false, nomen: true, plusplus: true, regexp: false, unparam: false,
   sloppy: false, stupid: false, sub: false, vars: false, white: false,
   indent: 4, maxlen: 256
*/

var functions = {};
module.exports = functions;

functions.child_process = require('child_process');
functions.fs = require('fs');
functions.http = require('http');
functions.net = require('net');
functions.os = require('os');
functions.path = require("path");
functions.util = require('util');
functions.stream = require('stream');
functions.url = require('url');

functions.exec = functions.child_process.exec;
functions.spawn = functions.child_process.spawn;

functions.in_array = function (needle, haystack) {
    if (!(haystack instanceof Array)) {
        return false;
    }
    if (haystack.indexOf(needle) === -1) {
        return false;
    }
    return true;
};

functions.log = function (msg) {
    if (typeof msg === 'undefined') {
        return;
    }
    functions.util.log(msg);
};

functions.trimnl = function (input) {
    return input.toString().replace(/(\r\n|\r|\n|\n\r)/, '');
};

functions.uniqid = function () {
    return Math.random().toString(16) + Math.random().toString(16);
};

functions.icystring = function (obj) {
    var s = [];
    Object.keys(obj).forEach(function (key) {
        s.push(key);
        s.push('=\'');
        s.push(obj[key]);
        s.push('\';');
    });
    return s.join('');
};

functions.shuffle = function (inputArr) {
    if (!(inputArr instanceof Array)) {
        return false;
    }
    var outputArr = [],
        k;
    for (k in inputArr) {
        if (inputArr.hasOwnProperty(k)) {
            outputArr.push(inputArr[k]);
        }
    }
    return outputArr.sort(function () {
        return 0.5 - Math.random();
    });
};

functions.streampass = function () {
    this.writable = true;
    this.readable = true;
};

functions.util.inherits(functions.streampass, functions.stream.Stream);

functions.streampass.prototype.write = function (chunk) {
    this.emit('data', chunk);
};

functions.unrefcopy = function (inputObject) {
    if (!(inputObject instanceof Object)) {
        return inputObject;
    }
    if (inputObject instanceof Array) {
        return inputObject.slice(0);
    }
    var outputObject = {};
    Object.keys(inputObject).forEach(function (key) {
        outputObject[key] = functions.unrefcopy(inputObject[key]);
    });
    return outputObject;
};