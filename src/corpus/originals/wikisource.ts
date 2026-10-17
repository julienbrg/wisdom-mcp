import { cached } from '../cache.js';
import { decodeEntities, type SourceText } from './source.js';

const API =
  'https://zh.wikisource.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&page=';
const LICENSE = 'Public domain (Chinese Wikisource)';

const TAO_TE_CHING = '道德經 (王弼本)';
const ANALECTS = [
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
].map((book) => `論語/${book}`);
// Zhu Xi's text, as for the Great Learning and the Doctrine of the Mean, so his readings align on it.
const MENCIUS = '一 二 三 四 五 六 七 八 九 十 十一 十二 十三 十四'
  .split(' ')
  .map((n) => `四書章句集註/孟子集注卷${n}`);
const ZHUANGZI =
  '逍遙遊 齊物論 養生主 人間世 德充符 大宗師 應帝王 駢拇 馬蹄 胠篋 在宥 天地 天道 天運 刻意 繕性 秋水 至樂 達生 山木 田子方 知北遊 庚桑楚 徐無鬼 則陽 外物 寓言 讓王 盜跖 說劍 漁父 列禦寇 天下'
    .split(' ')
    .map((chapter) => `莊子/${chapter}`);
const LIEZI = '天瑞 黃帝 周穆王 仲尼 湯問 力命 楊朱 說符'
  .split(' ')
  .map((book) => `列子/${book}篇`);
// Every chapter, so that a unit's number is the chapter's own; lost chapters are not loaded.
const MOZI_CHAPTERS =
  '親士 修身 所染 法儀 七患 辭過 三辯 尚賢上 尚賢中 尚賢下 尚同上 尚同中 尚同下 兼愛上 兼愛中 兼愛下 非攻上 非攻中 非攻下 節用上 節用中 節用下 節葬上 節葬中 節葬下 天志上 天志中 天志下 明鬼上 明鬼中 明鬼下 非樂上 非樂中 非樂下 非命上 非命中 非命下 非儒上 非儒下 經上 經下 經說上 經說下 大取 小取 耕柱 貴義 公孟 魯問 公輸'.split(
    ' ',
  );
// Mei translates the ethical and political chapters: not the eight that are lost, nor the
// dialectical ones (40–45).
const MOZI_LEFT_OUT = [22, 23, 24, 29, 30, 33, 34, 38, 40, 41, 42, 43, 44, 45];
const MOZI = MOZI_CHAPTERS.map((chapter, i) => ({
  title: `墨子/${chapter}`,
  chapter: i + 1,
})).filter(({ chapter }) => !MOZI_LEFT_OUT.includes(chapter));
const XUNZI_BOOKS =
  '勸學 修身 不苟 榮辱 非相 非十二子 仲尼 儒效 王制 富國 王霸 君道 臣道 致士 議兵 彊國 天論 正論 禮論 樂論 解蔽 正名 性惡 君子 成相 賦 大略 宥坐 子道 法行 哀公 堯問'.split(
    ' ',
  );
// The books Dubs translates in whole or in part, and the eulogy at the end of 堯問 that he puts
// after book 23.
const XUNZI = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 15, 16, 17, 18, 19, 20, 21, 22, 23, 32].map(
  (book) => ({
    title: `荀子/${XUNZI_BOOKS[book - 1]}篇`,
    book,
  }),
);
const ART_OF_WAR = '孫子兵法';
const HEXAGRAMS =
  '乾 坤 屯 蒙 需 訟 師 比 小畜 履 泰 否 同人 大有 謙 豫 隨 蠱 臨 觀 噬嗑 賁 剝 復 无妄 大畜 頤 大過 坎 離 咸 恒 遯 大壯 晉 明夷 家人 睽 蹇 解 損 益 夬 姤 萃 升 困 井 革 鼎 震 艮 漸 歸妹 豐 旅 巽 兌 渙 節 中孚 小過 既濟 未濟'
    .split(' ')
    .map((name) => `周易/${name}`);
const GREAT_LEARNING = '四書章句集註/大學章句';
const DOCTRINE_OF_THE_MEAN = '四書章句集註/中庸章句';

const DIGITS = '〇一二三四五六七八九';

export interface Section {
  anchor: string;
  body: string;
}

// Both "二十一" and the positional "二一" that Wikisource uses in chapter ids.
export function cnum(s: string): number {
  const ten = s.indexOf('十');
  if (ten < 0) return [...s].reduce((n, c) => n * 10 + DIGITS.indexOf(c), 0);
  const tens = ten === 0 ? 1 : DIGITS.indexOf(s[ten - 1]);
  const ones = ten === s.length - 1 ? 0 : DIGITS.indexOf(s[ten + 1]);
  return tens * 10 + ones;
}

// Language conversion: -{谷}- -> 谷, and -{zh:顚;zh-hant:顛;zh-hans:颠}- -> 顛
function convert(rule: string): string {
  if (!/^[\w-]+:/.test(rule)) return rule;
  const variants = Object.fromEntries(
    rule.split(';').map((v) => v.split(':').map((s) => s.trim()) as [string, string]),
  );
  return variants['zh-hant'] ?? variants.zh ?? Object.values(variants)[0];
}

// A section runs until the next heading or the end of the transcluded part.
function untilTrailer(s: string): string {
  const end = s.search(/^=|<\/onlyinclude>/m);
  return end < 0 ? s : s.slice(0, end);
}

export function cleanWikitext(s: string): string {
  let text = s
    .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/-\{([^{}|]*)\}-/g, (_, rule: string) => convert(rule))
    .replace(/\[\[Category:[^\]]*\]\]/g, '')
    // Interlanguage links: [[en:Mozi/Self-Cultivation]]
    .replace(/\[\[[a-z]{2,3}(?:-[a-z]+)?:[^\]|]*\]\]/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1');
  // Variant readings keep the main one: {{另2|已|一無「已」字}} -> 已
  text = text.replace(/\{\{(?:另2?|参|參)\|([^|{}]*)\|[^{}]*\}\}/g, '$1');
  while (/\{\{[^{}]*\}\}/.test(text)) text = text.replace(/\{\{[^{}]*\}\}/g, '');
  return decodeEntities(text.replace(/<[^>]+>/g, '').replace(/'''?/g, ''))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

// Wang Bi's commentary sits on indented ":" lines under each line of the text.
export function taoChapters(wikitext: string): Map<string, Section> {
  const parts = wikitext.split(/^==\s*([一二三四五六七八九十]+)章\s*==\s*$/m);
  const chapters = new Map<string, Section>();
  for (let i = 1; i < parts.length; i += 2) {
    const lines = untilTrailer(parts[i + 1])
      .split('\n')
      .filter((l) => !/^\s*[:*]/.test(l));
    chapters.set(`${cnum(parts[i])}`, {
      anchor: `${parts[i]}章`,
      body: cleanWikitext(lines.join('\n')),
    });
  }
  return chapters;
}

export function analectsChapters(wikitext: string): Map<string, Section> {
  const parts = wikitext.split(
    /<div id="([一二三四五六七八九十]+)之([一二三四五六七八九十]+)"[^>]*>.*?<\/div>/,
  );
  const chapters = new Map<string, Section>();
  for (let i = 1; i < parts.length; i += 3) {
    chapters.set(`${cnum(parts[i])}.${cnum(parts[i + 1])}`, {
      anchor: `${parts[i]}之${parts[i + 1]}`,
      body: cleanWikitext(untilTrailer(parts[i + 2])),
    });
  }
  return chapters;
}

// "1A.1": book I, part A (上), chapter 1, as Legge numbers them.
// Chapters that 集注 sets out as two paragraphs: 7A.41 runs on with 「孟子曰：大匠不為拙工」.
const RUN_ON: Record<string, number> = { '7A': 41 };

// One volume (卷) of 集注 per part of a book, one paragraph per chapter: "1A.1" is book I, part A
// (上), chapter 1, as Legge numbers them.
export function menciusChapters(wikitext: string, volume: number): Map<string, Section> {
  const prefix = `${(volume >> 1) + 1}${'AB'[volume & 1]}`;
  const paragraphs = wikitext
    .split('\n')
    .filter((l) => l.startsWith('\u3000'))
    .map(cleanWikitext)
    .filter((body) => /[，。：；！？]/.test(body));
  const runOn = RUN_ON[prefix];
  if (runOn) paragraphs.splice(runOn - 1, 2, paragraphs.slice(runOn - 1, runOn + 1).join('\n'));
  return new Map(paragraphs.map((body, i) => [`${prefix}.${i + 1}`, { anchor: '', body }]));
}

// Zhu Xi's 章句: each chapter ends with a 「右…章」 line, and his notes run inline in {{annotate}}.
// The Great Learning counts from 0, the text of Confucius, then the ten chapters of commentary.
export function zhangjuChapters(wikitext: string, first: number): Map<string, Section> {
  const chapters = new Map<string, Section>();
  let lines: string[] = [];
  for (const para of wikitext.split(/\n[ \t]*\n/)) {
    const p = para.replace(/^\n+/, '');
    if (/^(?:\{\{gap\}\}|::)\s*右/.test(p)) {
      chapters.set(`${first + chapters.size}`, { anchor: '', body: lines.join('\n') });
      lines = [];
      continue;
    }
    if (!/^(?:\{\{gap\}\}|\u3000)/.test(p)) continue;
    const body = cleanWikitext(p);
    // Titles have no punctuation, and the preface quotes 程子.
    if (/[，。：；！？]/.test(body) && !body.startsWith('子程子曰')) lines.push(body);
  }
  return chapters;
}

// A page with no headings or anchors, set out one paragraph per section: "1.3" is chapter 1,
// paragraph 3. The header, the notes after the transcluded part and paragraphs with no
// punctuation (titles, templates) are dropped.
export function paragraphs(wikitext: string, chapter: number): Map<string, Section> {
  const body = wikitext
    .split('</onlyinclude>')[0]
    .replace(/\{\{[Hh]eader2?\s*\|(?:[^{}]|\{\{[^{}]*\}\})*\}\}/, '');
  const paras = body
    .split(/\n[ \t]*\n/)
    .map(cleanWikitext)
    .filter((p) => /[，。：；！？]/.test(p));
  return new Map(paras.map((p, i) => [`${chapter}.${i + 1}`, { anchor: '', body: p }]));
}

// The thirteen chapters on one page, each a level-2 heading (始計第一); the dialogues after them
// (答話) are not Sunzi's text.
export function artOfWarChapters(wikitext: string): Map<string, Section> {
  const parts = wikitext.split(/^==\s*(.+?)\s*==\s*$/m);
  const units = new Map<string, Section>();
  for (let i = 1; i < parts.length; i += 2) {
    const m = parts[i].match(/第([一二三四五六七八九十]+)$/);
    if (!m) break;
    for (const [unit, { body }] of paragraphs(parts[i + 1], cnum(m[1]))) {
      units.set(unit, { anchor: parts[i], body });
    }
  }
  return units;
}

// A hexagram's page, split as Legge divides it: the Text (卦辭 and 爻辭) of hexagram 3 is "3", its 彖
// Appendix I ("App. I.3"), its 象 Appendix II, and the 文言 on the first two Appendix IV, one chapter
// for each run of paragraphs (**) or of lines (*#).
export function hexagramSections(wikitext: string, n: number): Map<string, Section> {
  const parts: Record<string, string[][]> = { 易經: [], 彖曰: [], 象曰: [], 文言曰: [] };
  let part: string[][] | null = null;
  let kind = '';
  for (const line of wikitext.split('\n')) {
    const m = line.match(/'''(易經|彖曰|象曰|文言曰)：'''/);
    if (m) [part, kind] = [parts[m[1]], ''];
    else if (!part || !line.startsWith('*')) continue;
    else if (line.startsWith('*:')) kind = '';
    else {
      const k = line.startsWith('*#') ? '#' : '*';
      if (k !== kind || !part.length) part.push([]);
      kind = k;
      part.at(-1)!.push(cleanWikitext(line.replace(/^[*#]+/, '')));
    }
  }
  const all = (chapters: string[][]) => chapters.flat().join('\n');
  const units = new Map<string, Section>([
    [`${n}`, { anchor: '', body: all(parts.易經) }],
    [`App. I.${n}`, { anchor: '', body: all(parts.彖曰) }],
    [`App. II.${n}`, { anchor: '', body: all(parts.象曰) }],
  ]);
  parts.文言曰.forEach((lines, i) =>
    units.set(`App. IV.${n}.${i + 1}`, { anchor: '', body: lines.join('\n') }),
  );
  return units;
}

// Each level-2 heading of a page and the paragraphs under it.
function headed(wikitext: string): { heading: string; paras: string[] }[] {
  const parts = wikitext.split(/^==\s*([^=]+?)\s*==\s*$/m);
  const sections = [];
  for (let i = 1; i < parts.length; i += 2) {
    const paras = parts[i + 1]
      .split(/\n[ \t]*\n/)
      .map((p) => cleanWikitext(p.replace(/^[:*#]+/gm, '')))
      .filter((p) => /[，。：；！？]/.test(p));
    sections.push({ heading: parts[i], paras });
  }
  return sections;
}

// How many of Wikisource's paragraphs of the 繫辭下 each of Legge's chapters (Zhu Xi's) takes.
const XICI_II = [1, 3, 1, 1, 9, 1, 1, 1, 2, 1, 1, 3];

// Legge's Appendix III is the 繫辭, chapter by chapter: "App. III.2.5" is section II, chapter V.
export function xiciChapters(wikitext: string, section: 1 | 2): Map<string, Section> {
  const chapters = headed(wikitext).filter((c) => /^第.+章$/.test(c.heading));
  let paras = chapters.map((c) => c.paras.join('\n'));
  if (section === 2) {
    const all = chapters.flatMap((c) => c.paras);
    if (all.length !== XICI_II.reduce((a, b) => a + b)) throw new Error('繫辭下: paragraphs moved');
    paras = XICI_II.map((count) => all.splice(0, count).join('\n'));
  }
  return new Map(paras.map((body, i) => [`App. III.${section}.${i + 1}`, { anchor: '', body }]));
}

// The 說卦 (Appendix V) by chapter, the 序卦 (VI) by its two parts, and the 雜卦 (VII) whole, but
// for the collated text Wikisource adds after it.
export function wingSections(wikitext: string, appendix: 'V' | 'VI' | 'VII'): Map<string, Section> {
  const sections = headed(wikitext).filter((s) => s.heading !== '校詁版');
  if (appendix === 'VII' && sections.length !== 1) throw new Error('雜卦: sections moved');
  return new Map(
    sections.map(({ heading, paras }, i) => [
      appendix === 'VII' ? 'App. VII' : `App. ${appendix}.${i + 1}`,
      { anchor: heading, body: paras.join('\n') },
    ]),
  );
}

export async function wikitext(cacheDir: string, title: string): Promise<string> {
  const file = `wikisource-${title.replace(/[/ ]/g, '_')}.json`;
  const res = JSON.parse(
    (await cached(cacheDir, file, API + encodeURIComponent(title))).toString(),
  );
  if (!res.parse) throw new Error(`Wikisource ${title}: ${JSON.stringify(res.error ?? res)}`);
  return res.parse.wikitext;
}

export async function loadWikisource(workId: string, cacheDir: string): Promise<SourceText> {
  const pages: Record<string, { title: string; sections: (w: string) => Map<string, Section> }[]> =
    {
      'tao-te-ching': [{ title: TAO_TE_CHING, sections: taoChapters }],
      analects: ANALECTS.map((title) => ({ title, sections: analectsChapters })),
      mencius: MENCIUS.map((title, i) => ({ title, sections: (w) => menciusChapters(w, i) })),
      'chuang-tzu': ZHUANGZI.map((title, i) => ({ title, sections: (w) => paragraphs(w, i + 1) })),
      liezi: LIEZI.map((title, i) => ({ title, sections: (w) => paragraphs(w, i + 1) })),
      'art-of-war': [{ title: ART_OF_WAR, sections: artOfWarChapters }],
      'i-ching': [
        ...HEXAGRAMS.map((title, i) => ({
          title,
          sections: (w: string) => hexagramSections(w, i + 1),
        })),
        { title: '易傳/繫辭上', sections: (w) => xiciChapters(w, 1) },
        { title: '易傳/繫辭下', sections: (w) => xiciChapters(w, 2) },
        { title: '易傳/說卦', sections: (w) => wingSections(w, 'V') },
        { title: '易傳/序卦', sections: (w) => wingSections(w, 'VI') },
        { title: '易傳/雜卦', sections: (w) => wingSections(w, 'VII') },
      ],
      mozi: MOZI.map(({ title, chapter }) => ({ title, sections: (w) => paragraphs(w, chapter) })),
      xunzi: XUNZI.map(({ title, book }) => ({ title, sections: (w) => paragraphs(w, book) })),
      'great-learning': [{ title: GREAT_LEARNING, sections: (w) => zhangjuChapters(w, 0) }],
      'doctrine-of-the-mean': [
        { title: DOCTRINE_OF_THE_MEAN, sections: (w) => zhangjuChapters(w, 1) },
      ],
    };

  const units = new Map();
  for (const { title, sections } of pages[workId]) {
    const base = `https://zh.wikisource.org/wiki/${encodeURI(title.replace(/ /g, '_'))}`;
    for (const [unit, { anchor, body }] of sections(await wikitext(cacheDir, title))) {
      units.set(unit, { body, url: anchor ? `${base}#${encodeURIComponent(anchor)}` : base });
    }
  }
  return { license: LICENSE, units };
}
