import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recallAt } from '../dist/corpus/recall.js';

test('recallAt counts relevant ids within the first k hits', () => {
  assert.equal(recallAt(2, ['a', 'b', 'c'], ['a', 'c']), 0.5);
  assert.equal(recallAt(3, ['a', 'b', 'c'], ['a', 'c']), 1);
  assert.equal(recallAt(10, [], ['a']), 0);
});

test('recallAt is 1 when nothing is relevant', () => {
  assert.equal(recallAt(10, ['a'], []), 1);
});
