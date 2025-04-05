import * as crypto from "node:crypto";
import * as express from "express";
import * as redis from "redis";
import {CoreServices} from "rescueshelter.core";

// Create CoreServices application specific constants
export const SESSION_TIME = 900000; // 15 minutes = 900000 milliseconds
export const ACCESS_TOKEN_EXPIRATION = 60 /*seconds*/*5; // Five minutes

/**
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
export default async function Authentication(req: express.Request, res: express.Response, next: express.NextFunction) {
    const jsonResponse = new CoreServices.JsonResponse();
    const url =  /(\/api\/manage\/auth)$/;

    // Not authentication route
    if(url.test(req.originalUrl) == false) {
        next(); // middleware handler
        return;
    }
    console.log("Middleware Authentication");
    
    if(req.method.toUpperCase() == "POST") {
        let error = `request.method: \'${req.method}\' not available.`;
        console.debug(`Middleware Authentication ${req.originalUrl} ${error}`);
        res.status(200);
        res.json(jsonResponse.createError(error));
        return;
    }

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
} // end Authentication