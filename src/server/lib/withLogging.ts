import { NextResponse } from "next/server";
import { logger } from "@/server/lib/logger";
import { ApiError } from "@/server/lib/apiError";

type Handler<P extends Record<string, string> = Record<string, string>> = (
  req: Request,
  ctx: { params: Promise<P> },
) => Promise<Response>;

/**
 * Wraps a route handler with structured request/response logging (Principle IV)
 * and uniform ApiError -> JSON translation.
 */
export function withLogging<P extends Record<string, string> = Record<string, string>>(
  handler: Handler<P>,
): Handler<P> {
  return async (req, ctx) => {
    const start = Date.now();
    const url = new URL(req.url);
    try {
      const res = await handler(req, ctx);
      logger.info(
        { method: req.method, path: url.pathname, status: res.status, ms: Date.now() - start },
        "request",
      );
      return res;
    } catch (err) {
      if (err instanceof ApiError) {
        logger.warn(
          { method: req.method, path: url.pathname, status: err.status, code: err.code },
          "request_error",
        );
        return NextResponse.json(err.toResponseBody(), { status: err.status });
      }
      logger.error(
        { method: req.method, path: url.pathname, err: (err as Error).message },
        "request_unhandled",
      );
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Internal server error." } },
        { status: 500 },
      );
    }
  };
}
