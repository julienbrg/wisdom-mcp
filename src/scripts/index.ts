import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { CliModule } from '../cli.module.js';
import type { Config } from '../config.js';
import { buildIndexes, mistralGenerators } from '../corpus/indexes.js';
import { MistralService } from '../corpus/mistral.service.js';
import { DB, type Db } from '../database/database.module.js';

const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
try {
  const cacheDir = app.get<Config>(ConfigService).get('CORPUS_CACHE', { infer: true });
  const generators = mistralGenerators(app.get(MistralService));
  console.table([await buildIndexes(app.get<Db>(DB), cacheDir, generators)]);
} finally {
  await app.close();
}
