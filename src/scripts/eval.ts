import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppConfigModule } from '../config.js';
import { CorpusModule } from '../corpus/corpus.module.js';
import { recallAt } from '../corpus/recall.js';
import { SearchService } from '../corpus/search.service.js';
import { DatabaseModule } from '../database/database.module.js';

interface Situation {
  id: string;
  situation: string;
  relevant: string[];
}

const K = 10;
const TARGET = 0.7;
const SET = fileURLToPath(new URL('../../test/eval/situations.json', import.meta.url));

@Module({ imports: [AppConfigModule, DatabaseModule, CorpusModule] })
class EvalModule {}

const situations: Situation[] = JSON.parse(readFileSync(SET, 'utf-8'));
const app = await NestFactory.createApplicationContext(EvalModule, { logger: ['error', 'warn'] });
try {
  const search = app.get(SearchService);
  const rows = [];
  let degraded = 0;
  for (const s of situations) {
    const result = await search.search(s.situation);
    if (result.degraded) degraded++;
    const top = result.hits.slice(0, K).map((h) => h.id);
    rows.push({
      id: s.id,
      recall: recallAt(K, top, s.relevant),
      missed: s.relevant.filter((id) => !top.includes(id)).join(' '),
    });
  }
  console.table(rows.map((r) => ({ ...r, recall: r.recall.toFixed(2) })));
  const mean = rows.reduce((sum, r) => sum + r.recall, 0) / rows.length;
  console.log(`Recall@${K}: ${mean.toFixed(3)} over ${rows.length} situations (target ${TARGET})`);
  const failing = rows.filter((r) => r.recall < TARGET).map((r) => r.id);
  if (failing.length) console.log(`Below ${TARGET}: ${failing.join(', ')}`);
  if (degraded) console.warn(`${degraded} searches fell back to keywords only.`);
} finally {
  await app.close();
}
