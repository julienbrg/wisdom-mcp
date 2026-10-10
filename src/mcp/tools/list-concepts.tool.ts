import { Injectable } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ConceptsService, type ConceptSummary } from '../../corpus/concepts.service.js';
import type { McpTool } from '../mcp-tool.js';

const line = (c: ConceptSummary) =>
  `[${c.id}] ${c.name}${c.original ? ` ${c.original}` : ''}: ${c.gloss} ` +
  `(${c.tradition}, ${c.school})`;

@Injectable()
export class ListConceptsTool implements McpTool {
  constructor(private readonly concepts: ConceptsService) {}

  register(server: McpServer) {
    server.registerTool(
      'list_concepts',
      {
        title: 'List concepts',
        description:
          'Lists the concepts of the Wisdom Context Window concept graph (wu wei, ' +
          'non-attachment, the golden rule…): id, name, original term, one-line gloss, ' +
          'tradition and school. Optionally filter by a word matched against the id, name, ' +
          'gloss, tradition, school and domains (ethics, death, love, suffering…). Use it on ' +
          'a broad question, then get_concept on the closest concepts.',
        inputSchema: z.object({ filter: z.string().max(100).optional() }),
        annotations: { readOnlyHint: true },
      },
      async ({ filter }) => {
        const concepts = this.concepts.list(filter);
        const text = concepts.length
          ? [`${concepts.length} concepts:`, ...concepts.map(line)].join('\n')
          : `No concept matches "${filter}". Call list_concepts without a filter to see them all.`;
        return { content: [{ type: 'text', text }], structuredContent: { concepts } };
      },
    );
  }
}
