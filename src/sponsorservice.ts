import {Application, json} from "express";
import * as bodyParser from "body-parser";
import * as services from "./services";

export namespace SponsorService {
    class SponsorDb {
        private __selectionFields;
        private model;

        constructor() {
            this.__selectionFields =  "_id useremail username firstname lastname photo audit";
            this.model = services.getModel(services.SPONSOR_MODEL_NAME);
        }

        newSponsor(item: any) : Promise<any> {
            var sponsor = new this.model(item);

            return sponsor.save();
        }

        saveSponsor(item: any) : Promise<any>  {
            var sponsor = new this.model(item);
            
            sponsor["audit"].push({modified: new Date(), sponsor_id: sponsor._id});

            var options = services.createFindOneAndUpdateOptions();
            
            return this.model.findOneAndUpdate({_id: sponsor._id}, sponsor, options);
        }

        getSponsor(id: String) : Promise<any>  {
            return this.model.findById(id);
        }

        getSponsors(page: Number = 1, limit: Number = 5, phrase?: String) : Promise<any> {
            var condition = (phrase)? {$text: {$search: phrase}}: {};
            
            return this.model.find(condition)
                .lean()
                .limit(limit)
                .select(this.__selectionFields);
        } 
    } //end SponsorDb class

    export function publishWebAPI(app: Application) {
        let jsonBodyParser = bodyParser.json({type: 'application/json'});
        let jsonResponse = new services.JsonResponse();

        let db = new SponsorDb();

        app.post("/api/sponsor", jsonBodyParser, (req,res) => {
            
            console.debug(`POST: ${req.url}`);
            if(!req.body) {
                res.status(200);
                res.json(jsonResponse.createError("HttpPOST json body not available"));
           }

           res.status(200);
           Promise.resolve(db.newSponsor(req.body))
            .catch(error => res.json(jsonResponse.createError(error)))
            .then(data => res.json(jsonResponse.createData(data)));
        });

        app.post("/api/sponsor/:id", jsonBodyParser, (req,res) => {
            console.debug(`POST [:id]: ${req.url}`);            
            
            res.status(200);
            Promise.resolve(db.saveSponsor(req.body))
                .catch(error => res.json(jsonResponse.createError(error)) )
                .then(data => res.json(jsonResponse.createData(data["value"])));
        });

        app.get("/api/sponsor/:id", (req,res) => {
            console.debug(`GET [:id]: ${req.url}`);
            res.status(200);

            Promise.resolve(db.getSponsor(req.params.id))
                .catch(error => res.json(jsonResponse.createError(error)) )
                .then(data => res.json(jsonResponse.createData(data)) );
        });

        app.get("/api/sponsors", (req,res) => {
            console.debug(`GET: ${req.url}`);
            var page = Number.parseInt(req.query.page as any || 1); 
            var limit = Number.parseInt(req.query.limit as any || 5);
            var phrase = req.query.phrase as any || null;

            res.status(200);
            Promise.resolve(db.getSponsors(page,limit,phrase))
                .then(data => res.json(jsonResponse.createPagination(data, 1, page)))
                .catch(error => res.json(jsonResponse.createError(error)));
        });
    } // end publishWebAPI
} // end SponsorService namespace
