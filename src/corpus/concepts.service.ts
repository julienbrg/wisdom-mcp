import { Inject, Injectable } from '@nestjs/common';
import { DB, type Db } from '../database/database.module.js';
import { cutWords } from './passages.service.js';

const SNIPPET_WORDS = 40;
const WORDS_BEFORE_QUOTE = 8;

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

// Builds the snippet around the phrase that makes the passage key, so a long passage still shows
// it; when the phrase isn't in the text, the snippet is the passage opening.
export function keySnippet(text: string, quote: string | null) {
  const body = squash(text);
  const at = quote ? body.indexOf(squash(quote)) : -1;
  const starts = [...body.matchAll(/\S+/g)].map((m) => m.index);
  const first = at < 0 ? 0 : Math.max(0, starts.filter((i) => i <= at).length - 1);
  const start = Math.max(0, first - WORDS_BEFORE_QUOTE);
  const cut = cutWords(body.slice(starts[start] ?? 0), SNIPPET_WORDS);
  return (start > 0 ? '… ' : '') + cut.text + (cut.cut ? ' …' : '');
}

export interface ConceptSummary {
  id: string;
  name: string;
  original: string | null;
  gloss: string;
  tradition: string;
  school: string;
}

export interface KeyPassage {
  work: string;
  id: string | null;
  author: string | null;
  title: string | null;
  ref: string | null;
  snippet: string;
}

export interface ConceptLink {
  type: 'parallel' | 'tension' | 'related' | 'broader' | 'narrower';
  id: string;
  name: string;
  note: string;
}

export interface Concept extends ConceptSummary {
  summary: string;
  domains: string[];
  passages: KeyPassage[];
  links: ConceptLink[];
}

interface LinkRow {
  source: string;
  target: string;
  type: ConceptLink['type'];
  note: string;
  name: string;
}

@Injectable()
export class ConceptsService {
  private readonly all;
  private readonly filtered;
  private readonly concept;
  private readonly passages;
  private readonly links;

  constructor(@Inject(DB) db: Db) {
    const summary = 'select id, name, original, gloss, tradition, school from concepts';
    this.all = db.prepare<[], ConceptSummary>(`${summary} order by id`);
    this.filtered = db.prepare<[string], ConceptSummary>(
      `${summary} where instr(lower(id || ' ' || name || ' ' || coalesce(original, '') || ' ' ||
         gloss || ' ' || tradition || ' ' || school || ' ' || domains), lower(?)) > 0
       order by id`,
    );
    this.concept = db.prepare<[string], ConceptSummary & { summary: string; domains: string }>(
      `select id, name, original, gloss, summary, tradition, school, domains
       from concepts where id = ?`,
    );
    this.passages = db.prepare<
      [string],
      {
        work_slug: string;
        text: string;
        quote: string | null;
        id: string | null;
        author: string | null;
        title: string | null;
        ref: string | null;
      }
    >(
      `select cp.work_slug, cp.text, cp.quote, p.id, w.author, w.title, p.ref
       from concept_passages cp
       left join passages p on p.id = cp.work_slug || ':' || cp.idx and p.is_apparatus = 0
         and p.ref_unit is not null
       left join works w on w.id = p.work_id
       where cp.concept_id = ? order by cp.position`,
    );
    this.links = db.prepare<[{ id: string }], LinkRow>(
      `select l.source, l.target, l.type, l.note, c.name from concept_links l
       join concepts c on c.id = iif(l.source = @id, l.target, l.source)
       where l.source = @id or l.target = @id
       order by l.type, c.id`,
    );
  }

  list(filter?: string): ConceptSummary[] {
    return filter?.trim() ? this.filtered.all(filter.trim()) : this.all.all();
  }

  get(id: string): Concept | null {
    const row = this.concept.get(id);
    if (!row) return null;
    return {
      ...row,
      domains: row.domains ? row.domains.split(', ') : [],
      passages: this.passages.all(id).map((p) => ({
        work: p.work_slug,
        id: p.id,
        author: p.author,
        title: p.title,
        ref: p.ref,
        snippet: keySnippet(p.text, p.quote),
      })),
      links: this.links.all({ id }).map((l) => {
        const other = l.source === id ? l.target : l.source;
        const type = l.type === 'broader' && l.target === id ? 'narrower' : l.type;
        return { type, id: other, name: l.name, note: l.note };
      }),
    };
  }
}
