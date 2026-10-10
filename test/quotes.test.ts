import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../dist/database/database.module.js';
import { QuoteError, QuotesService, canonical } from '../dist/corpus/quotes.service.js';

function seed() {
  const db = openDatabase(':memory:');
  db.exec(`
    insert into works (id, author, title, original_title, original_language, tradition) values
      ('tao', 'Laozi', 'Tao Te Ching', '道德經', 'lzh', 'chinese'),
      ('med', 'Marcus Aurelius', 'Meditations', 'Τὰ εἰς ἑαυτόν', 'grc', 'stoic'),
      ('ecc', 'Qoheleth', 'Ecclesiastes', 'קֹהֶלֶת', 'hbo', 'abrahamic');
    insert into texts (id, work_id, translator, year, language) values
      ('tao:legge', 'tao', 'James Legge', 1891, 'en'),
      ('med:casaubon', 'med', 'Meric Casaubon', 1634, 'en'),
      ('ecc:kjv', 'ecc', 'King James Version', 1611, 'en');
    insert into passages (id, text_id, work_id, position, ref, ref_unit, raw, body) values
      ('tao:228', 'tao:legge', 'tao', 1, '63.1', '63', 'x', 'It is the way of the Tao to act without acting.'),
      ('tao:229', 'tao:legge', 'tao', 2, '63.2', '63', 'x', 'He recompenses injury with kindness.'),
      ('med:54', 'med:casaubon', 'med', 0, '1.1', '1', 'x', 'Of my grandfather Verus I have learned to be gentle and meek.'),
      ('ecc:1', 'ecc:kjv', 'ecc', 0, '7:1', '7.1', 'x', 'A good name is better than precious ointment; and the day of death than the day of one''s birth.');
    insert into originals (work_id, ref_unit, language, body, source_url, license) values
      ('tao', '63', 'lzh', '為無為，事無事，味無味。大小多少，報怨以德。', 'https://zh.wikisource.org/', 'CC BY-SA 4.0'),
      ('med', '1', 'grc', '(1.1) Παρὰ τοῦ πάππου Οὐήρου τὸ καλόηθες καὶ ἀόργητον. (2.1) Παρὰ τῆς δόξης καὶ μνήμης.', 'https://www.perseus.tufts.edu/', 'CC BY-SA 3.0');
    insert into originals_fts (originals_fts) values ('rebuild');
    insert into passages_fts (passages_fts) values ('rebuild');
  `);
  return new QuotesService(db);
}

test('canonical drops whitespace, punctuation and section markers but keeps diacritics', () => {
  assert.equal(canonical('為無為， 事無事。'), '為無為事無事');
  assert.equal(canonical('(1.1) Παρὰ τοῦ πάππου'), 'παρὰτοῦπάππου');
  assert.equal(canonical('A good  name, is "better"!'), 'agoodnameisbetter');
});

test('an exact Chinese quote returns its reference whatever the punctuation', () => {
  const { exact } = seed().check('大小多少 報怨以德');
  assert.deepEqual(exact, [
    {
      id: 'tao:228',
      author: 'Laozi',
      title: 'Tao Te Ching',
      ref: '63',
      text: 'original',
      score: 1,
    },
  ]);
});

test('an exact Greek quote returns its reference across section markers', () => {
  const { exact } = seed().check('καὶ ἀόργητον· Παρὰ τῆς δόξης');
  assert.equal(exact.length, 1);
  assert.deepEqual(exact[0], {
    id: 'med:54',
    author: 'Marcus Aurelius',
    title: 'Meditations',
    ref: '1',
    text: 'original',
    score: 1,
  });
});

test('an exact English quote returns the translation passage', () => {
  const { exact, candidates } = seed().check('a good name is better than precious ointment');
  assert.deepEqual(candidates, []);
  assert.deepEqual(
    exact.map((m) => [m.id, m.ref, m.text]),
    [['ecc:1', '7:1', 'translation']],
  );
});

test('an altered quote returns no exact match and the closest candidates', () => {
  const { exact, candidates } = seed().check('A good name is worth more than precious ointment');
  assert.deepEqual(exact, []);
  assert.equal(candidates[0].id, 'ecc:1');
  assert.ok(candidates[0].score > 0.5 && candidates[0].score < 1);

  const chinese = seed().check('報怨以仁');
  assert.deepEqual(chinese.exact, []);
  assert.equal(chinese.candidates[0].id, 'tao:228');
});

test('work narrows the search and rejects unknown or ambiguous works', () => {
  const service = seed();
  assert.deepEqual(service.check('to act without acting', 'Ecclesiastes').exact, []);
  assert.equal(service.check('to act without acting', 'tao te ching').exact[0].id, 'tao:228');
  assert.throws(() => service.check('to act without acting', 'Plato'), /No work matches "Plato"/);
  assert.throws(() => service.check('to act without acting', 'e'), /matches several works/);
  assert.throws(() => service.check('德。'), QuoteError);
});
