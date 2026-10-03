import { Injectable } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { MAX_IDS, PassagesService } from '../../corpus/passages.service.js';
import type { McpTool } from '../mcp-tool.js';

@Injectable()
export class ReadPassagesTool implements McpTool {
  constructor(private readonly passages: PassagesService) {}

  register(server: McpServer) {
    server.registerTool(
      'read_passages',
      {
        title: 'Read passages',
        description:
          'Returns the full reference unit (chapter, verse or section) for each passage id ' +
          'from search_passages: the original text to quote, its reference, and a ' +
          'public-domain English translation as an aid. Hits in the same unit are returned ' +
          'once. Output stops at about 6,000 words, so read only the ids you need.',
        inputSchema: z.object({ ids: z.array(z.string()).min(1).max(MAX_IDS) }),
        annotations: { readOnlyHint: true },
      },
      async ({ ids }) => {
        const { text } = this.passages.read(ids);
        return { content: [{ type: 'text', text }] };
      },
    );
  }
}
