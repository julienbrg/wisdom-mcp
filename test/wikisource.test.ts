import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceUnits } from '../dist/corpus/originals/index.js';
import {
  analectsChapters,
  cleanWikitext,
  cnum,
  taoChapters,
} from '../dist/corpus/originals/wikisource.js';

test('chinese numerals, written and positional', () => {
  assert.deepEqual(
    ['一', '十', '十二', '二十', '八十一', '二一', '四七'].map(cnum),
    [1, 10, 12, 20, 81, 21, 47],
  );
});

test('wikitext: variants, links, conversions and notes', () => {
  assert.equal(
    cleanWikitext(
      "子曰：「{{另2|《[[尚書|書]]》-{云}-：『孝乎惟孝』|也有點作「《書》」}}，-{zh:顚;zh-hant:顛;zh-hans:颠}-沛<ref>note</ref>{{*|gloss}}'''。'''",
    ),
    '子曰：「《書》云：『孝乎惟孝』，顛沛。',
  );
});

test('tao te ching: commentary lines and the colophon are dropped', () => {
  const chapters = taoChapters(
    '=上篇=\n:晉　王弼注\n==一章==\n道可道，非常道，\n:{{*|可道之道}}\n名可名，非常名；\n==八十一章==\n信言不美，\n=跋=\n　　王弼老子道德經二卷',
  );
  assert.deepEqual(
    [...chapters],
    [
      ['1', { anchor: '一章', body: '道可道，非常道，\n名可名，非常名；' }],
      ['81', { anchor: '八十一章', body: '信言不美，' }],
    ],
  );
});

test('analects: chapters by div id, trailer cut at the next heading', () => {
  const chapters = analectsChapters(
    `*[[論語註疏/卷01|註疏]]\n<onlyinclude>\n<div id="一之一" style="x">'''一之一'''</div>\n子曰：「學而時習之」\n\n<div id="一之十六" style="x">'''一之十六'''</div>\n子曰：「不患人之不己知」\n===校勘記===\n{{reflist}}\n</onlyinclude>\n[[Category:論語]]`,
  );
  assert.deepEqual(
    [...chapters],
    [
      ['1.1', { anchor: '一之一', body: '子曰：「學而時習之」' }],
      ['1.16', { anchor: '一之十六', body: '子曰：「不患人之不己知」' }],
    ],
  );
});

test('translation units map onto source units', () => {
  assert.deepEqual(sourceUnits('dhammapada', '58-59'), ['58', '59']);
  assert.deepEqual(sourceUnits('dhammapada', '183'), ['183']);
  assert.deepEqual(sourceUnits('analects', '5.1'), ['5.1', '5.2']);
  assert.deepEqual(sourceUnits('analects', '5.27'), ['5.28']);
  assert.deepEqual(sourceUnits('analects', '9.5'), ['9.5']);
  assert.deepEqual(sourceUnits('analects', '9.6'), ['9.6', '9.7']);
  assert.deepEqual(sourceUnits('analects', '9.30'), ['9.31']);
  assert.deepEqual(sourceUnits('analects', '6.3'), ['6.3']);
  assert.deepEqual(sourceUnits('enchiridion', '51'), ['52', '53']);
  assert.deepEqual(sourceUnits('enchiridion', '49'), ['49']);
  assert.deepEqual(sourceUnits('ecclesiastes', '5:1'), ['4:17']);
  assert.deepEqual(sourceUnits('ecclesiastes', '5:20'), ['5:19']);
  assert.deepEqual(sourceUnits('ecclesiastes', '4:16'), ['4:16']);
});
