import { Mongoose, Schema, Model, Document } from "mongoose";

let mongoose = new Mongoose()

console.log(`mongoosejs version: ${mongoose.version}`);

mongoose.set('debug', true);
mongoose.set('useFindAndModify', false);

const __connectionString = 'mongodb://localhost:27017/rescueshelter';
const __connection = mongoose.createConnection(__connectionString, { useNewUrlParser: true , useUnifiedTopology: true, useCreateIndex: true} );

export const SECURITY_MODEL_NAME = "token";
createMongooseModel(SECURITY_MODEL_NAME, 
    createMongooseSchema({}, false /* disable schema strict */));

export const TRACK_MODEL_NAME = "transaction";
createMongooseModel(TRACK_MODEL_NAME, () => {
    var schema = createMongooseSchema({
            name: {type: String, required: true},
            sponsor_id: {type: {}, required: true},
            data: {type: {}, required: true},
            date: {type: Date, required: true}
        }); 

    schema.path("data").default(new Date());

    return schema;
});

export const SPONSOR_MODEL_NAME = "sponsor";
createMongooseModel(SPONSOR_MODEL_NAME, ()=>{
    
    var question = createMongooseSchema({
        _id: false,
        question: {type: String, required: true},
        answer: {type: String, required: true},
    });

    var securitySchema = createMongooseSchema({        
        _id: false,
        password: {type: String, required: true},
        questions: [question]
    });


    var schema = createMongooseSchema({        
        firstname: {type: String},
        lastname: {type: String},
        useremail: {type: String, required: [true, '*'], unique: true},
        username: {type: String, unique: true},
        security: {type: securitySchema},
        photo: {type: String},
        audit: [
            {
                _id: false,
                modified: {type: Date, required: [true]},
                sponsor_id: {type: mongoose.SchemaTypes.ObjectId, required: [true]}
            }
        ]
    });
    
    schema.index({username: "text", useremail: "text"});
    schema.path("audit").default(function(){
        return {
            modified: Date.now(),
            sponsor_id: this._id,
        };
    });    
    //schema.path("audit.sponssor_id").default(function(){return Date.now();});
    
    return schema;
});

export const ANIMAL_MODEL_NAME = "animal";
createMongooseModel(ANIMAL_MODEL_NAME, ()=>{
    var schema = createMongooseSchema({
        name: {type: String, unique:true, required: [true, '*']},
        image: {
            content: String,
            contenttype: String
        },
        endangered: Boolean,
        category: String,
        description: String,
        data: {type: Array<{population: Number, created: Date}>()},
        dates: {
            created: Date ,
            modified: Date
        },
        sponsors: {type: Array<String>()}
    });
    
    schema.index({name: "text", category: "text", description: "text", sponsors: "text"});
    schema.path("dates.created").default(function(){return Date.now();});
    schema.path("dates.modified").default(function(){return Date.now();});
    
    return schema;
});    

export const SYSTEM_UNAVAILABLE_MSG = "system unavailable. please try later.";
export const SYSTEM_INVALID_USER_CREDENTIALS_MSG = "invalid useremail and/or password";
export const SYSTEM_SESSION_EXPIRED = "login, current session expired.";

export function createMongooseSchema(schemaDefinition: any, strictMode: boolean = true) {
    return new mongoose.Schema(schemaDefinition, {strict: strictMode});
}

export function createMongooseModel(modelName: string, modelSchema: Schema<any> | Function) 
: Model<Document> {
    if(__connection.models[modelName] !== undefined)
        return __connection.models[modelName];

    var schema = (typeof modelSchema == 'function')?  modelSchema(): modelSchema;

    return __connection.model(modelName, schema);    
}

export function getModel(modelName: string) : Model<Document> {    
    if(__connection.models[modelName] !== undefined)
        return __connection.models[modelName];

    throw new Error(`${modelName} not a valid model name.`);    
}

export function createFindOneAndUpdateOptions(fields?: Object|String, upsert: boolean = false) {
    // MongoDB https://mongodb.github.io/node-mongodb-native/3.2/api/Collection.html#findOneAndUpdate
    // Mongoose https://mongoosejs.com/docs/api.html#model_Model.findOneAndUpdate
    
    var options = {
        new:  true,       // returns the modified model
        upsert: upsert,    // new models are not allowed
        maxTimeMS:  1000, // 10 seconds maximum wait
        rawResult: true,  // returns the raw result from the MongoDB driver
        strict: false     // ensures only model schema value saved
    };

    /*Field selection. Equivalent to .select(fields).findOneAndUpdate()*/
    if(fields) 
        options["fields"] = fields;

    return options;
}

export class Pagination {
    public pages: Number;
    public pageIndex: Number;
    public documents: Array<any>;

    constructor(data: Array<any>, pageCount: Number, pageCurrent: Number){
        this.pages = pageCount;
        this.pageIndex = pageCurrent;
        this.documents = data;
    }
} // end Pagination

export class JsonResponse {
    constructor(){}

    createError(error: any) : any {
        return {
            ok: true,
            data: error,
        }
    }

    createData(data: any) : any {
        return {
            ok: true,
            data: data,
        }
    }

    createPagination(data: any, pageCount: Number = 1, pageCurrent: Number = 1) : any {
        return {
            ok: true,
            data: new Pagination(data,pageCount, pageCurrent)
        }
    }
} // end JsonResponse
