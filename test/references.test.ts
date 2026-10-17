import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anchored, artOfWarUnit, roman, segment } from '../dist/corpus/references.js';

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

test('tao te ching: chapters, paragraphs, bare markers and part headings', () => {
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
    'PART II.',
    '5. 1. Heaven and earth',
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
    [null, null, true],
    ['5.1', '5', false],
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

test('art of war: sections by number, notes in brackets over several blocks', () => {
  assert.deepEqual(
    refs('art-of-war', [
      'Preface by Lionel Giles',
      'Chapter I. LAYING PLANS',
      '[Ts’ao Kung, in defining the meaning]',
      '1. Sun Tzŭ said: The art of war',
      '2, 3. It is a matter of life and death',
      '[True excellence being, as Tu Mu says, things that',
      '"the world’s coarse thumb\nAnd finger fail to plumb."',
      '4 These are: (1) The Moral Law',
      'If his forces are united, separate them.',
      'The latter defined as "places enclosed."]',
      '[1] "Words on Wellington," by Sir. W. Fraser.',
      'Chapter XII. THE ATTACK BY FIRE',
      '1. Sun Tzŭ said: There are five ways',
      '[Tu Mu says\n]\n2. In order to carry out an attack',
    ]),
    [
      [null, null, true],
      [null, null, true],
      [null, null, true],
      ['1.1', '1.1', false],
      ['1.2-3', '1.1', false],
      [null, null, true],
      [null, null, true],
      ['1.4', '1.1', false],
      ['1.4', '1.1', false],
      [null, null, true],
      [null, null, true],
      [null, null, true],
      ['12.1', '12.1', false],
      [null, null, true],
      ['12.2', '12.1', false],
    ],
  );
});

test('art of war: a section that runs over two source paragraphs takes both', () => {
  assert.equal(artOfWarUnit(1, 4, 4), '1.1');
  assert.equal(artOfWarUnit(1, 5, 6), '1.2');
  assert.equal(artOfWarUnit(6, 21, 21), '6.6');
  assert.equal(artOfWarUnit(6, 22, 22), '6.6-7');
  assert.equal(artOfWarUnit(6, 23, 23), '6.7');
  assert.equal(artOfWarUnit(13, 27, 27), '13.5');
});

test('aligned: each translation takes the chapter its Chinese paragraph comes from', () => {
  const source = new Map(
    Object.entries({
      '1A.1': '孟子見梁惠王。王曰：「叟不遠千里而來，亦將有以利吾國乎？」',
      '1A.2': '孟子見梁惠王，王立於沼上，顧鴻鴈麋鹿，曰：「賢者亦樂此乎？」',
      '1A.3': '梁惠王曰：「寡人之於國也，盡心焉耳矣。」',
    }).map(([unit, body]) => [unit, { body }]),
  );
  const segs = segment(
    'mencius',
    [
      '## chapter01',
      '梁惠王上',
      'Liang Hui Wang I',
      '孟子見梁惠王。王曰：「叟不遠千里而來，亦將有以利吾國乎？」',
      'Mencius went to see king Hui of Liang.',
      'He went on.',
      '王立於沼上，顧鴻鴈麋鹿。梁惠王曰：「寡人之於國也，盡心焉耳矣。」',
      'The king went and stood with him by a pond.',
      '## chapter02',
      'Liang Hui Wang II',
    ],
    source,
  );
  assert.deepEqual(
    segs.map((s) => [s.ref, s.refUnit, s.apparatus]),
    [
      [null, null, true],
      [null, null, true],
      [null, null, true],
      [null, null, true],
      ['1A.1', '1A.1', false],
      ['1A.1', '1A.1', false],
      [null, null, true],
      ['1A.2-3', '1A.2-3', false],
      [null, null, true],
      [null, null, true],
    ],
  );
  assert.throws(() => segment('mencius', []), /source text/);
});

test('anchored: units start at their anchors, and a unit starting within a block takes a range', () => {
  const blocks = [
    '## Introduction',
    'The history of Taoist philosophy',
    '## Book I',
    '### Cosmogony',
    'Our Master Lieh Tzŭ dwelt on a vegetable plot',
    '"There is a Creative  Principle\nwhich is itself uncreated."',
    '***',
    "The Master Lieh Tzŭ said: 'The inspired men of old. The virtue of Heaven and Earth.'",
    "The Master Lieh Tzŭ said: 'On one hand",
    '## Footnotes',
    'A fellow-disciple.',
    '## Book II',
    'The Yellow Emperor sat for fifteen years',
  ];
  const anchors: [string | null, string][] = [
    ['1.1', 'Our Master Lieh Tzŭ'],
    ['1.2', "The Master Lieh Tzŭ said: 'The"],
    ['1.3', '…The virtue of Heaven'],
    [null, "The Master Lieh Tzŭ said: 'On"],
    ['2.1', 'The Yellow Emperor'],
  ];
  assert.deepEqual(
    anchored('liezi', blocks, anchors).map((s) => s.refUnit),
    [null, null, null, null, '1.1', '1.1', null, '1.2-3', null, null, null, null, '2.1'],
  );
  assert.throws(
    () => anchored('liezi', blocks, [...anchors, ['2.2', 'Not there']]),
    /anchor not found: 2.2 Not there/,
  );
});

test("anchored: a scan's footnotes run from the first one on a page to the next page head", () => {
  const blocks = [
    'BOOK  I',
    'CHAPTER',
    'BEMEKDINa  THE  LeABNED  ^',
    'If  one  does  not  preserve  the  learned  in  a state',
    'Formerly  Lord  Wen  was  once  in\nexile  and  yet  later',
    '^ This  and  the  two  following  chapters  are  judged  to  be  spurious',
    'unanimously  by  competent  textual  critics.',
    'THE  WORKS  OF  MOTSE',
    '2',
    'looked  upon  with  awe  by  the  princes  of  CHna.^',
    '^ Chow of Yin in wine, you go and attack him. We will surely',
    '[ let you destroy him.”',
    '^ These are the wicked helpers of the unsuccessful princes.',
    'Examples of sucli are Tuan Kan Mu,^ CKintse,® and Pu Yiieh.*',
    'it 1',
  ];
  const anchors: [string, string][] = [
    ['1.1', 'If one does not'],
    ['1.2', 'Formerly Lord Wen'],
  ];
  assert.deepEqual(
    anchored('mozi', blocks, anchors).map((s) => s.refUnit),
    [
      null,
      null,
      null,
      '1.1',
      '1.2',
      null,
      null,
      null,
      null,
      '1.2',
      '1.2',
      '1.2',
      null,
      '1.2',
      null,
    ],
  );
});

test('anchored: a translation whose main text is missing fails', () => {
  for (const workId of ['chuang-tzu', 'liezi', 'tao-te-ching-giles', 'mozi']) {
    assert.throws(() => segment(workId, ['nothing here']), /main text start not found/);
  }
});
