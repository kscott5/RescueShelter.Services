import * as express from "express";
import * as crypto from "crypto";
import * as Middleware from "./middleware";
import {CoreServices} from "rescueshelter.core";
import {Connection, Model} from "mongoose";

let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});

class Generate {
   static security(useremail: String, textPassword: String, questions?: any) {
        const encryptedPassword = Generate.encryptedData(textPassword, useremail);
        const securityModel = {password: encryptedPassword};

        var secureQuestions = new Array();
        if(questions !== undefined  && questions.length !== 0) {
            console.debug(`${useremail} with ${questions.length} questions`);
            
            for(const index in questions) {
                if(questions[index]["question"] !== undefined && questions[index]["answer"] !== undefined) {
                    const question = {
                            question: questions[index]["question"], 
                            answer: Generate.encryptedData(questions[index]["answer"])
                    };
    
                    secureQuestions.push(question);
                } // end if
            } // end for loop
        } // end questions
        
        if(secureQuestions.length > 0)
            securityModel["questions"] = secureQuestions;

        return securityModel;
    }

    static encryptedData(data: String, secret: String = 'Rescue Shelter: Security Question Answer', algorithm: string = 'aes-192-cbc') {        
        let key = crypto.scryptSync(secret as string, 'salt', 24);
        let iv = crypto.randomFillSync(new Uint8Array(16));

        let cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encryptedData = cipher.update(data as string, 'utf8', 'hex');
        encryptedData += cipher.final('hex');
        
        return encryptedData;
    }
} // end Generate

export class SecurityDb {
    private authSelectionFields;
    private connection: Connection;

    constructor() {
        this.authSelectionFields = "_id useremail username firstname lastname photo audit";    
        this.connection = CoreServices.createConnection();        
    } // end constructor

    authenticate(useremail: String, encryptedPassword: String) : Promise<any> {
        const security = this.connection.model(CoreServices.SECURITY_MODEL_NAME, CoreServices.securityModel);

        const pipeline = [];
        pipeline.push({
            $match: {useremail: useremail}
        });

        pipeline.push({
            $lookup: {
                from: "security",
                let: {'password': '$password'},
                pipeline: [{
                    $project: {
                        _id: false, useremail: 1, username: 1, 
                        is_sponsor: {$in: ['$useremail', '$$animals_sponsors']}
                    }            
                }],
                as: "sponsors"
            }        
        });
        pipeline.push({
            $lookup: {
                from: "sponsors",
                let: {usermail: '$useremail', username: '$username', firstname: '$firstname', lastname: '$lastname'},
                pipeline: [{
                    $project: {
                        _id: false, useremail: 1, username: 1, 
                        is_sponsor: {$in: ['$useremail', '$$animals_sponsors']}
                    }            
                }],
                as: "sponsor"
            }        
        });
        return security.aggregate([
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
            
            return Promise.resolve(doc);
        });        
    } // end authenticate

    async registeration(item: any) : Promise<any> {
        if(await this.verifyUniqueUserEmail(item.useremail) === true ) {
            item.security = Generate.security(item.useremail, item.password, item.questions);

            var model = this.connection.model(CoreServices.SPONSOR_MODEL_NAME, CoreServices.sponsorSchema);
        
            var sponsor = new model({'useremail': item.useremail});
        
            await sponsor.save();
            
        }
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
            var accessType = access.accessType.trim().toLowerCase() || 'not required';
            switch(accessType) {
                case 'not required':
                    return Promise.resolve(true);

                case 'useremail':
                    return this.verifyUniqueUserEmail(access.useremail);
                
                case 'username':
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
        const sponsor = this.connection.model(CoreServices.SPONSORS_MODEL_NAME, CoreServices.sponsorSchema);

        return sponsor.findOne({useremail: name})
            .then(doc => { 
                return (doc === null)? 
                    Promise.resolve({unique: true}) :
                    Promise.reject({unique: false});
            });
    }

    private verifyUniqueUserEmail(email: String) : Promise<any> {
        const sponsor = this.connection.model(CoreServices.SPONSORS_MODEL_NAME, CoreServices.sponsorSchema);
        
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


        app.use(Middleware.AccessToken.default);
        app.use(Middleware.DataEncryption.default);

        router.post("/unique/sponsor", async (req,res) => {
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
            res.status(200);

            const data = req.body?.data;
            const secret = req.body?.secret || '';

            if(data == null) {
                res.removeHeader(Middleware.DataEncryption.HEADER_ENCRYPTED_DATA);
                res.json(jsonResponse.createError("HttpPOST: request body not available"));
                return;
            }

            res.json(jsonResponse.createData("encryption done."));
        });

        router.post("/deauth", async (req,res) => {
            res.status(200);

            const jsonResponse = new CoreServices.JsonResponse();

            var token = req.body.token;
            var useremail = req.body.useremail;
            var remoteIpAddr = req.socket?.remoteAddress;

            // @ts-ignore
            let client = redis.createClient({ disableOfflineQueue: true});

            let cacheErrorWasFound = false;
            client.on('error', (error) => { 
                if(cacheErrorWasFound) return;

                console.debug(`/death cache service blocking, error: ${error}`);
                cacheErrorWasFound = true;
            });

            client.on('ready', ()=> {
                client.get(token,(error,reply) => {
                    if(cacheErrorWasFound) {
                        console.debug(`/deauth cache service available now!`);
                    }

                    if(error) {
                        console.debug(`/deauth error: ${error}`);
                    } else {
                        let data = JSON.parse(reply);
                        if(cacheErrorWasFound || data?.useremail == useremail && data?.remoteIpAddr == remoteIpAddr) {
                            client.del(token);
                        }
                    }

                    res.json(jsonResponse.createData("component.loggout.bye.message"));
                }); // end client.get(...)
                
                client.quit();
            }); // end client.on(`ready`...)            
        }); // end /deauth

        /**
         * Authenticate the sponsor and generate app access hash id
         */
        router.post("/auth", async (req,res) => {
            res.status(200);

            // NOTE: https://github.com/redis/node-redis/blob/4d659f0b446d19b409f53eafbf7317f5fbb917a9/docs/client-configuration.md

            // @ts-ignore
            const client = new redis.RedisClient({ disableOfflineQueue: true});

            let cacheErrorWasFound = false;
            client.on('error', (error) => {
                if(cacheErrorWasFound) return;

                cacheErrorWasFound = true;
                console.debug(`/auth cache service blocking, error: ${error}`);
            });

            client.on('ready', async () => {
                if(cacheErrorWasFound)
                    console.debug(`/auth cache service available now`);

                const useremail = req.body?.useremail; // either useremail or username
                const password = req.body?.password; // clear text password never saved

                if(useremail == null || password == null) {
                    res.removeHeader(Middleware.AccessToken.HEADER_ACCESS_TOKEN);
                    res.removeHeader(Middleware.DataEncryption.HEADER_ENCRYPTED_DATA);
                    res.json(jsonResponse.createError("request body not available"));
                    return;
                }

                try {                
                    const encryptedPassword = res.getHeader(Middleware.DataEncryption.HEADER_ENCRYPTED_DATA)+'';
                    res.removeHeader(Middleware.DataEncryption.HEADER_ENCRYPTED_DATA);
                    
                    var sponsor = await db.authenticate(useremail, encryptedPassword);
                    
                    const accessToken = res.getHeader(Middleware.AccessToken.HEADER_ACCESS_TOKEN)+'';
                    const accessData = { 
                        useremail: useremail, 
                        remoteIpAddress: req.socket?.remoteAddress, 
                        scopes: 'Array of not available' // ex. sponsor.security.scopes
                    };

                    client.set(`${accessToken}`, `${ JSON.stringify(accessData) }`);
                    client.expire(accessToken, Middleware.AccessToken.EXPIRATION);

                    res.json(jsonResponse.createData({token: accessToken, sponsor: sponsor}));                
                } catch(error) {
                    res.removeHeader(Middleware.AccessToken.HEADER_ACCESS_TOKEN);
                    res.removeHeader(Middleware.DataEncryption.HEADER_ENCRYPTED_DATA);
                    
                    res.json(jsonResponse.createError(error));
                };

                client.quit();
            }); // end client.on('ready'...)
        }); // end /auth

        /**
         * Registers then authenticate new sponsor
         */
        router.post("/registration", async (req,res) => {
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
                    item.security = Generate.security(useremail, password, questions);

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