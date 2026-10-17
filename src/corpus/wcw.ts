import { gunzipSync } from 'node:zlib';
import { cached, download } from './cache.js';

const WCW_URL = 'https://wisdom.owocki.com/downloads/wisdom-corpus.jsonl.gz';

export interface WcwRecord {
  slug: string;
  title: string;
  author: string;
  translator: string | null;
  tradition: string;
  kind: string;
  text: string;
}

export async function loadWcw(
  cacheDir: string,
  slugs: string[],
  refresh = false,
): Promise<Map<string, WcwRecord>> {
  const jsonl = gunzipSync(
    await cached(cacheDir, 'wisdom-corpus.jsonl.gz', WCW_URL, refresh),
  ).toString();
  const records = new Map<string, WcwRecord>();
  for (const record of parseWcw(jsonl)) {
    if (slugs.includes(record.slug)) records.set(record.slug, record);
  }
  const missing = slugs.filter((s) => !records.has(s));
  if (missing.length)
    throw new Error(`missing from the Wisdom Context Window: ${missing.join(', ')}`);
  return records;
}

/** The latest dump, downloaded without touching the cached copy the import uses. */
export async function fetchWcw(): Promise<WcwRecord[]> {
  return parseWcw(gunzipSync(await download(WCW_URL)).toString());
}

function parseWcw(jsonl: string): WcwRecord[] {
  return jsonl
    .split('\n')
    .filter((line) => line)
    .map((line) => JSON.parse(line) as WcwRecord);
}

// Same split as the Wisdom Context Window API, so block i is its passage i.
export function splitPassages(text: string): string[] {
  return text.split(/\n\s*\n/).filter((block) => block.trim());
}
