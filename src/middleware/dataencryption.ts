import crypto from "node:crypto";
import express from "express";

// @ts-ignore
import {services as CoreServices} from "rescueshelter.core";
import accesstoken from "./accesstoken";

/**
 * @description
 * The data encryption, encrypted data response header
 */
const HEADER_ENCRYPTED_DATA: string = 'RS-Encrypted-Data';
const ENCRYPTION_SECRET: string = 'RS Default Secret Text.';
const ENCRYPTION_ALGORITHM: string = 'aes-192-cbc';

function encryptData(plaintext: string, secret: string = ENCRYPTION_SECRET) : string {
    let key = crypto.scryptSync(secret, 'salt', 24);
    let iv = Uint8Array.from([191,173,60,199,43,61,43,13,54,47,28,252,36,163,161,141]);
    
    let cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encryptedData = cipher.update(plaintext, 'utf8', 'hex');
    encryptedData += cipher.final('hex');

    return encryptedData;
}

/**
 * @description 
 * Data encryption middleware encypts the request data.
 * The data format in req.body 
 * 
 *      {
 *          "data|password": "plain text data (required)",
 *          "useremail": "profile login email address (password required!)"
 *          "secret": "plain text secret data use with cipher (optional)"
 *      }
 * 
 * if data encrypted the express.Response.Headers appends RS-ENCRYPTED-DATA
 * 
 * @param req express.Request
 * @param res express.Response
 * @param next express.NextFunction
 * @returns 
 */
async function Middleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    console.log("Middleware Data Encryption");
    
    const jsonResponse = new CoreServices.JsonResponse();
    const url = /(\/api\/manage\/secure)\/(data|auth)$/

    if(url.test(req.originalUrl) == false) {
        next(); // middleware handler
        return;
    }

    if(req.method.toUpperCase() != "POST") {
        let error = `request.method: \'${req.method}\' not available.`;
        console.debug(`DataEncryptMiddleware ${req.originalUrl} ${error}`);
        res.status(200);
        res.json(jsonResponse.createError(error));
        return;
    }
    
    try {
        // encrypt raw data or plain text password
        let plaintext = req.body?.data || req.body?.password;
        if(plaintext == null) {
            res.json(jsonResponse.createError("required fields not available in request body."));
            return;
        } 

        let encryptedData = encryptData(plaintext, req.body?.secret || ENCRYPTION_SECRET);
        res.set(HEADER_ENCRYPTED_DATA, encryptedData);

        if(req.body?.password != null && req.body?.useremail != null) {
            // create the access token
            let accessToken = encryptData(`${req.socket?.remoteAddress}/${req.body.useremail}/${encryptedData}`);            
            res.set(accesstoken.HEADER_ACCESS_TOKEN, accessToken);
        }

        next();
    } catch(error) { // Redis cache access 
        res.json(jsonResponse.createError(error));
    } // try-catch    
} // end Middleware

export default {
    Middleware,
    HEADER_ENCRYPTED_DATA,
    ENCRYPTION_SECRET,
    ENCRYPTION_ALGORITHM
}