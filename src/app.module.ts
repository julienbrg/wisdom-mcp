import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hostHeaderValidation, originValidation } from '@modelcontextprotocol/express';
import { AppConfigModule, type Env } from './config.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { McpModule } from './mcp/mcp.module.js';
import { rejectBatches } from './security.js';
import { UsageModule } from './usage/usage.module.js';

@Module({
  imports: [AppConfigModule, DatabaseModule, UsageModule, McpModule],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  constructor(private readonly config: ConfigService<Env, true>) {}

  configure(consumer: MiddlewareConsumer) {
    const { hostname } = new URL(this.config.get('PUBLIC_URL', { infer: true }));
    consumer
      .apply(hostHeaderValidation([hostname]), originValidation([hostname]), rejectBatches)
      .forRoutes('mcp');
  }
}
