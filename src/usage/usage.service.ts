import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { DB, type Db } from '../database/database.module.js';

export interface UsageRow {
  query?: string;
  passageIds?: string[];
  hits?: number;
  keywordOnly?: boolean;
  embeddingTokens?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 30 * DAY_MS;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class UsageService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly insert;
  private readonly expired;
  private readonly hashQuery;
  private timer?: NodeJS.Timeout;

  constructor(@Inject(DB) private readonly db: Db) {
    this.insert = db.prepare(
      `insert into usage (tool, query, passage_ids, hits, duration_ms, keyword_only, embedding_tokens)
       values (@tool, @query, @passageIds, @hits, @durationMs, @keywordOnly, @embeddingTokens)`,
    );
    this.expired = db.prepare<[number], { id: number; query: string }>(
      'select id, query from usage where at < ? and query is not null',
    );
    this.hashQuery = db.prepare<[string, number]>(
      'update usage set query = null, query_hash = ? where id = ?',
    );
  }

  onApplicationBootstrap() {
    this.purge();
    this.timer = setInterval(() => this.purge(), DAY_MS).unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  /** Runs a tool handler and logs one row, filled in by the handler, even when it throws. */
  async track<T>(tool: string, handler: (row: UsageRow) => Promise<T>): Promise<T> {
    const row: UsageRow = {};
    const start = performance.now();
    try {
      return await handler(row);
    } finally {
      this.insert.run({
        tool,
        query: row.query ?? null,
        passageIds: row.passageIds ? JSON.stringify(row.passageIds) : null,
        hits: row.hits ?? null,
        durationMs: Math.round(performance.now() - start),
        keywordOnly: row.keywordOnly === undefined ? null : Number(row.keywordOnly),
        embeddingTokens: row.embeddingTokens ?? null,
      });
    }
  }

  /** Replaces queries older than 30 days with their SHA-256 hash. Returns how many it hashed. */
  purge(now = Date.now()): number {
    return this.db.transaction(() => {
      const rows = this.expired.all(Math.floor((now - RETENTION_MS) / 1000));
      for (const { id, query } of rows) this.hashQuery.run(sha256(query), id);
      return rows.length;
    })();
  }
}
