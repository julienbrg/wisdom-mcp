import { cached } from '../cache.js';
import { fold, type Guangyun } from './guangyun.js';
import { POLYPHONES, type Reading, type Readings } from './pinyin.js';

// 《經典釋文》 in the 四部叢刊 edition, as transcribed page by page on Chinese Wikisource.
const API = 'https://zh.wikisource.org/w/api.php?format=json&formatversion=2&';
const INDEX = 'Sibu Congkan0061-陸德明-經典釋文-12-10.djvu';

interface Volume {
  pages: [number, number];
  /** The books (篇) in order, as headed in the 音義. */
  books: string[];
  bookOf: (refUnit: string) => string;
  /** The first headword on the text itself, after the notes on the title and preface. */
  start?: string;
}

export const VOLUMES: Record<string, Volume> = {
  analects: {
    pages: [2, 44],
    books: [
      '學而第一',
      '爲政第二',
      '八佾第三',
      '里仁第四',
      '公冶長第五',
      '雍也第六',
      '述而第七',
      '泰伯第八',
      '子罕第九',
      '鄉黨第十',
      '先進第十一',
      '顏淵第十二',
      '子路第十三',
      '憲問第十四',
      '衞靈公第十五',
      '季氏第十六',
      '陽貨第十七',
      '微子第十八',
      '子張第十九',
      '堯曰第二十',
    ],
    bookOf: (refUnit) => refUnit.split('.')[0],
  },
  'tao-te-ching': { pages: [46, 59], books: ['老子'], bookOf: () => '1', start: '徼' },
};

// The usual reading (如字), which 釋文 leaves unannotated.
const RUZI: Record<string, string> = {
  說: 'shuō',
  樂: 'yuè',
  為: 'wéi',
  好: 'hǎo',
  惡: 'è',
  知: 'zhī',
  行: 'xíng',
  長: 'cháng',
  見: 'jiàn',
  食: 'shí',
  數: 'shù',
  間: 'jiān',
  傳: 'chuán',
  重: 'zhòng',
  中: 'zhōng',
  王: 'wáng',
  先: 'xiān',
  從: 'cóng',
  少: 'shǎo',
  予: 'yú',
  降: 'jiàng',
  語: 'yǔ',
  衣: 'yī',
  雨: 'yǔ',
  令: 'lìng',
  處: 'chǔ',
  喪: 'sāng',
  相: 'xiāng',
  將: 'jiāng',
  女: 'nǚ',
  曾: 'zēng',
  乘: 'chéng',
  度: 'dù',
  分: 'fēn',
  解: 'jiě',
  遺: 'yí',
  屬: 'shǔ',
  施: 'shī',
  藏: 'cáng',
  觀: 'guān',
  和: 'hé',
  難: 'nán',
  要: 'yāo',
  齊: 'qí',
  正: 'zhèng',
  朝: 'cháo',
  遠: 'yuǎn',
  告: 'gào',
  共: 'gòng',
  被: 'bèi',
  量: 'liàng',
  便: 'biàn',
  冠: 'guān',
  沒: 'mò',
  費: 'fèi',
  參: 'cān',
  適: 'shì',
  弟: 'dì',
  足: 'zú',
  衰: 'shuāi',
  厭: 'yàn',
  辟: 'bì',
  鄉: 'xiāng',
  期: 'qī',
  賈: 'gǔ',
  莫: 'mò',
  奇: 'qí',
  識: 'shí',
  強: 'qiáng',
  勝: 'shèng',
  張: 'zhāng',
  稱: 'chēng',
  載: 'zài',
  畜: 'xù',
  亡: 'wáng',
  使: 'shǐ',
  與: 'yǔ',
  父: 'fù',
  大: 'dà',
  夫: 'fū',
  舍: 'shè',
};
export const ruzi = (c: string) => RUZI[fold(c)];

const isPolyphone = (c: string) => POLYPHONES.has(fold(c));
const HAN = /\p{Script=Han}/u;
const han = (s: string) => [...s].filter((c) => HAN.test(c)).join('');

export interface Note {
  book: string;
  head: string;
  note: string;
}

async function page(cacheDir: string, n: number): Promise<string> {
  const url = `${API}action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(`Page:${INDEX}/${n}`)}`;
  const json = JSON.parse((await cached(cacheDir, `shiwen-${n}.json`, url)).toString());
  return json.query.pages[0].revisions[0].slots.main.content as string;
}

async function skchar(cacheDir: string, code: string): Promise<string> {
  const url = `${API}action=expandtemplates&prop=wikitext&text=${encodeURIComponent(`{{SKchar|${code}}}`)}`;
  const json = JSON.parse((await cached(cacheDir, `skchar-${code}.json`, url)).toString());
  const text = json.expandtemplates.wikitext as string;
  return text.match(/alt=([^|\]]+)/)?.[1] ?? text;
}

/** The headwords and notes of one 音義, with the number of the book (篇) each falls under. */
export async function loadNotes(cacheDir: string, workId: string): Promise<Note[]> {
  const { pages, books } = VOLUMES[workId];
  const [from, to] = pages;
  let text = '';
  for (let n = from; n <= to; n++)
    text += (await page(cacheDir, n)).replace(/<noinclude>[\s\S]*?<\/noinclude>/g, '') + '\n';
  for (const code of new Set([...text.matchAll(/\{\{SKchar\|(\d+)\}\}/g)].map((m) => m[1]))) {
    text = text.replaceAll(`{{SKchar|${code}}}`, await skchar(cacheDir, code));
  }

  const titles = new Map(books.map((b, i) => [han(b).split('').map(fold).join(''), String(i + 1)]));
  const notes: Note[] = [];
  let book = books.length === 1 ? '1' : '0';
  let head = '';
  let last: Note | undefined;
  for (const part of text.split(/(\{\{雙行註文\|[^{}]*\}\})/)) {
    const m = part.match(/^\{\{雙行註文\|([^{}]*)\}\}$/);
    if (m) {
      const note = m[1].replaceAll('|', '');
      // A note that runs over to the next column or page continues the one before it.
      if (!han(head) && last) last.note += note;
      else {
        const h = han(head).split('').map(fold).join('');
        const title = [...titles.keys()].find((t) => h.endsWith(t));
        if (title) {
          book = titles.get(title)!;
          last = undefined;
        } else notes.push((last = { book, head: han(head), note }));
      }
      head = '';
      continue;
    }
    for (let line of part.split('\n')) {
      const h = han(line).split('').map(fold).join('');
      if (/音義$|^經典釋文|撰$/.test(h)) continue;
      line = line.replace(
        /^[\s\u3000]*(?:凡|舊)[一二三四五六七八九十百]+章(?:今[一二三四五六七八九十百]+章)?/,
        '',
      );
      const title = [...titles.keys()].find((t) => h.startsWith(t));
      if (title && !line.includes('{{')) {
        book = titles.get(title)!;
        head = line.slice(line.indexOf(title.at(-1)!) + 1);
        last = undefined;
      } else head += line;
    }
  }
  const start = VOLUMES[workId].start;
  return start ? notes.slice(notes.findIndex((n) => n.head === start)) : notes;
}

interface Resolved {
  index: number;
  pinyin: string | null;
}

/** Which character of the headword a note reads, and as what. */
function resolve(gy: Guangyun, head: string, note: string): Resolved[] {
  const chars = [...head];
  const targets = (prefix: string | undefined) => {
    if (prefix === '上') return [0];
    if (prefix === '下') return [chars.length - 1];
    if (prefix) return [chars.lastIndexOf(prefix)];
    const poly = chars.flatMap((c, i) => (isPolyphone(c) ? [i] : []));
    return poly;
  };

  const tries: [string | undefined, string][] = [[undefined, note]];
  if (note[0] === '上' || note[0] === '下' || (chars.includes(note[0]) && chars.length > 1)) {
    tries.push([note[0], note.slice(1)]);
  }
  for (const [prefix, rest] of tries) {
    const both = rest.startsWith('並');
    const body = both ? rest.slice(1) : rest;
    let classesOf: ((c: string) => ReturnType<Guangyun['classesOf']>) | undefined;
    let hint: string | undefined;
    let plain = false;
    const fanqie = body.match(/^(\p{Script=Han})(\p{Script=Han})反/u);
    const homophone = body.match(/^音(\p{Script=Han})/u);
    if (body.startsWith('如字')) plain = true;
    else if (fanqie) {
      classesOf = () => gy.fanqie(fanqie[1], fanqie[2]);
      hint = fanqie[2];
    } else if (homophone) {
      classesOf = (c) => gy.homophone(c, homophone[1]);
      hint = homophone[1];
    } else continue;

    const idx = both ? chars.flatMap((c, i) => (isPolyphone(c) ? [i] : [])) : targets(prefix);
    if (!idx.length) return [];
    if (plain) return idx.map((index) => ({ index, pinyin: ruzi(chars[index]) ?? null }));
    const found = idx.map((index) => ({
      index,
      pinyin: gy.pinyin(chars[index], classesOf!(chars[index]), hint),
    }));
    if (both || prefix || chars.length === 1) return found;
    // Otherwise the note reads the polyphone it fits, or another character of the headword.
    return found.filter((f) => f.pinyin).slice(-1);
  }
  return [];
}

export interface Unit {
  refUnit: string;
  body: string;
}

interface Slot {
  refUnit: string;
  pos: number;
  char: string;
}

/** The Chinese characters of each book (篇), in order, with where each sits in its unit. */
export function slotsByBook(units: Unit[], bookOf: (refUnit: string) => string) {
  const books = new Map<string, Slot[]>();
  for (const u of units) {
    const slots = books.get(bookOf(u.refUnit)) ?? [];
    [...u.body].forEach(
      (char, pos) => HAN.test(char) && slots.push({ refUnit: u.refUnit, pos, char }),
    );
    books.set(bookOf(u.refUnit), slots);
  }
  return books;
}

const CARRY = /下.{0,8}?同|放此|不出者同/;

function occurrences(text: string, h: string): number[] {
  const out: number[] = [];
  for (let i = text.indexOf(h); i >= 0; i = text.indexOf(h, i + 1)) out.push(i);
  return out;
}

/**
 * Where each headword sits in the text, or -1 for headwords from the commentary. Headwords of two
 * characters or more are anchors, placed in order to cover as many characters as possible; single
 * characters are then placed at their first occurrence between the anchors around them.
 */
export function align(heads: string[], text: string): number[] {
  const at = heads.map(() => -1);
  // Weighted longest increasing subsequence over (headword, occurrence) pairs.
  const best: { score: number; note: number; pos: number; end: number; prev: number }[] = [];
  heads.forEach((h, i) => {
    if (h.length < 2) return;
    const found = occurrences(text, h).map((pos) => {
      let prev = -1;
      best.forEach((b, j) => {
        if (b.end < pos && (prev < 0 || b.score > best[prev].score)) prev = j;
      });
      const score = h.length + (prev < 0 ? 0 : best[prev].score);
      return { score, note: i, pos, end: pos + h.length - 1, prev };
    });
    best.push(...found);
  });
  let k = best.reduce((top, b, i) => (top < 0 || b.score > best[top].score ? i : top), -1);
  for (; k >= 0; k = best[k].prev) at[best[k].note] = best[k].pos;

  let cursor = 0;
  heads.forEach((h, i) => {
    if (at[i] >= 0) {
      cursor = at[i] + h.length;
      return;
    }
    if (h.length !== 1) return;
    const next = at.findIndex((p, j) => j > i && p >= 0);
    const bound = next < 0 ? text.length : at[next];
    const pos = text.indexOf(h, cursor);
    if (pos >= 0 && pos < bound) {
      at[i] = pos;
      cursor = pos + 1;
    }
  });
  return at;
}

/** Draft readings for every polyphone occurrence, from the notes aligned on the text. */
export function draft(
  gy: Guangyun,
  notes: Note[],
  units: Unit[],
  bookOf: (refUnit: string) => string,
): { readings: Readings; unmatched: Note[] } {
  const readings: Readings = {};
  const unmatched: Note[] = [];
  for (const [book, slots] of slotsByBook(units, bookOf)) {
    const text = slots.map((s) => fold(s.char)).join('');
    const events = new Map<number, { pinyin: string | null; note: Note; carry: boolean }>();
    const own = notes.filter((x) => x.book === book && x.head);
    const positions = align(
      own.map((n) => [...n.head].map(fold).join('')),
      text,
    );
    own.forEach((n, i) => {
      const at = positions[i];
      if (at < 0) return void unmatched.push(n);
      for (const r of resolve(gy, n.head, n.note)) {
        events.set(at + r.index, { pinyin: r.pinyin, note: n, carry: CARRY.test(n.note) });
      }
    });

    const carried = new Map<string, { pinyin: string | null; note: Note; at: Slot }>();
    slots.forEach((slot, i) => {
      const c = fold(slot.char);
      if (!isPolyphone(c)) return;
      const event = events.get(i);
      let entry: Omit<Reading, 'pos' | 'char'>;
      if (event) {
        entry = { pinyin: event.pinyin ?? '', source: '經典釋文', note: event.note.note };
        if (!event.pinyin) entry.todo = `note not resolved: ${event.note.head} ${event.note.note}`;
        if (event.carry) carried.set(c, { ...event, at: slot });
        else carried.delete(c);
      } else if (carried.has(c)) {
        const from = carried.get(c)!;
        entry = {
          pinyin: from.pinyin ?? '',
          source: '經典釋文',
          note: `下同 (${from.at.refUnit} ${from.note.head}: ${from.note.note})`,
        };
        if (!from.pinyin) entry.todo = 'carried note not resolved';
      } else {
        entry = { pinyin: ruzi(c), source: '經典釋文', note: '如字 (no note)' };
      }
      (readings[slot.refUnit] ??= []).push({ pos: slot.pos, char: slot.char, ...entry });
    });
  }
  return { readings, unmatched };
}
