import { Inject, Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/server';
import { MCP_TOOLS, type McpTool } from './mcp-tool.js';

@Injectable()
export class McpFactory {
  constructor(@Inject(MCP_TOOLS) private readonly tools: McpTool[]) {}

  build(): McpServer {
    const server = new McpServer({ name: 'wisdom-mcp', version: '0.1.0' });
    for (const tool of this.tools) tool.register(server);
    return server;
  }
}
