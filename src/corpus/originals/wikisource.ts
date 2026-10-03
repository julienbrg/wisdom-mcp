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
export function untilTrailer(s: string): string {
  const end = s.search(/^=|<\/onlyinclude>/m);
  return end < 0 ? s : s.slice(0, end);
}

export function cleanWikitext(s: string): string {
  let text = s
    .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/-\{([^{}|]*)\}-/g, (_, rule: string) => convert(rule))
    .replace(/\[\[Category:[^\]]*\]\]/g, '')
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

async function wikitext(cacheDir: string, title: string): Promise<string> {
  const file = `wikisource-${title.replace(/[/ ]/g, '_')}.json`;
  const res = JSON.parse(
    (await cached(cacheDir, file, API + encodeURIComponent(title))).toString(),
  );
  if (!res.parse) throw new Error(`Wikisource ${title}: ${JSON.stringify(res.error ?? res)}`);
  return res.parse.wikitext;
}

export async function loadWikisource(workId: string, cacheDir: string): Promise<SourceText> {
  const pages =
    workId === 'tao-te-ching'
      ? [{ title: TAO_TE_CHING, sections: taoChapters }]
      : ANALECTS.map((title) => ({ title, sections: analectsChapters }));

  const units = new Map();
  for (const { title, sections } of pages) {
    const base = `https://zh.wikisource.org/wiki/${encodeURI(title.replace(/ /g, '_'))}`;
    for (const [unit, { anchor, body }] of sections(await wikitext(cacheDir, title))) {
      units.set(unit, { body, url: `${base}#${encodeURIComponent(anchor)}` });
    }
  }
  return { license: LICENSE, units };
}
