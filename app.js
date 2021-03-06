"use strict";

const log = require('lambda-log');
log.info(`Starting sf-streaming-sns-bridge v${process.env.npm_package_version}`);

const http = require('http');
const Bridge = require('./bridge').Bridge;

const PORT = process.env.BRIDGE_PORT || process.env.PORT || 8080;

let serverStatus = 'DOWN';

const bridge = new Bridge();

// Exposing REST API
http.createServer(function (req, res) {
    const url = req.url;
    let bodyPromise;

    if (url.startsWith('/health')) {
        bodyPromise = Promise.resolve({status: serverStatus});
    } else if (url.startsWith('/status')) { // status for all channels
        bodyPromise = Promise.resolve(bridge.status());
    } else if (url.startsWith('/reload')) { // reload configurations and restart the bridge
        bodyPromise = bridge.reload().then(() => ({succeeded: true}));
    } else {
        bodyPromise = Promise.resolve({statusCode: 404});
    }

    bodyPromise.catch(e => {
        let body;
        if (e.statusCode) {
            body = e;
        } else {
            body = {error: `${e}`};
        }

        if (!e.statusCode || e.statusCode !== 404) {
            log.error(e, {description: `Failed to handle request '${url}'`});
        }
        return body;
    })
    .then(body => {
        res.writeHead(body.statusCode? body.statusCode : (body.error? 500 : 200), {'Content-Type': 'application/json'});
        res.write(JSON.stringify(body));
        res.end();
    });
}).listen(PORT);
log.info(`Listening on ${PORT}`);
serverStatus = 'UP';

// Start the bridge
bridge.reload();
