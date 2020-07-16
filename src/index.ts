import services = require( "./server");
import {AriaService} from "./ariaservice";
import {AnimalService} from "./animalservice";
import {SponsorService} from "./sponsorservice";
import {SecurityService} from "./securityservice";

services.serverName = 'Rescure Shelter Services';
services.serverPort = 3304;

services.middleware = [
    new AnimalService().publishWebAPI,
    new SponsorService().publishWebAPI,
    new SponsorService().publishWebAPI,
    new SecurityService().publishWebAPI];

services.listener();