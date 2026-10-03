import type { Work } from '../works.js';
import { loadGita } from './gita.js';
import { meditationsChapters } from './meditations.js';
import { loadPerseus } from './perseus.js';
import { loadSefaria } from './sefaria.js';
import type { SourceText } from './source.js';
import { loadSuttaCentral } from './suttacentral.js';
import { loadWikisource } from './wikisource.js';

export interface Original {
  refUnit: string;
  body: string;
  sourceUrl: string;
  license: string;
}

function load(work: Work, cacheDir: string): Promise<SourceText> {
  switch (work.original) {
    case 'wikisource':
      return loadWikisource(work.id, cacheDir);
    case 'perseus':
      return loadPerseus(work.id, cacheDir);
    case 'suttacentral':
      return loadSuttaCentral(cacheDir);
    case 'sefaria':
      return loadSefaria(cacheDir);
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
  // The KJV's 5:1 is the Hebrew 4:17, so Hebrew chapter 5 runs one verse behind.
  ecclesiastes(unit) {
    const [c, v] = unit.split(':').map(Number);
    if (c === 5) return [v === 1 ? '4:17' : `5:${v - 1}`];
  },
};

export function sourceUnits(workId: string, refUnit: string): string[] {
  const mapped = UNIT_MAPS[workId]?.(refUnit);
  if (mapped) return mapped;
  const range = refUnit.match(/^(\d+)-(\d+)$/);
  if (!range) return [refUnit];
  return Array.from({ length: +range[2] - +range[1] + 1 }, (_, i) => `${+range[1] + i}`);
}

export async function loadOriginals(
  work: Work,
  refUnits: string[],
  cacheDir: string,
): Promise<Original[]> {
  const source = await load(work, cacheDir);
  return refUnits.map((refUnit) => {
    const parts = sourceUnits(work.id, refUnit).map((u) => {
      const part = source.units.get(u);
      if (!part) throw new Error(`${work.id} ${refUnit}: no original for source unit ${u}`);
      return part;
    });
    return {
      refUnit,
      body: parts.map((p) => p.body).join('\n'),
      sourceUrl: parts[0].url,
      license: source.license,
    };
  });
}
