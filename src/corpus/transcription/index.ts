import { romanizeGreek } from './greek.js';
import { romanizeHebrew } from './hebrew.js';
import { loadReadings, toPinyin } from './pinyin.js';
import { romanizeSanskrit } from './sanskrit.js';

const SCHEMES: Record<string, (text: string) => string> = {
  grc: romanizeGreek,
  hbo: romanizeHebrew,
  san: romanizeSanskrit,
};

/** A pronunciation aid for an original in a non-Latin script, or null when it needs none. */
export function transcribe(language: string, text: string): string | null {
  return SCHEMES[language]?.(text) ?? null;
}

/**
 * The transcription of each original of a work. Classical Chinese takes its polyphone readings
 * from data/pinyin/<work>.json, and fails listing every occurrence without a reviewed reading.
 */
export function transcribeOriginals(
  workId: string,
  language: string,
  originals: { refUnit: string; body: string }[],
): (string | null)[] {
  if (language !== 'lzh') return originals.map((o) => transcribe(language, o.body));
  const readings = loadReadings(workId);
  const missing: string[] = [];
  const out = originals.map((o) => {
    const r = toPinyin(o.body, readings[o.refUnit]);
    for (const m of r.missing) missing.push(`${workId} ${o.refUnit} @${m.pos} ${m.char}`);
    return r.text;
  });
  if (missing.length) {
    throw new Error(
      `${missing.length} polyphones have no reviewed reading in data/pinyin/${workId}.json ` +
        `(run pnpm readings:draft, then review the entries marked todo):\n${missing.join('\n')}`,
    );
  }
  return out;
}
