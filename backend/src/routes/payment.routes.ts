import { Router } from "express";
import * as paymentController from "../controllers/payment.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();
router.use(requireAuth);

router.post("/", requireRole("LANDLORD"), paymentController.createInvoice);
router.get("/mine", requireRole("TENANT"), paymentController.listMine);
router.get("/landlord", requireRole("LANDLORD"), paymentController.listForLandlord);
router.get("/lease/:leaseId", paymentController.listForLease);

router.post("/:id/checkout-session", requireRole("TENANT"), paymentController.createCheckoutSession);
router.patch("/:id/cancel", requireRole("LANDLORD"), paymentController.cancelInvoice);
router.get("/:id/invoice", paymentController.downloadInvoice);
router.get("/:id/receipt", paymentController.downloadReceipt);
router.get("/:id", paymentController.getPayment);
router.post("/:id/sync", paymentController.syncPayment);

export default router;