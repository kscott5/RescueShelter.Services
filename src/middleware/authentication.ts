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

/**
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
export async function AuthenticationMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    const jsonResponse = new CoreServices.JsonResponse();
    const url =  /(\/api\/manage\/auth)$/;

    if(url.test(req.originalUrl) == false) {
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