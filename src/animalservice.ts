import {Application, NextFunction, Request, Response, Router}  from "express";
import * as bodyParser from "body-parser";
import {RedisClient} from "redis";
import {CoreServices} from "rescueshelter.core";
import {SecurityDb} from "./securityservice";

let router = Router({ caseSensitive: true, mergeParams: true, strict: true});

class AnimalManagerDb {
    private __selectionFields;
    private model;

    constructor() {
        this.__selectionFields = '_id name description imageSrc sponsors';
        this.model = CoreServices.getModel(CoreServices.ANIMAL_MODEL_NAME);
    } // end constructor

    async newAnimal(item: any) : Promise<any> {
        var animal = new this.model(item);
            
        var data = await animal.save();
        return data;
    }

    async saveAnimal(item: any) : Promise<any> {
        var animal = new this.model(item);

        var options = CoreServices.createFindOneAndUpdateOptions();
        var data = await this.model.findOneAndUpdate({_id: animal._id}, animal, options)
        return data["value"];
    }
} // end AnimalDb

export class AnimalService {
    constructor(){}

    /**
     * @description Publishes the available Web API URLs for items
     */
    publishWebAPI(app: Application) : void {
        // Parser for various different custom JSON types as JSON
        let jsonBodyParser = bodyParser.json({type: 'application/json'});
        let jsonResponse = new CoreServices.JsonResponse();            

        let db = new AnimalManagerDb();
        let securityDb = new SecurityDb();
        
        try {
            (new RedisClient({host: 'localhost', port: 6379}))?.quit();
        } catch(error) {
            console.log('**************These projects are professional entertainment***************')
            console.log('The following command configures an out of process Redis.io memory cache.');
            console.log('In process requires Redis.io install in the process of RescueShelter.Reports.');
            console.log('\n');
            console.log('docker run -it -p 127.0.0.1:6379:6379 --name redis_dev redis-server --loglevel debug');
            console.log('\n\n\n');
            console.log('Terminal/shell access use:> telnet 127.0.0.1 6379');
            console.log('set \'foo\' \'bar\''); // server response is +OK
            console.log('get \'foo\''); // server response is $4 bar
            console.log('quit'); //exit telnet sessions
        }
    
        async function validateAccessToken(req: Request, res: Response, next: NextFunction) {
            // var client: RedisClient;
            // try {
            //     client = new RedisClient({host: 'localhost', port: 6379});
    
            //     if(client.exists(req.params.id) === true) {
            //         next();
            //     }
            // } catch(error) {            
            //     res.json(jsonResponse.createError(error));
            // } finally {
            //     client?.quit();
            // }

            next();
        }
        
        app.use(validateAccessToken);

        router.post("/new", jsonBodyParser, async (req,res) => {
            console.debug(`POST: ${req.url}`);

            var hashid = req.body.hashid;
            var useremail = req.body.useremail;
            var animal = req.body.animal;
            
            res.status(200);

            if(animal === null) {
                res.json(jsonResponse.createError("HttpPOST request body not valid"));
            }

            try {
                var access = {accessType: "hashid", hashid: hashid, useremail: useremail};
                var auth = await securityDb.verifyAccess(access);
                

                var data = await db.newAnimal(req.body);
                res.json(jsonResponse.createData(data));
            } catch(error) { 
                console.log(error);
                res.json(jsonResponse.createError("You do not have access."));
            }
        }); // end routeNewAnimal
        
        router.post("/:id", jsonBodyParser, async (req,res) => {
            console.debug(`POST [:id] update ${req.url}`);

            var id = req.params.id;
            var hashid = req.body.hashid;
            var useremail = req.body.useremail;
            var animal = req.body.animal;
            
            res.status(200);

            if(id === null || animal === null || animal._id != id) {
                res.json(jsonResponse.createError("HttpPOST request parameter and/or json body not valid"));
            }
            
            try {
                var access = {accessType: "hashid", hashid: hashid, useremail: useremail};
                var auth = await securityDb.verifyAccess(access);

                var data = await db.saveAnimal(animal);
                res.json(jsonResponse.createData(data));
            } catch(error) {
                console.log(error);
                res.json(jsonResponse.createError("You do not have access."));
            }
        }); //end routeUpdateAnimalWithId       
                
        app.use("/api/manage/animals", router);        
    } // end publishWebAPI
}; // end AnimalService class

