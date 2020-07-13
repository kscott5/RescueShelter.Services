import {Application} from "express";
import * as bodyParser from "body-parser";
import * as crypto from "crypto";
import * as services from "./services";

export const SESSION_TIME = 900000; // 15 minutes = 900000 milliseconds

class Track {
    private model;
    constructor() {
        this.model = services.getModel(services.TRACK_MODEL_NAME);
    }

    request(action: any) {
        console.debug("Tracking transaction");

        var obj = new this.model(action);
        
        obj.save((err, doc)=>{
            if(err !== null) {                
                console.log("Error occurred with transaction tracker");
                console.log(err);
                throw new Error(err);
            }
        });
    } // end request
} // end Track

class Generate {
    private model;
    constructor(){
        this.model = services.getModel(services.SECURITY_MODEL_NAME);
    }

    security(useremail: String, textPassword: String, questions?: any) {
        const encryptedPassword = this.encryptedData(textPassword, useremail);
        const securityModel = {password: encryptedPassword};

        var secureQuestions = new Array();
        if(questions !== undefined  && questions.length !== 0) {
            console.debug(`${useremail} with ${questions.length} questions`);
            
            for(const index in questions) {
                if(questions[index]["question"] !== undefined && questions[index]["answer"] !== undefined) {
                    const question = {
                            question: questions[index]["question"], 
                            answer: this.encryptedData(questions[index]["answer"])
                    };
    
                    secureQuestions.push(question);
                } // end if
            } // end for loop
        } // end questions
        
        if(secureQuestions.length > 0)
            securityModel["questions"] = secureQuestions;

        return securityModel;
    }

    encryptedData(data: String, salt: String = 'Rescue Shelter: Security Question Answer') {
        const tmpData = data.trim();
        const tmpSalt = salt.trim();

        const encryptedData = crypto.pbkdf2Sync(tmpData, tmpSalt, 100, 50, 'sha256');
        const hexEncryptedData = encryptedData.toString('hex');

        return hexEncryptedData;
    }

    /**
     * 
     * @param doc authenicate sponor was ok
     */
    private hashId(doc: any) : Promise<any> {
        if(!doc)
            return Promise.reject(services.SYSTEM_INVALID_USER_CREDENTIALS_MSG);

        var now = new Date();
        var expires = new Date(now.getTime()+SESSION_TIME);

        var useremail = doc.useremail;
        console.debug(`generateHashId with ${useremail}`);
        
        var hashid = this.encryptedData(useremail, `${useremail} hash salt ${expires.getTime()}`);

        var tokenModel = this.model;
        var update = new tokenModel({useremail: useremail, hashid: hashid, expires: expires.getTime()});

        var options = services.createFindOneAndUpdateOptions({_id: false, hashid: 1, expiration: 1}, true);
        return tokenModel.findOneAndUpdate({useremail: useremail}, update, options)
            .then(product => {return product["value"]} )
            .catch(err => {
                console.log(err);
                return Promise.reject(services.SYSTEM_UNAVAILABLE_MSG);
            });
    } // end hashId
} // end Generate

export class SecurityDb {
    private __authSelectionFields;
    private generate;
    private model;
    
    constructor() {
        this.__authSelectionFields = "_id useremail username firstname lastname photo audit";    
    
        this.generate = new Generate();

        this.model = services.getModel(services.SECURITY_MODEL_NAME);
    } // end constructor

    deauthenticate(hashid: String, useremail: String) : Promise<any> { 
        return this.model.findOneAndRemove({hashid: hashid, useremail: useremail});
    } 

    authenticate(useremail: String, password: String) : Promise<any> {
        const encryptedPassword = this.generate.encryptedData(password, useremail);

        // Format improves readable and increases the Number of lines
        const now = new Date();            

        const sponsor = services.getModel(services.SPONSOR_MODEL_NAME);
        return sponsor.aggregate([
            {
                $lookup: { // left outer join on sponsor. token exists and valid
                    from: "tokens",
                    let: {sponsors_useremail: '$useremail'},
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        {$eq: ['$useremail', '$$sponsors_useremail']},
                                        {$eq: ['$useremail', useremail]}
                                    ]
                                }
                            }
                        },
                        {                    
                            $project: {
                                _id: false, hashid: 1, useremail: 1, expires: 1, 
                                expired: { $not: {$gt: ['$expires', now.getTime()] } }
                            }
                        }
                    ],
                    as: "token"
                }        
            },
            {
                $match: { $and: [{useremail: useremail, "security.password": encryptedPassword}] }
            },
            {
            $project: {
                firstname: 1, lastname: 1, useremail: 1, username: 1, token: '$token'
            }}
        ])
        .limit(1)
        .then(doc => {
            if(doc.length === 0)
                return Promise.reject(services.SYSTEM_INVALID_USER_CREDENTIALS_MSG);

            var sponsor = doc[0];                    
            if(sponsor.token.length === 1) { // session exists                        
                var token = sponsor.token[0]; 
                if(token.expired) 
                    return Promise.reject(services.SYSTEM_SESSION_EXPIRED);

                sponsor.token = null;
                return Promise.resolve({hashid: token.hashid, sponsor: sponsor});
            } else { // session !exists                
                return Promise.resolve(this.generate.hashId(sponsor)).then(data => {
                    return Promise.resolve({hashid: data._doc.hashid /* find alternative */, sponsor: sponsor})});
                
            }
        });        
    } // end authenticate

    newSponorSecurity(useremail: String, securityModel: any) : Promise<any> {
        if(!securityModel["password"]) {
            console.debug(`${securityModel}: not a valid security schema`);
            return Promise.reject("Sponsor security creation issue. Contact system administrator");
        }

        const options = services.createFindOneAndUpdateOptions();
        return this.model.findOneAndUpdate({useremail: useremail}, {$set: {security: securityModel}}, options);
    }

    // https://jsfiddle.net/karegascott/wyjgsfne/
    verifyAccess(access: any) : Promise<any> {
        try {
            var accessType = access.accessType.trim().toLowerCase() || "not required";
            switch(accessType) {
                case "not required"  || 0:
                    return Promise.resolve(true);

                case "hashid" || 1:
                    return this.verifyHash(access.hashid, access.useremail);

                case "useremail" || 2:
                    return this.verifyUniqueUserEmail(access.useremail);
                
                case "username" || 3:
                    return this.verifyUniqueUserName(access.username);

                case "uniqueuserfield" || 4:
                    return this.verifyUniqueUserField(access.field, access.value);
                    
                default:
                    console.debug(`Access Type: ${accessType} not valid`);
                    return Promise.resolve(false);
            }
        } catch(error) {
            console.debug("verify access type not valid");
            console.debug(error);
            
            return Promise.reject(error);
        }
    } // end verifyAccess

    private verifyHash(hashid: String, useremail: String) : Promise<any> { 
        console.debug(`verify ${useremail} hash id ${hashid}`);

        return this.model.findOne({hashid: hashid, useremail: useremail})
            .then(doc => {
                return (doc !== null)? 
                Promise.resolve({verified: true}) :
                Promise.reject({verified: false});
            });
    }

    private verifyUniqueUserField(field: String, value: String) : Promise<any> {
        switch(field.trim().toLowerCase()) {
            case "username":
                return this.verifyUniqueUserName(value);

            case "useremail":
                return this.verifyUniqueUserEmail(value);

            default:
                console.log(`${field} is not a valid field`);
                return Promise.reject({unique: false});
        }
    }

    private verifyUniqueUserName(name: String) : Promise<any> {
        const sponsor = services.getModel(services.SPONSOR_MODEL_NAME);
        return sponsor.findOne({useremail: name})
            .then(doc => { 
                return (doc === null)? 
                    Promise.resolve({unique: true}) :
                    Promise.reject({unique: false});
            });
    }

    private verifyUniqueUserEmail(email: String) : Promise<any> {
        const sponsor = services.getModel(services.SPONSOR_MODEL_NAME);
        return sponsor.findOne({useremail: email})
            .then(doc =>  {
                return (doc === null)? 
                    Promise.resolve({unique: true}) :
                    Promise.reject({unique: false});
            });
    }
} // end SecurityDb

export class SecurityService {

    constructor(){}

    publishWebAPI(app: Application) : void {
        let jsonBodyParser = bodyParser.json({type: 'application/json'});
        let jsonResponse = new services.JsonResponse();
        
        let db = new SecurityDb();
        let generate = new Generate();
        
        app.post("/api/secure/unique/sponsor", jsonBodyParser, (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            const field = req.body.field;
            const value = req.body.value;
            if(!field || !value) {                
                res.json(jsonResponse.createError("HttpPOST body not available with request"));
            }

            Promise.resolve(db.verifyAccess({accessType: field, field: value}))
                .then(data => res.json(jsonResponse.createData(data)))
                .catch(error => res.json(jsonResponse.createError(error)));
        });

        app.post("/api/secure/data", jsonBodyParser, (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            const data = req.body.data;
            const secret = req.body.secret;            

            if(!data || !secret) {
                res.json(jsonResponse.createError("HttpPOST: request body not available"));
            }

            res.json(jsonResponse.createData(generate.encryptedData(data,secret)));
        });

        app.post("/api/secure/verify", jsonBodyParser, (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            var hashid = req.body.hashid;
            var useremail = req.body.useremail;

            if(!hashid || !useremail) {
                res.json(jsonResponse.createError("HttpPOST body not availe with request"));
            }

            Promise.resolve(db.verifyAccess({accessType: 'hashid', hashid: hashid, useremail: useremail}))
                .then(data => res.json(jsonResponse.createData(data)))
                .catch(error => res.json(jsonResponse.createError(error)));            
        }); // end /api/secure/verify

        app.post("/api/secure/deauth", jsonBodyParser, (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            var hashid = req.body.hashid;
            var useremail = req.body.useremail;

            if(!hashid || !useremail) {
                res.json(jsonResponse.createError("HttpPOST body is not available."));
            }

            Promise.resolve(db.deauthenticate(hashid, useremail))
                .then(data => res.json(jsonResponse.createData(data)))
                .catch(error => res.json(jsonResponse.createError(error)));
        });

        /**
         * Authenticate the sponsor and generate app access hash id
         */
        app.post("/api/secure/auth", jsonBodyParser, (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            const useremail = req.body.useremail; // either useremail or username
            const password = req.body.password; // clear text password never saved

            if(!useremail || !password) {
                res.json(jsonResponse.createError("HttpPOST: request body not available"));
            }

            Promise.resolve(db.authenticate(useremail, password))
                .then(data => res.json(jsonResponse.createData(data)))
                .catch(error => res.json(jsonResponse.createError(error)));
        });

        /**
         * Registers then authenticate new sponsor
         */
        app.post("/api/secure/registration", jsonBodyParser, (req,res) => {
            console.debug(`POST: ${req.url}`);
            if(!req.body) {
                res.status(200);
                res.json(jsonResponse.createError("HttpPOST json body not available"));
            }

            // generate the security object
            var item = req.body;
            var useremail = item.useremail;
            var password = item.password;
            var questions = item.questions;

            item.security = generate.security(useremail, password, questions);

            // create the new sponsor with security
            res.status(200);

            var model = services.getModel(services.SPONSOR_MODEL_NAME);
            var sponsor = new model(item);

            var authPromise = Promise.resolve(db.authenticate(useremail, password));
            Promise.resolve(sponsor.save())
                .then(doc => authPromise)
                .then(auth => res.json(jsonResponse.createData(auth)))
                .catch(error => res.json(jsonResponse.createError(error)));
        }); // end /api/secure/registration
    } // end publishWebAPI
} // end SecurityService