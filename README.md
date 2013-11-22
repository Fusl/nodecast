nodecast
===

nodecast is a high performance live streaming transcoder and stream "muxer"

### transcoder.js
This program is the core of stream-transcoding. It grabs the audio-stream from server.js, playlist.js and the jingle-server and decides, which of them should be put on air now.
The configuration works as follows:

``` javascript
var config = {
    global: {
        version: '0.0.6', // This is the version number of the release. Please do not change it until you update also the script belonging to it
        converterpath: '/usr/bin/ffmpeg' // Specify the path of ffmpeg or avconv here (e.g. /usr/bin/ffmpeg, /usr/local/bin/avconv, etc.)
        convertsamplerate: 48000 // You should set the samplerate of the highest mountpoint defined here
    },
    server: {
        ip: '0.0.0.0', // On which ip should the transcoder listen for dispatchers and statuspage-clients?
        port: 7777, // On which port should the transcoder listen for dispatchers and statuspage-clients?
        allowedips: ['127.0.0.1'] // Which ips should be allowed to stream audio data? Specify the ips of all your dispatcher servers here
    },
    statuspage: {
        allowedips: ['127.0.0.1'], // Which ips should be allowed to display all the statuspages?
        readable: {
            path: '/status', // Specify the url-path of the readable statuspage here
            allowedips: ['0.0.0.0'] // Which ips should be allowed to display the statuspages? Keep in mind that each can see others ip addresses so don't really use 0.0.0.0 here!
        },
        parseable: {
            path: '/status?json', // Specify the url-path of the parseable statuspage here
            allowedips: [] // Which ips should be allowed to display the statuspages?
        },
        inspect: {
            path: '/status?inspect', // Specify the url-path of the inspect statuspage here
            allowedips: [], // Which ips should be allowed to display the statuspages?
            options: { // This options will be passed to util.inspect's options parameter
                'showHidden': true,
                'depth': null
            }
        }
    }
};
var mounts = {
    '/main-192.mp3': {
        name: 'RaveOne.FM Mainstream 192k', // Specify the icy-name header value here
        url: 'http://raveone.fm/', // Specify the icy-url header value here
        genre: 'RaveOne.FM Mainstream 192k', // Specify the icy-genre header value here
        bitrate: 192, // Conversion bitrate without the 'k' suffix
        samplerate: 48000, // Conversion samplerate
        codec: 'libmp3lame', // Conversion codec
        format: 'mp3', // Conversion format
        metaint: 8192, // Specify the meta-interval here (default: 8192, disable: 0)
        contenttype: 'audio/mpeg', // Specify the content-type header value here
        notices: ['This is', 'a', 'teststream'], // Specify the icy-notice header values here
        allowedips: ['127.0.0.1', '10.135.0.2', '10.135.192.26'] // Which ips should be allowed to stream audio data from only this mountpoint? Specify the ips of all your dispatcher servers here
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
    }
};
var sources = {
    'dj': {
        url: 'http://localhost:8080/', // Specify the url of an audio streaming server (e.g. the server.js process) here
        retrywait: 100, // How long to wait after the dj disconnects/times out before reconnecting
        callback: function () {
            source('adjingle', function () {
                source('dj');
            });
        }, // Which functions should be called after the dj disconnects/times out?
        unsyncdiscard: true, // Prevent dispatcher buffer overflow and discard any chunks which do not fit into the unix socketbuffer
        timeout: 1000, // How long to wait before the dj is marked as timed out
        destinations: {
            '/main-192.mp3': {
                priority: 10 // Specify the priority of this source for this destination here
            },
            '/main-128.mp3': {
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
            }
        }
    },
    'adjingle': {
        url: 'http://10.135.0.2/streamad/streamad.php',
        isjingle: true, // This tells the setup loop to not autostart this source
        listen: 'SIGUSR2', // Listen for this kill-signal and call this jingle when this event omits
        nativerate: true, // Read this stream at native-rate
        atHours: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], // Specify the hours on which the kill-signal should be able to play this jingle
        destinations: {
            '/main-192.mp3': {
                priority: 9
            },
            '/main-128.mp3': {
                priority: 9
            }
        }
    }
};
```
