import {Application}  from "express";
import * as bodyParser from "body-parser";
import * as services from "./services";
import {SecurityService, SecurityDb} from "./securityservice";

class AnimalDb {
    private __selectionFields;
    private model;

    constructor() {
        this.__selectionFields = '_id name description imageSrc sponsors';
        this.model = services.getModel(services.ANIMAL_MODEL_NAME);
    } // end constructor

    newAnimal(item: any) : Promise<any> {
        var animal = new this.model(item);
            
        return animal.save().then(product => {return product;});
    }

    saveAnimal(item: any) : Promise<any> {
        var animal = new this.model(item);

        var options = services.createFindOneAndUpdateOptions();
        return this.model.findOneAndUpdate({_id: animal._id}, animal, options)
            .then( doc => { return doc["value"]; });
    }

    getAnimal(id: String) : Promise<any>{
        return this.model.findById(id).then(doc => { return doc;});
    } 

    getAnimals(page: Number = 1, limit: Number = 5, phrase?: String) : Promise<any> {
        var animalAggregate = (!phrase)? this.model.aggregate() :
            this.model.aggregate().append({$match: {$text: {$search: phrase}}});
                
        return animalAggregate.append([
            {
                $lookup: {
                    from: "sponsors",
                    let: {animals_sponsors: '$sponsors'},
                    pipeline: [{
                        $project: {
                            _id: false, useremail: 1, username: 1, 
                            is_sponsor: {$in: ['$useremail', '$$animals_sponsors']}
                        }            
                    }],
                    as: "sponsors"
                }        
            },
            {
            $project: {
                name: 1, description: 1, endangered: 1, imageSrc: 1,
                sponsors: {
                    $filter: {
                        input: '$sponsors',
                        as: 'contributor',
                        cond: {$eq: ['$$contributor.is_sponsor', true]}
                    }
                }
            }}
        ])
        .limit(limit).then(data => {return data});
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
        let jsonResponse = new services.JsonResponse();            

        let db = new AnimalDb();
        let securityDb = new SecurityDb();

        /**
         * @description create a new animal data 
         */
        app.post("/api/animal/new", jsonBodyParser, async (req,res) => {
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
        });

        /**
         * @description update the animal data
         */
        app.post("/api/animal/:id", jsonBodyParser, async (req,res) => {
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
        }); // end POST [update] /api/animal/:id 

        /**
         * @description Retrieves single item
         * @param id unique identifier of item
         */
        app.get("/api/animal/:id", async (req,res) => {
            console.debug(`GET: ${req.url}`);
            if (!req.params.id) {
                    res.status(404);
                    res.send("HttpGET id not available");
                    return;
            }
            res.status(200);
            try {
                var data = await db.getAnimal(req.params.id);
                res.json(jsonResponse.createData(data));
            } catch(error) {
                    console.log(error);
                    res.json(jsonResponse.createError(error));
            }
        });

        /**
         * @description Retrieves a json resultset of items
         */
        app.get("/api/animals/", async (req,res) => {
            console.debug(`GET: ${req.url}`);
            var page = Number.parseInt(req.query["page"] as any || 1); 
            var limit = Number.parseInt(req.query["limit"] as any || 5);
            var phrase = req.query["phrase"] as string || '';

            res.status(200);
            
            try {
                var data = await db.getAnimals(page, limit, phrase);
                res.json(jsonResponse.createPagination(data,1,page));
            } catch(error) {
                res.json(jsonResponse.createError(error));
            }
        });
    } // end publishWebAPI
}; // end AnimalService class