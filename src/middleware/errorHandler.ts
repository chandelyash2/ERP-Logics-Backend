import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("Unhandled API Error:", err);

  if (err instanceof ZodError) {
    const errorDetails = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    res.status(400).json({ detail: errorDetails });
    return;
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    detail: message,
  });
}
