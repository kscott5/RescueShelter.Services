import express  from "express";
import bodyParser from "body-parser";

// @ts-ignore
import CoreServices from "rescueshelter.core";

import accesstoken from "./middleware/accesstoken";
import dataencryption from "./middleware/dataencryption";

import {Connection, Model} from "mongoose";

let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});

class AnimalManagerDb {
    private connection: Connection;
    private model: Model<CoreServices.animalSchema>;

    constructor() {
        this.connection = CoreServices.createConnection();
        this.model = this.connection.model(CoreServices.ANIMAL_MODEL_NAME, CoreServices.animalSchema);
    } // end constructor

    async close() {
        await this.connection.close();
    }

    async newAnimal(item: any) : Promise<any> {
        var animal = new this.model({...item, sponsors: [...item?.sponsors] });
            
        var data = await animal.save();
        return data;
    }

    async saveAnimal(item: any) : Promise<any> {
        var animal = new this.model({...item});

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
        router.use(bodyParser.json({type: 'application/json'}));
                
        router.use(accesstoken.Middleware);
        router.use(dataencryption.Middleware);

        router.post("/new", async (req,res) => {
            var animal = req.body.animal;
            
            res.status(200);

            let jsonResponse = new CoreServices.JsonResponse();
            let db = new AnimalManagerDb();
        
            if(animal === null) {
                res.json(jsonResponse.createError("HttpPOST request body not valid"));
            }

            try {
                var data = await db.newAnimal(req.body);
                await db.close();
                res.json(jsonResponse.createData(data));
            } catch(error) { 
                console.log(error);
                res.json(jsonResponse.createError("You do not have access."));
            }
        }); // end routeNewAnimal
        
        router.post("/:id", async (req,res) => {
            var id = req.params.id;
            var animal = req.body.animal;
            
            res.status(200);

            let jsonResponse = new CoreServices.JsonResponse();
            let db = new AnimalManagerDb();
        
            if(id === null || animal === null || animal._id != id) {
                res.json(jsonResponse.createError("HttpPOST request parameter and/or json body not valid"));
            }
            
            try {
                var data = await db.saveAnimal(animal);
                await db.close();

                res.json(jsonResponse.createData(data));
            } catch(error) {
                console.log(error);
                res.json(jsonResponse.createError("You do not have access."));
            }
        }); //end routeUpdateAnimalWithId       
                
        app.use("/api/manage/animals", router);        
    } // end publishWebAPI
}; // end AnimalService class

