import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Config } from './config.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.set('trust proxy', 1);
app.enableShutdownHooks();

const openApi = new DocumentBuilder()
  .setTitle('wisdom-mcp')
  .setDescription('MCP server for agentic hybrid search over wisdom texts')
  .setVersion('0.1.0')
  .build();
SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, openApi));

await app.listen(app.get<Config>(ConfigService).get('PORT', { infer: true }), '127.0.0.1');
