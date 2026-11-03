import { Router } from "express";
import * as conversationController from "../controllers/conversation.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth);

router.get("/", conversationController.listConversations);
router.get("/:id/messages", conversationController.listMessages);
router.post("/:id/read", conversationController.markRead);

export default router;