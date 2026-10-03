import type { McpServer } from '@modelcontextprotocol/server';

export interface McpTool {
  register(server: McpServer): void;
}

export const MCP_TOOLS = Symbol('MCP_TOOLS');
