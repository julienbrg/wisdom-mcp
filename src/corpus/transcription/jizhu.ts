import { cached } from '../cache.js';
import { candidates, fold, toneOf, type Guangyun } from './guangyun.js';
import type { Readings } from './pinyin.js';
import { ruzi, slotsByBook, type Unit } from './shiwen.js';

// 朱熹《論語集注》 on Chinese Wikisource, used to cross-check the readings drawn from 釋文.
const API =
  'https://zh.wikisource.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&page=';
const VOLUMES = '一二三四五六七八九十'.split('').map((n) => `四書章句集註/論語集注卷${n}`);

const HAN = /\p{Script=Han}/u;
const plain = (s: string) =>
  [...s]
    .filter((c) => HAN.test(c))
    .map(fold)
    .join('');

interface Clause {
  book: string;
  /** The text the note follows, since the previous note. */
  segment: string;
  clause: string;
}

export async function loadJizhu(cacheDir: string): Promise<Clause[]> {
  const out: Clause[] = [];
  let book = 0;
  for (const [i, page] of VOLUMES.entries()) {
    const json = JSON.parse(
      (await cached(cacheDir, `jizhu-${i + 1}.json`, API + encodeURIComponent(page))).toString(),
    );
    const text = (json.parse.wikitext as string).replace(/\{\{ProperNoun\|([^{}]*)\}\}/g, '$1');
    for (const section of text.split(/^==([^=]+)==$/m).slice(1)) {
      if (/第/.test(section) && !section.includes('\n')) {
        book++;
        continue;
      }
      let segment = '';
      for (const part of section.split(/(\{\{annotate\|[^{}]*\}\})/)) {
        const m = part.match(/^\{\{annotate\|([^{}]*)\}\}$/);
        if (!m) {
          segment += part;
          continue;
        }
        const phonetic = m[1].split('◯')[0];
        for (const clause of phonetic.split('。')) {
          if (/[平上去入]聲|音.|..反|、.同|如字/.test(clause)) {
            out.push({ book: String(book), segment: plain(segment), clause: clause.trim() });
          }
        }
        segment = '';
      }
    }
  }
  return out;
}

/** The readings a clause allows for each character it names, by its position in the segment. */
function allowed(gy: Guangyun, clause: string, segment: string): Map<number, string[]> {
  const out = new Map<number, string[]>();
  const [subjects, ...rest] = clause.split('，');
  const rule = rest.join('，');
  if (!rule) return out;

  const positions = (subject: string) => {
    // 「行寡之行」: the 行 of 行寡.
    const of = subject.match(/^(\p{Script=Han}+)之(\p{Script=Han})$/u);
    const phrase = of ? plain(of[1]) : plain(subject);
    const char = of ? fold(of[2]) : phrase;
    if (char.length !== 1) return [];
    const at: number[] = [];
    for (let i = segment.indexOf(phrase); i >= 0; i = segment.indexOf(phrase, i + 1)) {
      at.push(i + phrase.indexOf(char));
    }
    return at;
  };

  const read = (c: string, rule = rest.join('，')): string[] => {
    const tone = rule.match(/^(?:皆|並)?([平上去入])聲/);
    if (tone) {
      const t = '平上去入'.indexOf(tone[1]) + 1;
      const byClass = candidates(c).filter((p) => gy.tonesOf(c, p).includes(t));
      if (byClass.length) return byClass;
      const mandarin = { 1: [1, 2], 2: [3], 3: [4], 4: [1, 2, 3, 4] }[t]!;
      return candidates(c).filter((p) => mandarin.includes(toneOf(p)));
    }
    const homophone = rule.match(/^音(\p{Script=Han})/u);
    if (homophone) return [gy.pinyin(c, gy.homophone(c, homophone[1]), homophone[1]) ?? ''];
    const fanqie = rule.match(/^(\p{Script=Han})(\p{Script=Han})反/u);
    if (fanqie) return [gy.pinyin(c, gy.fanqie(fanqie[1], fanqie[2]), fanqie[2]) ?? ''];
    if (rule.startsWith('如字')) return [ruzi(c) ?? ''];
    return [];
  };

  // 「說、悅同」: the first reads as the second.
  const same = clause.match(/^(\p{Script=Han})、(\p{Script=Han})同$/u);
  if (same) {
    const p = gy.pinyin(same[1], gy.homophone(same[1], same[2]), same[2]);
    for (const at of positions(same[1])) out.set(at, p ? [p] : []);
    return out;
  }
  // 「樂，上二字並五教反，下一字音洛」: the occurrences in order, split between two readings.
  const split = rule.match(/^上(.)字並?(.+?)，下.字(.+)$/u);
  if (split) {
    const at = positions(subjects);
    const first = '一二三四五'.indexOf(split[1]) + 1;
    at.forEach((a, i) => {
      const ok = read(segment[a], i < first ? split[2] : split[3]).filter(Boolean);
      if (ok.length) out.set(a, ok);
    });
    return out;
  }
  for (const subject of subjects.split('、')) {
    const at = positions(subject);
    if (!at.length) continue;
    const c = segment[at[0]];
    const ok = read(c).filter(Boolean);
    if (ok.length) for (const a of at) out.set(a, ok);
  }
  return out;
}

/** Marks each reading 集注 confirms, and sends each one it contradicts to review. */
export function crossCheck(
  gy: Guangyun,
  clauses: Clause[],
  readings: Readings,
  units: Unit[],
  bookOf: (refUnit: string) => string,
): void {
  const entries = new Map(
    Object.entries(readings).flatMap(([ref, list]) => list.map((e) => [`${ref}\0${e.pos}`, e])),
  );
  for (const [book, slots] of slotsByBook(units, bookOf)) {
    const text = slots.map((s) => fold(s.char)).join('');
    let cursor = 0;
    for (const c of clauses.filter((x) => x.book === book)) {
      const at = c.segment ? text.indexOf(c.segment, cursor) : -1;
      if (at < 0) continue;
      cursor = at;
      for (const [offset, ok] of allowed(gy, c.clause, c.segment)) {
        const slot = slots[at + offset];
        const entry = slot && entries.get(`${slot.refUnit}\0${slot.pos}`);
        if (!entry || entry.reviewed) continue;
        if (ok.includes(entry.pinyin)) entry.check = `朱熹集注: ${c.clause}`;
        else {
          entry.todo = `經典釋文 ${entry.pinyin || '?'} (${entry.note}), 朱熹集注 ${ok.join('/')} (${c.clause})`;
        }
      }
    }
  }
}
