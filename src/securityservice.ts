import * as express from "express";
import * as bodyParser from "body-parser";
import * as crypto from "crypto";
import * as redis from "redis";
import {CoreServices} from "rescueshelter.core";
import * as Middleware from "./middleware";

let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});
let cacheClient = redis.createClient({});

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
console.log('****************************************************************************\n');


(async () => {
    console.debug(`cacheAllUserEmails -> Cache All User Emails with DSN Key`);

    try {
        var model = CoreServices.getModel(CoreServices.SPONORS_MODEL_NAME);
        var data = await model.find({}, {'useremail': 1});

        if(data.length > 0) {
            cacheClient.set('UserEmailByDNS', JSON.stringify(data));
            cacheClient.expire('UserEmailByDNS', Middleware.AccessToken.EXPIRATION);
        }
    } catch(error)  {
        console.debug(`cacheAllUserEmails error: ${error}`);
    }
})();

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

    encryptedData(data: String, secret: String = 'Rescue Shelter: Security Question Answer', algorithm: string = 'aes-192-cbc') {        
        let key = crypto.scryptSync(secret as string, 'salt', 24);
        let iv = crypto.randomFillSync(new Uint8Array(16));

        let cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encryptedData = cipher.update(data as string, 'utf8', 'hex');
        encryptedData += cipher.final('hex');
        
        return encryptedData;
    }
} // end Generate

export class SecurityDb {
    private __authSelectionFields;
    private model;
    
    constructor() {
        this.__authSelectionFields = "_id useremail username firstname lastname photo audit";    

        this.model = CoreServices.getModel(CoreServices.SECURITY_MODEL_NAME);
    } // end constructor

    deauthenticate(access_token: String, useremail: String) : Promise<any> { 
        return this.model.findOneAndRemove({access_token: access_token, useremail: useremail});
    } 

    authenticate(useremail: String, encryptedPassword: String) : Promise<any> {
        const sponsor = CoreServices.getModel(CoreServices.SPONSOR_MODEL_NAME);
        return sponsor.aggregate([
            {
                $match: { $and: [{useremail: useremail, "security.password": encryptedPassword}] }
            },
            {
            $project: {
                firstname: 1, lastname: 1, useremail: 1, username: 1
            }}
        ])
        .limit(1)
        .then(doc => {
            if(doc.length === 0)
                return Promise.reject(CoreServices.SYSTEM_INVALID_USER_CREDENTIALS_MSG);
            
            var sponsor = doc[0];
            return Promise.resolve(sponsor);
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

    /**
     * @description Determines if a value is available or unique
     * @param access object {
     *     accessType: string [useremail|username],
     *     useremail: string,                       
     *     username: string
     * }
     */
    // https://jsfiddle.net/karegascott/wyjgsfne/
    verifyAdhocData(access: any) : Promise<any> {
        try {
            var accessType = access.accessType.trim().toLowerCase() || "not required";
            switch(accessType) {
                case "not required"  || 0:
                    return Promise.resolve(true);

                case "useremail" || 2:
                    return this.verifyUniqueUserEmail(access.useremail);
                
                case "username" || 3:
                    return this.verifyUniqueUserName(access.username);
                
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
        let jsonResponse = new CoreServices.JsonResponse();
        
        let db = new SecurityDb();
        let generate = new Generate();

        app.use(bodyParser.json({type: "application/json"}));
        app.use(Middleware.AccessToken.default);
        app.use(Middleware.DataEncryption.default);
        app.use(Middleware.Authentication.default);

        router.post("/unique/sponsor", async (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            const field = req.body.field;
            const value = req.body.value;
            if(!field || !value) {                
                res.json(jsonResponse.createError("HttpPOST body not available with request"));
            }

            try {
                var data = await db.verifyAdhocData({accessType: field, field: value});
                res.json(jsonResponse.createData(data));
            } catch(error) {
                res.json(jsonResponse.createError(error));
            }
        });

        router.post("/data", async (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            const data = req.body?.data || req.body?.password;
            const secret = req.body?.secret || '';

            if(!data || !secret) {
                res.json(jsonResponse.createError("HttpPOST: request body not available"));
            }

            res.json(jsonResponse.createData("encryption done."));
        });

        router.post("/deauth", async (req,res) => {
            console.debug(`POST: ${req.url}`);

            try {
                var access_token = req.body?.access_token;
                var useremail = req.body?.useremail;
                var remoteIpAddr = req.socket?.remoteAddress;

                cacheClient.get(access_token) === true;
                cacheClient.del(access_token) === true;                
            } catch(error) {
                console.debug(error);
            }

            res.location("/");
            res.redirect("/");
        });

        /**
         * Authenticate the sponsor and generate app access hash id
         */
        router.post("/auth", async (req,res) => {
            console.debug(`POST: ${req.url}`);
            res.status(200);

            const useremail = req.body.useremail; // either useremail or username
            const password = req.body.password; // clear text password never saved

            if(!useremail || !password) {
                res.json(jsonResponse.createError("HttpPOST: request body not available"));
            }

            try {                
                const encryptedPassword = res.get(Middleware.DataEncryption.HEADER_ENCRYPTED_DATA)
                var sponsor = await db.authenticate(useremail, encryptedPassword);
                
                const accessToken = generate.encryptedData(`${useremail}+${req.socket?.remoteAddress}`);
                const accessData = { 
                    useremail: useremail, 
                    remoteIpAddress: req.socket?.remoteAddress, 
                    scopes: 'Array of not available' // ex. sponsor.security.scopes
                };

                cacheClient.set(`${accessToken}`, `${ JSON.stringify(accessData) }`);
                cacheClient.expire(accessToken, Middleware.AccessToken.EXPIRATION);

                res.json(jsonResponse.createData({token: accessToken, sponsor: sponsor}));                
            } catch(error) {
                res.json(jsonResponse.createError(error));
            };
        });

        /**
         * Registers then authenticate new sponsor
         */
        router.post("/registration", async (req,res) => {
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

            try {

                if(await db.verifyAdhocData({accessType: 'useremail', useremail}) === true ) {
                    item.security = generate.security(useremail, password, questions);

                    var model = CoreServices.getModel(CoreServices.SPONSOR_MODEL_NAME);
                
                    var sponsor = new model(item);                
                    await sponsor.save();
                    
                    res.location('/auth');
                    res.redirect('/auth');
                } else {
                    res.status(200)
                    res.json(jsonResponse.createError(`${useremail} is not available.`));
                }
            } catch(error) {
                res.status(200);
                res.json(jsonResponse.createError(error))
            }
        }); // end /registration

        app.use('/api/manage/secure/', router);
    } // end publishWebAPI
} // end SecurityService