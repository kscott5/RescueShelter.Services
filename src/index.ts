import {CoreServer} from "rescueshelter.core";
import {AriaService} from "./ariaservice";
import {AnimalService} from "./animalservice";
import {SponsorService} from "./sponsorservice";
import {SecurityService} from "./securityservice";
import { WebAuthnService } from "./webauthnservice";

declare let __dirname; // variable initialize by NodeJS Path Module

let path = require("path");
let staticPath = path.join(__dirname, '/../public');

// https://expressjs.com/en/guide/writing-middleware.html
// The order of middleware insertion is important.
CoreServer.start('Rescue Shelter Services Server', 3302, [
    new WebAuthnService().publishWebAPI, // passport
    new SecurityService().publishWebAPI, // Secure all routes
    new SponsorService().publishWebAPI,
    new AnimalService().publishWebAPI], [/* cors */], staticPath);