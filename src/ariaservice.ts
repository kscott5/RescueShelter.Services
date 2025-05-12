import express from "express";
import bodyParser from "body-parser";

// @ts-ignore
import {CoreServices} from "rescueshelter.core";

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

let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});

CoreServices.createMongooseModel("aria", 
    CoreServices.createMongooseSchema({
        lang: {type: String, required: true},
        route: {type: String, required: true},
        labels: {type: Object, required: true}
    })
);

export class AriaService {
    constructor(){}

    publishWebAPI(app: express.Application) : void {
        router.use(bodyParser.json({type: "application/json"}));

        router.get("/:lang", (req: express.Request,res: express.Response) => {
            let jsonResponse = new CoreServices.JsonResponse();

            res.status(200);

            res.json(jsonResponse.createError(`${req.body?.lang}: Not implemented yet`));
        });

        app.use('/api/aria', router);
    } // end publishWebAPI
} // end AriaService