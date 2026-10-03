import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chaptersOf } from '../dist/corpus/originals/gita.js';
import { gitaRange, gitaVerses } from '../dist/corpus/originals/gita-verses.js';
import { meditationsChapters } from '../dist/corpus/originals/meditations.js';
import { group, parseTei } from '../dist/corpus/originals/perseus.js';
import { cleanVerse } from '../dist/corpus/originals/sefaria.js';
import { versesOf } from '../dist/corpus/originals/suttacentral.js';

const TEI = `<TEI><teiHeader><title>skip me</title></teiHeader><text><body>
<div type="edition"><head>ΚΑΤΑ ΜΑΘΘΑΙΟΝ</head>
<div type="textpart" subtype="chapter" n="5">
<div type="textpart" subtype="verse" n="3"><p> <milestone unit="para"/> ΜΑΚΑΡΙΟΙ οἱ πτωχοὶ
τῷ πνεύματι,<note>a note</note> ὅτι &amp; <pb n="5"/></p></div>
<div type="textpart" subtype="verse" n="4"><p>μακάριοι οἱ πενθοῦντες</p></div>
</div></div></body></text></TEI>`;

test('perseus: leaf text by citation path, without notes or heads', () => {
  assert.deepEqual(
    [...parseTei(TEI)],
    [
      ['5.3', 'ΜΑΚΑΡΙΟΙ οἱ πτωχοὶ τῷ πνεύματι, ὅτι &'],
      ['5.4', 'μακάριοι οἱ πενθοῦντες'],
    ],
  );
});

test('perseus: grouping by the leading levels of the citation', () => {
  const texts = new Map([
    ['1.1.1', 'a'],
    ['1.2.1', 'b'],
    ['2.1.1', 'c'],
  ]);
  assert.deepEqual([...group(texts, 1, '.').keys()], ['1', '2']);
  assert.deepEqual(
    group(texts, 1, '.')
      .get('1')
      ?.map((p) => p.path),
    ['1.1.1', '1.2.1'],
  );
});

test('sefaria: paragraph markers and tags are dropped, ketiv and qere kept', () => {
  assert.equal(
    cleanVerse(
      'שְׁמֹ֣ר <span class="mam-kq"><span class="mam-kq-k">(רגליך)</span> <span class="mam-kq-q">[רַגְלְךָ֗]</span></span>&nbsp;<span class="mam-spi-pe">{פ}</span><br>',
    ),
    'שְׁמֹ֣ר (רגליך) [רַגְלְךָ֗]',
  );
});

test('suttacentral: verse lines without titles or the vagga colophon', () => {
  const verses = versesOf({
    'dhp58:0': 'Garahadinnavatthu ',
    'dhp58:1': 'Yathā saṅkāradhānasmiṁ, ',
    'dhp58:2': 'ujjhitasmiṁ mahāpathe; ',
    'dhp59:0.1': 'title',
    'dhp59:1': 'Evaṁ saṅkārabhūtesu, ',
    'dhp59:5': 'Pupphavaggo catuttho. ',
  });
  assert.deepEqual(
    [...verses],
    [
      [58, 'Yathā saṅkāradhānasmiṁ,\nujjhitasmiṁ mahāpathe;'],
      [59, 'Evaṁ saṅkārabhūtesu,'],
    ],
  );
});

test('gita: verses joined by chapter in verse order', () => {
  const chapters = chaptersOf([
    { chapter_number: '1', verse_number: '2', text: 'b' },
    { chapter_number: '1', verse_number: '1', text: 'धृतराष्ट्र उवाच\n\nधर्मक्षेत्रे' },
    { chapter_number: 2, verse_number: 1, text: 'c' },
  ]);
  assert.deepEqual(
    [...chapters],
    [
      ['1', 'धृतराष्ट्र उवाच\nधर्मक्षेत्रे\n\nb'],
      ['2', 'c'],
    ],
  );
});

test('meditations: Casaubon sections map onto the Perseus chapters they translate', () => {
  assert.deepEqual(meditationsChapters('1.1'), ['1.1', '1.2', '1.3', '1.4']);
  assert.deepEqual(meditationsChapters('1.15'), ['2.1']);
  assert.deepEqual(meditationsChapters('2.6'), ['2.9']);
  assert.deepEqual(meditationsChapters('12.3'), ['12.4']);
  assert.deepEqual(meditationsChapters('12.15'), ['12.19', '12.20', '12.21']);
  assert.throws(() => meditationsChapters('2.5'), /no section/);
  assert.throws(() => meditationsChapters('12.28'), /no section/);
});

test('gita: Arnold passages map onto the verse ranges they render', () => {
  assert.equal(gitaRange(1, 1), '1');
  assert.equal(gitaRange(18, 26), '64-65');
  assert.equal(gitaRange(18, 31), '74-78');
  assert.throws(() => gitaRange(18, 32), /no passage/);
  assert.deepEqual(gitaVerses('18.64-65'), ['18.64', '18.65']);
  assert.deepEqual(gitaVerses('2.70'), ['2.70']);
});
