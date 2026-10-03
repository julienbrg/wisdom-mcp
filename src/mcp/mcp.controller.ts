import { All, Controller, type OnModuleDestroy, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { Request, Response } from 'express';
import { McpFactory } from './mcp.factory.js';

@ApiTags('mcp')
@Controller('mcp')
export class McpController implements OnModuleDestroy {
  private readonly handler = createMcpHandler(() => this.factory.build());
  private readonly serve = toNodeHandler(this.handler);

  constructor(private readonly factory: McpFactory) {}

  @Post()
  @ApiOperation({
    summary: 'MCP endpoint (Streamable HTTP, JSON-RPC 2.0)',
    description:
      'Connect with an MCP client. Requests must set `Accept: application/json, text/event-stream`.',
  })
  @ApiBody({
    schema: {
      example: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'example', version: '1.0.0' },
        },
      },
    },
  })
  handle(@Req() req: Request, @Res() res: Response) {
    return this.serve(req, res, req.body);
  }

  @All()
  @ApiExcludeEndpoint()
  handleOther(@Req() req: Request, @Res() res: Response) {
    return this.serve(req, res);
  }

  async onModuleDestroy() {
    await this.handler.close();
  }
}
