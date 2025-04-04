import * as crypto from "node:crypto";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as redis from "redis";
import {CoreServices} from "rescueshelter.core";

// Create CoreServices application specific constants
export const SESSION_TIME = 900000; // 15 minutes = 900000 milliseconds
export const MANAGE_BASE_ROUTER_URL = '/api/manage';
export const MANAGE_ACCEPTABLE_HTTP_VERBS = ['POST'];

export const ACCESS_TOKEN_EXPIRATION = 60 /*seconds*/*5; // Five minutes

export const JSONBodyParserMiddleware = bodyParser.json({type: 'application/json'});

export async function AccessTokenMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    const jsonResponse = new CoreServices.JsonResponse();
    const endsWith =  /(\/(auth|data|deauth|registration|body))$/;

    if(req.originalUrl.startsWith(MANAGE_BASE_ROUTER_URL) == true && endsWith.test(req.originalUrl) == true) {
        next(); // middleware handler
        return;
    }

    if(MANAGE_ACCEPTABLE_HTTP_VERBS.indexOf(req.method.toUpperCase()) === -1) {
        let error = `request.method: \'${req.method}\' not available.`;
        console.debug(`AccessTokenMiddleware ${req.originalUrl} ${error}`);
        res.status(200);
        res.json(jsonResponse.createError(error));
        return;
    }

    let cacheClient = redis.createClient({});
    try { // Reading data from Redis in memory cache
        let access_token = req.body?.access_token;
        if(access_token == undefined) {
            let error = `missing request.body: \'{access_token\': \'value\'}'`;
            console.debug(`AccessTokenMiddleware ${req.originalUrl} ${error}`);
            res.status(200);
            res.json(jsonResponse.createError(error));
            return;                        
        }

        let remoteIpAddr = req.socket?.remoteAddress;
        cacheClient.get(access_token, (error,reply) => {                    
            if(reply !== null) {
                console.debug(`AccessTokenMiddleware ${req.originalUrl} -> get \'${access_token}\' +OK`);
                res.status(200);
                res.json(JSON.parse(reply));
            } else {
                console.debug(`AccessTokenMiddleware ${req.originalUrl} -> get \'${access_token}\' ${(error || 'not available')}`);                      
                next();
            }
        });
        
    } catch(error) { // Redis cache access  
        res.json(jsonResponse.createError(error));        
    } 
} // end AccessTokenMiddleware

export async function AuthenticateMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    const jsonResponse = new CoreServices.JsonResponse();
    const endsWith =  /(\/auth)$/;

    if(req.originalUrl.startsWith(MANAGE_BASE_ROUTER_URL) == false || endsWith.test(req.originalUrl) == false) {
        next(); // middleware handler
        return;
    }

    if(MANAGE_ACCEPTABLE_HTTP_VERBS.indexOf(req.method.toUpperCase()) === -1) {
        let error = `request.method: \'${req.method}\' not available.`;
        console.debug(`AuthenticateMiddleware ${req.originalUrl} ${error}`);
        res.status(200);
        res.json(jsonResponse.createError(error));
        return;
    }

    console.log("AuthenticateMiddleware");
    
    try {        
        if(req.body?.username == null || req.body?.password == null) {
            res.json(jsonResponse.createError("HttpPOST: username/password not available in request body."));
            return;
        } 
    
        let key = crypto.scryptSync('Rescue Shelter Data Encypt Secret', 'salt', 24);
        let iv = crypto.randomFillSync(new Uint8Array(16));
        let algorithm: string = 'aes-192-cbc';

        let cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encryptedData = cipher.update(req.body.password, 'utf8', 'hex');
        encryptedData += cipher.final('hex');
        
        res.set("encryptedData", encryptedData); 
        next();      
    } catch(error) { // Redis cache access 
        res.json(jsonResponse.createError(error));
    } // try-catch    
} // end AuthenticateMiddleware