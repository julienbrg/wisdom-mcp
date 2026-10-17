import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceUnits } from '../dist/corpus/originals/index.js';
import {
  analectsChapters,
  artOfWarChapters,
  cleanWikitext,
  cnum,
  hexagramSections,
  menciusChapters,
  paragraphs,
  taoChapters,
  wingSections,
  xiciChapters,
  zhangjuChapters,
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
      "子曰：「{{另2|《[[尚書|書]]》-{云}-：『孝乎惟孝』|也有點作「《書》」}}，-{zh:顚;zh-hant:顛;zh-hans:颠}-沛<ref>note</ref>{{*|gloss}}'''。'''[[en:Analects/Wei Zheng]]",
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

test('mencius: a chapter per paragraph of 集注, numbered by book and part', () => {
  const chapters = menciusChapters(
    [
      '==盡心章句上==',
      '\u3000\u3000{{annotate|凡四十六章。}}',
      '\u3000\u3000孟子曰：「盡其心者，知其性也。」{{annotate|心者，人之神明。-{云}-}}',
      ...Array.from({ length: 39 }, (_, i) => `\u3000\u3000孟子曰：「${i}。」`),
      '\u3000\u3000公孫丑曰：「道則高矣。」',
      '\u3000\u3000孟子曰：「大匠不為拙工。」',
      '\u3000\u3000孟子曰：「天下有道。」',
    ].join('\n'),
    12,
  );
  assert.equal(chapters.size, 42);
  assert.deepEqual(chapters.get('7A.1'), { anchor: '', body: '孟子曰：「盡其心者，知其性也。」' });
  assert.deepEqual(chapters.get('7A.41'), {
    anchor: '',
    body: '公孫丑曰：「道則高矣。」\n孟子曰：「大匠不為拙工。」',
  });
  assert.equal(chapters.get('7A.42')?.body, '孟子曰：「天下有道。」');
});

test('zhangju: chapters end at 右, with notes, titles and the preface dropped', () => {
  const chapters = zhangjuChapters(
    [
      '　　中庸章句{{annotate|中者，不偏不倚。}}',
      '::　　子程子曰：「不偏之謂中。」',
      '{{gap}}子程子曰：「大學，孔氏之遺書。」',
      '　　天命之謂性，{{annotate|命，猶令也。-{云}-}}率性之謂道。',
      '::    右第一章。{{annotate|言道。}}\n::其下十章。',
      '{{gap}}《[[康誥]]》曰：「克明德。」\n富潤屋，德潤身。',
      '{{gap}}右傳之首章。釋明明德。',
    ].join('\n\n'),
    0,
  );
  assert.deepEqual(
    [...chapters],
    [
      ['0', { anchor: '', body: '天命之謂性，率性之謂道。' }],
      ['1', { anchor: '', body: '《康誥》曰：「克明德。」\n富潤屋，德潤身。' }],
    ],
  );
});

test('paragraphs: one section per paragraph, header, titles and trailing notes dropped', () => {
  const sections = paragraphs(
    '{{header2\n|title=[[../]]\n|section=逍遙遊第一\n}}\n\n北冥有魚，摶{{另|扶|抉}}搖而上。\n\n蜩與鷽鳩笑之曰：「我決起而飛。」\n\n[[Category:先秦]]',
    1,
  );
  assert.deepEqual(
    [...sections],
    [
      ['1.1', { anchor: '', body: '北冥有魚，摶扶搖而上。' }],
      ['1.2', { anchor: '', body: '蜩與鷽鳩笑之曰：「我決起而飛。」' }],
    ],
  );
  assert.deepEqual(
    [...paragraphs('{{Header|title=列子|notes=}}\n\n子列子居鄭圃。\n{{footer}}', 8)],
    [['8.1', { anchor: '', body: '子列子居鄭圃。' }]],
  );
  assert.deepEqual(
    [
      ...paragraphs(
        '<onlyinclude>\n凡此五者，聖人之所儉節也。\n</onlyinclude>\n==註釋==\n<references/>',
        6,
      ),
    ],
    [['6.1', { anchor: '', body: '凡此五者，聖人之所儉節也。' }]],
  );
});

test('art of war: paragraphs numbered by chapter, the dialogues after the thirteen dropped', () => {
  const units = artOfWarChapters(
    [
      '{{header|title=孫子兵法}}',
      '== 始計第一 ==',
      '[[wikipedia:zh:孙武|孫子]]曰：兵者，國之大事。',
      '',
      '夫未戰而廟算勝者，得算多也。',
      '',
      '== 用間第十三 ==',
      '孫子曰：凡興師十萬。',
      '',
      '== 答話 ==',
      '吳王問孫武曰：「散地士卒顧家，不可與戰，則必固守不出。」',
    ].join('\n'),
  );
  assert.deepEqual(
    [...units],
    [
      ['1.1', { anchor: '始計第一', body: '孫子曰：兵者，國之大事。' }],
      ['1.2', { anchor: '始計第一', body: '夫未戰而廟算勝者，得算多也。' }],
      ['13.1', { anchor: '用間第十三', body: '孫子曰：凡興師十萬。' }],
    ],
  );
});

test('i ching: a hexagram page gives the text, the 彖, the 象 and the 文言 by chapter', () => {
  const units = hexagramSections(
    [
      '[[周易]]　第二卦',
      ';坤',
      "*<span style=\"color:blue\">'''易經：'''</span>",
      "**<span style=\"color:blue\">'''坤'''：元亨。利牝馬之貞。</span>",
      '*#<span style="color:blue">初六：履霜，堅冰至。</span>',
      '',
      "*'''彖曰：'''",
      '**至哉坤元，萬物資生，乃順承天。',
      '***坤厚載物，德合-{无}-疆。',
      '',
      "*'''象曰：'''",
      '**地勢坤，君子以厚德載物。',
      '*#履霜堅冰，陰始凝也。',
      '',
      "*'''文言曰：'''",
      '**坤至柔而動也剛。',
      '*#積善之家，必有餘慶。',
      '*#直其正也，方其義也。',
      '*:',
      '*#「潛龍勿用」，下也。',
    ].join('\n'),
    2,
  );
  assert.deepEqual(Object.fromEntries([...units].map(([unit, { body }]) => [unit, body])), {
    '2': '坤：元亨。利牝馬之貞。\n初六：履霜，堅冰至。',
    'App. I.2': '至哉坤元，萬物資生，乃順承天。\n坤厚載物，德合无疆。',
    'App. II.2': '地勢坤，君子以厚德載物。\n履霜堅冰，陰始凝也。',
    'App. IV.2.1': '坤至柔而動也剛。',
    'App. IV.2.2': '積善之家，必有餘慶。\n直其正也，方其義也。',
    'App. IV.2.3': '「潛龍勿用」，下也。',
  });
});

test('i ching: the 繫辭 by Legge’s chapters, and the other wings', () => {
  const chapter = (n: string, ...paras: string[]) =>
    `==第${n}章==\n` + paras.map((p) => `{{gap}}${p}`).join('\n\n');
  const upper = xiciChapters(
    `{{Header|title=繫辭上傳}}\n\n${chapter('一', '天尊地卑，乾坤定矣。')}\n\n${chapter('二', '聖人設卦觀象。', '是故君子所居而安者。')}`,
    1,
  );
  assert.deepEqual(
    [...upper].map(([unit, { body }]) => [unit, body]),
    [
      ['App. III.1.1', '天尊地卑，乾坤定矣。'],
      ['App. III.1.2', '聖人設卦觀象。\n是故君子所居而安者。'],
    ],
  );
  // Wikisource's chapters of the 繫辭下 are not Zhu Xi's, so its paragraphs are counted out again.
  const paras = Array.from({ length: 25 }, (_, i) => `第${i + 1}段。`);
  const lower = xiciChapters(
    [chapter('一', ...paras.slice(0, 4)), chapter('二', ...paras.slice(4))].join('\n\n'),
    2,
  );
  assert.equal(lower.size, 12);
  assert.equal(lower.get('App. III.2.2')!.body, '第2段。\n第3段。\n第4段。');
  assert.equal(lower.get('App. III.2.12')!.body, '第23段。\n第24段。\n第25段。');
  assert.throws(() => xiciChapters(chapter('一', ...paras.slice(1)), 2), /paragraphs moved/);

  const sequence = wingSections(
    '==上篇==\n:有[[周易/乾|天]][[周易/坤|地]]，然後萬物生焉。\n\n==下篇==\n:有天地然後有萬物。',
    'VI',
  );
  assert.deepEqual(
    [...sequence].map(([unit, { body }]) => [unit, body]),
    [
      ['App. VI.1', '有天地，然後萬物生焉。'],
      ['App. VI.2', '有天地然後有萬物。'],
    ],
  );
  assert.deepEqual(
    [
      ...wingSections(
        '==一篇==\n:乾剛坤柔，比樂師憂。\n\n==校詁版==\n\n乾剛坤柔。比樂師憂。',
        'VII',
      ),
    ].map(([unit, { body }]) => [unit, body]),
    [['App. VII', '乾剛坤柔，比樂師憂。']],
  );
});

test('translation units map onto source units', () => {
  assert.deepEqual(sourceUnits('dhammapada', '58-59'), ['58', '59']);
  assert.deepEqual(sourceUnits('dhammapada', '183'), ['183']);
  assert.deepEqual(sourceUnits('mencius', '1A.6-7'), ['1A.6', '1A.7']);
  assert.deepEqual(sourceUnits('doctrine-of-the-mean', '14-15'), ['14', '15']);
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
