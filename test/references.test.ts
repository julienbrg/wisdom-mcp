import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roman, segment } from '../dist/corpus/references.js';

const refs = (workId: string, blocks: string[]) =>
  segment(workId, blocks).map((s) => [s.ref, s.refUnit, s.apparatus]);

test('roman numerals', () => {
  assert.deepEqual(['IV', 'IX', 'XIV', 'XLVII', 'LI'].map(roman), [4, 9, 14, 47, 51]);
});

test('front matter before the main text is apparatus', () => {
  assert.deepEqual(refs('dhammapada', ['THE DHAMMAPADA', 'Chapter I. The Twin-Verses', '1. All']), [
    [null, null, true],
    [null, null, true],
    ['1', '1', false],
  ]);
});

test('tao te ching: chapters, paragraphs and bare markers', () => {
  const blocks = [
    'PART 1.',
    'Ch. 1. 1. The Tao that can be trodden',
    '2. (Conceived of as) having no name',
    '3.',
    '  Always without desire\n  If its deep mystery',
    '2. 1. All in the world know',
    '3. The thirty spokes',
    '4.',
    '1.',
    "  Colour's five hues",
  ];
  assert.deepEqual(refs('tao-te-ching', blocks), [
    [null, null, true],
    ['1.1', '1', false],
    ['1.2', '1', false],
    [null, null, true],
    ['1.3', '1', false],
    ['2.1', '2', false],
    ['3', '3', false],
    [null, null, true],
    [null, null, true],
    ['4.1', '4', false],
  ]);
});

test('analects: chapters are split out of page blocks and counted', () => {
  const segs = segment('analects', [
    'CONFUCIAN ANALECTS.\nBOOK I.  HSIO R.',
    "CHAPTER I. 1. The Master said, 'Is it not\n        CHAP. II. 1. The philosopher Yu",
    "sequence.'\n        CHAP II. The Master said",
    'BOOK II. WEI CHANG.',
    "CHAP. I. The Master said, 'He who\n        CHAP. I. typo",
  ]);
  assert.deepEqual(
    segs.map((s) => [s.n, s.part, s.ref, s.text.slice(0, 10)]),
    [
      [0, 0, null, 'CONFUCIAN '],
      [1, 0, '1.1', '1. The Mas'],
      [1, 1, '1.2', '1. The phi'],
      [2, 0, '1.2', "sequence.'"],
      [2, 1, '1.3', 'The Master'],
      [3, 0, null, 'BOOK II. W'],
      [4, 0, '2.1', 'The Master'],
      [4, 1, '2.2', 'typo'],
    ],
  );
});

test('dhammapada: combined verses get a range', () => {
  assert.deepEqual(refs('dhammapada', ['Chapter I. Twin', '58, 59. As on a heap']).at(-1), [
    '58-59',
    '58-59',
    false,
  ]);
});

test('meditations: book.section refs and units, one skipped section allowed', () => {
  const blocks = [
    'THE FIRST BOOK',
    'I. Of my grandfather',
    'I learned more.',
    'THE SECOND BOOK',
    'I. Remember',
    'II. Let it be',
    'IV. Why should',
    'VII. Too far',
  ];
  assert.deepEqual(
    refs('meditations', blocks).map(([ref, unit]) => `${ref}@${unit}`),
    ['null@null', '1.1@1.1', '1.1@1.1', 'null@null', '2.1@2.1', '2.2@2.2', '2.4@2.4', '2.4@2.4'],
  );
});

test('enchiridion: footnote anchors on section numbers and the end of the text', () => {
  assert.deepEqual(
    refs('enchiridion', [
      'THE ENCHIRIDION',
      'I',
      'There are things',
      'XXIX[2]',
      'In every affair',
      'Footnotes',
      '[1]Happiness',
    ]),
    [
      [null, null, true],
      [null, null, true],
      ['1', '1', false],
      [null, null, true],
      ['29', '29', false],
      [null, null, true],
      [null, null, true],
    ],
  );
});

test('bible: verse numbers become chapter:verse', () => {
  const segs = segment('ecclesiastes', [
    'Book 21  Ecclesiastes',
    '21:001:004 One generation passeth away',
  ]);
  assert.deepEqual(
    segs.map((s) => [s.ref, s.text]),
    [
      [null, 'Book 21  Ecclesiastes'],
      ['1:4', 'One generation passeth away'],
    ],
  );
});

test('gita: verse ranges counted per chapter, colophons and footnotes are apparatus', () => {
  assert.deepEqual(
    refs('bhagavad-gita', [
      'PREFACE',
      'CHAPTER I',
      '  Dhritirashtra:\n  Ranged',
      '  Sanjaya:\n  When he beheld',
      'HERE ENDETH CHAPTER I.',
      'CHAPTER II',
      '  Sanjaya:\n  Him, filled',
      '[FN#1] Some',
    ]),
    [
      [null, null, true],
      [null, null, true],
      ['1.1', '1.1', false],
      ['1.2-11', '1.2-11', false],
      [null, null, true],
      [null, null, true],
      ['2.1', '2.1', false],
      [null, null, true],
    ],
  );
});
