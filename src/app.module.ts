import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hostHeaderValidation } from '@modelcontextprotocol/express';
import { AppConfigModule, type Env } from './config.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { McpModule } from './mcp/mcp.module.js';

@Module({
  imports: [AppConfigModule, DatabaseModule, McpModule],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  constructor(private readonly config: ConfigService<Env, true>) {}

  configure(consumer: MiddlewareConsumer) {
    const publicUrl = this.config.get('PUBLIC_URL', { infer: true });
    consumer.apply(hostHeaderValidation([new URL(publicUrl).hostname])).forRoutes('mcp');
  }
}
