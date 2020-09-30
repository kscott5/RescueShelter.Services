import {CoreServer} from "rescueshelter.core";
import {AriaService} from "./ariaservice";
import {AnimalService} from "./animalservice";
import {SponsorService} from "./sponsorservice";
import {SecurityService} from "./securityservice";

// https://expressjs.com/en/guide/writing-middleware.html
// The order of middleware insertion is important.
CoreServer.start('Rescue Shelter Services Server', 3302, [
    new SecurityService().publishWebAPI, // Secure all routes
    new SponsorService().publishWebAPI,
    new AnimalService().publishWebAPI], [], "./public");