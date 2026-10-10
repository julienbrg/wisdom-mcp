import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { importConcepts } from '../dist/corpus/concepts.js';
import { ConceptsService, keySnippet } from '../dist/corpus/concepts.service.js';
import { openDatabase } from '../dist/database/database.module.js';

const concept = (slug: string, name: string, extra: object = {}) => ({
  slug,
  name,
  original: null,
  gloss: `${name} gloss`,
  summary: `${name} summary`,
  tradition: 'chinese',
  school: 'daoist',
  domains: ['art-of-living'],
  key_passages: [],
  ...extra,
});

// A cache already holding the graph and every concept, so the import never touches the network.
function conceptsCache() {
  const dir = mkdtempSync(join(tmpdir(), 'wisdom-cache-'));
  const concepts = [
    concept('wu-wei', 'Wu wei', {
      original: '無為',
      domains: ['art-of-living', 'politics'],
      key_passages: [
        { slug: 'tao-te-ching', idx: 1, text: 'The Tao   does nothing,\nyet nothing is undone.' },
        { slug: 'chuang-tzu', idx: 815, text: Array(60).fill('word').join(' '), quote: 'gone' },
      ],
    }),
    concept('non-attachment', 'Non-attachment', { tradition: 'perennial', school: 'hub' }),
    concept('effort', 'Striving', {
      tradition: 'greco-roman',
      school: 'stoic',
      domains: ['ethics'],
    }),
  ];
  const graph = {
    concepts: concepts.map(({ slug }) => ({ slug })),
    edges: [
      { source: 'wu-wei', target: 'non-attachment', type: 'broader', note: '' },
      { source: 'effort', target: 'wu-wei', type: 'tension', note: 'Forcing against yielding.' },
    ],
  };
  writeFileSync(join(dir, 'wcw-graph.json'), JSON.stringify(graph));
  for (const c of concepts)
    writeFileSync(join(dir, `wcw-concept-${c.slug}.json`), JSON.stringify(c));
  return dir;
}

function corpusDb() {
  const db = openDatabase(':memory:');
  db.exec(`insert into works (id, author, title, original_language, tradition)
           values ('tao-te-ching', 'Laozi', 'Tao Te Ching', 'lzh', 'chinese');
           insert into texts (id, work_id, language) values ('tao-te-ching:legge', 'tao-te-ching', 'en');
           insert into passages (id, text_id, work_id, position, ref, ref_unit, raw, body)
           values ('tao-te-ching:1', 'tao-te-ching:legge', 'tao-te-ching', 1, '37.1', '37', 'r', 'b');`);
  return db;
}

test('import writes concepts, key passages and links, and can run again', async () => {
  const db = corpusDb();
  const cache = conceptsCache();
  for (let run = 0; run < 2; run++) {
    assert.deepEqual(await importConcepts(db, cache), { concepts: 3, passages: 2, links: 2 });
  }
  assert.deepEqual(db.prepare('select id, domains from concepts order by id').all(), [
    { id: 'effort', domains: 'ethics' },
    { id: 'non-attachment', domains: 'art-of-living' },
    { id: 'wu-wei', domains: 'art-of-living, politics' },
  ]);
});

test('list_concepts filters on id, name, gloss, tradition, school and domains', async () => {
  const db = corpusDb();
  await importConcepts(db, conceptsCache());
  const concepts = new ConceptsService(db);

  const ids = (filter?: string) => concepts.list(filter).map((c: { id: string }) => c.id);
  assert.deepEqual(ids(), ['effort', 'non-attachment', 'wu-wei']);
  assert.deepEqual(ids('  '), ids());
  assert.deepEqual(ids('STOIC'), ['effort']);
  assert.deepEqual(ids('politics'), ['wu-wei']);
  assert.deepEqual(ids('無為'), ['wu-wei']);
  assert.deepEqual(ids('100%'), []);
  assert.deepEqual(concepts.list('perennial'), [
    {
      id: 'non-attachment',
      name: 'Non-attachment',
      original: null,
      gloss: 'Non-attachment gloss',
      tradition: 'perennial',
      school: 'hub',
    },
  ]);
});

test('get_concept maps key passages in the corpus to passage ids and lists the others without', async () => {
  const db = corpusDb();
  await importConcepts(db, conceptsCache());
  const concepts = new ConceptsService(db);

  const wuWei = concepts.get('wu-wei');
  assert.equal(wuWei.summary, 'Wu wei summary');
  assert.deepEqual(wuWei.domains, ['art-of-living', 'politics']);
  assert.deepEqual(wuWei.passages[0], {
    work: 'tao-te-ching',
    id: 'tao-te-ching:1',
    author: 'Laozi',
    title: 'Tao Te Ching',
    ref: '37.1',
    snippet: 'The Tao does nothing, yet nothing is undone.',
  });
  assert.equal(wuWei.passages[1].id, null);
  assert.equal(wuWei.passages[1].work, 'chuang-tzu');
  assert.equal(wuWei.passages[1].snippet, Array(40).fill('word').join(' ') + ' …');
  assert.deepEqual(wuWei.links, [
    { type: 'broader', id: 'non-attachment', name: 'Non-attachment', note: '' },
    { type: 'tension', id: 'effort', name: 'Striving', note: 'Forcing against yielding.' },
  ]);

  assert.deepEqual(concepts.get('non-attachment').links, [
    { type: 'narrower', id: 'wu-wei', name: 'Wu wei', note: '' },
  ]);
  assert.equal(concepts.get('nope'), null);

  db.exec("update passages set is_apparatus = 1 where id = 'tao-te-ching:1'");
  assert.equal(concepts.get('wu-wei').passages[0].id, null);
});

const words = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `w${from + i}`).join(' ');

test('a key snippet starts a few words before the quote and keeps it whole', () => {
  const text = `${words(1, 50)} wander in the\n realms of inaction. ${words(51, 100)}`;
  assert.equal(
    keySnippet(text, 'wander in the realms   of inaction.'),
    `… ${words(43, 50)} wander in the realms of inaction. ${words(51, 26 + 50)} …`,
  );
  assert.equal(keySnippet(`${words(1, 3)} the quote`, 'the quote'), `${words(1, 3)} the quote`);
  assert.equal(keySnippet(`a${words(1, 3)}`, 'w2'), `a${words(1, 3)}`);
});

test('a key snippet falls back to the passage opening when the quote is not in the text', () => {
  assert.equal(keySnippet(words(1, 60), 'not there'), `${words(1, 40)} …`);
  assert.equal(keySnippet(words(1, 60), null), `${words(1, 40)} …`);
});
