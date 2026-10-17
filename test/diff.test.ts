import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { diffCorpus, importedPassages } from '../dist/corpus/diff.js';
import { PILOT_WORKS } from '../dist/corpus/works.js';
import { openDatabase } from '../dist/database/database.module.js';

const records = readFileSync(new URL('fixtures/wcw-diff.jsonl', import.meta.url), 'utf-8')
  .split('\n')
  .filter((line) => line)
  .map((line) => JSON.parse(line));

function importedDb(passages: Record<string, [string, string][]>) {
  const db = openDatabase(':memory:');
  for (const [work, ids] of Object.entries(passages)) {
    db.prepare(
      `insert into works (id, author, title, original_language, tradition) values (?, '', '', '', '')`,
    ).run(work);
    db.prepare(`insert into texts (id, work_id, language) values (?, ?, 'en')`).run(work, work);
    ids.forEach(([id, raw], position) =>
      db
        .prepare(
          `insert into passages (id, text_id, work_id, position, raw, body) values (?, ?, ?, ?, ?, '')`,
        )
        .run(id, work, work, position, raw),
    );
  }
  return db;
}

const ANALECTS: [string, string][] = [
  ['analects:0', 'BOOK I'],
  ['analects:1', 'The Master said, Is it not pleasant to learn?'],
  ['analects:2', 'The Master said, Fine words seldom are associated with virtue.'],
];

test('imported passages keep the block their id points to, split chapters included', () => {
  const db = importedDb({ analects: [ANALECTS[0], ['analects:1a', 'A'], ['analects:1b', 'B']] });
  assert.deepEqual(
    importedPassages(db),
    new Map([
      [
        'analects',
        [
          { block: 0, raw: 'BOOK I' },
          { block: 1, raw: 'A' },
          { block: 1, raw: 'B' },
        ],
      ],
    ]),
  );
});

test('diff lists new full texts on the site and imported works a re-import would change', () => {
  const db = importedDb({
    analects: ANALECTS,
    'tao-te-ching': [
      ['tao-te-ching:0', 'The Tao that can be trodden is not the enduring Tao.'],
      ['tao-te-ching:1', 'All in the world know the beauty'],
      ['tao-te-ching:2', 'Thirty spokes unite in the one nave.'],
    ],
    'great-learning': [
      ['great-learning:0', 'What the Great Learning teaches'],
      ['great-learning:1', 'The point where to rest being known'],
    ],
    dhammapada: [['dhammapada:0', 'All that we are is the result of what we have thought.']],
  });
  const before = db.prepare('select count(*) as n from passages').get();

  assert.deepEqual(diffCorpus(records, PILOT_WORKS, importedPassages(db)), {
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
      { work: 'tao-te-ching', imported: 3, upstream: 2, edited: 1 },
      { work: 'great-learning', imported: 2, upstream: 2, edited: 2 },
      { work: 'dhammapada', imported: 1, upstream: 0, edited: 1 },
    ],
  });
  assert.deepEqual(db.prepare('select count(*) as n from passages').get(), before);
});
