import base64url from "base64url";
import * as express from "express";
import * as bodyParser from "body-parser";

import {CoreServices} from "rescueshelter.core";
import {Connection, Model} from "mongoose";

import passport from "passport";
import * as webauthn from "passport-fido2-webauthn";

let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});

function registeration(user, externalId, publicKey, cb) {
    console.debug('Passort WebAuthn Registration');

    const connection = CoreServices.createConnection();
    const sponsors = this.connection.model(CoreServices.SPONSORS_MODEL_NAMEl);
    const security = this.connection.model(CoreServices.SECURITY_MODEL_NAME);

    var sponsor = new sponsors({...user, audit: [{modified: new Date(), sponsor_id: externalId}]});
    sponsor.save();    

    var secure = new security({sponsor_id: sponsor._id, externa_id: externalId, public_key: publicKey});
    secure.save();
    
    connection.close();

    return cb(null, sponsor);
} // end registration

function verification(externalId, userId, cb) {
    const connection = CoreServices.createConnection();
    const sponsors = this.connection.model(CoreServices.SPONSORS_MODEL_NAME, CoreServices.sponsoryModel);
    const security = this.connection.model(CoreServices.SECURITY_MODEL_NAME, CoreServices.securityModel);

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
        let jsonResponse = new CoreServices.JsonResponse();

        passport.use(strategy);

        app.use(bodyParser.json({type: "application/json"}));
        
        router.post('/challenge', function(req, res, next) {            
            sessionStore.challenge(req, function(err, challenge) {
              if (err) { return next(err); }
              res.json({ challenge: base64url.encode(challenge) });
            });
          });
        
        router.post('/auth',
            passport.authenticate('webauthn', { failWithError: true }),
            function(req, res, next) {
              res.json({ ok: true });
            },
            function(err, req, res, next) {
              res.json({ ok: false });
        });

        app.use('/api/passport', router);
    } // end publishWebAPI
} // end WebAuthnService