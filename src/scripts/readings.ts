import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { CliModule } from '../cli.module.js';
import type { Config } from '../config.js';
import { prepareWorks } from '../corpus/import.js';
import { Guangyun } from '../corpus/transcription/guangyun.js';
import {
  crossCheck,
  draftJizhu,
  loadJizhu,
  VOLUMES as JIZHU,
} from '../corpus/transcription/jizhu.js';
import { loadReadings, readingsFile, type Readings } from '../corpus/transcription/pinyin.js';
import { draft, loadNotes, VOLUMES, type Skipped } from '../corpus/transcription/shiwen.js';
import { draftSiku, loadSiku, SIKU } from '../corpus/transcription/siku.js';
import { PILOT_WORKS } from '../corpus/works.js';

// Drafts data/pinyin/<work>.json from 《經典釋文》, cross-checked against 朱熹《論語集注》 for the
// Analects, from 《四書章句集注》 alone for the books 釋文 does not cover, or from the 四庫 edition's
// inline 釋文 for the Liezi. Reviewed entries are kept as they are.
// Works can be named on the command line to draft only those.
const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
try {
  const cacheDir = app.get<Config>(ConfigService).get('CORPUS_CACHE', { infer: true });
  const gy = await Guangyun.load(cacheDir);
  const only = process.argv.slice(2);
  const works = PILOT_WORKS.filter(
    (w) => (VOLUMES[w.id] || JIZHU[w.id] || SIKU[w.id]) && (!only.length || only.includes(w.id)),
  );
  const stats = [];
  for (const prepared of await prepareWorks(works, cacheDir)) {
    const { work } = prepared;
    // A range like "10.6-7" is drafted as its source units, which the transcription then joins.
    const originals = [
      ...new Map(
        prepared.originals
          .flatMap((o) =>
            /-\d+$/.test(o.refUnit)
              ? o.parts.map((p) => ({ refUnit: p.unit, body: p.body }))
              : [{ refUnit: o.refUnit, body: o.body }],
          )
          .map((u) => [u.refUnit, u]),
      ).values(),
    ];
    let notes: number;
    let commentary: number;
    let readings: Readings;
    let skipped: Skipped[] = [];
    if (VOLUMES[work.id]) {
      const { bookOf } = VOLUMES[work.id];
      const shiwen = await loadNotes(cacheDir, work.id);
      const drafted = draft(gy, shiwen, originals, bookOf);
      ({ readings, skipped } = drafted);
      [notes, commentary] = [shiwen.length, drafted.unmatched.length];
      if (JIZHU[work.id])
        crossCheck(gy, await loadJizhu(cacheDir, work.id), readings, originals, bookOf);
    } else if (SIKU[work.id]) {
      const siku = await loadSiku(cacheDir, work.id);
      const drafted = draftSiku(gy, siku, originals, SIKU[work.id].bookOf);
      readings = drafted.readings;
      [notes, commentary] = [siku.notes.length, drafted.unmatched.length];
    } else {
      const clauses = await loadJizhu(cacheDir, work.id);
      const drafted = draftJizhu(gy, clauses, originals, JIZHU[work.id].bookOf);
      readings = drafted.readings;
      [notes, commentary] = [clauses.length, drafted.unmatched.length];
    }

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
    for (const s of skipped) {
      console.log(
        `${work.id} ${s.refUnit} @${s.pos} ${s.char}: skipped ${s.note.head} ${s.note.note} (${s.pinyin}, pinyin-pro ${s.modern})`,
      );
    }
    stats.push({
      work: work.id,
      notes,
      commentary,
      readings: all.length,
      checked: all.filter((e) => e.check).length,
      reviewed: all.filter((e) => e.reviewed).length,
      todo: todo.length,
      skipped: skipped.length,
    });
  }
  console.table(stats);
} finally {
  await app.close();
}
