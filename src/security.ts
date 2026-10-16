import type { NextFunction, Request, Response } from 'express';

/**
 * MCP 2025-06-18 dropped JSON-RPC batches. Rejecting them also keeps the rate limiter honest,
 * since it counts one tool call per request.
 */
export function rejectBatches(req: Request, res: Response, next: NextFunction) {
  if (!Array.isArray(req.body)) return next();
  res.status(400).json({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32600, message: 'Batch requests are not supported.' },
  });
}

/** Hardening headers for every response. Swagger UI needs inline scripts, so `/docs` skips the CSP. */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!req.originalUrl.startsWith('/docs')) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  }
  next();
}
