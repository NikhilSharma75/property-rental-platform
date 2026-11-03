import { Request, Response, NextFunction } from "express";
import * as favoriteService from "../services/favorite.service";

export async function addFavorite(req: Request, res: Response, next: NextFunction) {
  try {
    await favoriteService.addFavorite(req.user!.sub, req.params.propertyId as string);
    res.status(200).json({ message: "Added to favorites." });
  } catch (err) { next(err); }
}

export async function removeFavorite(req: Request, res: Response, next: NextFunction) {
  try {
    await favoriteService.removeFavorite(req.user!.sub, req.params.propertyId as string);
    res.status(200).json({ message: "Removed from favorites." });
  } catch (err) { next(err); }
}

export async function listFavorites(req: Request, res: Response, next: NextFunction) {
  try {
    const properties = await favoriteService.listFavorites(req.user!.sub);
    res.status(200).json({ properties });
  } catch (err) { next(err); }
}

