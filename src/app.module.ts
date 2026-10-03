import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { hostHeaderValidation } from '@modelcontextprotocol/express';
import { env } from './config.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { McpModule } from './mcp/mcp.module.js';

@Module({
  imports: [DatabaseModule, McpModule],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(hostHeaderValidation([new URL(env.PUBLIC_URL).hostname])).forRoutes('mcp');
  }
}
