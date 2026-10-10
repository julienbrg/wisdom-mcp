import { Injectable } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  ConceptsService,
  type Concept,
  type ConceptLink,
  type KeyPassage,
} from '../../corpus/concepts.service.js';
import type { McpTool } from '../mcp-tool.js';

const LINK_HEADINGS: [ConceptLink['type'], string][] = [
  ['parallel', 'Parallels'],
  ['tension', 'Tensions'],
  ['related', 'Related'],
  ['broader', 'Broader'],
  ['narrower', 'Narrower'],
];

const passage = (p: KeyPassage) =>
  p.id
    ? `- [${p.id}] ${p.author}, ${p.title}, ${p.ref}: "${p.snippet}"`
    : `- ${p.work} (not in the corpus, context only): "${p.snippet}"`;

function format(c: Concept) {
  const lines = [
    `${c.name}${c.original ? ` (${c.original})` : ''} [${c.id}]`,
    `${c.tradition}, ${c.school}; domains: ${c.domains.join(', ') || 'none'}`,
    '',
    c.gloss,
    '',
    c.summary,
  ];
  if (c.passages.length) {
    lines.push(
      '',
      'Key passages (snippets; quote only from read_passages, using the ids):',
      ...c.passages.map(passage),
    );
  }
  for (const [type, heading] of LINK_HEADINGS) {
    const links = c.links.filter((l) => l.type === type);
    if (!links.length) continue;
    lines.push(
      '',
      `${heading}:`,
      ...links.map((l) => `- [${l.id}] ${l.name}${l.note ? `: ${l.note}` : ''}`),
    );
  }
  return lines.join('\n');
}

@Injectable()
export class GetConceptTool implements McpTool {
  constructor(private readonly concepts: ConceptsService) {}

  register(server: McpServer) {
    server.registerTool(
      'get_concept',
      {
        title: 'Get a concept',
        description:
          'Returns one concept from list_concepts by id: its summary, key passages (with ' +
          'passage ids for read_passages when the work is in the corpus), and its parallels, ' +
          'tensions and related concepts in other traditions, each with a note.',
        inputSchema: z.object({ id: z.string().min(1).max(100) }),
        annotations: { readOnlyHint: true },
      },
      async ({ id }) => {
        const concept = this.concepts.get(id);
        if (!concept) {
          return {
            content: [
              { type: 'text', text: `Unknown concept: ${id}. Find its id with list_concepts.` },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: format(concept) }],
          structuredContent: { ...concept },
        };
      },
    );
  }
}
