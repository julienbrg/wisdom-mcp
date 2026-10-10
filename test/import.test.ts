import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { importWorks } from '../dist/corpus/import.js';
import { PassagesService } from '../dist/corpus/passages.service.js';
import { PILOT_WORKS } from '../dist/corpus/works.js';
import { openDatabase } from '../dist/database/database.module.js';

// A cache already holding every download, so the import never touches the network.
function fixtureCache() {
  const dir = mkdtempSync(join(tmpdir(), 'wisdom-cache-'));
  const text = [
    'This eBook was produced by David Widger',
    'Book 21        Ecclesiastes',
    '21:001:001 The words of the Preacher, the son of David, king in\n           Jerusalem.',
    '21:005:001 Keep thy foot when thou goest to the house of God.',
  ].join('\n\n');
  const record = { slug: 'ecclesiastes', title: 'Ecclesiastes', kind: 'full-text', text };
  writeFileSync(join(dir, 'wisdom-corpus.jsonl.gz'), gzipSync(JSON.stringify(record) + '\n'));

  const chapters = [
    ['דִּבְרֵי קֹהֶלֶת'],
    [],
    [],
    Array.from({ length: 17 }, (_, i) => `4:${i + 1}`),
  ];
  const sefaria = {
    versions: [
      { versionTitle: 'Miqra according to the Masorah', license: 'CC-BY-SA', text: chapters },
    ],
  };
  writeFileSync(join(dir, 'sefaria-ecclesiastes.json'), JSON.stringify(sefaria));
  return dir;
}

test('import writes works, texts, passages and originals, and can run again', async () => {
  const db = openDatabase(':memory:');
  const cache = fixtureCache();
  const works = PILOT_WORKS.filter((w) => w.id === 'ecclesiastes');

  for (let run = 0; run < 2; run++) {
    assert.deepEqual(await importWorks(db, works, cache), [
      { work: 'ecclesiastes', passages: 4, quotable: 2, originals: 2 },
    ]);
  }

  assert.deepEqual(db.prepare('select id, original_language from works').all(), [
    { id: 'ecclesiastes', original_language: 'hbo' },
  ]);
  assert.deepEqual(db.prepare('select id, translator, year from texts').all(), [
    { id: 'ecclesiastes:king-james-version', translator: 'King James Version', year: 1611 },
  ]);

  const passages = db
    .prepare(
      'select id, position, ref, ref_unit, raw, body, is_apparatus from passages order by position',
    )
    .all();
  assert.deepEqual(
    passages.map((p: { id: string; ref: string; is_apparatus: number }) => [
      p.id,
      p.ref,
      p.is_apparatus,
    ]),
    [
      ['ecclesiastes:0', null, 1],
      ['ecclesiastes:1', null, 1],
      ['ecclesiastes:2', '1:1', 0],
      ['ecclesiastes:3', '5:1', 0],
    ],
  );
  assert.equal(passages[2].body, 'The words of the Preacher, the son of David, king in Jerusalem.');
  assert.match(passages[2].raw, /^21:001:001 .*\n {11}Jerusalem\.$/);

  assert.deepEqual(
    db
      .prepare(
        'select ref_unit, body, transcription, source_url, license from originals order by id',
      )
      .all(),
    [
      {
        ref_unit: '1:1',
        body: 'דִּבְרֵי קֹהֶלֶת',
        transcription: 'divre qohelet',
        source_url: 'https://www.sefaria.org/Ecclesiastes.1.1?lang=he',
        license: 'CC-BY-SA (Sefaria, Miqra according to the Masorah)',
      },
      {
        ref_unit: '5:1',
        body: '4:17',
        transcription: '4:17',
        source_url: 'https://www.sefaria.org/Ecclesiastes.4.17?lang=he',
        license: 'CC-BY-SA (Sefaria, Miqra according to the Masorah)',
      },
    ],
  );

  const hits = db
    .prepare("select rowid from passages_fts where passages_fts match 'preacher'")
    .all();
  assert.equal(hits.length, 1);
});

function meditationsCache() {
  const dir = mkdtempSync(join(tmpdir(), 'wisdom-cache-'));
  const text = [
    'Produced by J. Boyd',
    'THE FIRST BOOK',
    'I. Of my grandfather Verus I have learned to be gentle and meek.',
    'THE TWELFTH BOOK',
    'I. Whatsoever thou doest hereafter aspire unto.',
    'II. God beholds our minds and understandings.',
    'III. I have often wondered how it should come to pass.',
    'APPENDIX',
  ].join('\n\n');
  const record = { slug: 'meditations', title: 'Meditations', kind: 'full-text', text };
  writeFileSync(join(dir, 'wisdom-corpus.jsonl.gz'), gzipSync(JSON.stringify(record) + '\n'));

  const chapter = (book: number, n: number, sections = 1) =>
    `<div type="textpart" subtype="chapter" n="${n}">` +
    Array.from(
      { length: sections },
      (_, i) =>
        `<div type="textpart" subtype="section" n="${i + 1}"><p>${book}.${n}.${i + 1}</p></div>`,
    ).join('') +
    '</div>';
  const book = (n: number, chapters: string[]) =>
    `<div type="textpart" subtype="book" n="${n}">${chapters.join('')}</div>`;
  const tei = `<TEI><teiHeader><licence>CC-BY-SA 4.0</licence></teiHeader><text><body>
<div type="edition">
${book(
  1,
  [1, 2, 3, 4].map((n) => chapter(1, n)),
)}
${book(12, [chapter(12, 1, 2), chapter(12, 2), chapter(12, 3), chapter(12, 4)])}
</div></body></text></TEI>`;
  writeFileSync(join(dir, 'tlg0562.tlg001.perseus-grc2.xml'), tei);
  return dir;
}

test('import stores the Meditations original by Casaubon section', async () => {
  const db = openDatabase(':memory:');
  const works = PILOT_WORKS.filter((w) => w.id === 'meditations');
  await importWorks(db, works, meditationsCache());

  assert.deepEqual(
    db.prepare('select ref, ref_unit from passages where is_apparatus = 0 order by position').all(),
    [
      { ref: '1.1', ref_unit: '1.1' },
      { ref: '12.1', ref_unit: '12.1' },
      { ref: '12.2', ref_unit: '12.2' },
      { ref: '12.3', ref_unit: '12.3' },
    ],
  );
  const url = 'https://scaife.perseus.org/reader/urn:cts:greekLit:tlg0562.tlg001.perseus-grc2';
  assert.deepEqual(
    db.prepare('select ref_unit, body, source_url from originals order by id').all(),
    [
      { ref_unit: '1.1', body: '1.1.1\n1.2.1\n1.3.1\n1.4.1', source_url: `${url}:1.1/` },
      { ref_unit: '12.1', body: '(1) 12.1.1\n(2) 12.1.2', source_url: `${url}:12.1/` },
      { ref_unit: '12.2', body: '12.2.1\n12.3.1', source_url: `${url}:12.2/` },
      { ref_unit: '12.3', body: '12.4.1', source_url: `${url}:12.4/` },
    ],
  );
});

function gitaCache() {
  const dir = mkdtempSync(join(tmpdir(), 'wisdom-cache-'));
  const text = [
    'PREFACE',
    'CHAPTER I',
    'Dhritirashtra:\n  Ranged thus for battle',
    'CHAPTER XVIII',
    ...Array.from({ length: 26 }, (_, i) => `Krishna, passage ${i + 1}`),
    'HERE ENDETH CHAPTER XVIII.',
    '[FN#1] A note',
  ].join('\n\n');
  const record = { slug: 'bhagavad-gita', title: 'Bhagavad Gita', kind: 'full-text', text };
  writeFileSync(join(dir, 'wisdom-corpus.jsonl.gz'), gzipSync(JSON.stringify(record) + '\n'));

  const verse = (c: number, v: number) => ({
    chapter_number: c,
    verse_number: v,
    text: `श्लोक ${c}.${v}\n\nपाद।।${c}.${v}।।\n `,
  });
  const verses = [verse(1, 1), ...Array.from({ length: 78 }, (_, i) => verse(18, i + 1))];
  writeFileSync(join(dir, 'gita-verse.json'), JSON.stringify(verses));
  return dir;
}

test('import stores the Gita by verse and reads back only the verses a passage renders', async () => {
  const db = openDatabase(':memory:');
  const works = PILOT_WORKS.filter((w) => w.id === 'bhagavad-gita');
  await importWorks(db, works, gitaCache());

  const quotable = db
    .prepare('select id, ref_unit from passages where is_apparatus = 0 order by position')
    .all() as { id: string; ref_unit: string }[];
  assert.equal(quotable.length, 27);
  assert.deepEqual(quotable[0], { id: 'bhagavad-gita:2', ref_unit: '1.1' });
  assert.deepEqual(quotable.at(-1), { id: 'bhagavad-gita:29', ref_unit: '18.64-65' });

  const { text } = new PassagesService(db).read(['bhagavad-gita:29']);
  assert.match(text, /, 18\.64-65\nCovers hits: bhagavad-gita:29 \(18\.64-65\)\./);
  assert.match(text, /श्लोक 18\.64\nपाद।।18\.64।।\nश्लोक 18\.65\nपाद।।18\.65।।\n/);
  assert.doesNotMatch(text, /18\.63|18\.66/);
  assert.match(text, /Krishna, passage 26/);
  assert.doesNotMatch(text, /passage 25/);
});
