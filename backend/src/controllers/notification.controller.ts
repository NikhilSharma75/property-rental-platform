import { Request, Response, NextFunction } from "express";
import * as notificationCenter from "../services/in-app-notification.service";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const notifications = await notificationCenter.list(req.user!.sub);
    const unreadCount = await notificationCenter.unreadCount(req.user!.sub);
    res.status(200).json({ notifications, unreadCount });
  } catch (err) { next(err); }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationCenter.markRead(req.user!.sub, req.params.id as string);
    res.status(200).json({ ok: true });
  } catch (err) { next(err); }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationCenter.markAllRead(req.user!.sub);
    res.status(200).json({ ok: true });
  } catch (err) { next(err); }
}
