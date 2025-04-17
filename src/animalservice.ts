import * as express  from "express";
import * as bodyParser from "body-parser";
import * as CoreServices from "rescueshelter.core";
import * as Middleware from "./middleware";

let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});

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
    publishWebAPI(app: express.Application) : void {
        // Parser for various different custom JSON types as JSON
        app.use(bodyParser.json({type: 'application/json'}));
                
        app.use(Middleware.AccessToken.default);
        app.use(Middleware.DataEncryption.default);

        router.post("/new", async (req,res) => {
            var hashid = req.body.hashid;
            var useremail = req.body.useremail;
            var animal = req.body.animal;
            
            res.status(200);

            let jsonResponse = new CoreServices.JsonResponse();
            let db = new AnimalManagerDb();
        
            if(animal === null) {
                res.json(jsonResponse.createError("HttpPOST request body not valid"));
            }

            try {
                var data = await db.newAnimal(req.body);
                res.json(jsonResponse.createData(data));
            } catch(error) { 
                console.log(error);
                res.json(jsonResponse.createError("You do not have access."));
            }
        }); // end routeNewAnimal
        
        router.post("/:id", async (req,res) => {
            var id = req.params.id;
            var useremail = req.body.useremail;
            var animal = req.body.animal;
            
            res.status(200);

            let jsonResponse = new CoreServices.JsonResponse();
            let db = new AnimalManagerDb();
        
            if(id === null || animal === null || animal._id != id) {
                res.json(jsonResponse.createError("HttpPOST request parameter and/or json body not valid"));
            }
            
            try {
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

