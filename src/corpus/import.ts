import type { Db } from '../database/database.module.js';
import { isVerse, normalize } from './normalize.js';
import { loadOriginals, type Original } from './originals/index.js';
import { segment, type Segment } from './references.js';
import { loadWcw, splitPassages } from './wcw.js';
import type { Work } from './works.js';

export interface ImportStats {
  work: string;
  passages: number;
  quotable: number;
  originals: number;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// "analects:123" for a whole corpus passage, "analects:123b" for the second chapter in it.
const passageId = (workId: string, s: Pick<Segment, 'n' | 'part'>) =>
  `${workId}:${s.n}${s.part ? String.fromCharCode(97 + s.part) : ''}`;

export async function importWorks(db: Db, works: Work[], cacheDir: string): Promise<ImportStats[]> {
  const records = await loadWcw(
    cacheDir,
    works.map((w) => w.id),
  );

  // Everything is fetched before the first write, so a network failure leaves the database as it was.
  const prepared: { work: Work; segments: Segment[]; originals: Original[] }[] = [];
  for (const work of works) {
    const segments = segment(work.id, splitPassages(records.get(work.id)!.text));
    const units = [...new Set(segments.flatMap((s) => (s.apparatus ? [] : [s.refUnit!])))];
    prepared.push({ work, segments, originals: await loadOriginals(work, units, cacheDir) });
  }

  const ids = works.map((w) => w.id);
  const placeholders = ids.map(() => '?').join(', ');
  const oldPassages = db.prepare(`select id from passages where work_id in (${placeholders})`);
  const deleteVec = db.prepare('delete from passages_vec where passage_id = ?');
  const deleteWorks = db.prepare(`delete from works where id in (${placeholders})`);
  const insertWork = db.prepare(
    `insert into works (id, author, title, original_title, original_language, tradition)
     values (?, ?, ?, ?, ?, ?)`,
  );
  const insertText = db.prepare(
    `insert into texts (id, work_id, translator, year, language, source_url)
     values (?, ?, ?, ?, 'en', ?)`,
  );
  const insertPassage = db.prepare(
    `insert into passages (id, text_id, work_id, position, ref, ref_unit, raw, body, is_apparatus)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertOriginal = db.prepare(
    `insert into originals (work_id, ref_unit, language, body, source_url, license)
     values (?, ?, ?, ?, ?, ?)`,
  );

  return db.transaction(() => {
    for (const { id } of oldPassages.all(...ids) as { id: string }[]) deleteVec.run(id);
    deleteWorks.run(...ids);

    const stats = prepared.map(({ work, segments, originals }) => {
      const textId = `${work.id}:${slug(work.translator)}`;
      insertWork.run(
        work.id,
        work.author,
        work.title,
        work.originalTitle,
        work.originalLanguage,
        work.tradition,
      );
      insertText.run(textId, work.id, work.translator, work.year, work.source);
      segments.forEach((s, position) =>
        insertPassage.run(
          passageId(work.id, s),
          textId,
          work.id,
          position,
          s.ref,
          s.refUnit,
          s.raw,
          normalize(s.text, isVerse(s.raw)),
          s.apparatus ? 1 : 0,
        ),
      );
      for (const o of originals) {
        insertOriginal.run(
          work.id,
          o.refUnit,
          work.originalLanguage,
          o.body,
          o.sourceUrl,
          o.license,
        );
      }
      return {
        work: work.id,
        passages: segments.length,
        quotable: segments.filter((s) => !s.apparatus).length,
        originals: originals.length,
      };
    });

    db.exec(`insert into passages_fts (passages_fts) values ('rebuild');
             insert into originals_fts (originals_fts) values ('rebuild');`);
    return stats;
  })();
}
