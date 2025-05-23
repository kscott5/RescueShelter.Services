import base64url from "base64url";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

// @ts-ignore
import {services as CoreServices} from "rescueshelter.core";

import passport from "passport";
import webauthn from "passport-fido2-webauthn";
import { CORSOptions } from ".";


let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});

// @ts-ignore
function registeration(user, externalId, publicKey, cb) {
    console.debug('Passort WebAuthn Registration');

    const connection = CoreServices.createConnection();
    const sponsors = connection.model(CoreServices.SPONSORS_MODEL_NAMEl);
    const security = connection.model(CoreServices.SECURITY_MODEL_NAME);

    var sponsor = new sponsors({...user, audit: [{modified: new Date(), sponsor_id: externalId}]});
    sponsor.save();    

    var secure = new security({sponsor_id: sponsor._id, externa_id: externalId, public_key: publicKey});
    secure.save();
    
    connection.close();

    return cb(null, sponsor);
} // end registration

// @ts-ignore
function verification(externalId, userId, cb) {
    const connection = CoreServices.createConnection();
    const sponsors = connection.model(CoreServices.SPONSORS_MODEL_NAME, CoreServices.sponsoryModel);
    const security = connection.model(CoreServices.SECURITY_MODEL_NAME, CoreServices.securityModel);

    var secure = security.findOne({'external_id': externalId});
    var sponsor = sponsors.findOne({'_id': secure.sponsor_id, 'user.id': userId});
    
    connection.close();

    return cb(null, sponsor, secure.public_key);
} // end verification


const sessionStore = new webauthn.SessionChallengeStore({key: 'webauthn'});
const strategy = new webauthn.Strategy({ store: sessionStore },
        verification, registeration);

export class WebAuthnService {    
    constructor(){}

    publishWebAPI(app: express.Application) : void {
        passport.use(strategy);

        router.use(bodyParser.json({type: "application/json"}));
        router.use(cors(CORSOptions));
        
        router.post('/challenge', function(req, res, next) {
           // @ts-ignore            
            sessionStore.challenge(req, (err, challenge) => {
              if (err) { return next(err); }
              // @ts-ignore
              res.json({ challenge: base64url.encode(challenge) });
            });
          });
        
        router.post('/auth',
            passport.authenticate('webauthn', { failWithError: true }),
            // @ts-ignore
            function(req, res, next) {
              res.json({ ok: true });
            },
            // @ts-ignore
            function(err, req, res, next) {
              res.json({ ok: false });
        });

        app.use('/api/passport', router);
    } // end publishWebAPI
} // end WebAuthnService