import { existsSync, readFileSync } from 'node:fs';
import { pinyin } from 'pinyin-pro';

const READINGS_DIR = new URL('../../../data/pinyin/', import.meta.url);

// Characters whose classical reading depends on sense (破讀), so each occurrence needs a reading
// from the sources rather than the library's guess from modern usage.
export const POLYPHONES = new Set(
  '說樂為爲好惡知行長見食數間傳重中王先從少予降語衣雨令處喪相將女曾乘度分解遺屬施藏觀和難要' +
    '齊正朝遠告共被量便冠沒費參適弟足衰厭辟鄉期賈莫奇識強勝張稱載畜亡使與父大夫舍',
);

export interface Reading {
  pos: number;
  char: string;
  pinyin: string;
  source: string;
  note: string;
  /** A check against a second source. */
  check?: string;
  /** Why the reading still needs review: the import refuses it until this is gone. */
  todo?: string;
  reviewed?: string;
}

/** Readings by reference unit, from data/pinyin/<work>.json, or none when the work has no file. */
export type Readings = Record<string, Reading[]>;

export const readingsFile = (workId: string) => new URL(`${workId}.json`, READINGS_DIR);

export function loadReadings(workId: string): Readings {
  const file = readingsFile(workId);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf-8')) as Readings) : {};
}

const PUNCTUATION: Record<string, string> = {
  '，': ',',
  '、': ',',
  '﹑': ',',
  ',': ',',
  '。': '.',
  '！': '!',
  '﹗': '!',
  '？': '?',
  '：': ':',
  '﹕': ':',
  '；': ';',
  '「': '“',
  '」': '”',
  '『': '‘',
  '』': '’',
  '《': '“',
  '》': '”',
  '（': '(',
  '）': ')',
};
const OPENING = new Set(['“', '‘', '(']);

export interface PinyinResult {
  text: string;
  /** Positions of polyphones with no reading. */
  missing: { pos: number; char: string }[];
}

export function toPinyin(text: string, readings: Reading[] = []): PinyinResult {
  const chars = [...text];
  const byPos = new Map(readings.map((r) => [r.pos, r]));
  for (const r of readings) {
    if (chars[r.pos] !== r.char)
      throw new Error(`reading at ${r.pos} is for ${r.char}, but the text has ${chars[r.pos]}`);
  }

  const base = pinyin(text, { type: 'all', toneSandhi: false });
  if (base.length !== chars.length) throw new Error('pinyin-pro split the text unexpectedly');
  const missing: PinyinResult['missing'] = [];
  let out = '';
  let open = true;
  base.forEach((b, pos) => {
    const c = chars[pos];
    if (b.isZh) {
      const found = byPos.get(pos);
      const reading = found?.todo ? undefined : found;
      if (!reading && POLYPHONES.has(c)) missing.push({ pos, char: c });
      out += (open ? '' : ' ') + (reading?.pinyin ?? b.pinyin);
      open = false;
    } else if (c === '\n') {
      out = out.trimEnd() + '\n';
      open = true;
    } else {
      const p = PUNCTUATION[c] ?? c.trim();
      if (!p) return;
      if (OPENING.has(p)) {
        out += (open ? '' : ' ') + p;
        open = true;
      } else out += p;
    }
  });
  return { text: out, missing };
}
