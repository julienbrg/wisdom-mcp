import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Config } from './config.js';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.set('trust proxy', 1);
app.enableShutdownHooks();

const openApi = new DocumentBuilder()
  .setTitle('wisdom-mcp')
  .setDescription('MCP server for agentic hybrid search over wisdom texts')
  .setVersion(version)
  .build();
SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, openApi));

await app.listen(app.get<Config>(ConfigService).get('PORT', { infer: true }), '127.0.0.1');
