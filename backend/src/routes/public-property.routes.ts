import { Router } from "express";
import * as publicPropertyController from "../controllers/public-property.controller";
import { optionalAuth } from "../middleware/optionalAuth.middleware";

const router = Router();

router.use(optionalAuth); // no login required, but reads req.user if a token is present

router.get("/", publicPropertyController.listPublicProperties);
router.get("/:id", publicPropertyController.getPublicProperty);
router.get("/:id/units", publicPropertyController.listAvailableUnits);


export default router;