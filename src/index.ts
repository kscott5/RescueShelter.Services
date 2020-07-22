import {CoreServer} from "rescueshelter.core";
import {AriaService} from "./ariaservice";
import {AnimalService} from "./animalservice";
import {SponsorService} from "./sponsorservice";
import {SecurityService} from "./securityservice";


CoreServer.start('Rescue Shelter Services Server', 3303, [
    new AnimalService().publishWebAPI,
    new SponsorService().publishWebAPI,
    new SecurityService().publishWebAPI], [], "./public");