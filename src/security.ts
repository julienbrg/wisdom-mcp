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
