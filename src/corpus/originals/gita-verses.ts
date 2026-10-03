// The verses each of Arnold's passages renders, one entry per passage, chapter by chapter.
// Aligned with embeddings against per-verse English translations from the gita/gita dataset,
// keeping verse order, then checked by hand. Neighbours share a verse where Arnold splits it,
// and the verses he omits as interpolations are left out, or given to the dotted line that
// stands in for them.
const PASSAGES: Record<string, string> = {
  1: `
    1 2-11 12-19 20-23 24-28 28-35 35-46 47
  `,
  2: `
    1 2-3 4 5-8 9-10 11-20 21 22 23-28 29 30-38 39-48 49-53 54 55-66 67-69 70 70 71-72
  `,
  3: `
    1-2 3 4-12 13-35 36 37-43
  `,
  4: `
    1-3 4 5-15 16-31 32-42
  `,
  5: `
    1 2 3-18 19-26 27-29
  `,
  6: `
    1 2-4 5-6 7-9 10-15 16-17 18-23 24-32 33-34 35-36 37-39 40-47
  `,
  7: `
    1-2 3 4 5-14 15 16 17-19 20-26 27-28 29-30
  `,
  8: `
    1-2 3-6 7-8 9 9 10 10-11 12-13 14-15 16-22 23-27 28
  `,
  9: `
    1-2 3 4 5 6 7 8 9 10 11-19 20 20-21 21 22 23-28 29 30-34
  `,
  10: `
    1-11 12-18 19-42
  `,
  11: `
    1-4 5-7 8 9-12 13 14 15 15-16 17 17-18 18-19 19 20 20-21 21 22 22-23 23 24 24-25 25
    26-27 27-28 28 29 30 30-31 31 32-34 35 36 36-37 37-38 38-39 39 39-40 40 40-41 41-42
    42-43 43 44 44-45 45-46 46 47-49 50 51 52-55
  `,
  12: `
    1 2-4 5-12 13-20
  `,
  13: `
    1 2-4 5 6-7 8-12 13-18 19 20-22 23 24-26 27-31 32-35
  `,
  14: `
    1-2 3-4 5-13 14-15 16-18 19 20 21 22-25 26 27
  `,
  15: `
    1 2 2-3 3 3-4 4-5 5 6 7-9 10-11 12-15 16 17-18 19 20
  `,
  16: `
    1-3 4 5 6 7-11 12-20 21-22 23-24
  `,
  17: `
    1 2 3-10 11-13 14 15 16 17 18 19 20 21 22
  `,
  18: `
    1 2 3-4 5 6 7-11 12 13-17 18-19 20-22 23-25 26-28 29 30-32 33-35 36 37-39 40 41
    42-44 45-46 47-49 50 51-62 63 64-65 66 67-71 72 73 74-78
  `,
};

// "64-65" for the 26th passage of chapter 18.
export function gitaRange(chapter: number, passage: number): string {
  const entry = PASSAGES[chapter]?.trim().split(/\s+/)[passage - 1];
  if (!entry) throw new Error(`bhagavad-gita ${chapter}: no passage ${passage} in Arnold`);
  return entry;
}

export function gitaVerses(unit: string): string[] {
  const [chapter, range] = unit.split('.');
  const [from, to = from] = range.split('-').map(Number);
  return Array.from({ length: to - from + 1 }, (_, i) => `${chapter}.${from + i}`);
}
