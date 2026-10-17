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
 * from data/pinyin/<work>.json, by reference unit or else by each source unit it spans, and fails
 * listing every occurrence without a reviewed reading.
 */
export function transcribeOriginals(
  workId: string,
  language: string,
  originals: { refUnit: string; body: string; parts?: { unit: string; body: string }[] }[],
): (string | null)[] {
  if (language !== 'lzh') return originals.map((o) => transcribe(language, o.body));
  const readings = loadReadings(workId);
  const missing: string[] = [];
  const pinyin = (unit: string, body: string) => {
    const r = toPinyin(body, readings[unit]);
    for (const m of r.missing) missing.push(`${workId} ${unit} @${m.pos} ${m.char}`);
    return r.text;
  };
  const out = originals.map((o) =>
    readings[o.refUnit] || !o.parts || o.parts.length < 2
      ? pinyin(o.refUnit, o.body)
      : o.parts.map((p) => pinyin(p.unit, p.body)).join('\n'),
  );
  if (missing.length) {
    throw new Error(
      `${missing.length} polyphones have no reviewed reading in data/pinyin/${workId}.json ` +
        `(run pnpm readings:draft, then review the entries marked todo):\n${missing.join('\n')}`,
    );
  }
  return out;
}
