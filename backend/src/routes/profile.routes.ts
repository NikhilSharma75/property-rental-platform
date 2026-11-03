import { Router } from "express";
import * as profileController from "../controllers/profile.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { uploadProfileImage, uploadVerificationDocuments } from "../middleware/upload.middleware";
import { verifyFileSignatures } from "../middleware/fileSignature.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", profileController.getProfile);
router.patch("/", profileController.updateProfile);

router.post("/image", uploadProfileImage, verifyFileSignatures, profileController.uploadProfileImage);
router.delete("/image", profileController.deleteProfileImage);

// Landlord-only verification workflow
router.get("/verification", requireRole("LANDLORD"), profileController.getVerification);
router.post(
  "/verification",
  requireRole("LANDLORD"),
  uploadVerificationDocuments,
  verifyFileSignatures,
  profileController.submitVerification
);

export default router;
