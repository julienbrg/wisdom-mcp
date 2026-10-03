import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '../database/database.module.js';
import { generateKeywords, type PassageText } from './keywords.js';
import type { MistralService } from './mistral.service.js';

export interface IndexStats {
  passages: number;
  keywords: number;
  embeddings: number;
}

export interface Generators {
  keywordsModel: string;
  embeddingModel: string;
  keywords: (passages: PassageText[]) => Promise<Map<string, string>>;
  embed: (texts: string[]) => Promise<Float32Array[]>;
}

const KEYWORD_BATCH = 20;
const EMBED_BATCH = 32;
const EMBED_BATCH_CHARS = 40_000;

export const mistralGenerators = (mistral: MistralService): Generators => ({
  keywordsModel: mistral.keywordsModel,
  embeddingModel: mistral.embeddingModel,
  keywords: (passages) => generateKeywords(mistral, passages),
  embed: (texts) => mistral.embed(texts, { attempts: 5 }),
});

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Generates keywords and embeddings for quotable passages and rebuilds both search indexes.
 * Results are cached by passage body, so rerunning after an import costs no API calls.
 */
export async function buildIndexes(
  db: Db,
  cacheDir: string,
  generators: Generators,
): Promise<IndexStats> {
  const passages = db
    .prepare(
      `select p.id, p.body from passages p join texts t on t.id = p.text_id
       where p.is_apparatus = 0 and t.quotable = 1 order by p.work_id, p.position`,
    )
    .all() as PassageText[];

  const keywords = new JsonCache<string>(
    join(cacheDir, `keywords-${generators.keywordsModel}.json`),
  );
  const missingKeywords = passages.filter((p) => !keywords.has(hash(p.body)));
  for (let i = 0; i < missingKeywords.length; i += KEYWORD_BATCH) {
    const batch = missingKeywords.slice(i, i + KEYWORD_BATCH);
    const lines = await generators.keywords(batch);
    for (const p of batch) if (lines.has(p.id)) keywords.set(hash(p.body), lines.get(p.id)!);
    keywords.save();
  }

  const vectors = new JsonCache<string>(
    join(cacheDir, `embeddings-${generators.embeddingModel}.json`),
  );
  const missingVectors = passages.filter((p) => !vectors.has(hash(p.body)));
  for (const batch of embedBatches(missingVectors)) {
    const out = await generators.embed(batch.map((p) => p.body));
    batch.forEach((p, i) =>
      vectors.set(hash(p.body), Buffer.from(out[i].buffer).toString('base64')),
    );
    vectors.save();
  }

  const setKeywords = db.prepare('update passages set keywords = ? where id = ?');
  const insertVec = db.prepare('insert into passages_vec (passage_id, embedding) values (?, ?)');
  return db.transaction(() => {
    db.exec(`update passages set keywords = ''; delete from passages_vec;`);
    let withKeywords = 0;
    let withVectors = 0;
    for (const p of passages) {
      const line = keywords.get(hash(p.body));
      if (line) {
        setKeywords.run(line, p.id);
        withKeywords++;
      }
      const vector = vectors.get(hash(p.body));
      if (vector) {
        insertVec.run(p.id, Buffer.from(vector, 'base64'));
        withVectors++;
      }
    }
    db.exec(`insert into passages_fts (passages_fts) values ('rebuild')`);
    return { passages: passages.length, keywords: withKeywords, embeddings: withVectors };
  })();
}

function* embedBatches(passages: PassageText[]) {
  let batch: PassageText[] = [];
  let chars = 0;
  for (const p of passages) {
    if (
      batch.length &&
      (batch.length === EMBED_BATCH || chars + p.body.length > EMBED_BATCH_CHARS)
    ) {
      yield batch;
      batch = [];
      chars = 0;
    }
    batch.push(p);
    chars += p.body.length;
  }
  if (batch.length) yield batch;
}

class JsonCache<T> {
  private readonly data: Record<string, T>;

  constructor(private readonly path: string) {
    this.data = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : {};
  }

  has(key: string) {
    return key in this.data;
  }

  get(key: string): T | undefined {
    return this.data[key];
  }

  set(key: string, value: T) {
    this.data[key] = value;
  }

  save() {
    mkdirSync(join(this.path, '..'), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.data));
  }
}
