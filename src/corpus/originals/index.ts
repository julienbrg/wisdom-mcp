import type { Work } from '../works.js';
import { loadGita } from './gita.js';
import { gitaVerses } from './gita-verses.js';
import { meditationsChapters } from './meditations.js';
import { loadPerseus } from './perseus.js';
import { loadSefaria } from './sefaria.js';
import type { SourceText } from './source.js';
import { loadSuttaCentral } from './suttacentral.js';
import { loadWikisource } from './wikisource.js';

export interface Original {
  refUnit: string;
  /** The source units the body joins, for a reference unit that spans several. */
  parts: { unit: string; body: string }[];
  body: string;
  sourceUrl: string;
  license: string;
}

export function loadSource(work: Work, cacheDir: string): Promise<SourceText> {
  const id = work.originalOf ?? work.id;
  switch (work.original) {
    case 'wikisource':
      return loadWikisource(id, cacheDir);
    case 'perseus':
      return loadPerseus(id, cacheDir);
    case 'suttacentral':
      return loadSuttaCentral(id, cacheDir);
    case 'sefaria':
      return loadSefaria(id, cacheDir);
    case 'gita':
      return loadGita(cacheDir);
  }
}

// Where the translation divides the text differently from the source edition.
const UNIT_MAPS: Record<string, (unit: string) => string[] | undefined> = {
  // Legge merges Wikisource 5.1–2 and 9.6–7, and numbers the rest one lower.
  analects(unit) {
    const [book, chap] = unit.split('.').map(Number);
    const shift = (from: number) =>
      chap === from ? [chap, chap + 1] : chap > from ? [chap + 1] : [chap];
    if (book === 5) return shift(1).map((c) => `5.${c}`);
    if (book === 9) return shift(6).map((c) => `9.${c}`);
  },
  // Higginson's L and LI each cover two of the 53 Greek chapters.
  enchiridion: (unit) => ({ '50': ['50', '51'], '51': ['52', '53'] })[unit],
  meditations: meditationsChapters,
  'bhagavad-gita': gitaVerses,
  // The KJV's 5:1 is the Hebrew 4:17, so Hebrew chapter 5 runs one verse behind.
  ecclesiastes(unit) {
    const [c, v] = unit.split(':').map(Number);
    if (c === 5) return [v === 1 ? '4:17' : `5:${v - 1}`];
  },
  // The KJV's 41:1-8 are the Hebrew 40:25-32.
  job(unit) {
    const [c, v] = unit.split(':').map(Number);
    if (c === 41) return [v <= 8 ? `40:${v + 24}` : `41:${v - 8}`];
  },
  psalms(unit) {
    const [c, v] = unit.split(':').map(Number);
    // Psalm 13's KJV 5 and 6 are both the Hebrew 6.
    if (c === 13 && v === 6) return ['13:6'];
    const titles = PSALM_TITLES.get(c);
    if (titles) return [`${c}:${v + titles}`];
  },
};

// The Hebrew counts these psalms' titles as their first verse, or first two, and the KJV doesn't
// number them, as in the Copenhagen Alliance's English versification mappings:
// https://github.com/Copenhagen-Alliance/versification-specification
const PSALM_TITLES = new Map([
  ...[51, 52, 54, 60].map((c) => [c, 2] as const),
  ...[
    3, 4, 5, 6, 7, 8, 9, 12, 13, 18, 19, 20, 21, 22, 30, 31, 34, 36, 38, 39, 40, 41, 42, 44, 45, 46,
    47, 48, 49, 53, 55, 56, 57, 58, 59, 61, 62, 63, 64, 65, 67, 68, 69, 70, 75, 76, 77, 80, 81, 83,
    84, 85, 88, 89, 92, 102, 108, 140, 142,
  ].map((c) => [c, 1] as const),
]);

export function sourceUnits(workId: string, refUnit: string): string[] {
  const mapped = UNIT_MAPS[workId]?.(refUnit);
  if (mapped) return mapped;
  const range = refUnit.match(/^(.*?)(\d+)-(\d+)$/);
  if (!range) return [refUnit];
  const [, prefix, from, to] = range;
  return Array.from({ length: +to - +from + 1 }, (_, i) => `${prefix}${+from + i}`);
}

// "dn31:2.1-3.1" is every paragraph from dn31:2.1 to dn31:3.1, in the source's order. Some
// segment ids have a hyphen of their own ("mn10:26-28.1").
export function paragraphRange(units: ReadonlyMap<string, unknown>, refUnit: string): string[] {
  if (units.has(refUnit)) return [refUnit];
  const keys = [...units.keys()];
  for (let i = refUnit.indexOf('-'); i >= 0; i = refUnit.indexOf('-', i + 1)) {
    const from = refUnit.slice(0, i);
    const a = keys.indexOf(from);
    const b = keys.indexOf(`${from.split(':')[0]}:${refUnit.slice(i + 1)}`);
    if (a >= 0 && b > a) return keys.slice(a, b + 1);
  }
  return [refUnit];
}

// "70d-71b" is every Stephanus section from 70d to 71b, and "70a-c" from 70a to 70c, in the
// source's order: a page may end before its e.
export function stephanusRange(units: ReadonlyMap<string, unknown>, refUnit: string): string[] {
  const m = refUnit.match(/^(\d+)([a-e])-(\d+)?([a-e])$/);
  if (!m) return [refUnit];
  const keys = [...units.keys()];
  const a = keys.indexOf(m[1] + m[2]);
  const b = keys.indexOf((m[3] ?? m[1]) + m[4]);
  return a >= 0 && b > a ? keys.slice(a, b + 1) : [refUnit];
}

export function loadOriginals(work: Work, refUnits: string[], source: SourceText): Original[] {
  return refUnits.map((refUnit) => {
    const units = source.segments
      ? paragraphRange(source.units, refUnit)
      : source.stephanus
        ? stephanusRange(source.units, refUnit)
        : sourceUnits(work.id, refUnit);
    const parts = units.map((unit) => {
      const part = source.units.get(unit);
      if (!part) throw new Error(`${work.id} ${refUnit}: no original for source unit ${unit}`);
      return { unit, ...part };
    });
    return {
      refUnit,
      parts: parts.map(({ unit, body }) => ({ unit, body })),
      body: parts.map((p) => p.body).join('\n'),
      sourceUrl: parts[0].url,
      license: source.license,
    };
  });
}
