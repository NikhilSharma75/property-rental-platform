import { Router } from "express";
import * as applicationController from "../controllers/application.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { uploadApplicationDocuments } from "../middleware/upload.middleware";
import { verifyFileSignatures } from "../middleware/fileSignature.middleware";

const router = Router();
router.use(requireAuth);

// tenant routes
router.post("/", requireRole("TENANT"), applicationController.createApplication);
router.post("/:id/documents", requireRole("TENANT"), uploadApplicationDocuments, verifyFileSignatures, applicationController.uploadDocuments);
router.get("/mine", requireRole("TENANT"), applicationController.listMine);
router.patch("/:id/withdraw", requireRole("TENANT"), applicationController.withdraw);

// landlord routes
router.get("/landlord", requireRole("LANDLORD"), applicationController.listForLandlord);
router.patch("/:id/review", requireRole("LANDLORD"), applicationController.review);

// shared (authorization enforced inside the service)
router.get("/:id", applicationController.getApplication);

export default router;