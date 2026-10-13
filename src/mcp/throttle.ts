import { type ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ThrottlerLimitDetail, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Config } from '../config.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function toolCalled(context: ExecutionContext): string | undefined {
  const body = context.switchToHttp().getRequest<Request>().body as
    { method?: unknown; params?: { name?: unknown } } | undefined;
  if (body?.method !== 'tools/call') return undefined;
  return typeof body.params?.name === 'string' ? body.params.name : '';
}

/** Per client IP: a per-minute limit on tool calls and a daily cap on `search_passages`, which calls Mistral. */
export const McpThrottlerModule = ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: Config) => [
    {
      name: 'minute',
      ttl: MINUTE,
      limit: config.get('RATE_LIMIT_PER_MINUTE', { infer: true }),
      skipIf: (context) => toolCalled(context) === undefined,
    },
    {
      name: 'search',
      ttl: DAY,
      limit: config.get('SEARCH_LIMIT_PER_DAY', { infer: true }),
      skipIf: (context) => toolCalled(context) !== 'search_passages',
    },
  ],
});

/** Answers over the limit with 429 and a JSON-RPC error, so MCP clients can surface it. */
@Injectable()
export class McpThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(
    context: ExecutionContext,
    { timeToBlockExpire }: ThrottlerLimitDetail,
  ): Promise<void> {
    context.switchToHttp().getResponse<Response>().setHeader('Retry-After', timeToBlockExpire);
    const body = context.switchToHttp().getRequest<Request>().body as { id?: unknown } | undefined;
    throw new HttpException(
      {
        jsonrpc: '2.0',
        id: body?.id ?? null,
        error: { code: -32000, message: 'Rate limit exceeded. Try again later.' },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
