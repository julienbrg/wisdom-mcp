import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fits } from '../dist/corpus/transcription/guangyun.js';
import { VOLUMES } from '../dist/corpus/transcription/jizhu.js';
import {
  align,
  draftPlain,
  fill,
  slotsByBook,
  VOLUMES as SHIWEN,
} from '../dist/corpus/transcription/shiwen.js';

const cls = (initial: string, tone: 1 | 2 | 3 | 4, group: string) => ({
  id: 0,
  initial,
  rhyme: '',
  tone,
  group,
});

test('a 廣韻 sound class fits the Mandarin readings it regularly gives', () => {
  // 樂: 五教切 is yào, not yuè; 盧各切 is lè.
  assert.ok(fits('yào', cls('疑', 3, '效')));
  assert.ok(!fits('yuè', cls('疑', 3, '效')));
  assert.ok(fits('lè', cls('來', 4, '宕')));
  // 好: 呼到切 is hào, 呼晧切 hǎo.
  assert.ok(fits('hào', cls('曉', 3, '效')));
  assert.ok(!fits('hǎo', cls('曉', 3, '效')));
  // 行: 下孟切 is xìng, not hàng.
  assert.ok(fits('xìng', cls('匣', 3, '梗')));
  assert.ok(!fits('hàng', cls('匣', 3, '梗')));
});

test('類隔 fanqie spell 知 initials with 端 spellers', () => {
  assert.ok(!fits('zhòng', cls('端', 3, '通')));
  assert.ok(fits('zhòng', cls('端', 3, '通'), true));
});

test('headwords align in order, skipping those from the commentary', () => {
  const text = '學而時習之不亦說乎有朋自遠方來不亦樂乎';
  // 通稱 comes from 何晏's commentary; the second 不亦 must not jump back.
  assert.deepEqual(align(['亦說', '通稱', '有朋', '亦樂', '樂'], text), [6, -1, 9, 16, -1]);
  // A single character sits between the anchors around it.
  assert.deepEqual(align(['說', '有朋', '遠'], text), [7, 9, 12]);
});

test('a source reading carries on with 後放此, other polyphones take 如字', () => {
  const units = [
    { refUnit: '1', body: '王曰：好學。' },
    { refUnit: '2', body: '夫好之樂。' },
  ];
  const slots = slotsByBook(units, () => '1').get('1');
  const note = { book: '1', head: '好', note: '好，去聲，後放此' };
  const readings = {};
  fill(
    readings,
    slots,
    new Map([
      [2, { pinyin: 'hào', note, carry: true }],
      [
        7,
        {
          pinyin: null,
          note: { book: '1', head: '樂', note: '樂，去聲' },
          carry: false,
          todo: 'two',
        },
      ],
    ]),
    new Map(units.map((u) => [u.refUnit, [...u.body]])),
    '朱熹集注',
  );
  assert.deepEqual(
    Object.values(readings)
      .flat()
      .map((r) => [r.char, r.pinyin, r.todo]),
    [
      ['王', 'wáng', undefined],
      ['好', 'hào', undefined],
      ['夫', 'fú', undefined],
      ['好', 'hào', undefined],
      ['樂', '', 'two'],
    ],
  );
});

test('each part of a book of Mencius is its own volume of 集注', () => {
  const { bookOf } = VOLUMES.mencius;
  assert.deepEqual(['1A.1', '1B.16', '4A.3', '7B.38'].map(bookOf), ['1', '2', '7', '14']);
});

test('a 下同 stops at the end of its passage when the passages are scattered', () => {
  const units = [
    { refUnit: '2.3', body: '從心之所念。從口之所言。' },
    { refUnit: '2.11', body: '從漚鳥游。' },
  ];
  const slots = slotsByBook(units, () => '2').get('2');
  const note = { book: '2', head: '從', note: '音縱下同' };
  const readings: Record<string, { pinyin: string }[]> = {};
  fill(
    readings,
    slots,
    new Map([[0, { pinyin: 'zòng', note, carry: true }]]),
    new Map(units.map((u) => [u.refUnit, [...u.body]])),
    '殷敬順釋文',
    'unit',
  );
  assert.deepEqual(
    Object.values(readings)
      .flat()
      .map((r) => r.pinyin),
    ['zòng', 'zòng', 'cóng'],
  );
});

test('莊子音義 is found by its book numbers, over two volumes', () => {
  const { books, pages, bookOf } = SHIWEN['chuang-tzu'];
  assert.deepEqual(
    [books[0], books[9], books[10], books[19], books[32]],
    ['第一', '第十', '第十一', '第二十', '第三十三'],
  );
  assert.equal(pages.length, 2);
  assert.equal(bookOf('17.12'), '17');
});

test('a phrase 下同 carries to the phrase it names or to its headword, not to every occurrence', () => {
  const units = [
    { refUnit: '2.3', body: '惡乎隱。惡乎存。好惡之。' },
    { refUnit: '2.4', body: '爲是不用。道通爲一。爲是。' },
  ];
  const slots = slotsByBook(units, () => '2').get('2');
  const readings: Record<string, { pinyin: string }[]> = {};
  fill(
    readings,
    slots,
    new Map([
      [
        0,
        {
          pinyin: 'wū',
          note: { book: '2', head: '惡乎', note: '音烏下皆同' },
          carry: true,
          index: 0,
        },
      ],
      [
        9,
        { pinyin: 'wèi', note: { book: '2', head: '故爲', note: '于僞反下爲是皆同' }, carry: true },
      ],
    ]),
    new Map(units.map((u) => [u.refUnit, [...u.body]])),
    '經典釋文',
    'phrase',
  );
  assert.deepEqual(
    Object.values(readings)
      .flat()
      .map((r) => r.pinyin),
    ['wū', 'wū', 'hǎo', 'è', 'wèi', 'wéi', 'wèi'],
  );
});

test('周易音義 reads each hexagram in 王弼’s order, the first one apart', () => {
  const { bookOf, slots } = SHIWEN['i-ching'];
  assert.deepEqual(
    ['1', '10', '11', '42', '43', '64', 'App. I.30', 'App. IV.2.1', 'App. III.1.5'].map(bookOf),
    ['1', '1', '2', '4', '5', '6', '3', '1', '7'],
  );
  assert.deepEqual(['App. III.2.12', 'App. V.3', 'App. VI.2', 'App. VII'].map(bookOf), [
    '8',
    '9',
    '10',
    '11',
  ]);
  const units = [
    { refUnit: '1', body: '乾：元。\n初九：潛。' },
    { refUnit: '2', body: '坤：元。\n初六：履。\n六二：直。' },
    { refUnit: 'App. I.1', body: '大哉。' },
    { refUnit: 'App. I.2', body: '至哉。' },
    { refUnit: 'App. II.1', body: '天行。\n潛龍。' },
    { refUnit: 'App. II.2', body: '地勢。\n履霜。\n直方。' },
    { refUnit: 'App. IV.2.1', body: '坤至。' },
    { refUnit: 'App. III.1.1', body: '天尊。' },
  ];
  const books = slots!(units);
  assert.equal(
    books
      .get('1')!
      .map((s) => s.char)
      .join(''),
    '乾元初九潛大哉天行潛龍坤元至哉地勢初六履履霜六二直直方坤至',
  );
  assert.equal(
    books
      .get('7')!
      .map((s) => s.char)
      .join(''),
    '天尊',
  );
});

test('a work with no 音義 takes the usual readings, to be reviewed', () => {
  const readings = draftPlain([{ refUnit: '1.1', body: '將受命於君。夫兵者，不祥之器。' }]);
  assert.deepEqual(
    readings['1.1'].map((r) => [r.char, r.pinyin, r.source]),
    [
      ['將', 'jiāng', 'no 音義'],
      ['於', 'yú', 'no 音義'],
      ['夫', 'fú', 'no 音義'],
    ],
  );
});
