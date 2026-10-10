import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openDatabase } from '../dist/database/database.module.js';

test('migrations create the schema', () => {
  const db = openDatabase(':memory:');
  assert.equal(db.pragma('user_version', { simple: true }), 3);

  const tables = db
    .prepare("select name from sqlite_master where type = 'table'")
    .all()
    .map((r: { name: string }) => r.name);
  for (const name of [
    'works',
    'texts',
    'passages',
    'originals',
    'translations',
    'passages_fts',
    'originals_fts',
    'passages_vec',
    'concepts',
    'concept_passages',
    'concept_links',
  ]) {
    assert.ok(tables.includes(name), `missing table ${name}`);
  }
  const columns = db.pragma('table_info(originals)').map((c: { name: string }) => c.name);
  assert.ok(columns.includes('transcription'));
});

test('sqlite-vec stores 1024-dimension vectors', () => {
  const db = openDatabase(':memory:');
  db.prepare("insert into passages_vec (passage_id, embedding) values ('p1', ?)").run(
    new Float32Array(1024).fill(0.5),
  );
  const row = db
    .prepare('select passage_id, distance from passages_vec where embedding match ? and k = 1')
    .get(new Float32Array(1024).fill(0.5));
  assert.equal(row.passage_id, 'p1');
});

test('migrations are not re-applied on reopen', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'wisdom-')), 'app.db');
  openDatabase(path).close();
  const db = openDatabase(path);
  assert.equal(db.pragma('user_version', { simple: true }), 3);
});
