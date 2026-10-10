import { Module, type Type } from '@nestjs/common';
import { CorpusModule } from '../corpus/corpus.module.js';
import { McpController } from './mcp.controller.js';
import { McpFactory } from './mcp.factory.js';
import { MCP_TOOLS, type McpTool } from './mcp-tool.js';
import { CheckQuoteTool } from './tools/check-quote.tool.js';
import { GetConceptTool } from './tools/get-concept.tool.js';
import { ListConceptsTool } from './tools/list-concepts.tool.js';
import { ReadPassagesTool } from './tools/read-passages.tool.js';
import { SearchPassagesTool } from './tools/search-passages.tool.js';

const TOOLS: Type<McpTool>[] = [
  SearchPassagesTool,
  ReadPassagesTool,
  CheckQuoteTool,
  ListConceptsTool,
  GetConceptTool,
];

@Module({
  imports: [CorpusModule],
  controllers: [McpController],
  providers: [
    ...TOOLS,
    { provide: MCP_TOOLS, useFactory: (...tools: McpTool[]) => tools, inject: TOOLS },
    McpFactory,
  ],
})
export class McpModule {}
