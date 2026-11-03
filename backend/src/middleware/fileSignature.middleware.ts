import { Request, Response, NextFunction } from "express";

/**
 * multer only sees the Content-Type the CLIENT claims. This checks the real file header ("magic bytes")
 * so an .exe/.html renamed to image/png is rejected. Place it right AFTER the multer middleware.
 */
function sniff(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

function collect(req: Request): Express.Multer.File[] {
  const out: Express.Multer.File[] = [];
  if (req.file) out.push(req.file);
  const files = req.files as Express.Multer.File[] | Record<string, Express.Multer.File[]> | undefined;
  if (Array.isArray(files)) out.push(...files);
  else if (files) for (const list of Object.values(files)) out.push(...list);
  return out;
}

export function verifyFileSignatures(req: Request, res: Response, next: NextFunction) {
  for (const f of collect(req)) {
    const real = sniff(f.buffer);
    if (!real || real !== f.mimetype) {
      return res.status(400).json({ message: `"${f.originalname}" is not a valid ${f.mimetype} file.` });
    }
  }
  next();
}
