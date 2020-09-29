import {Application, NextFunction, Request, Response, Router} from "express";
import * as bodyParser from "body-parser";
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
