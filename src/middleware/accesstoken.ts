import * as express from "express";
import {createClient as createRedisClient} from "redis";

// @ts-ignore
import {services as CoreServices} from "rescueshelter.core";

/**
 * @description
 * The access token expires after five minutes
 */
const EXPIRATION = 60 /*seconds*/*5; // Five minutes
const HEADER_ACCESS_TOKEN = "Access-Token";

/**
 * @description
 * Access token secures specify express.routes and ignores
 * auth (login), deauth (logout), registration and data.
 * 
 * @param req express.Request
 * @param res express.Response
 * @param next express.NextFunction
 * @returns  
 */
async function Middleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    const url =  /(\/api\/manage\/secure\/)(auth|data|deauth|registration)$/;
    const title = "Middleware Access Token";
    const jsonResponse = new CoreServices.JsonResponse();
    
    // ignores these express.routes
    if(url.test(req.originalUrl) == true) {
        next(); // middleware handler
        return;
    }

    if(req.method.toUpperCase() == "POST") {
        let error = `request.method: \'${req.method}\' not available.`;
        console.debug(`${title} ${req.originalUrl} ${error}`);
        res.status(200);
        res.json(jsonResponse.createError(error));
        return;
    }

    let client = createRedisClient({});
    client.on('error', (error) => {
        console.debug(`Access Token Middleware blocking, error: ${error}`);
    });

    try { // Reading data from Redis in memory cache
        let token = req.body?.token;
        if(token == undefined) {
            let error = `missing request.body: \'{token\': \'value\'}'`;
            console.debug(`${title} ${req.originalUrl} ${error}`);
            res.status(200);
            res.json(jsonResponse.createError(error));
            return;                        
        }

        client.get(token).then((value) => {                    
            console.debug(`${title} ${req.originalUrl} -> get \'${token}\' +OK`);
            res.status(200);
            res.json(JSON.parse(value+''));
        }).catch((error) => {
            console.debug(`${title} ${req.originalUrl} -> get \'${token}\' ${(error || 'not available')}`);                      
            next();
        });
        
        client.connect();
    } catch(error) { // Redis cache access  
        res.json(jsonResponse.createError(error));        
    } 
} // end Middleware

export default {
    Middleware,
    EXPIRATION,
    HEADER_ACCESS_TOKEN
}

