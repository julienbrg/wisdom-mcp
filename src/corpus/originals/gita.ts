import { cached } from '../cache.js';
import type { SourceText } from './source.js';

const URL = 'https://raw.githubusercontent.com/gita/gita/main/data/verse.json';
const PAGE = 'https://github.com/gita/gita/blob/main/data/verse.json';

interface Verse {
  chapter_number: string | number;
  verse_number: string | number;
  text: string;
}

// Arnold's translation has no verse numbers, so a unit is a whole chapter.
export function chaptersOf(verses: Verse[]): Map<string, string> {
  const chapters = new Map<string, { v: number; text: string }[]>();
  for (const verse of verses) {
    const c = `${+verse.chapter_number}`;
    const text = verse.text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
    chapters.set(c, [...(chapters.get(c) ?? []), { v: +verse.verse_number, text }]);
  }
  return new Map(
    [...chapters].map(([c, vs]) => [
      c,
      vs
        .sort((a, b) => a.v - b.v)
        .map((v) => v.text)
        .join('\n\n'),
    ]),
  );
}

export async function loadGita(cacheDir: string): Promise<SourceText> {
  const verses = JSON.parse((await cached(cacheDir, 'gita-verse.json', URL)).toString()) as Verse[];
  const units = new Map();
  for (const [c, body] of chaptersOf(verses)) units.set(c, { body, url: PAGE });
  return { license: 'Unlicense (gita/gita dataset)', units };
}
