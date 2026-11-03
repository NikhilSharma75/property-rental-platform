import { Router } from "express";
import * as documentController from "../controllers/document.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { authorizeDocumentUpload } from "../middleware/documentUpload.middleware";
import { uploadSingleDocument } from "../middleware/upload.middleware";
import { verifyFileSignatures } from "../middleware/fileSignature.middleware";

const router = Router();
router.use(requireAuth);

// Order matters: authorize (role, category, quota) -> multer (buffers the file) -> magic-byte check -> handler.
router.post("/:category", authorizeDocumentUpload, uploadSingleDocument, verifyFileSignatures, documentController.uploadDocument);
router.get("/", documentController.listMyDocuments);
router.delete("/:id", documentController.deleteDocument);

export default router;