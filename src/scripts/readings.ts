import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { CliModule } from '../cli.module.js';
import type { Config } from '../config.js';
import { prepareWorks } from '../corpus/import.js';
import { Guangyun } from '../corpus/transcription/guangyun.js';
import { crossCheck, loadJizhu } from '../corpus/transcription/jizhu.js';
import { loadReadings, readingsFile, type Readings } from '../corpus/transcription/pinyin.js';
import { draft, loadNotes, VOLUMES } from '../corpus/transcription/shiwen.js';
import { PILOT_WORKS } from '../corpus/works.js';

// Drafts data/pinyin/<work>.json from 《經典釋文》, cross-checked against 朱熹《論語集注》 for the
// Analects. Reviewed entries are kept as they are.
const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
try {
  const cacheDir = app.get<Config>(ConfigService).get('CORPUS_CACHE', { infer: true });
  const gy = await Guangyun.load(cacheDir);
  const works = PILOT_WORKS.filter((w) => VOLUMES[w.id]);
  const stats = [];
  for (const { work, originals } of await prepareWorks(works, cacheDir)) {
    const { bookOf } = VOLUMES[work.id];
    const notes = await loadNotes(cacheDir, work.id);
    const { readings, unmatched } = draft(gy, notes, originals, bookOf);
    if (work.id === 'analects')
      crossCheck(gy, await loadJizhu(cacheDir), readings, originals, bookOf);

    const old = loadReadings(work.id);
    const merged: Readings = {};
    for (const [ref, list] of Object.entries(readings)) {
      merged[ref] = list.map((e) => {
        const kept = old[ref]?.find((o) => o.pos === e.pos && o.char === e.char && o.reviewed);
        return kept ?? e;
      });
    }
    writeFileSync(readingsFile(work.id), JSON.stringify(merged, null, 2) + '\n');

    const all = Object.values(merged).flat();
    const todo = Object.entries(merged).flatMap(([ref, l]) =>
      l.filter((e) => e.todo).map((e) => ({ ref, ...e })),
    );
    for (const t of todo) console.log(`${work.id} ${t.ref} @${t.pos} ${t.char}: ${t.todo}`);
    stats.push({
      work: work.id,
      notes: notes.length,
      commentary: unmatched.length,
      readings: all.length,
      checked: all.filter((e) => e.check).length,
      reviewed: all.filter((e) => e.reviewed).length,
      todo: todo.length,
    });
  }
  console.table(stats);
} finally {
  await app.close();
}
