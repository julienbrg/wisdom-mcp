import { wikitext } from '../originals/wikisource.js';
import { fold, type Guangyun } from './guangyun.js';
import type { Readings } from './pinyin.js';
import {
  CARRY,
  fill,
  resolve,
  skchar,
  slotsByBook,
  type Note,
  type ReadingEvent,
  type Unit,
} from './shiwen.js';

// 《列子》 in the 四庫全書 edition, where 殷敬順's 釋文 runs inline with 張湛's notes, after the
// passage it reads: 「居鄭圃{{SK notes|音布…}}」 or 「攓蓬而指{{SK notes|攓音蹇…}}」.
export const SIKU: Record<string, { pages: string[]; bookOf: (refUnit: string) => string }> = {
  liezi: {
    pages: Array.from({ length: 8 }, (_, i) => `列子 (四庫全書本)/卷${i + 1}`),
    bookOf: (refUnit) => refUnit.split('.')[0],
  },
};

const HAN = /\p{Script=Han}/u;
const PHONETIC = /^(?:音\p{Script=Han}|\p{Script=Han}\p{Script=Han}[反切]|如字)/u;

interface SikuNote extends Note {
  /** Where the note falls in the characters of its book. */
  end: number;
}

/** The text of each book (卷), and the notes in it that open with a reading. */
export async function loadSiku(
  cacheDir: string,
  workId: string,
): Promise<{ texts: Map<string, string[]>; notes: SikuNote[] }> {
  const texts = new Map<string, string[]>();
  const notes: SikuNote[] = [];
  for (const [i, page] of SIKU[workId].pages.entries()) {
    let text = (await wikitext(cacheDir, page))
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\{\{SKQS (?:header|footer)[^{}]*\}\}/g, '')
      .replace(/\{\{SK anchor\|([^{}]*)\}\}/g, '$1')
      .replace(/\{\{SKchar2\|\d+\}\}/g, '');
    for (const code of new Set([...text.matchAll(/\{\{SKchar\|(\d+)\}\}/g)].map((m) => m[1]))) {
      text = text.replaceAll(`{{SKchar|${code}}}`, await skchar(cacheDir, code));
    }
    const book = String(i + 1);
    const chars: string[] = [];
    for (const part of text.split(/(\{\{SK notes\|[^{}]*\}\})/)) {
      const m = part.match(/^\{\{SK notes\|([^{}]*)\}\}$/);
      if (!m) {
        chars.push(...[...part].filter((c) => HAN.test(c)));
        continue;
      }
      const note = m[1].replace(/○.*$/, '');
      const prefixed = HAN.test(note[0]) && PHONETIC.test(note.slice(1));
      if (PHONETIC.test(note) || prefixed) {
        // A reading of the last word, or of a character named first within the last few.
        const head = chars.slice(prefixed ? -6 : -2).join('');
        notes.push({ book, head, note, end: chars.length });
      }
    }
    texts.set(book, chars);
  }
  return { texts, notes };
}

/** Pairs of positions, in a and b, of a longest common subsequence of their characters. */
function lcs(a: string[], b: string[]): Map<number, number> {
  const w = b.length + 1;
  const len = new Uint16Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      len[i * w + j] =
        a[i] === b[j]
          ? len[(i + 1) * w + j + 1] + 1
          : Math.max(len[(i + 1) * w + j], len[i * w + j + 1]);
    }
  }
  const pairs = new Map<number, number>();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) pairs.set(i++, j++);
    else if (len[(i + 1) * w + j] >= len[i * w + j + 1]) i++;
    else j++;
  }
  return pairs;
}

/**
 * Draft readings from the 四庫 notes, placed on the text by aligning the two editions character
 * by character. A note is only placed where the words before it align, so that a passage missing
 * from the imported units cannot take another's reading, and its 下同 stops with its passage.
 */
export function draftSiku(
  gy: Guangyun,
  { texts, notes }: Awaited<ReturnType<typeof loadSiku>>,
  units: Unit[],
  bookOf: (refUnit: string) => string,
): { readings: Readings; unmatched: Note[] } {
  const readings: Readings = {};
  const unmatched: Note[] = [];
  const bodies = new Map(units.map((u) => [u.refUnit, [...u.body]]));
  for (const [book, slots] of slotsByBook(units, bookOf)) {
    const pairs = lcs(
      (texts.get(book) ?? []).map(fold),
      slots.map((s) => fold(s.char)),
    );
    const events = new Map<number, ReadingEvent>();
    for (const n of notes.filter((x) => x.book === book)) {
      const head = [...n.head];
      const at = head.map((_, k) => pairs.get(n.end - head.length + k));
      const last = at.at(-1);
      if (last === undefined || at.at(-2) !== last - 1) {
        unmatched.push(n);
        continue;
      }
      // Read on the text's own characters, which may be other forms of the 四庫 ones.
      const own = at.map((slot, k) => (slot === undefined ? head[k] : slots[slot].char));
      const named = own.find((c) => fold(c) === fold(n.note[0]));
      const note = named ? named + n.note.slice(1) : n.note;
      for (const r of resolve(gy, own.join(''), note)) {
        const slot = at[r.index];
        if (slot === undefined) continue;
        events.set(slot, { pinyin: r.pinyin, note: { ...n, note }, carry: CARRY.test(note) });
      }
    }
    fill(readings, slots, events, bodies, '殷敬順釋文', 'unit');
  }
  return { readings, unmatched };
}
