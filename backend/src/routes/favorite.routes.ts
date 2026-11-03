import { Router } from "express";
import * as favoriteController from "../controllers/favorite.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(requireAuth, requireRole("TENANT"));

router.get("/", favoriteController.listFavorites);
router.post("/:propertyId", favoriteController.addFavorite);
router.delete("/:propertyId", favoriteController.removeFavorite);

export default router;