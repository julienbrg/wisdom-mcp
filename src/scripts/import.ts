import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { CliModule } from '../cli.module.js';
import type { Config } from '../config.js';
import { importConcepts } from '../corpus/concepts.js';
import { importWorks } from '../corpus/import.js';
import { PILOT_WORKS } from '../corpus/works.js';
import { DB, type Db } from '../database/database.module.js';

const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
try {
  const cacheDir = app.get<Config>(ConfigService).get('CORPUS_CACHE', { infer: true });
  const db = app.get<Db>(DB);
  console.table(await importWorks(db, PILOT_WORKS, cacheDir));
  console.table([await importConcepts(db, cacheDir)]);
} finally {
  await app.close();
}
