import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isVerse, normalize } from '../dist/corpus/normalize.js';

test('prose lines are rejoined', () => {
  assert.equal(
    normalize('2. May not the space between heaven and earth be compared to a\nbellows?'),
    '2. May not the space between heaven and earth be compared to a bellows?',
  );
});

test('hard-hyphenated words are rejoined without a space', () => {
  assert.equal(normalize('a well-\ndefined path'), 'a well-defined path');
  assert.equal(normalize('Tsze-\n  wan asked'), 'Tsze-wan asked');
});

test('indented blocks are verse and keep their line breaks', () => {
  const raw =
    "  'Tis emptied, yet it loses not its power;\n   Much speech to swift exhaustion lead we see;";
  assert.ok(isVerse(raw));
  assert.equal(
    normalize(raw),
    "'Tis emptied, yet it loses not its power;\nMuch speech to swift exhaustion lead we see;",
  );
});

test('verse keeps trailing dashes on their line', () => {
  assert.equal(normalize('  Sadly meseems-\n  Our kinsmen'), 'Sadly meseems-\nOur kinsmen');
});

test('a single line or a hanging indent is prose', () => {
  assert.ok(!isVerse('  Krishna.'));
  assert.ok(!isVerse('21:001:004 One generation passeth away,\n           but the earth abideth'));
});

test('italic markers and footnote anchors are dropped', () => {
  assert.equal(normalize('the _agora_ and[FN#3] the tables'), 'the agora and the tables');
  assert.equal(normalize('let it be.”[10]'), 'let it be.”');
  assert.equal(normalize('snake_case stays'), 'snake_case stays');
});

test('the verse flag can come from the untrimmed passage', () => {
  assert.equal(normalize('Him, filled\n  With eyes', true), 'Him, filled\nWith eyes');
});
