// @ts-ignore
import {CoreServer} from "rescueshelter.core";
import {AnimalService} from "./animalservice";
import {SponsorService} from "./sponsorservice";
import {SecurityService} from "./securityservice";
import { WebAuthnService } from "./webauthnservice";
import { OAuthCallbackService } from "./oauthcallbackservice";

// @ts-ignore
declare let __dirname; // variable initialize by NodeJS Path Module

let path = require("node:path");
let staticPath = path.join(__dirname, '/../public');

export const CORSHostNames = [
    "https://localhost:3000"
];

export const CORSOptions = {
    // @ts-ignore
    origin: (origin, callback) => {
        callback(null, {
            origin: CORSHostNames.includes(origin)
        });
    },
    methods: ['GET','POST', 'PUT'],
    allowHeaders: ['Content-Type'],
    exposedHeaders: [], // none
    credentials: false,
    maxAge: 3000, // seconds
    preFlightContinue: true,
    optionSuccessStatus: 210
}

// https://expressjs.com/en/guide/writing-middleware.html
// The order of middleware insertion is important.
CoreServer.start({
    server: {
        name: 'Rescue Shelter Services Server', 
        port: 3302,
        secure: true
    },
    webRootPath: staticPath,
    middleWare: [
        new OAuthCallbackService().publishWebAPI,
        new WebAuthnService().publishWebAPI, // passport
        new SecurityService().publishWebAPI, // Secure all routes
        new SponsorService().publishWebAPI,
        new AnimalService().publishWebAPI
        ], 
    corsHostNames: CORSHostNames,
    closeCallback: ()=>{}
});