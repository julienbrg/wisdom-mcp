import type { Db } from '../database/database.module.js';
import { cached } from './cache.js';

const API_URL = 'https://wisdom.owocki.com/api';

interface GraphConcept {
  slug: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  note: string;
}

interface Concept {
  slug: string;
  name: string;
  original: string | null;
  gloss: string;
  summary: string;
  tradition: string;
  school: string;
  domains: string[];
  key_passages: { slug: string; idx: number; text: string; quote?: string }[];
}

export interface ConceptStats {
  concepts: number;
  passages: number;
  links: number;
}

const json = async <T>(cacheDir: string, name: string, path: string) =>
  JSON.parse((await cached(cacheDir, name, `${API_URL}/${path}`)).toString()) as T;

export async function importConcepts(db: Db, cacheDir: string): Promise<ConceptStats> {
  const graph = await json<{ concepts: GraphConcept[]; edges: GraphEdge[] }>(
    cacheDir,
    'wcw-graph.json',
    'graph',
  );
  // Everything is fetched before the first write, so a network failure leaves the database as it was.
  const concepts: Concept[] = [];
  for (const { slug } of graph.concepts) {
    concepts.push(await json<Concept>(cacheDir, `wcw-concept-${slug}.json`, `concept/${slug}`));
  }

  const insertConcept = db.prepare(
    `insert into concepts (id, name, original, gloss, summary, tradition, school, domains)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPassage = db.prepare(
    `insert into concept_passages (concept_id, position, work_slug, idx, text, quote)
     values (?, ?, ?, ?, ?, ?)`,
  );
  const insertLink = db.prepare(
    'insert or ignore into concept_links (source, target, type, note) values (?, ?, ?, ?)',
  );

  return db.transaction(() => {
    db.exec('delete from concepts');
    let passages = 0;
    for (const c of concepts) {
      insertConcept.run(
        c.slug,
        c.name,
        c.original,
        c.gloss,
        c.summary,
        c.tradition,
        c.school,
        c.domains.join(', '),
      );
      c.key_passages.forEach((p, position) => {
        insertPassage.run(c.slug, position, p.slug, p.idx, p.text, p.quote ?? null);
        passages++;
      });
    }
    let links = 0;
    for (const e of graph.edges)
      links += insertLink.run(e.source, e.target, e.type, e.note).changes;
    return { concepts: concepts.length, passages, links };
  })();
}
