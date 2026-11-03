import { Router } from "express";
import * as dashboardController from "../controllers/dashboard.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();
router.use(requireAuth);

router.get("/landlord", requireRole("LANDLORD"), dashboardController.landlordStats);
router.get("/tenant", requireRole("TENANT"), dashboardController.tenantStats);

export default router;