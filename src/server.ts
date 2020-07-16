"use strict";

import express = require("express");
import cors = require("cors")

import morgan from "morgan";
import * as helmet from "helmet";
import * as path from "path";

declare let __dirname; // variable initialize by NodeJS Path Module

/**
 * Name of the express server name
 */
export let serverName: string;

/**
 * Express server listens on port number
 */
export let serverPort: Number;

/**
 * List of function with an Express.Application parameter
 * 
 * example:
 * 
 *  function serviceName(app: Application): void {}
 */
export let middleware: Array<Function>;

/**
 * List of server hostname with CORS access
 */
export let whitelist: Array<string>;

/**
 * Express Http server for the Rescue Shelter App
 */
const apiServer = express()

// ************************************
//  Middleware sequential use important
// ************************************
apiServer.use(morgan('dev'));

var corsOptionsDelegate = function (req, callback) {
    if (whitelist === undefined || whitelist.length == 0 || whitelist.indexOf(req.headers.origin) === 0) {
        callback(null, true);
    }
    else {
        callback(new Error('Not allowed by CORS'));
    }
};
apiServer.use(cors(corsOptionsDelegate));

apiServer.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"]
    }
}));

const publicPath = path.join(__dirname, '../public');
apiServer.use(express.static(publicPath));


export function listener(): void {
    if(middleware === null || middleware === undefined) {
        console.log('{server}.middleware not initialized');
        return;
    }
    middleware.forEach((fn) => {
        try {
            fn(apiServer);
        } catch {
            console.log('Invalid function format. [HINT: ' + fn.name + '(app: express.Application)]');
        }
    });

    apiServer.listen(serverPort, () => {
        var port = (serverPort === null || serverPort === undefined) ? 3301: serverPort;
        var server = (serverName === null || serverName == undefined)? 'Rescue Shelter': serverName;

        console.log(server + ' listening on port: ' + port);
        console.log('wwwroot: ' + publicPath);
    });
}
