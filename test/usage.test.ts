import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { openDatabase } from '../dist/database/database.module.js';
import { UsageService } from '../dist/usage/usage.service.js';

const DAY = 24 * 60 * 60;

test('track logs a row with the fields the handler sets', async () => {
  const db = openDatabase(':memory:');
  const usage = new UsageService(db);
  const result = await usage.track('search_passages', async (row) => {
    Object.assign(row, {
      query: 'anger',
      passageIds: ['tao:2', 'dham:1'],
      hits: 2,
      keywordOnly: false,
      embeddingTokens: 3,
    });
    return 'ok';
  });
  assert.equal(result, 'ok');
  const row = db.prepare('select * from usage').get();
  assert.equal(row.tool, 'search_passages');
  assert.equal(row.query, 'anger');
  assert.equal(row.passage_ids, '["tao:2","dham:1"]');
  assert.equal(row.hits, 2);
  assert.equal(row.keyword_only, 0);
  assert.equal(row.embedding_tokens, 3);
  assert.ok(row.duration_ms >= 0);
});

test('track logs a row when the handler throws', async () => {
  const db = openDatabase(':memory:');
  const usage = new UsageService(db);
  await assert.rejects(
    usage.track('get_concept', async (row) => {
      row.query = 'wu-wei';
      throw new Error('boom');
    }),
  );
  const row = db.prepare('select tool, query, keyword_only from usage').get();
  assert.deepEqual({ ...row }, { tool: 'get_concept', query: 'wu-wei', keyword_only: null });
});

test('purge hashes queries older than 30 days and keeps passage ids', () => {
  const db = openDatabase(':memory:');
  const now = Date.UTC(2026, 9, 13);
  const at = now / 1000;
  const insert = db.prepare(
    `insert into usage (at, tool, query, passage_ids, duration_ms)
     values (?, 'search_passages', ?, '["tao:2"]', 10)`,
  );
  insert.run(at - 31 * DAY, 'old question');
  insert.run(at - 29 * DAY, 'recent question');

  assert.equal(new UsageService(db).purge(now), 1);
  const rows = db.prepare('select query, query_hash, passage_ids from usage order by at').all();
  assert.deepEqual(
    { ...rows[0] },
    {
      query: null,
      query_hash: createHash('sha256').update('old question').digest('hex'),
      passage_ids: '["tao:2"]',
    },
  );
  assert.deepEqual(
    { ...rows[1] },
    {
      query: 'recent question',
      query_hash: null,
      passage_ids: '["tao:2"]',
    },
  );
  assert.equal(new UsageService(db).purge(now), 0);
});
