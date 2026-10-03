import { Module, type Type } from '@nestjs/common';
import { McpController } from './mcp.controller.js';
import { McpFactory } from './mcp.factory.js';
import { MCP_TOOLS, type McpTool } from './mcp-tool.js';

const TOOLS: Type<McpTool>[] = [];

@Module({
  controllers: [McpController],
  providers: [
    ...TOOLS,
    { provide: MCP_TOOLS, useFactory: (...tools: McpTool[]) => tools, inject: TOOLS },
    McpFactory,
  ],
})
export class McpModule {}
