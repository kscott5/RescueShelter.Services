import * as crypto from "node:crypto";
import * as express from "express";
import {CoreServices} from "rescueshelter.core";
import { HEADER_ACCESS_TOKEN } from "./accesstoken";

/**
 * @description
 * The data encryption, encrypted data response header
 */
export const HEADER_ENCRYPTED_DATA = 'RS-ENCRYPTION-DATA';

function encryptData(plaintext: string, secret: string = 'Rescue Shelter Data Encypt Secret') : string {
    let key = crypto.scryptSync(secret, 'salt', 24);
    let iv = crypto.randomFillSync(new Uint8Array(16));
    let algorithm: string = 'aes-192-cbc';

    let cipher = crypto.createCipheriv(algorithm, key, iv);
    
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
 *          "username": "profile login identifier or name (password required!)"
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
export default async function DataEncryption(req: express.Request, res: express.Response, next: express.NextFunction) {
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
            res.json(jsonResponse.createError("HttpPOST: required fields not available in request body."));
            return;
        } 

        let encryptedData = encryptData(plaintext, req.body?.secret);
        if(req.body?.password != null && req.body?.username != null) {
            // create the access token
            let accessToken = encryptData(`${req.socket?.remoteAddress}/${req.body.useremail}/${encryptedData}`);
            res.set(HEADER_ACCESS_TOKEN, accessToken);
        } else {
            res.set(HEADER_ENCRYPTED_DATA, encryptedData);
        }

        next(); 
    } catch(error) { // Redis cache access 
        res.json(jsonResponse.createError(error));
    } // try-catch    
} // end DataEncryption
