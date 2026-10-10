import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassagesService, countWords, cutWords } from '../dist/corpus/passages.service.js';
import { openDatabase } from '../dist/database/database.module.js';

function seed() {
  const db = openDatabase(':memory:');
  db.exec(`
    insert into works (id, author, title, original_title, original_language, tradition) values
      ('tao', 'Laozi', 'Tao Te Ching', '道德經', 'lzh', 'chinese'),
      ('ecc', 'Qoheleth', 'Ecclesiastes', 'קֹהֶלֶת', 'hbo', 'abrahamic');
    insert into texts (id, work_id, translator, year, language) values
      ('tao:legge', 'tao', 'James Legge', 1891, 'en'),
      ('ecc:kjv', 'ecc', 'King James Version', 1611, 'en');
    insert into passages (id, text_id, work_id, position, ref, ref_unit, raw, body, is_apparatus) values
      ('tao:0', 'tao:legge', 'tao', 0, null, null, 'Preface', 'Preface', 1),
      ('tao:228', 'tao:legge', 'tao', 1, '63.1', '63', 'x', 'It is the way of the Tao to act without acting.', 0),
      ('tao:229', 'tao:legge', 'tao', 2, '63.2', '63', 'x', 'He recompenses injury with kindness.', 0),
      ('ecc:1', 'ecc:kjv', 'ecc', 0, '7:1', '7.1', 'x', 'A good name is better than precious ointment.', 0);
    insert into originals (work_id, ref_unit, language, body, transcription, source_url, license) values
      ('tao', '63', 'lzh', '為無為，事無事，味無味。大小多少，報怨以德。',
       'wéi wú wéi, shì wú shì, wèi wú wèi. dà xiǎo duō shǎo, bào yuàn yǐ dé.',
       'https://zh.wikisource.org/', 'CC BY-SA 4.0');
  `);
  return db;
}

test('read returns each reference unit once with original and aid translation', () => {
  const { text, truncated, missing } = new PassagesService(seed()).read(['tao:229', 'tao:228']);
  assert.equal(truncated, false);
  assert.deepEqual(missing, []);
  assert.equal(
    text,
    [
      'Laozi, Tao Te Ching (道德經), 63',
      'Covers hits: tao:229 (63.2), tao:228 (63.1).',
      'Original language: Classical Chinese. Source: https://zh.wikisource.org/ (CC BY-SA 4.0).',
      '',
      'ORIGINAL (quote this)',
      '為無為，事無事，味無味。大小多少，報怨以德。',
      '',
      'TRANSCRIPTION (pronunciation aid, Hanyu Pinyin, classical readings; not the source, do not quote it as the original)',
      'wéi wú wéi, shì wú shì, wèi wú wèi. dà xiǎo duō shǎo, bào yuàn yǐ dé.',
      '',
      'AID TRANSLATION (James Legge, 1891, public domain)',
      'It is the way of the Tao to act without acting.\n\nHe recompenses injury with kindness.',
      '',
      'No authorised modern translation is stored for these passages: translate the original yourself and label the translation as your own.',
    ].join('\n'),
  );
});

test('read falls back to the translation and reports unknown or apparatus ids', () => {
  const { text, missing } = new PassagesService(seed()).read(['ecc:1', 'tao:0', 'nope']);
  assert.deepEqual(missing, ['tao:0', 'nope']);
  assert.match(text, /No original is available for this passage/);
  assert.match(
    text,
    /TRANSLATION \(quote this; King James Version, 1611, public domain\)\nA good name/,
  );
  assert.match(text, /Not found or not quotable: tao:0, nope\./);
});

test('countWords counts each Chinese character as a word', () => {
  assert.equal(countWords('為無為，事無事'), 6);
  assert.equal(countWords('to act without acting.'), 4);
});

test('cutWords cuts at a sentence boundary when asked', () => {
  assert.deepEqual(cutWords('One two. Three four five.', 4, true), { text: 'One two.', cut: true });
  assert.deepEqual(cutWords('One two. Three four five.', 4), {
    text: 'One two. Three four',
    cut: true,
  });
  assert.deepEqual(cutWords('為無為。事無事。', 4, true), { text: '為無為。', cut: true });
  assert.deepEqual(cutWords('short', 4, true), { text: 'short', cut: false });
});

test('read cuts the aid translation first, then the original, within about 6,000 words', () => {
  const db = seed();
  const sentence = 'Vanity of vanities, saith the Preacher. ';
  db.prepare(
    `insert into originals (work_id, ref_unit, language, body, source_url, license)
     values ('ecc', '7.1', 'hbo', ?, 'https://www.sefaria.org/', 'CC-BY-SA')`,
  ).run(sentence.repeat(1500));
  const { text, truncated } = new PassagesService(db).read(['ecc:1']);
  assert.equal(truncated, true);
  assert.ok(countWords(text) < 6100);
  assert.match(text, /Preacher\.\n\[Cut at a sentence boundary; reference 7\.1 continues\.\]/);
  assert.match(text, /\[Aid translation left out to stay within the size limit\.\]/);
});
