import { Router } from "express";
import * as maintenanceController from "../controllers/maintenance.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { uploadMaintenancePhotos } from "../middleware/upload.middleware";
import { verifyFileSignatures } from "../middleware/fileSignature.middleware";

const router = Router();
router.use(requireAuth);

router.post("/", requireRole("TENANT"), maintenanceController.create);
router.post("/:id/photos", requireRole("TENANT"), uploadMaintenancePhotos, verifyFileSignatures, maintenanceController.uploadPhotos);
router.get("/mine", requireRole("TENANT"), maintenanceController.listMine);
router.patch("/:id/cancel", requireRole("TENANT"), maintenanceController.cancel);

router.get("/landlord", requireRole("LANDLORD"), maintenanceController.listLandlord);
router.patch("/:id/status", requireRole("LANDLORD"), maintenanceController.updateStatus);
router.patch("/:id/assign", requireRole("LANDLORD"), maintenanceController.assign);

router.get("/:id", maintenanceController.getOne);

export default router;