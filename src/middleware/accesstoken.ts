import * as express from "express";
import * as redis from "redis";
import {CoreServices} from "rescueshelter.core";

/**
 * @description
 * The access token expires after five minutes
 */
export const EXPIRATION = 60 /*seconds*/*5; // Five minutes
export const HEADER_ACCESS_TOKEN = "ACCESS_TOKEN";

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
export default async function AccessToken(req: express.Request, res: express.Response, next: express.NextFunction) {
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

    let cacheClient = redis.createClient({});
    try { // Reading data from Redis in memory cache
        let access_token = req.body?.access_token;
        if(access_token == undefined) {
            let error = `missing request.body: \'{access_token\': \'value\'}'`;
            console.debug(`${title} ${req.originalUrl} ${error}`);
            res.status(200);
            res.json(jsonResponse.createError(error));
            return;                        
        }

        let remoteIpAddr = req.socket?.remoteAddress;
        cacheClient.get(access_token, (error,reply) => {                    
            if(reply !== null) {
                console.debug(`${title} ${req.originalUrl} -> get \'${access_token}\' +OK`);
                res.status(200);
                res.json(JSON.parse(reply));
            } else {
                console.debug(`${title} ${req.originalUrl} -> get \'${access_token}\' ${(error || 'not available')}`);                      
                next();
            }
        });
        
    } catch(error) { // Redis cache access  
        res.json(jsonResponse.createError(error));        
    } 
} // end AccessToken