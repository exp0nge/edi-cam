// modules
var childProcess = require('child_process')
    , express = require('express')
    , http = require('http')
    , morgan = require('morgan')
    , ws = require('ws')
    , mraa = require('mraa');

// configuration files
var configServer = require('./lib/config/server');

// app parameters
var app = express();
app.set('port', configServer.httpPort);
app.use(express.static(configServer.staticFolder));
app.use(morgan('dev'));

// serve index
require('./lib/routes').serveIndex(app, configServer.staticFolder);

// HTTP server
http.createServer(app).listen(app.get('port'), function () {
    console.log('HTTP server listening on port ' + app.get('port'));
});

/// Video streaming section
// Reference: https://github.com/phoboslab/jsmpeg/blob/master/stream-server.js

var STREAM_MAGIC_BYTES = 'jsmp'; // Must be 4 bytes
var width = 320;
var height = 240;

// WebSocket server
var wsServer = new (ws.Server)({port: configServer.wsPort});
var commandWsServer = new (ws.Server)({port: configServer.commandWsPort});
console.log('WebSocket server listening on port ' + configServer.wsPort);

wsServer.on('connection', function (socket) {
    // Send magic bytes and video size to the newly connected socket
    // struct { char magic[4]; unsigned short width, height;}
    var streamHeader = new Buffer(8);

    streamHeader.write(STREAM_MAGIC_BYTES);
    streamHeader.writeUInt16BE(width, 4);
    streamHeader.writeUInt16BE(height, 6);
    socket.send(streamHeader, {binary: true});

    console.log('New WebSocket Connection (' + wsServer.clients.length + ' total)');

    socket.on('close', function (code, message) {
        console.log('Disconnected WebSocket (' + wsServer.clients.length + ' total)');
    });

});

commandWsServer.on('connection', function (socket) {
    console.log('Command socket connected!');

    socket.on('message', function incoming(command) {
        console.log("parsing %s", command);
        switch (command) {
            case "up":
                roverForward();
                break;
            case "down":
                roverBackward();
                break;
            case "left":
                roverLeft();
                break;
            case "right":
                roverRight();
                break;
            case "space":
                halt();
                break;
        }
    });
});


wsServer.broadcast = function (data, opts) {
    for (var i in this.clients) {
        if (this.clients[i].readyState == 1) {
            this.clients[i].send(data, opts);
        }
        else {
            console.log('Error: Client (' + i + ') not connected.');
        }
    }
};

// HTTP server to accept incoming MPEG1 stream
http.createServer(function (req, res) {
    console.log(
        'Stream Connected: ' + req.socket.remoteAddress +
        ':' + req.socket.remotePort + ' size: ' + width + 'x' + height
    );

    req.on('data', function (data) {
        wsServer.broadcast(data, {binary: true});
    });
}).listen(configServer.streamPort, function () {
    console.log('Listening for video stream on port ' + configServer.streamPort);

    // Run do_ffmpeg.sh from node
    childProcess.exec('../../bin/do_ffmpeg.sh');
});

// Pin initialization
var leftBackward = new mraa.Gpio(2),
    leftForward = new mraa.Gpio(3),
    rightForward = new mraa.Gpio(4),
    rightBackward = new mraa.Gpio(5);
leftBackward.dir(mraa.DIR_OUT);
leftForward.dir(mraa.DIR_OUT);
rightForward.dir(mraa.DIR_OUT);
rightBackward.dir(mraa.DIR_OUT);

var DEFAULT_DURATION = 0.3;

function roverForward(secs) {
    leftForward.write(1);
    rightForward.write(1);
    setTimeout(function () {
        leftForward.write(0);
        rightForward.write(0);
    }, secs || DEFAULT_DURATION);
}

function roverBackward(secs) {
    leftBackward.write(1);
    rightBackward.write(1);
    setTimeout(function () {
        leftBackward.write(0);
        rightBackward.write(0);
    }, secs || DEFAULT_DURATION);
}

function roverLeft(secs) {
    leftBackward.write(1);
    rightForward.write(1);
    setTimeout(function () {
        leftBackward.write(0);
        rightForward.write(0);
    }, secs || DEFAULT_DURATION);
}

function roverRight(secs) {
    leftForward.write(1);
    rightBackward.write(1);
    setTimeout(function () {
        leftForward.write(0);
        rightBackward.write(0);
    }, secs || DEFAULT_DURATION);
}

function halt() {
    leftForward.write(0);
    leftBackward.write(0);
    rightBackward.write(0);
    rightForward.write(0);
}

module.exports.app = app;
