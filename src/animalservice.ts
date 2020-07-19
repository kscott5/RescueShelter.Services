import {Application, Router}  from "express";
import * as bodyParser from "body-parser";
import * as services from "./services";
import {SecurityService, SecurityDb} from "./securityservice";

let router = Router({ caseSensitive: true, mergeParams: true, strict: true});

class AnimalManagerDb {
    private __selectionFields;
    private model;

    constructor() {
        this.__selectionFields = '_id name description imageSrc sponsors';
        this.model = services.getModel(services.ANIMAL_MODEL_NAME);
    } // end constructor

    async newAnimal(item: any) : Promise<any> {
        var animal = new this.model(item);
            
        var data = await animal.save();
        return data;
    }

    async saveAnimal(item: any) : Promise<any> {
        var animal = new this.model(item);

        var options = services.createFindOneAndUpdateOptions();
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
        let jsonResponse = new services.JsonResponse();            

        let db = new AnimalManagerDb();
        let securityDb = new SecurityDb();
        
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
                
        app.use("/api/animals", router);        
    } // end publishWebAPI
}; // end AnimalService class

