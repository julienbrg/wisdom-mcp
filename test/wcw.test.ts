import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitPassages } from '../dist/corpus/wcw.js';

test('passages split on blank lines and keep their indentation', () => {
  assert.deepEqual(splitPassages('CHAPTER II\n\n  \n  Sanjaya.\n  Him, filled\n\n\n6.\n\n'), [
    'CHAPTER II',
    '  Sanjaya.\n  Him, filled',
    '6.',
  ]);
});
