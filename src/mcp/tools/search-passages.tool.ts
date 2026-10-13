import { Injectable } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { SearchService } from '../../corpus/search.service.js';
import { UsageService } from '../../usage/usage.service.js';
import type { McpTool } from '../mcp-tool.js';

@Injectable()
export class SearchPassagesTool implements McpTool {
  constructor(
    private readonly search: SearchService,
    private readonly usage: UsageService,
  ) {}

  register(server: McpServer) {
    server.registerTool(
      'search_passages',
      {
        title: 'Search the wisdom corpus',
        description:
          'Keyword and semantic search over philosophical and spiritual texts. Search in ' +
          'English whatever language the person writes in. The texts are old translations: ' +
          'use older words ("slander", "backbiting") as well as modern ones, put phrases in ' +
          'double quotes, and run several searches for broad topics. Returns up to 20 hits ' +
          'with truncated snippets: always fetch the full text with read_passages before quoting.',
        inputSchema: z.object({ query: z.string().min(2).max(500) }),
        annotations: { readOnlyHint: true },
      },
      ({ query }) =>
        this.usage.track('search_passages', async (row) => {
          row.query = query;
          const { hits, degraded, tokens } = await this.search.search(query);
          Object.assign(row, {
            passageIds: hits.map((h) => h.id),
            hits: hits.length,
            keywordOnly: degraded,
            embeddingTokens: tokens,
          });
          const lines = hits.map(
            (h) => `[${h.id}] ${h.author}, ${h.title}${h.ref ? `, ${h.ref}` : ''}\n${h.snippet}`,
          );
          if (degraded) lines.unshift('(Semantic search unavailable: keyword results only.)');
          return {
            content: [{ type: 'text', text: lines.join('\n\n') || 'No results.' }],
            structuredContent: { hits, degraded },
          };
        }),
    );
  }
}
