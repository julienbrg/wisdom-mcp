import { Inject, Injectable } from '@nestjs/common';
import { DB, type Db } from '../database/database.module.js';
import { STOP_WORDS } from './search.service.js';

const FTS_CANDIDATES = 50;
const RETURNED = 5;
const MIN_CHARS = 3;

export interface QuoteMatch {
  id: string;
  author: string;
  title: string;
  ref: string;
  text: 'original' | 'translation';
  /** Share of the quote's character trigrams found in the passage, from 0 to 1. */
  score: number;
}

export interface QuoteCheck {
  exact: QuoteMatch[];
  candidates: QuoteMatch[];
}

interface Row {
  id: string | null;
  author: string;
  title: string;
  ref: string;
  body: string;
}

export class QuoteError extends Error {}

/** Lowercased, without section markers, whitespace or punctuation; diacritics are kept. */
export function canonical(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\(\d+(?:\.\d+)*\)/g, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{Z}\s]/gu, '');
}

function trigrams(text: string): Set<string> {
  const chars = [...text];
  const set = new Set<string>();
  for (let i = 0; i + 3 <= chars.length; i++) set.add(chars.slice(i, i + 3).join(''));
  return set;
}

const phrase = (s: string) => `"${s.replace(/"/g, '""')}"`;

@Injectable()
export class QuotesService {
  private readonly originals;
  private readonly translations;
  private readonly works;

  constructor(@Inject(DB) db: Db) {
    this.originals = db.prepare<{ match: string; work: string | null; limit: number }, Row>(
      `select (select p.id from passages p join texts t on t.id = p.text_id
               where p.work_id = o.work_id and p.ref_unit = o.ref_unit
                 and p.is_apparatus = 0 and t.quotable = 1
               order by p.position limit 1) as id,
              w.author, w.title, o.ref_unit as ref, o.body
       from originals_fts
       join originals o on o.id = originals_fts.rowid
       join works w on w.id = o.work_id
       where originals_fts match @match and (@work is null or o.work_id = @work)
       order by rank
       limit @limit`,
    );
    this.translations = db.prepare<{ match: string; work: string | null; limit: number }, Row>(
      `select p.id, w.author, w.title, coalesce(p.ref, p.ref_unit) as ref, p.body
       from passages_fts
       join passages p on p.rowid = passages_fts.rowid
       join texts t on t.id = p.text_id
       join works w on w.id = p.work_id
       where passages_fts match @match and (@work is null or p.work_id = @work)
         and p.is_apparatus = 0 and t.quotable = 1 and p.ref_unit is not null
       order by bm25(passages_fts, 1.0, 0.0)
       limit @limit`,
    );
    this.works = db.prepare<
      [],
      { id: string; author: string; title: string; original_title: string | null }
    >('select id, author, title, original_title from works order by id');
  }

  check(quote: string, work?: string): QuoteCheck {
    const q = canonical(quote);
    if ([...q].length < MIN_CHARS) {
      throw new QuoteError(`The quote needs at least ${MIN_CHARS} letters to check.`);
    }
    const workId = work ? this.resolveWork(work) : null;
    const grams = trigrams(q);

    const matches: QuoteMatch[] = [];
    const seen = new Set<string>();
    const add = (rows: Row[], text: QuoteMatch['text']) => {
      for (const r of rows) {
        if (!r.id || seen.has(`${text}\0${r.id}`)) continue;
        seen.add(`${text}\0${r.id}`);
        const body = canonical(r.body);
        let found = 0;
        for (const g of grams) if (body.includes(g)) found++;
        const score = body.includes(q) ? 1 : found / grams.size;
        matches.push({ id: r.id, author: r.author, title: r.title, ref: r.ref, text, score });
      }
    };

    // Trigrams within each run of letters, so an altered word still finds its neighbours.
    const runs = quote.normalize('NFKC').split(/[\p{P}\p{S}\p{Z}\s]+/u);
    const segments = new Set(runs.flatMap((r) => [...trigrams(r)]));
    if (segments.size) {
      add(
        this.originals.all({
          match: [...segments].map(phrase).join(' OR '),
          work: workId,
          limit: FTS_CANDIDATES,
        }),
        'original',
      );
    }

    const words = (quote.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
      (w) => w.length > 1 && !STOP_WORDS.has(w),
    );
    if (words.length) {
      add(
        this.translations.all({
          match: `body : (${[...new Set(words)].map(phrase).join(' OR ')})`,
          work: workId,
          limit: FTS_CANDIDATES,
        }),
        'translation',
      );
    }

    const exact = matches.filter((m) => m.score === 1).slice(0, RETURNED);
    if (exact.length) return { exact, candidates: [] };
    const candidates = matches
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, RETURNED);
    return { exact, candidates };
  }

  /** Accepts a work id, or part of its title, original title or author. */
  private resolveWork(work: string): string {
    const all = this.works.all();
    const needle = work.trim().toLowerCase();
    const byId = all.find((w) => w.id === needle);
    if (byId) return byId.id;
    const found = all.filter((w) =>
      [w.title, w.original_title, w.author].some((f) => f?.toLowerCase().includes(needle)),
    );
    if (found.length === 1) return found[0].id;
    const ids = (found.length ? found : all).map((w) => w.id).join(', ');
    throw new QuoteError(
      found.length
        ? `"${work}" matches several works: ${ids}. Pass one of these ids.`
        : `No work matches "${work}". Known works: ${ids}.`,
    );
  }
}
