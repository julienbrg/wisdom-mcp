import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildIndexes } from '../dist/corpus/indexes.js';
import { openDatabase } from '../dist/database/database.module.js';

function seed() {
  const db = openDatabase(':memory:');
  db.exec(`
    insert into works (id, author, title, original_language, tradition)
      values ('ecclesiastes', 'Qoheleth', 'Ecclesiastes', 'hbo', 'abrahamic');
    insert into texts (id, work_id, translator, year, language)
      values ('ecclesiastes:kjv', 'ecclesiastes', 'King James Version', 1611, 'en');
    insert into passages (id, text_id, work_id, position, ref, ref_unit, raw, body, is_apparatus) values
      ('ecclesiastes:1', 'ecclesiastes:kjv', 'ecclesiastes', 0, null, null, 'Preface', 'Preface', 1),
      ('ecclesiastes:2', 'ecclesiastes:kjv', 'ecclesiastes', 1, '1:2', '1.2',
        'Vanity of vanities', 'Vanity of vanities', 0),
      ('ecclesiastes:3', 'ecclesiastes:kjv', 'ecclesiastes', 2, '7:1', '7.1',
        'A good name is better than precious ointment', 'A good name is better than precious ointment', 0);
  `);
  return db;
}

function fakes() {
  const calls = { keywords: 0, embed: 0 };
  return {
    calls,
    generators: {
      keywordsModel: 'fake-keywords',
      embeddingModel: 'fake-embed',
      keywords: async (ps: { id: string; body: string }[]) => {
        calls.keywords += ps.length;
        return new Map(
          ps.map((p) => [p.id, p.body.includes('name') ? 'reputation, honour' : 'futility']),
        );
      },
      embed: async (texts: string[]) => {
        calls.embed += texts.length;
        return texts.map(() => new Float32Array(1024).fill(1 / 32));
      },
    },
  };
}

test('buildIndexes fills keywords and both indexes for quotable passages only', async () => {
  const db = seed();
  const cache = mkdtempSync(join(tmpdir(), 'wisdom-index-'));
  const { calls, generators } = fakes();

  assert.deepEqual(await buildIndexes(db, cache, generators), {
    passages: 2,
    keywords: 2,
    embeddings: 2,
  });
  assert.deepEqual(calls, { keywords: 2, embed: 2 });

  assert.deepEqual(db.prepare('select id, keywords from passages order by position').all(), [
    { id: 'ecclesiastes:1', keywords: '' },
    { id: 'ecclesiastes:2', keywords: 'futility' },
    { id: 'ecclesiastes:3', keywords: 'reputation, honour' },
  ]);
  const fts = db
    .prepare(
      `select p.id from passages_fts f join passages p on p.rowid = f.rowid
       where passages_fts match 'reputation'`,
    )
    .all();
  assert.deepEqual(fts, [{ id: 'ecclesiastes:3' }]);
  assert.deepEqual(db.prepare('select passage_id from passages_vec order by passage_id').all(), [
    { passage_id: 'ecclesiastes:2' },
    { passage_id: 'ecclesiastes:3' },
  ]);
});

test('buildIndexes reuses cached keywords and embeddings', async () => {
  const cache = mkdtempSync(join(tmpdir(), 'wisdom-index-'));
  await buildIndexes(seed(), cache, fakes().generators);

  const { calls, generators } = fakes();
  const db = seed();
  assert.deepEqual(await buildIndexes(db, cache, generators), {
    passages: 2,
    keywords: 2,
    embeddings: 2,
  });
  assert.deepEqual(calls, { keywords: 0, embed: 0 });
});
