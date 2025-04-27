import * as express from "express";
import * as bodyParser from "body-parser";
import * as CoreServices from "rescueshelter.core";
import * as Middleware from "./middleware";

import {Connection, Model} from "mongoose";

let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});

class SponsorDb {
    private selectionFields;
    private connection: Connection;
    private model: Model<CoreServices.sponsorSchema>;

    constructor() {
        this.selectionFields =  "_id useremail username firstname lastname photo audit";
        this.connection = CoreServices.createConnection();
        this.model = this.connection.model(CoreServices.SPONSOR_MODEL_NAME, CoreServices.sponsorSchema);
    }

    async close() {
        await this.connection.close();
    }

    async newSponsor(item: any) : Promise<any> {
        var sponsor = new this.model({ ...item,
                security: {...item.security}
        });

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

    publishWebAPI(app: express.Application) : void {
        app.use(bodyParser.json({type: 'application/json'}));
        
        app.use(Middleware.AccessToken.default);
        app.use(Middleware.DataEncryption.default);

        router.post("/", async (req,res) => {            
            let jsonResponse = new CoreServices.JsonResponse();
            if(!req.body) {
                res.status(200);
                res.json(jsonResponse.createError("HttpPOST json body not available"));
           }

           res.status(200);
           try {
                const db = new SponsorDb();
                var data = await db.newSponsor(req.body);
                await db.close();

                res.json(jsonResponse.createData(data));
           } catch(error) {
               res.json(jsonResponse.createError(error));
           }            
        });

        router.post("/:id", async (req,res) => {                   
            let jsonResponse = new CoreServices.JsonResponse();
            res.status(200);
            try {
                const db = new SponsorDb();
                var data = await db.saveSponsor(req.body);
                await db.close();

                res.json(jsonResponse.createData(data["value"]));
            } catch(error) {
                res.json(jsonResponse.createError(error));
            }
        });

        app.use("/api/manage/sponsors", router);
    } // end publishWebAPI
} // end SponsorService
