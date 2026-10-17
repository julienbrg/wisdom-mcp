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
}

/** Passage blocks per imported work, read back from the positional ids ("analects:123b" is block 123). */
export function importedBlocks(db: Db): Map<string, number> {
  const rows = db.prepare('select work_id, id from passages').all() as {
    work_id: string;
    id: string;
  }[];
  const blocks = new Map<string, number>();
  for (const { work_id, id } of rows) {
    const n = parseInt(id.slice(work_id.length + 1), 10);
    blocks.set(work_id, Math.max(blocks.get(work_id) ?? 0, n + 1));
  }
  return blocks;
}

export function diffCorpus(records: WcwRecord[], works: Work[], imported: Map<string, number>) {
  const known = new Set(works.map((w) => w.id));
  const newWorks: NewWork[] = records
    .filter((r) => !known.has(r.slug))
    .map(({ slug, title, author, translator, tradition }) => ({
      slug,
      title,
      author,
      translator,
      tradition,
    }));

  const bySlug = new Map(records.map((r) => [r.slug, r]));
  const changed: ChangedWork[] = [];
  for (const [work, blocks] of imported) {
    const record = bySlug.get(work);
    const upstream = record ? splitPassages(record.text).length : 0;
    if (upstream !== blocks) changed.push({ work, imported: blocks, upstream });
  }
  return { newWorks, changed };
}
