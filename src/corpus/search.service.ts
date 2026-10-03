import { Inject, Injectable } from '@nestjs/common';
import { DB, type Db } from '../database/database.module.js';
import { EmbeddingsService } from './embeddings.service.js';

export interface Hit {
  id: string;
  author: string;
  title: string;
  ref: string | null;
  snippet: string;
}

export interface SearchResult {
  hits: Hit[];
  degraded: boolean;
}

const CANDIDATES = 50;
const RRF_K = 60;
const PER_WORK = 3;
const RETURNED = 20;
const OPENING_CHARS = 300;

/** Words too common to rank on alone, dropped from the any-term pass. */
export const STOP_WORDS = new Set(
  (
    'a about am an and are as at be been but by can could did do does for from had has have he ' +
    'her his how i if in into is it its me my no not of on or our she should so than that the ' +
    'their them then there these they this those to us was we were what when where which who ' +
    'why will with would you your'
  ).split(' '),
);

@Injectable()
export class SearchService {
  private readonly ftsTop;
  private readonly vecTop;
  private readonly hydrate;

  constructor(
    @Inject(DB) db: Db,
    private readonly embeddings: EmbeddingsService,
  ) {
    // The body counts more than the generated keywords, and only body text goes in snippets.
    this.ftsTop = db.prepare<[string, number], { id: string; snippet: string }>(
      `select p.id, snippet(passages_fts, 0, '', '', '…', 40) as snippet
       from passages_fts
       join passages p on p.rowid = passages_fts.rowid
       join texts t on t.id = p.text_id
       where passages_fts match ? and p.is_apparatus = 0 and t.quotable = 1
       order by bm25(passages_fts, 1.0, 0.4)
       limit ?`,
    );
    this.vecTop = db.prepare<[Buffer, number], { id: string }>(
      `select passage_id as id from passages_vec
       where embedding match ? and k = ?
       order by distance`,
    );
    this.hydrate = db.prepare<
      [string],
      Omit<Hit, 'snippet'> & { work_id: string; opening: string }
    >(
      `select p.id, w.author, w.title, p.ref, p.work_id, substr(p.body, 1, ${OPENING_CHARS}) as opening
       from passages p join works w on w.id = p.work_id
       where p.id = ?`,
    );
  }

  async search(query: string): Promise<SearchResult> {
    const snippets = new Map<string, string>();
    for (const row of this.keywordSearch(query)) snippets.set(row.id, row.snippet);

    let vecIds: string[] = [];
    let degraded = false;
    try {
      const vector = await this.embeddings.embed(query);
      vecIds = this.vecTop.all(Buffer.from(vector.buffer), CANDIDATES).map((r) => r.id);
    } catch {
      degraded = true;
    }

    const perWork = new Map<string, number>();
    const hits: Hit[] = [];
    for (const id of rrf([[...snippets.keys()], vecIds])) {
      const row = this.hydrate.get(id);
      if (!row) continue;
      const n = perWork.get(row.work_id) ?? 0;
      if (n >= PER_WORK) continue;
      perWork.set(row.work_id, n + 1);
      const { author, title, ref, opening } = row;
      const snippet = snippets.get(id) ?? opening + (opening.length < OPENING_CHARS ? '' : '…');
      hits.push({ id, author, title, ref, snippet });
      if (hits.length === RETURNED) break;
    }
    return { hits, degraded };
  }

  /** Every term required first, then any term to fill the list. */
  private keywordSearch(query: string) {
    const and = toFtsQuery(query, 'AND');
    if (!and) return [];
    const rows = this.ftsTop.all(and, CANDIDATES);
    const or = toFtsQuery(query, 'OR', STOP_WORDS) || toFtsQuery(query, 'OR');
    if (rows.length < CANDIDATES && or !== and) {
      const seen = new Set(rows.map((r) => r.id));
      rows.push(...this.ftsTop.all(or, CANDIDATES).filter((r) => !seen.has(r.id)));
    }
    return rows.slice(0, CANDIDATES);
  }
}

/**
 * Keeps quoted phrases as FTS5 phrases and quotes every other term, so punctuation in the
 * query cannot break FTS5 syntax. Bare terms in `skip` are dropped; phrases never are.
 */
export function toFtsQuery(query: string, op: 'AND' | 'OR', skip?: Set<string>): string {
  const parts: string[] = [];
  for (const m of query.matchAll(/"([^"]+)"|(\S+)/g)) {
    const term = (m[1] ?? m[2]).replaceAll('"', '').trim();
    if (m[2] && skip?.has(term.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))) continue;
    if (/[\p{L}\p{N}]/u.test(term)) parts.push(`"${term}"`);
  }
  return parts.join(` ${op} `);
}

/** Reciprocal rank fusion: ids ordered by the sum of 1 / (k + rank) over the lists they appear in. */
export function rrf(lists: string[][], k = RRF_K): string[] {
  const score = new Map<string, number>();
  for (const ids of lists) {
    ids.forEach((id, rank) => score.set(id, (score.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
