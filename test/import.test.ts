import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { importWorks } from '../dist/corpus/import.js';
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
    db.prepare('select ref_unit, body, source_url, license from originals order by id').all(),
    [
      {
        ref_unit: '1:1',
        body: 'דִּבְרֵי קֹהֶלֶת',
        source_url: 'https://www.sefaria.org/Ecclesiastes.1.1?lang=he',
        license: 'CC-BY-SA (Sefaria, Miqra according to the Masorah)',
      },
      {
        ref_unit: '5:1',
        body: '4:17',
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
