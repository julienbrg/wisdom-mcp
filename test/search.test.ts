import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STOP_WORDS, SearchService, rrf, toFtsQuery } from '../dist/corpus/search.service.js';
import { openDatabase } from '../dist/database/database.module.js';

const axis = (i: number) => {
  const v = new Float32Array(1024);
  v[i] = 1;
  return v;
};

// Passage i of each work is embedded on axis i, so a query on axis 0 finds the first passages.
function seed() {
  const db = openDatabase(':memory:');
  const passages: [string, string, string, number][] = [
    ['tao', 'tao:1', 'The sage recompenses injury with kindness.', 0],
    ['tao', 'tao:2', 'He who conquers anger is mighty.', 0],
    ['tao', 'tao:3', 'Anger and kindness do not dwell together.', 0],
    ['tao', 'tao:4', 'Anger is a fire; kindness is water.', 0],
    ['tao', 'tao:5', 'Translator: anger appears often in this book.', 1],
    ['dham', 'dham:1', 'Let a man overcome anger by love.', 0],
    ['dham', 'dham:2', 'Hatred does not cease by hatred.', 0],
  ];
  db.exec(`
    insert into works (id, author, title, original_language, tradition) values
      ('tao', 'Laozi', 'Tao Te Ching', 'lzh', 'chinese'),
      ('dham', 'The Buddha', 'Dhammapada', 'pli', 'indian');
    insert into texts (id, work_id, translator, year, language) values
      ('tao:legge', 'tao', 'James Legge', 1891, 'en'),
      ('dham:muller', 'dham', 'F. Max Müller', 1881, 'en');
  `);
  const insert = db.prepare(
    `insert into passages (id, text_id, work_id, position, ref, ref_unit, raw, body, keywords, is_apparatus)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertVec = db.prepare('insert into passages_vec (passage_id, embedding) values (?, ?)');
  passages.forEach(([work, id, body, apparatus], i) => {
    const text = work === 'tao' ? 'tao:legge' : 'dham:muller';
    const keywords = id === 'dham:2' ? 'resentment, revenge, forgiveness' : '';
    insert.run(
      id,
      text,
      work,
      i,
      id.split(':')[1],
      id.split(':')[1],
      body,
      body,
      keywords,
      apparatus,
    );
    if (!apparatus) insertVec.run(id, Buffer.from(axis(i).buffer));
  });
  db.exec(`insert into passages_fts (passages_fts) values ('rebuild')`);
  return db;
}

const embeddings = (i: number) => ({ embed: async () => axis(i) });
const failing = {
  embed: async () => {
    throw new Error('timeout');
  },
};

test('toFtsQuery quotes terms, keeps phrases and drops bare punctuation', () => {
  assert.equal(
    toFtsQuery('anger "citizen of the world" - AND*', 'AND'),
    '"anger" AND "citizen of the world" AND "AND*"',
  );
  assert.equal(toFtsQuery('war peace', 'OR'), '"war" OR "peace"');
  assert.equal(toFtsQuery('— ?', 'AND'), '');
});

test('toFtsQuery drops skipped bare terms but keeps phrases', () => {
  assert.equal(
    toFtsQuery('Should I listen to "the others"?', 'OR', STOP_WORDS),
    '"listen" OR "the others"',
  );
  assert.equal(toFtsQuery('to be', 'OR', STOP_WORDS), '');
});

test('rrf ranks ids found by both lists first', () => {
  assert.deepEqual(
    rrf([
      ['a', 'b', 'c'],
      ['c', 'd'],
    ]),
    ['c', 'a', 'b', 'd'],
  );
});

test('search merges both indexes, caps each work at 3 hits and skips apparatus', async () => {
  const search = new SearchService(seed(), embeddings(6) as never);
  const { hits, degraded } = await search.search('anger');

  assert.equal(degraded, false);
  const ids = hits.map((h) => h.id);
  assert.equal(ids.filter((id) => id.startsWith('tao:')).length, 3);
  assert.ok(!ids.includes('tao:5'));
  assert.ok(ids.includes('dham:2'), 'vector-only hit is merged in');
  assert.equal(hits.find((h) => h.id === 'dham:2')!.snippet, 'Hatred does not cease by hatred.');
  assert.deepEqual(
    { ...hits.find((h) => h.id === 'dham:1')! },
    {
      id: 'dham:1',
      author: 'The Buddha',
      title: 'Dhammapada',
      ref: '1',
      snippet: 'Let a man overcome anger by love.',
    },
  );
});

test('search falls back from AND to OR and matches generated keywords', async () => {
  const search = new SearchService(seed(), failing as never);
  const { hits } = await search.search('kindness sage');
  assert.equal(hits[0].id, 'tao:1');
  assert.ok(hits.some((h) => h.id === 'tao:3'));

  const byKeyword = await search.search('revenge');
  assert.deepEqual(
    byKeyword.hits.map((h) => h.id),
    ['dham:2'],
  );
});

test('search ignores stop words when falling back to OR', async () => {
  const search = new SearchService(seed(), failing as never);
  const { hits } = await search.search('Is love enough?');
  assert.deepEqual(
    hits.map((h) => h.id),
    ['dham:1'],
  );

  const onlyStopWords = await search.search('he is');
  assert.ok(onlyStopWords.hits.some((h) => h.id === 'tao:4'));
});

test('search returns keyword results flagged as degraded when embedding fails', async () => {
  const { hits, degraded } = await new SearchService(seed(), failing as never).search('hatred');
  assert.equal(degraded, true);
  assert.deepEqual(
    hits.map((h) => h.id),
    ['dham:2'],
  );
});
