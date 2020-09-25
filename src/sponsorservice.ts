import {Application, NextFunction, Request, Response, Router} from "express";
import * as bodyParser from "body-parser";
import {RedisClient} from "redis";
import {CoreServices} from "rescueshelter.core";

let router = Router({ caseSensitive: true, mergeParams: true, strict: true});

class SponsorDb {
    private __selectionFields;
    private model;

    constructor() {
        this.__selectionFields =  "_id useremail username firstname lastname photo audit";
        this.model = CoreServices.getModel(CoreServices.SPONSOR_MODEL_NAME);
    }

    async newSponsor(item: any) : Promise<any> {
        var sponsor = new this.model(item);

        var data = await sponsor.save();
        return data;
    }

    async saveSponsor(item: any) : Promise<any>  {
        var sponsor = new this.model(item);
        
        sponsor["audit"].push({modified: new Date(), sponsor_id: sponsor._id});

        var options = CoreServices.createFindOneAndUpdateOptions();
        
        var data = await this.model.findOneAndUpdate({_id: sponsor._id}, sponsor, options);
        return data;
    }
} //end SponsorDb class

export class SponsorService {
    constructor(){}

    publishWebAPI(app: Application) : void {
        let jsonBodyParser = bodyParser.json({type: 'application/json'});
        let jsonResponse = new CoreServices.JsonResponse();

        let db = new SponsorDb();

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
    
        router.post("/", jsonBodyParser, async (req,res) => {
            
            console.debug(`POST: ${req.url}`);
            if(!req.body) {
                res.status(200);
                res.json(jsonResponse.createError("HttpPOST json body not available"));
           }

           res.status(200);
           try {
                var data = await db.newSponsor(req.body);
                res.json(jsonResponse.createData(data));
           } catch(error) {
               res.json(jsonResponse.createError(error));
           }            
        });

        router.post("/:id", jsonBodyParser, async (req,res) => {
            console.debug(`POST [:id]: ${req.url}`);            
            
            res.status(200);
            try {
                var data = await db.saveSponsor(req.body);
                res.json(jsonResponse.createData(data["value"]));
            } catch(error) {
                res.json(jsonResponse.createError(error));
            }
        });

        app.use("/api/manage/sponsors", router);
    } // end publishWebAPI
} // end SponsorService
