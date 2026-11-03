import { Router } from "express";
import * as leaseController from "../controllers/lease.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();
router.use(requireAuth);

router.post("/", requireRole("LANDLORD"), leaseController.createLease);
router.get("/mine", requireRole("TENANT"), leaseController.listMineTenant);
router.get("/landlord", requireRole("LANDLORD"), leaseController.listMineLandlord);
router.patch("/:id/status", requireRole("LANDLORD"), leaseController.updateStatus);
router.patch("/:id/sign", requireRole("TENANT", "LANDLORD"), leaseController.sign);
router.get("/:id/pdf", leaseController.downloadPdf);
router.get("/:id", leaseController.getLease);

export default router;


