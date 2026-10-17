import { pinyin } from 'pinyin-pro';
import { cached } from '../cache.js';
import { candidates, fold, type Guangyun } from './guangyun.js';
import { POLYPHONES, type Reading, type Readings } from './pinyin.js';

// 《經典釋文》 in the 四部叢刊 edition, as transcribed page by page on Chinese Wikisource.
const API = 'https://zh.wikisource.org/w/api.php?format=json&formatversion=2&';
const INDEX_1 = 'Sibu Congkan0052-陸德明-經典釋文-12-01.djvu';
const INDEX = 'Sibu Congkan0061-陸德明-經典釋文-12-10.djvu';
const INDEX_11 = 'Sibu Congkan0062-陸德明-經典釋文-12-11.djvu';

const ORDINALS = Array.from({ length: 33 }, (_, i) => {
  const n = i + 1;
  const tens = n < 10 ? '' : `${n >= 20 ? '〇一二三'[Math.floor(n / 10)] : ''}十`;
  return `第${tens}${n % 10 ? '〇一二三四五六七八九'[n % 10] : ''}`;
});

interface Volume {
  /** Page ranges, in order, of the djvu indexes they are in. */
  pages: [index: string, from: number, to: number][];
  /** The books (篇) in order, as headed in the 音義. */
  books: string[];
  bookOf: (refUnit: string) => string;
  /** The first headword on the text itself, after the notes on the title and preface. */
  start?: string;
  carry?: Carry;
  /** The characters of each book in the order the 音義 reads them, when the units are not. */
  slots?: (units: Unit[]) => Map<string, Slot[]>;
}

export const VOLUMES: Record<string, Volume> = {
  analects: {
    pages: [[INDEX, 2, 44]],
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
  'tao-te-ching': { pages: [[INDEX, 46, 59]], books: ['老子'], bookOf: () => '1', start: '徼' },
  // 莊子音義, 卷二十六 to 卷二十八. Notes break up some of its headings (齊物論{{…}}第二), so
  // books are found by their numbers.
  'chuang-tzu': {
    pages: [
      [INDEX, 60, 179],
      [INDEX_11, 2, 66],
    ],
    books: ORDINALS,
    bookOf: (refUnit) => refUnit.split('.')[0],
    // Its 下同 runs on through long chapters, over other senses of the same character.
    carry: 'phrase',
  },
  // 周易音義, 卷二: the six 傳 of 王弼's text, then the wings in 韓康伯's. The first 傳's heading is
  // broken up by notes, so it is found by the 王弼注 after it.
  'i-ching': {
    pages: [[INDEX_1, 76, 138]],
    books: [
      '王弼注',
      '周易上經泰傳第二',
      '周易上經噬嗑傳第三',
      '周易下經咸傳第四',
      '周易下經夬傳第五',
      '周易下經豐傳第六',
      '周易繫',
      '周易繫辭下第八',
      '周易說卦第九',
      '周易序卦第十',
      '周易雜卦',
      '周易畧例',
    ],
    bookOf: ichingBook,
    carry: 'phrase',
    slots: wangBi,
  },
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
  於: 'yú',
  鮮: 'xiān',
  孫: 'sūn',
  逮: 'dài',
  妻: 'qī',
  貉: 'hé',
  愬: 'sù',
  召: 'zhào',
  荷: 'hé',
  當: 'dāng',
  幾: 'jī',
  飂: 'liáo',
  虺: 'huǐ',
  省: 'xǐng',
  監: 'jiān',
  澹: 'dàn',
  偲: 'sī',
  裨: 'bì',
  揭: 'jiē',
  任: 'rèn',
  亢: 'kàng',
  亟: 'jí',
  亞: 'yà',
  适: 'kuò',
  泥: 'ní',
  應: 'yìng',
};
export const ruzi = (c: string) => RUZI[fold(c)];

// The last hexagram of each 傳, and the books of the wings after them.
const ZHUAN = [10, 20, 30, 42, 54, 64];
const WINGS: Record<string, number> = { 'III.1': 7, 'III.2': 8, V: 9, VI: 10, VII: 11 };

function ichingBook(refUnit: string): string {
  const wing = refUnit.match(/^App\. (III\.\d|V|VI|VII)\b/);
  if (wing) return String(WINGS[wing[1]]);
  const n = Number(refUnit.match(/\d+/)![0]);
  return String(ZHUAN.findIndex((last) => n <= last) + 1);
}

const YAO = /^(?:[初上用][六九]|[六九][二三四五])[：，]/u;

/** The Chinese characters of each line of a unit, with where each sits in it. */
function lineSlots(u: Unit | undefined): Slot[][] {
  if (!u) return [];
  const lines: Slot[][] = [[]];
  [...u.body].forEach((char, pos) => {
    if (char === '\n') lines.push([]);
    else if (HAN.test(char)) lines.at(-1)!.push({ refUnit: u.refUnit, pos, char });
  });
  return lines;
}

// 王弼 sets the 彖 and the 象 of the whole after each hexagram's judgment, and the 象 of each line
// after the line, but for the first hexagram, which keeps them apart as Legge does.
function wangBi(units: Unit[]): Map<string, Slot[]> {
  const byUnit = new Map(units.map((u) => [u.refUnit, u]));
  const books = new Map<string, Slot[]>();
  const add = (book: string, lines: Slot[][]) =>
    books.set(book, [...(books.get(book) ?? []), ...lines.flat()]);
  for (const u of units) {
    const book = ichingBook(u.refUnit);
    if (!/^\d+$/.test(u.refUnit)) {
      if (Number(book) > ZHUAN.length) add(book, lineSlots(u));
      continue;
    }
    const n = u.refUnit;
    const text = lineSlots(u);
    const tuan = lineSlots(byUnit.get(`App. I.${n}`));
    const [great, ...lines] = lineSlots(byUnit.get(`App. II.${n}`));
    const wenyan: Slot[][][] = [];
    for (let k = 1; byUnit.has(`App. IV.${n}.${k}`); k++)
      wenyan.push(lineSlots(byUnit.get(`App. IV.${n}.${k}`)));
    if (n === '1') {
      add(book, [...text, ...tuan, great ?? [], ...lines, ...wenyan.flat()]);
      continue;
    }
    const first = u.body.split('\n').findIndex((l) => YAO.test(l));
    if (first < 0) throw new Error(`i-ching ${n}: no line statements`);
    const yao = text.slice(first);
    add(book, [
      ...text.slice(0, first),
      ...tuan,
      great ?? [],
      ...yao.flatMap((line, k) => [line, lines[k] ?? []]),
      ...lines.slice(yao.length),
      ...wenyan.flat(),
    ]);
  }
  return books;
}

// 夫 opening a clause is the particle 音扶 (夫唯, 夫物), which 釋文 does not note every time;
// 夫子, the Master, keeps its usual reading.
const clauseInitial = (chars: string[], pos: number) =>
  (pos === 0 || /[\p{P}\s]/u.test(chars[pos - 1])) && chars[pos + 1] !== '子';

const isPolyphone = (c: string) => POLYPHONES.has(fold(c));
const HAN = /\p{Script=Han}/u;
const han = (s: string) => [...s].filter((c) => HAN.test(c)).join('');

export interface Note {
  book: string;
  head: string;
  note: string;
}

async function page(cacheDir: string, index: string, n: number): Promise<string> {
  const url = `${API}action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(`Page:${index}/${n}`)}`;
  const volume = Number(index.match(/-(\d+)\.djvu$/)![1]);
  const file = volume === 10 ? `shiwen-${n}.json` : `shiwen-${volume}-${n}.json`;
  const json = JSON.parse((await cached(cacheDir, file, url)).toString());
  return json.query.pages[0].revisions[0].slots.main.content as string;
}

export async function skchar(cacheDir: string, code: string): Promise<string> {
  const url = `${API}action=expandtemplates&prop=wikitext&text=${encodeURIComponent(`{{SKchar|${code}}}`)}`;
  const json = JSON.parse((await cached(cacheDir, `skchar-${code}.json`, url)).toString());
  const text = json.expandtemplates.wikitext as string;
  return text.match(/alt=([^|\]]+)/)?.[1] ?? text;
}

/** The headwords and notes of one 音義, with the number of the book (篇) each falls under. */
export async function loadNotes(cacheDir: string, workId: string): Promise<Note[]> {
  const { pages, books } = VOLUMES[workId];
  let text = '';
  for (const [index, from, to] of pages) {
    for (let n = from; n <= to; n++)
      text +=
        (await page(cacheDir, index, n)).replace(/<noinclude>[\s\S]*?<\/noinclude>/g, '') + '\n';
  }
  for (const code of new Set([...text.matchAll(/\{\{SKchar\|(\d+)\}\}/g)].map((m) => m[1]))) {
    text = text.replaceAll(`{{SKchar|${code}}}`, await skchar(cacheDir, code));
  }
  // Glyphs with no character, which would break up the notes around them.
  text = text.replace(/\{\{SKchar2\|\d+\}\}/g, '');

  const titles = books.map((b) => han(b).split('').map(fold).join(''));
  const notes: Note[] = [];
  let book = books.length === 1 ? '1' : '0';
  // Only the next book's heading is looked for, so that 第二 is never taken for 第十二.
  const next = () => titles[Number(book)];
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
        if (next() && h.endsWith(next())) {
          book = String(Number(book) + 1);
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
      const title = next();
      if (title && h.startsWith(title) && !line.includes('{{')) {
        book = String(Number(book) + 1);
        head = line.slice(line.indexOf(title.at(-1)!) + 1);
        last = undefined;
      } else head += line;
    }
  }
  if (books.length > 1 && Number(book) !== books.length)
    throw new Error(`${workId}: 音義 headings found up to book ${book} of ${books.length}`);
  const start = VOLUMES[workId].start;
  return start ? notes.slice(notes.findIndex((n) => n.head === start)) : notes;
}

interface Resolved {
  index: number;
  pinyin: string | null;
}

/** Which character of the headword a note reads, and as what. */
export function resolve(gy: Guangyun, head: string, note: string, poly = isPolyphone): Resolved[] {
  const chars = [...head];
  const targets = (prefix: string | undefined) => {
    if (prefix === '上') return [0];
    if (prefix === '下') return [chars.length - 1];
    if (prefix) return [chars.lastIndexOf(prefix)];
    return chars.flatMap((c, i) => (poly(c) ? [i] : []));
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

    const idx = both ? chars.flatMap((c, i) => (poly(c) ? [i] : [])) : targets(prefix);
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

export interface Slot {
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

/** A character folded to one code unit, so that a position in a text of them is one in its slots. */
export const one = (c: string) => (c.codePointAt(0)! > 0xffff ? '〓' : fold(c));

export const CARRY = /下.{0,8}?同|放此|不出者同/;

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

/** A note on a character missing from POLYPHONES whose reading differs from pinyin-pro's. */
export interface Skipped extends Slot {
  pinyin: string;
  modern: string;
  note: Note;
}

/** A source's reading for one character of the text, or null with why it needs review. */
export interface ReadingEvent {
  pinyin: string | null;
  note: Note;
  carry: boolean;
  /** Which character of the headword the reading is for. */
  index?: number;
  todo?: string;
}

/**
 * How far a 下同 carries a reading: through the book, within its unit, or to the same phrase
 * only: the one the note names (「下爲是皆同」), else the headword itself when it has two
 * characters or more, else within the unit.
 */
export type Carry = 'book' | 'unit' | 'phrase';

const HAN_RUN = /\p{Script=Han}/u;

// 「下爲是皆同」 names 爲是; the fanqie in 「下孟反下同」 names nothing.
const NAMED = /下(?:文)?((?:(?![反切下皆並同注及])\p{Script=Han}){1,4}?)(?:皆|並)?同/gu;

function carriedPhrase(event: ReadingEvent, c: string): { phrase: string[]; offset: number } {
  for (const [, named] of event.note.note.matchAll(NAMED)) {
    const phrase = [...named].map(fold);
    if (phrase.includes(c)) return { phrase, offset: phrase.indexOf(c) };
  }
  const head = [...event.note.head].filter((x) => HAN_RUN.test(x)).map(fold);
  if (head.length > 1 && head.includes(c)) {
    const offset =
      event.index !== undefined && head[event.index] === c ? event.index : head.indexOf(c);
    return { phrase: head, offset };
  }
  return { phrase: [c], offset: 0 };
}

/**
 * A reading for every polyphone occurrence in a book: the source's own where it has one, carried
 * on by 下同 (within its unit only, when the units are scattered passages), and the usual reading
 * (如字) elsewhere.
 */
export function fill(
  readings: Readings,
  slots: Slot[],
  events: Map<number, ReadingEvent>,
  bodies: Map<string, string[]>,
  source: string,
  carry: Carry = 'book',
): void {
  type Carried = ReadingEvent & { at: Slot; phrase: string[]; offset: number };
  // By character: one carry at a time, or in 'phrase' mode one per phrase, so that a note on
  // 好惡 does not end the 下同 of 惡乎.
  const carried = new Map<string, Carried[]>();
  const text = slots.map((s) => fold(s.char));
  const reaches = (from: Carried, i: number) => {
    if (carry === 'book') return true;
    const sameUnit = from.at.refUnit === slots[i].refUnit;
    if (carry === 'unit' || from.phrase.length === 1) return sameUnit;
    const start = i - from.offset;
    // 以爲, 爲之: too common for a 于僞反 to hold beyond its passage.
    return from.phrase.every((x, k) => text[start + k] === x) && (sameUnit || text[i] !== '為');
  };
  slots.forEach((slot, i) => {
    const c = fold(slot.char);
    if (!isPolyphone(c)) return;
    const event = events.get(i);
    const from = (carried.get(c) ?? []).findLast((e) => reaches(e, i));
    let entry: Omit<Reading, 'pos' | 'char'>;
    if (event) {
      entry = { pinyin: event.pinyin ?? '', source, note: event.note.note };
      if (!event.pinyin)
        entry.todo = event.todo ?? `note not resolved: ${event.note.head} ${event.note.note}`;
      const next = { ...event, at: slot, ...carriedPhrase(event, c) };
      const kept =
        carry === 'phrase'
          ? (carried.get(c) ?? []).filter((e) => e.phrase.join('') !== next.phrase.join(''))
          : [];
      carried.set(c, event.carry ? [...kept, next] : kept);
    } else if (from) {
      entry = {
        pinyin: from.pinyin ?? '',
        source,
        note: `下同 (${from.at.refUnit} ${from.note.head}: ${from.note.note})`,
      };
      if (!from.pinyin) entry.todo = 'carried note not resolved';
    } else if (c === '夫' && clauseInitial(bodies.get(slot.refUnit)!, slot.pos)) {
      entry = { pinyin: 'fú', source, note: '如字 (no note); clause-initial particle 夫, 音扶' };
    } else {
      entry = { pinyin: ruzi(c), source, note: '如字 (no note)' };
    }
    (readings[slot.refUnit] ??= []).push({ pos: slot.pos, char: slot.char, ...entry });
  });
}

// Works no 音義 covers: each polyphone takes its usual reading, to be reviewed by hand.
export const UNANNOTATED = ['art-of-war', 'mozi', 'xunzi'];

export function draftPlain(units: Unit[]): Readings {
  const readings: Readings = {};
  const bodies = new Map(units.map((u) => [u.refUnit, [...u.body]]));
  for (const slots of slotsByBook(units, () => '1').values())
    fill(readings, slots, new Map(), bodies, 'no 音義');
  return readings;
}

/** Draft readings for every polyphone occurrence, from the notes aligned on the text. */
export function draft(
  gy: Guangyun,
  notes: Note[],
  units: Unit[],
  bookOf: (refUnit: string) => string,
  carry: Carry = 'book',
  books = slotsByBook(units, bookOf),
): { readings: Readings; unmatched: Note[]; skipped: Skipped[] } {
  const readings: Readings = {};
  const unmatched: Note[] = [];
  const skipped: Skipped[] = [];
  const bodies = new Map(units.map((u) => [u.refUnit, [...u.body]]));
  for (const [book, slots] of books) {
    const text = slots.map((s) => one(s.char)).join('');
    const events = new Map<number, ReadingEvent>();
    const own = notes.filter((x) => x.book === book && x.head);
    const positions = align(
      own.map((n) => [...n.head].map(one).join('')),
      text,
    );
    own.forEach((n, i) => {
      const at = positions[i];
      if (at < 0) return void unmatched.push(n);
      for (const r of resolve(gy, n.head, n.note)) {
        // 「惡知，音烏」 reads 惡, not 知, which has no such reading.
        const c = slots[at + r.index].char;
        if (carry === 'phrase' && r.pinyin && !candidates(c).includes(r.pinyin)) {
          unmatched.push(n);
          continue;
        }
        events.set(at + r.index, {
          pinyin: r.pinyin,
          note: n,
          carry: CARRY.test(n.note),
          index: r.index,
        });
      }
      for (const r of resolve(gy, n.head, n.note, () => true)) {
        const slot = slots[at + r.index];
        if (isPolyphone(slot.char) || !r.pinyin) continue;
        const modern = pinyin(bodies.get(slot.refUnit)!.join(''), {
          type: 'all',
          toneSandhi: false,
        })[slot.pos].pinyin;
        if (modern !== r.pinyin) skipped.push({ ...slot, pinyin: r.pinyin, modern, note: n });
      }
    });

    fill(readings, slots, events, bodies, '經典釋文', carry);
  }
  return { readings, unmatched, skipped };
}
