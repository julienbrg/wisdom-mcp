import { env } from '../config.js';
import { importWorks } from '../corpus/import.js';
import { PILOT_WORKS } from '../corpus/works.js';
import { openDatabase } from '../database/database.module.js';

const db = openDatabase(env.DATABASE_PATH);
try {
  const stats = await importWorks(db, PILOT_WORKS, env.CORPUS_CACHE);
  console.table(stats);
} finally {
  db.close();
}
