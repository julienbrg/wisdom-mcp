import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fits } from '../dist/corpus/transcription/guangyun.js';
import { VOLUMES } from '../dist/corpus/transcription/jizhu.js';
import { align, fill, slotsByBook } from '../dist/corpus/transcription/shiwen.js';

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
