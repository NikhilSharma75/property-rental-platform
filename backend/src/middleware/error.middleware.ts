import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";

interface HttpError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: HttpError | ZodError | MulterError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed.",
      errors: err.issues.map((e) => ({ path: e.path.join("."), message: e.message })),
    });
  }

  if (err instanceof SyntaxError && "body" in err) {
    // express.json() failed on malformed JSON; the raw parser message is an implementation detail.
    return res.status(400).json({ message: "Request body must be valid JSON." });
  }

  if (err instanceof MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is too large."
        : err.message || "File upload failed.";
    return res.status(400).json({ message });
  }

  const statusCode = (err as HttpError).statusCode ?? 500;
  // 5xx messages often contain raw Postgres/Supabase text - log them, never send them.
  const message = statusCode >= 500 ? "Something went wrong." : err.message || "Something went wrong.";

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({ message });
}

