import { All, Controller, type OnModuleDestroy, Req, Res } from '@nestjs/common';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { Request, Response } from 'express';
import { McpFactory } from './mcp.factory.js';

@Controller('mcp')
export class McpController implements OnModuleDestroy {
  private readonly handler = createMcpHandler(() => this.factory.build());
  private readonly serve = toNodeHandler(this.handler);

  constructor(private readonly factory: McpFactory) {}

  @All()
  handle(@Req() req: Request, @Res() res: Response) {
    return this.serve(req, res, req.body);
  }

  async onModuleDestroy() {
    await this.handler.close();
  }
}
