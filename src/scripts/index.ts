import { env } from '../config.js';
import { buildIndexes } from '../corpus/indexes.js';
import { openDatabase } from '../database/database.module.js';

const db = openDatabase(env.DATABASE_PATH);
try {
  console.table([await buildIndexes(db, env.CORPUS_CACHE)]);
} finally {
  db.close();
}
