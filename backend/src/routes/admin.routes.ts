import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import * as c from "../controllers/admin.controller";

const router = Router();
// requireAuth re-reads role + suspension from the DB, so a demoted/suspended admin loses access immediately.
router.use(requireAuth, requireRole("ADMIN"));

router.get("/stats", c.stats);

router.get("/users", c.listUsers);
router.patch("/users/:id/suspension", c.setSuspension);

router.get("/properties", c.listProperties);
router.patch("/properties/:id/status", c.setPropertyStatus);

router.get("/applications", c.listApplications);

router.get("/verifications", c.listVerifications);
router.get("/verifications/:id/documents/:kind", c.getVerificationDocument);
router.patch("/verifications/:id", c.reviewVerification);

router.get("/reports", c.listReports);
router.patch("/reports/:id", c.resolveReport);

router.get("/reviews", c.listReviews);
router.patch("/reviews/:id/visibility", c.setReviewHidden);

router.get("/audit", c.listAudit);

export default router;
