import * as express from "express";
import * as bodyParser from "body-parser";
import * as crypto from "crypto";
import * as redis from "redis";
import {CoreServices} from "rescueshelter.core";
import * as blake2 from "blake2";

export const SESSION_TIME = 900000; // 15 minutes = 900000 milliseconds

let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});

const client = redis.createClient({});

console.log('\n**************These projects are professional entertainment***************')
console.log('The following command configures an out of process Redis.io memory cache.');
console.log('In process requires Redis.io install in the process of RescueShelter.Reports.');
console.log('');
console.log('docker run -it -p 127.0.0.1:6379:6379 --name redis_dev redis-server --loglevel debug');
console.log('');
console.log('Terminal/shell access use:> telnet 127.0.0.1 6379');
console.log('set \'foo\' \'bar\''); // server response is +OK
console.log('get \'foo\''); // server response is $4 bar
console.log('quit'); //exit telnet sessions
console.log('****************************************************************************\n')
class Track {
    private model;
    constructor() {
        this.model = CoreServices.getModel(CoreServices.TRACK_MODEL_NAME);
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
        this.model = CoreServices.getModel(CoreServices.SECURITY_MODEL_NAME);
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

    encryptedData(data: String, key: String = 'Rescue Shelter: Security Question Answer') {
        
        const tmpData = data.trim();
        const tmpKey = key.trim();
    
        const hash = blake2.createKeyedHash("blake2b", Buffer.from(tmpKey), {digestLength: 16})
        hash.update(Buffer.from(tmpData))

        const encryptedHashData = hash.digest('hex')
        return encryptedHashData;
    }
} // end Generate

export class SecurityDb {
    private __authSelectionFields;
    private generate;
    private model;
    
    constructor() {
        this.__authSelectionFields = "_id useremail username firstname lastname photo audit";    
        this.generate = new Generate();

        this.model = CoreServices.getModel(CoreServices.SECURITY_MODEL_NAME);
    } // end constructor

    deauthenticate(access_token: String, useremail: String) : Promise<any> { 
        client.del(access_token.toString(), (error,reply) => {
            console.debug(`${useremail} Redis `);
        });
        return this.model.findOneAndRemove({access_token: access_token, useremail: useremail});
    } 

    authenticate(useremail: String, password: String) : Promise<any> {
        const encryptedPassword = this.generate.encryptedData(password, useremail);

        // Format improves readable and increases the Number of lines
        const now = new Date();            

        const sponsor = CoreServices.getModel(CoreServices.SPONSOR_MODEL_NAME);
        return sponsor.aggregate([
            {
                $lookup: { // left outer join on sponsor. access_token exists and valid
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
                                _id: false, access_token: 1, useremail: 1, expires: 1, 
                                expired: { $not: {$gt: ['$expires', now.getTime()] } }
                            }
                        }
                    ],
                    as: "oauth"
                }        
            },
            {
                $match: { $and: [{useremail: useremail, "security.password": encryptedPassword}] }
            },
            {
            $project: {
                firstname: 1, lastname: 1, useremail: 1, username: 1, oauth: '$oauth'
            }}
        ])
        .limit(1)
        .then(doc => {
            if(doc.length === 0)
                return Promise.reject(CoreServices.SYSTEM_INVALID_USER_CREDENTIALS_MSG);

            // *********************************************
            // NOTE: Use Case ValidateAccessMiddleware
            // *********************************************
            var sponsor = doc[0];                    
            if(sponsor.oauth.length === 1) { // session exists                        
                var oauth = sponsor.oauth[0]; 
                if(oauth.expired) 
                    return Promise.reject(CoreServices.SYSTEM_SESSION_EXPIRED);

                sponsor.authorization = null;
                return Promise.resolve({access_token: oauth.access_token, sponsor: sponsor});
            } else { // session does not exists                
                return Promise.resolve(this.generate.access_token(sponsor)).then(data => {
                    return Promise.resolve({ouath: data._doc.ouath /* find alternative */, sponsor: sponsor})});
                
            }
            // *********************************************
            // NOTE: Above Use Case ValidateAccessMiddleware
            // *********************************************
        });        
    } // end authenticate

    newSponorSecurity(useremail: String, securityModel: any) : Promise<any> {
        if(!securityModel["password"]) {
            console.debug(`${securityModel}: not a valid security schema`);
            return Promise.reject("Sponsor security creation issue. Contact system administrator");
        }

        const options = CoreServices.createFindOneAndUpdateOptions();
        return this.model.findOneAndUpdate({useremail: useremail}, {$set: {security: securityModel}}, options);
    }

    // https://jsfiddle.net/karegascott/wyjgsfne/
    verifyAccess(access: any) : Promise<any> {
        try {
            var accessType = access.accessType.trim().toLowerCase() || "not required";
            switch(accessType) {
                case "not required"  || 0:
                    return Promise.resolve(true);

                case "access_token" || 1:
                    return this.verifyAccessToken(access.access_token, access.useremail);

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

    private verifyAccessToken(access_token: String, useremail: String) : Promise<any> { 
        console.debug(`verify ${useremail} oauth acccess_token ${access_token}`);

        return this.model.findOne({access_token: access_token, useremail: useremail})
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
        const sponsor = CoreServices.getModel(CoreServices.SPONSOR_MODEL_NAME);
        return sponsor.findOne({useremail: name})
            .then(doc => { 
                return (doc === null)? 
                    Promise.resolve({unique: true}) :
                    Promise.reject({unique: false});
            });
    }

    private verifyUniqueUserEmail(email: String) : Promise<any> {
        const sponsor = CoreServices.getModel(CoreServices.SPONSOR_MODEL_NAME);
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

    publishWebAPI(app: express.Application) : void {
        let jsonBodyParser = bodyParser.json({type: 'application/json'});
        let jsonResponse = new CoreServices.JsonResponse();
        
        let db = new SecurityDb();
        let generate = new Generate();

        const SECURE_ROUTER_BASE_URL = '/api/manage/secure';

        async function AccessTokenMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
            if(req.originalUrl.startsWith(SECURE_ROUTER_BASE_URL) !== true) {
                next();
                return;
            }

            if(req.method.toLowerCase() != 'post') {
                let error = `accepts request method: '\POST\' not method: \'${req.method}\'`;
                console.debug(`AccessTokenMiddleware ${req.originalUrl} ${error}`);
                res.status(200);
                res.json(jsonResponse.createError(error));
                return;
            }

            try { // Reading data from Redis in memory cache
                let access_token = req.body?.access_token;

                if(access_token == undefined) {
                    let error = `missing request.body: '${JSON.stringify({access_token: 'value'})}'`;
                    console.debug(`AccessTokenMiddleware ${req.originalUrl} ${error}`);
                    res.status(200);
                    res.json(jsonResponse.createError(error));
                    return;
                        
                }

                client.get(access_token, (error,reply) => {
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
                console.debug(error);
                next();
            } // try-catch    
        } // end AccessTokenMiddleware
        
        app.use(AccessTokenMiddleware);

        router.post("/unique/sponsor", jsonBodyParser, async (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);SECURE_ROUTER_BASE_URL

            const field = req.body.field;
            const value = req.body.value;
            if(!field || !value) {                
                res.json(jsonResponse.createError("HttpPOST body not available with request"));
            }

            try {
                var data = await db.verifyAccess({accessType: field, field: value});
                res.json(jsonResponse.createData(data));
            } catch(error) {
                res.json(jsonResponse.createError(error));
            }
        });

        router.post("/data", jsonBodyParser, async (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            const data = req.body.data;
            const secret = req.body.secret;            

            if(!data || !secret) {
                res.json(jsonResponse.createError("HttpPOST: request body not available"));
            }

            res.json(jsonResponse.createData(generate.encryptedData(data,secret)));
        });

        router.post("/verify", jsonBodyParser, async (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            var access_token = req.body.access_token;
            var useremail = req.body.useremail;

            if(!access_token || !useremail) {
                res.json(jsonResponse.createError("HttpPOST body not available with request"));
            }

            try {
                var data = db.verifyAccess({accessType: 'access_token', access_token: access_token, useremail: useremail});
                res.json(jsonResponse.createData(data));
            } catch(error) {
                res.json(jsonResponse.createError(error));
            }
        }); // end /verify

        router.post("/deauth", jsonBodyParser, async (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            var access_token = req.body.access_token;
            var useremail = req.body.useremail;

            if(!access_token || !useremail) {
                res.json(jsonResponse.createError("HttpPOST body is not available."));
            }

            try {
            var data = await db.deauthenticate(access_token, useremail);
                res.json(jsonResponse.createData(data));
            } catch(error) {
                res.json(jsonResponse.createError(error));
            }
        });

        /**
         * Authenticate the sponsor and generate app access hash id
         */
        router.post("/auth", jsonBodyParser, async (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            const useremail = req.body.useremail; // either useremail or username
            const password = req.body.password; // clear text password never saved

            if(!useremail || !password) {
                res.json(jsonResponse.createError("HttpPOST: request body not available"));
            }

            try {
                var data = await db.authenticate(useremail, password);
                res.json(jsonResponse.createData(data));
            } catch(error) {
                res.json(jsonResponse.createError(error));
            };
        });

        /**
         * Registers then authenticate new sponsor
         */
        router.post("/registration", jsonBodyParser, async (req,res) => {
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

            try {            
                var model = CoreServices.getModel(CoreServices.SPONSOR_MODEL_NAME);
                var sponsor = new model(item);
                
                await sponsor.save();

                var auth = await db.authenticate(useremail, password);
                res.json(jsonResponse.createData(auth))            
            } catch(error) {
                res.json(jsonResponse.createError(error))
            }
        }); // end /registration

        // string.concat('/') is an express HACK. req.originalUrl.startsWith(SECURE_ROUTER_BASE_URL)
        app.use(SECURE_ROUTER_BASE_URL.concat('/'), router);
    } // end publishWebAPI
} // end SecurityService