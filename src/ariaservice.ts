import {Application, Router} from "express";
import * as bodyParser from "body-parser";
import * as services from "./services";

/**
 * Localization of static content
 * 
 * https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA
 * https://www.wuhcag.com/wcag-checklist/
 * https://webaim.org/standards/wcag/checklist
 * https://a11yproject.com/checklist/
 * https://www.w3.org/WAI/
 * 
 */

let router = Router({ caseSensitive: true, mergeParams: true, strict: true});

services.createMongooseModel("aria", 
    services.createMongooseSchema({
        lang: {type: String, required: true},
        route: {type: String, required: true},
        labels: {type: Object, required: true}
    })
);

export class AriaService {
    constructor(){}

    publishWebAPI(app: Application) : void {
        let jsonParser = bodyParser.json();
        let jsonResponse = new services.JsonResponse();


        async function stub(req,res) {
            res.status(200);

            const lang = req.params.lang;
            res.json(jsonResponse.createError("Not implemented yet"));
        }

        router.get("/:lang", jsonParser, stub);
        app.use("/api/aria");
    } // end publishWebAPI
} // end AriaService