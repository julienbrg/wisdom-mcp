import { Injectable } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { QuoteError, QuotesService, type QuoteMatch } from '../../corpus/quotes.service.js';
import type { McpTool } from '../mcp-tool.js';

const line = (m: QuoteMatch) =>
  `[${m.id}] ${m.author}, ${m.title}, ${m.ref} (${m.text}` +
  (m.score < 1 ? `, ${Math.round(m.score * 100)}% similar` : '') +
  ')';

@Injectable()
export class CheckQuoteTool implements McpTool {
  constructor(private readonly quotes: QuotesService) {}

  register(server: McpServer) {
    server.registerTool(
      'check_quote',
      {
        title: 'Check a quote',
        description:
          'Checks a quote against the stored originals and public-domain translations, ' +
          'ignoring whitespace and punctuation. Returns the exact match with its passage id, ' +
          'work and reference, or the closest candidates when there is none. Optionally ' +
          'narrow it to one work by id, title or author.',
        inputSchema: z.object({
          quote: z.string().min(3).max(2000),
          work: z.string().min(1).max(200).optional(),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ quote, work }) => {
        try {
          const result = this.quotes.check(quote, work);
          const lines = result.exact.length
            ? ['Exact match:', ...result.exact.map(line)]
            : result.candidates.length
              ? [
                  'No exact match. Closest candidates (read them with read_passages):',
                  ...result.candidates.map(line),
                ]
              : ['No exact match and no close candidate.'];
          return {
            content: [{ type: 'text', text: lines.join('\n') }],
            structuredContent: { ...result },
          };
        } catch (e) {
          if (!(e instanceof QuoteError)) throw e;
          return { content: [{ type: 'text', text: e.message }], isError: true };
        }
      },
    );
  }
}
