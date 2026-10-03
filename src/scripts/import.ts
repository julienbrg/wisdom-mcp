import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { CliModule } from '../cli.module.js';
import type { Config } from '../config.js';
import { importWorks } from '../corpus/import.js';
import { PILOT_WORKS } from '../corpus/works.js';
import { DB, type Db } from '../database/database.module.js';

const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
try {
  const cacheDir = app.get<Config>(ConfigService).get('CORPUS_CACHE', { infer: true });
  console.table(await importWorks(app.get<Db>(DB), PILOT_WORKS, cacheDir));
} finally {
  await app.close();
}
