import { Router } from "express";
import * as propertyController from "../controllers/property.controller";
import * as unitController from "../controllers/unit.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { uploadPropertyImages } from "../middleware/upload.middleware";
import { verifyFileSignatures } from "../middleware/fileSignature.middleware";

const router = Router();

// Landlord-only for now — tenant browsing is a separate future feature.
router.use(requireAuth, requireRole("LANDLORD"));

router.get("/", propertyController.listProperties);
router.post("/", propertyController.createProperty);

router.get("/:id", propertyController.getProperty);
router.patch("/:id", propertyController.updateProperty);
router.delete("/:id", propertyController.deleteProperty);
router.post("/:id/restore", propertyController.restoreProperty);

router.post("/:id/images", uploadPropertyImages, verifyFileSignatures, propertyController.uploadPropertyImages);
router.delete("/:id/images", propertyController.removePropertyImage);

router.get("/:id/units", unitController.list);
router.post("/:id/units", unitController.create);
router.patch("/:id/units/:unitId", unitController.update);
router.delete("/:id/units/:unitId", unitController.remove);




export default router;