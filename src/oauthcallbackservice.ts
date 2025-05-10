import base64url from "base64url";
import * as express from "express";
import * as bodyParser from "body-parser";

import {CoreServices} from "rescueshelter.core";
import {Connection, Model} from "mongoose";

import { OAuth2Client } from "google-auth-library";

let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});

export class OAuthCallbackService {
    constructor(){}

    publishWebAPI(app: express.Application) : void {
        let jsonResponse = new CoreServices.JsonResponse();

        app.use(bodyParser.json({type: "application/json"}));
        
        router.post('/gs/verify', (req, res) => {
          const CLIENT_ID = '376504285036-7u3bjifr08917k18qr7euou8k1kpu6oo.apps.googleusercontent.com'
          const client = new OAuth2Client(CLIENT_ID);
          
          var data = {};

          client.verifyIdToken({
            idToken: req.body.credential,
            audience: CLIENT_ID,
          }).then((ticket) => {
            const payload = ticket.getPayload();
            res.status(200);
            res.json(jsonResponse.createData(payload));
          });
          
        });
        

        app.use('/api/oauth', router);
    } // end publishWebAPI
} // end OAuthCallbackService