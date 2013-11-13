#!/usr/local/bin/node

var server = {
	'server': {
		'configpath': '/home/fusl/nodecast/server.json',
		'listenip': '0.0.0.0',
		'listenport': 4000,
		'master': true,
		'version': '0.0.3'
	},
	'users': {
		'admin': {
			'passwd': '6572bdaff799084b973320f43f09b363',
			'acl': {
				'configwrite': true,
				'configread': true,
				'kicklistener': true,
				'kickstreamer': true,
				'listen': true,
				'restart': true,
				'status': true,
				'stream': true
			}
		},
		'dj': {
			'passwd': 'aea65c2ffbb56f45e00feaccbbcd501c',
			'acl': {
				'stream': true
			}
		},
		'listener': {
			'passwd': 'f6eedde70b3dad193edfcca7cf5753ef',
			'acl': {
				'listen': true
			}
		}
	}
}
