import { Router } from "express";
import * as savedSearchController from "../controllers/saved-search.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(requireAuth, requireRole("TENANT"));

router.get("/", savedSearchController.list);
router.post("/", savedSearchController.create);
router.patch("/:id", savedSearchController.update);
router.delete("/:id", savedSearchController.remove);

export default router;

