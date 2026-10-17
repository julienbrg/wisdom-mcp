import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { diffCorpus, importedBlocks } from '../dist/corpus/diff.js';
import { PILOT_WORKS } from '../dist/corpus/works.js';
import { openDatabase } from '../dist/database/database.module.js';

const records = readFileSync(new URL('fixtures/wcw-diff.jsonl', import.meta.url), 'utf-8')
  .split('\n')
  .filter((line) => line)
  .map((line) => JSON.parse(line));

function importedDb(passages: Record<string, string[]>) {
  const db = openDatabase(':memory:');
  for (const [work, ids] of Object.entries(passages)) {
    db.prepare(
      `insert into works (id, author, title, original_language, tradition) values (?, '', '', '', '')`,
    ).run(work);
    db.prepare(`insert into texts (id, work_id, language) values (?, ?, 'en')`).run(work, work);
    ids.forEach((id, position) =>
      db
        .prepare(
          `insert into passages (id, text_id, work_id, position, raw, body) values (?, ?, ?, ?, '', '')`,
        )
        .run(id, work, work, position),
    );
  }
  return db;
}

test('imported blocks are counted from passage ids, split chapters included', () => {
  const db = importedDb({ analects: ['analects:0', 'analects:1a', 'analects:1b', 'analects:2'] });
  assert.deepEqual(importedBlocks(db), new Map([['analects', 3]]));
});

test('diff lists new works on the site and imported works whose blocks changed', () => {
  const db = importedDb({
    analects: ['analects:0', 'analects:1', 'analects:2'],
    'tao-te-ching': ['tao-te-ching:0', 'tao-te-ching:1', 'tao-te-ching:2'],
    dhammapada: ['dhammapada:0'],
  });
  const before = db.prepare('select count(*) as n from passages').get();

  assert.deepEqual(diffCorpus(records, PILOT_WORKS, importedBlocks(db)), {
    newWorks: [
      {
        slug: 'zhuangzi-ziporyn',
        title: 'Zhuangzi: The Essential Writings',
        author: 'Zhuangzi',
        translator: 'Brook Ziporyn',
        tradition: 'chinese',
      },
    ],
    changed: [
      { work: 'tao-te-ching', imported: 3, upstream: 2 },
      { work: 'dhammapada', imported: 1, upstream: 0 },
    ],
  });
  assert.deepEqual(db.prepare('select count(*) as n from passages').get(), before);
});
