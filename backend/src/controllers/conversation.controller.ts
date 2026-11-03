import { Request, Response, NextFunction } from "express";
import * as messagingService from "../services/messaging.service";

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const conversations = await messagingService.listConversations(req.user!.sub);
    res.status(200).json({ conversations });
  } catch (err) { next(err); }
}

export async function listMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const before = req.query.before as string | undefined;
    const messages = await messagingService.listMessages(req.params.id as string, req.user!.sub, before);
    res.status(200).json({ messages });
  } catch (err) { next(err); }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    const readAt = await messagingService.markRead(req.params.id as string, req.user!.sub);
    res.status(200).json({ readAt });
  } catch (err) { next(err); }
}