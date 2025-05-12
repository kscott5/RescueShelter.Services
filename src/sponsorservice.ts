import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import CoreServices from "rescueshelter.core";
import accesstoken from "./middleware/accesstoken";
import dataencryption from "./middleware/dataencryption";

import {Connection, Model} from "mongoose";
import { CORSOptions } from ".";

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
        var sponsor = new this.model({
            'useremail': item.useremail, 'username': item.username,
            'firstname': item.firstname, 'lastname': item.lastname
         });
        
         sponsor["audit"].push({modified: new Date(), sponsor_id: sponsor._id});

        var data = await sponsor.save();
        return data;
    }

    async saveSponsor(item: any) : Promise<any>  {
        var sponsor = new this.model({
            '_id': item._id,
            'useremail': item.useremail, 'username': item.username,
            'firstname': item.firstname, 'lastname': item.lastname
         });
        
        sponsor["audit"].push({modified: new Date(), sponsor_id: sponsor._id});

        var options = CoreServices.createFindOneAndUpdateOptions();
        
        var data = await this.model.findOneAndUpdate({_id: sponsor._id}, sponsor, options);
        return data;
    }
} //end SponsorDb class

export class SponsorService {
    constructor(){}

    publishWebAPI(app: express.Application) : void {
        router.use(bodyParser.json({type: 'application/json'}));
        
        router.use(cors(CORSOptions));
        router.use(accesstoken.Middleware);
        router.use(dataencryption.Middleware);

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
