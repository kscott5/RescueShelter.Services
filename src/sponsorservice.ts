import {Application, json} from "express";
import * as bodyParser from "body-parser";
import * as services from "./services";


class SponsorDb {
    private __selectionFields;
    private model;

    constructor() {
        this.__selectionFields =  "_id useremail username firstname lastname photo audit";
        this.model = services.getModel(services.SPONSOR_MODEL_NAME);
    }

    async newSponsor(item: any) : Promise<any> {
        var sponsor = new this.model(item);

        var data = await sponsor.save();
        return data;
    }

    async saveSponsor(item: any) : Promise<any>  {
        var sponsor = new this.model(item);
        
        sponsor["audit"].push({modified: new Date(), sponsor_id: sponsor._id});

        var options = services.createFindOneAndUpdateOptions();
        
        var data = await this.model.findOneAndUpdate({_id: sponsor._id}, sponsor, options);
        return data;
    }

    async getSponsor(id: String) : Promise<any>  {
        var data = await this.model.findById(id);
        return data;
    }

    async getSponsors(page: Number = 1, limit: Number = 5, phrase?: String) : Promise<any> {
        var condition = (phrase)? {$text: {$search: phrase}}: {};
        
        var data = await this.model.find(condition)
            .lean()
            .limit(limit)
            .select(this.__selectionFields);

        return data;
    } 
} //end SponsorDb class

export class SponsorService {
    constructor(){}

    publishWebAPI(app: Application) : void {
        let jsonBodyParser = bodyParser.json({type: 'application/json'});
        let jsonResponse = new services.JsonResponse();

        let db = new SponsorDb();

        app.post("/api/sponsor", jsonBodyParser, async (req,res) => {
            
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

        app.post("/api/sponsor/:id", jsonBodyParser, async (req,res) => {
            console.debug(`POST [:id]: ${req.url}`);            
            
            res.status(200);
            try {
                var data = await db.saveSponsor(req.body);
                res.json(jsonResponse.createData(data["value"]));
            } catch(error) {
                res.json(jsonResponse.createError(error));
            }
        });

        app.get("/api/sponsor/:id", async (req,res) => {
            console.debug(`GET [:id]: ${req.url}`);
            res.status(200);

            try {
                var data = await db.getSponsor(req.params.id);
                res.json(jsonResponse.createData(data));
            } catch(error) {
                res.json(jsonResponse.createError(error));
            }
        });

        app.get("/api/sponsors", async (req,res) => {
            console.debug(`GET: ${req.url}`);
            var page = Number.parseInt(req.query.page as any || 1); 
            var limit = Number.parseInt(req.query.limit as any || 5);
            var phrase = req.query.phrase as any || null;

            res.status(200);
            try {
                var data = await db.getSponsors(page,limit,phrase);
                res.json(jsonResponse.createPagination(data, 1, page));
            } catch(error) {
                res.json(jsonResponse.createError(error));
            }
        });
    } // end publishWebAPI
} // end SponsorService
