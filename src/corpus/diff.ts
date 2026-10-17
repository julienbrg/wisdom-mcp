import type { Db } from '../database/database.module.js';
import { splitPassages, type WcwRecord } from './wcw.js';
import type { Work } from './works.js';

interface NewWork {
  slug: string;
  title: string;
  author: string;
  translator: string | null;
  tradition: string;
}

interface ChangedWork {
  work: string;
  imported: number;
  upstream: number;
  edited: number;
}

interface ImportedPassage {
  block: number;
  raw: string;
}

/** Each imported passage with its block, read back from the positional id ("analects:123b" is in block 123). */
export function importedPassages(db: Db): Map<string, ImportedPassage[]> {
  const rows = db.prepare('select work_id, id, raw from passages').all() as {
    work_id: string;
    id: string;
    raw: string;
  }[];
  const passages = new Map<string, ImportedPassage[]>();
  for (const { work_id, id, raw } of rows) {
    const block = parseInt(id.slice(work_id.length + 1), 10);
    passages.set(work_id, [...(passages.get(work_id) ?? []), { block, raw }]);
  }
  return passages;
}

/**
 * Full texts on the site that aren't pilot works yet, and imported works a re-import would change:
 * a different number of blocks, or passages no longer found in the block their id points to.
 */
export function diffCorpus(
  records: WcwRecord[],
  works: Work[],
  imported: Map<string, ImportedPassage[]>,
) {
  const known = new Set(works.map((w) => w.id));
  const newWorks: NewWork[] = records
    .filter((r) => r.kind === 'full-text' && !known.has(r.slug))
    .map(({ slug, title, author, translator, tradition }) => ({
      slug,
      title,
      author,
      translator,
      tradition,
    }));

  const bySlug = new Map(records.map((r) => [r.slug, r]));
  const changed: ChangedWork[] = [];
  for (const [work, passages] of imported) {
    const record = bySlug.get(work);
    const blocks = record ? splitPassages(record.text) : [];
    const count = Math.max(...passages.map((p) => p.block)) + 1;
    const edited = passages.filter((p) => !blocks[p.block]?.includes(p.raw)).length;
    if (count !== blocks.length || edited) {
      changed.push({ work, imported: count, upstream: blocks.length, edited });
    }
  }
  return { newWorks, changed };
}
