import { cached } from '../cache.js';
import type { SourceText } from './source.js';

const URL = 'https://raw.githubusercontent.com/gita/gita/main/data/verse.json';
const PAGE = 'https://github.com/gita/gita/blob/main/data/verse.json';

interface Verse {
  chapter_number: string | number;
  verse_number: string | number;
  text: string;
}

export function verseUnits(verses: Verse[]): Map<string, string> {
  return new Map(
    verses.map((v) => [
      `${+v.chapter_number}.${+v.verse_number}`,
      v.text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join('\n'),
    ]),
  );
}

export async function loadGita(cacheDir: string): Promise<SourceText> {
  const verses = JSON.parse((await cached(cacheDir, 'gita-verse.json', URL)).toString()) as Verse[];
  const units = new Map();
  for (const [v, body] of verseUnits(verses)) units.set(v, { body, url: PAGE });
  return { license: 'Unlicense (gita/gita dataset)', units };
}
