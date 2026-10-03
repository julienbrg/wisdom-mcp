import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import type { Config } from '../config.js';

export type Db = Database.Database;
export const DB = Symbol('DB');

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url));

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  sqliteVec.load(db);
  migrate(db);
  return db;
}

function migrate(db: Db) {
  const current = db.pragma('user_version', { simple: true }) as number;
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const version = parseInt(file, 10);
    if (version <= current) continue;
    db.transaction(() => {
      db.exec(readFileSync(MIGRATIONS_DIR + file, 'utf-8'));
      db.pragma(`user_version = ${version}`);
    })();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (config: Config) => openDatabase(config.get('DATABASE_PATH', { infer: true })),
      inject: [ConfigService],
    },
  ],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly db: Db) {}

  onApplicationShutdown() {
    this.db.close();
  }
}
