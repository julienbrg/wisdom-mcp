import { polyphonic } from 'pinyin-pro';
import { cached } from '../cache.js';

// 廣韻 sound classes (小韻) from ytenx, used to turn a fanqie or a homophone note into pinyin.
const YTENX = 'https://raw.githubusercontent.com/BYVoid/ytenx/master/ytenx/sync/kyonh/';

export interface SoundClass {
  id: number;
  initial: string;
  rhyme: string;
  tone: 1 | 2 | 3 | 4;
  /** The rhyme group (攝). */
  group: string;
}

// Forms that the sources, the corpus and 廣韻 write differently.
const VARIANTS: Record<string, string> = {
  爲: '為',
  敎: '教',
  恱: '悅',
  説: '說',
  逺: '遠',
  乗: '乘',
  徳: '德',
  衆: '眾',
  郷: '鄉',
  煕: '熙',
  戸: '户',
  㫖: '旨',
  呉: '吳',
  竒: '奇',
  曽: '曾',
  彊: '強',
  强: '強',
  㣲: '微',
  亷: '廉',
  歴: '歷',
  卽: '即',
  旣: '既',
  徃: '往',
  恠: '怪',
  荅: '答',
  㳺: '游',
  𤣥: '玄',
  𢎞: '弘',
  僞: '偽',
  黙: '默',
  冝: '宜',
  盖: '蓋',
  内: '內',
  産: '產',
  衞: '衛',
  顔: '顏',
  敍: '敘',
  槩: '概',
  脩: '修',
  觧: '解',
  蓺: '藝',
  秊: '年',
  弃: '棄',
  冣: '最',
  迯: '逃',
  筭: '算',
  埶: '勢',
  隂: '陰',
  緫: '總',
  摠: '總',
  昬: '昏',
  夀: '壽',
  䜴: '豉',
  遥: '遙',
  増: '增',
  謡: '謠',
  愠: '慍',
  艷: '豔',
  𥳑: '簡',
};
export const fold = (c: string) => VARIANTS[c] ?? c;

// Classical readings that pinyin-pro does not list.
const EXTRA: Record<string, string[]> = {
  與: ['yú', 'yù'],
  厭: ['yā', 'yǎn'],
  足: ['jù'],
  費: ['bì'],
  載: ['zǎi'],
  張: ['zhàng'],
  勝: ['shēng'],
  鄉: ['xiàng'],
  遠: ['yuàn'],
  王: ['wàng'],
  先: ['xiàn'],
  衣: ['yì'],
  雨: ['yù'],
  語: ['yù'],
  告: ['gù'],
  施: ['yì', 'shì'],
  遺: ['wèi'],
  行: ['xìng'],
  從: ['zòng'],
  使: ['shì'],
  大: ['tài'],
  予: ['yú'],
};

// Readings pinyin-pro lists that belong to another character or a modern word.
const EXCLUDE: Record<string, string[]> = { 稱: ['chèng'] };

export function candidates(c: string): string[] {
  const own = polyphonic(fold(c), { type: 'array' })[0] ?? [];
  return [...new Set([...own, ...(EXTRA[fold(c)] ?? [])])].filter(
    (p) => /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(p) && !EXCLUDE[fold(c)]?.includes(p),
  );
}

const VOICING: Record<string, 'clear' | 'voiced' | 'sonorant'> = {};
for (const i of '幫端知精莊章見影心生書滂透徹清初昌溪曉') VOICING[i] = 'clear';
for (const i of '並定澄從邪崇俟船常羣匣') VOICING[i] = 'voiced';
for (const i of '明泥孃來日疑云以') VOICING[i] = 'sonorant';

const INITIALS: Record<string, string[]> = {
  幫: ['b', 'p', 'f'],
  滂: ['p', 'f', 'b'],
  並: ['b', 'p', 'f'],
  明: ['m', 'w'],
  端: ['d'],
  透: ['t'],
  定: ['d', 't'],
  泥: ['n'],
  孃: ['n'],
  來: ['l'],
  知: ['zh'],
  徹: ['ch'],
  澄: ['zh', 'ch'],
  精: ['z', 'j'],
  清: ['c', 'q'],
  從: ['z', 'c', 'j', 'q'],
  心: ['s', 'x'],
  邪: ['s', 'x', 'c', 'q'],
  莊: ['zh', 'z'],
  初: ['ch', 'c'],
  崇: ['zh', 'ch', 'sh'],
  生: ['sh', 's'],
  俟: ['s', 'sh'],
  章: ['zh'],
  昌: ['ch'],
  常: ['sh', 'ch'],
  書: ['sh'],
  船: ['sh', 'ch'],
  日: ['r', ''],
  見: ['g', 'j', 'k'],
  溪: ['k', 'q'],
  羣: ['q', 'j', 'k', 'g'],
  疑: ['', 'y', 'w', 'n'],
  曉: ['h', 'x'],
  匣: ['h', 'x'],
  影: ['', 'y', 'w'],
  云: ['', 'y', 'w'],
  以: ['', 'y', 'w', 'r'],
};

const modern = (c: string) => polyphonic(fold(c), { type: 'array' })[0]?.[0] ?? '';

const TONE_MARKS = ['āēīōūǖ', 'áéíóúǘ', 'ǎěǐǒǔǚ', 'àèìòùǜ'];

// The Mandarin finals each rhyme group regularly gives, for open (舒) and checked (促) rhymes.
const FINALS: Record<string, [open: string, checked: string]> = {
  通: ['ong iong eng', 'u ü iu ou o'],
  江: ['ang iang uang', 'üe uo ao iao o e'],
  止: ['i ei ui er', ''],
  遇: ['u ü', ''],
  蟹: ['ai ei ui i ia ie ua uai a', ''],
  臻: ['en in un ün', 'i u ü e o ie'],
  山: ['an ian uan üan', 'a e o ie üe uo ua'],
  效: ['ao iao', ''],
  果: ['o uo e a ie', ''],
  假: ['a ia ua e ie', ''],
  宕: ['ang iang uang', 'uo üe ao iao e o'],
  梗: ['eng ing ong iong', 'i e o ai ei uo ü'],
  曾: ['eng ing ong en', 'e i ei o uo'],
  流: ['ou iu u ao iao', ''],
  深: ['en in', 'i e u'],
  咸: ['an ian', 'a ia e ie'],
};

const SPELLING: [RegExp, string][] = [
  [/^yu/, 'ü'],
  [/^you$/, 'iu'],
  [/^yi/, 'i'],
  [/^y/, 'i'],
  [/^wu$/, 'u'],
  [/^wei$/, 'ui'],
  [/^wen$/, 'un'],
  [/^weng$/, 'ong'],
  [/^w/, 'u'],
];

function final(p: string): string {
  const plain = p.normalize('NFD').replace(/\p{M}/gu, '').replace(/v/g, 'ü');
  const initial = initialOf(plain);
  let f = plain.slice(initial.length);
  if (/^[jqx]$/.test(initial)) f = f.replace(/^u/, 'ü');
  if (!initial || initial === 'y' || initial === 'w') {
    f = plain;
    for (const [re, to] of SPELLING)
      if (re.test(f)) {
        f = f.replace(re, to);
        break;
      }
  }
  return f;
}

export const toneOf = (p: string) =>
  1 + TONE_MARKS.findIndex((m) => [...p].some((c) => m.includes(c)));
const initialOf = (p: string) => p.match(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?/)![0];

// 類隔: older fanqie spell 知-series initials with 端-series spellers, and the reverse.
const LEIGE: Record<string, string> = {
  端: '知',
  透: '徹',
  定: '澄',
  泥: '孃',
  知: '端',
  徹: '透',
  澄: '定',
  孃: '泥',
};

/** Whether a Mandarin reading is the regular outcome of a 廣韻 sound class. */
export function fits(p: string, s: SoundClass, leige = false): boolean {
  if (leige && LEIGE[s.initial] && fits(p, { ...s, initial: LEIGE[s.initial] })) return true;
  const tone = toneOf(p);
  const voicing = VOICING[s.initial];
  const tones =
    s.tone === 1
      ? voicing === 'clear'
        ? [1]
        : [2]
      : s.tone === 2
        ? voicing === 'voiced'
          ? [4, 3]
          : [3]
        : s.tone === 3
          ? [4]
          : voicing === 'voiced'
            ? [2]
            : voicing === 'sonorant'
              ? [4]
              : [1, 2, 3, 4];
  const [open, checked] = FINALS[s.group] ?? ['', ''];
  const finals = (s.tone === 4 ? checked : open).split(' ');
  return (
    tones.includes(tone) &&
    (INITIALS[s.initial] ?? []).includes(initialOf(p)) &&
    (!s.group || finals.includes(final(p)))
  );
}

export class Guangyun {
  private constructor(private readonly byChar: Map<string, SoundClass[]>) {}

  static async load(cacheDir: string): Promise<Guangyun> {
    const get = async (name: string) =>
      (await cached(cacheDir, `ytenx-${name}`, YTENX + name)).toString().split('\n');
    // ytenx files 元 under 臻, but its Mandarin finals follow 山.
    const groups = new Map<string, string>();
    for (const line of await get('YonhGheh.txt')) {
      const [system, group] = line.split(' ');
      if (group && !system.startsWith('#')) groups.set(system, system === '元' ? '山' : group);
    }
    const tones = new Map<string, number>();
    const groupOf = new Map<string, string>();
    for (const line of await get('YonhMiuk.txt')) {
      const [rhyme, system, tone] = line.split(' ');
      if (!tone || rhyme.startsWith('#')) continue;
      tones.set(rhyme, +tone);
      groupOf.set(rhyme, groups.get(system) ?? '');
    }
    const classes = new Map<number, SoundClass>();
    for (const line of await get('SieuxYonh.txt')) {
      const [id, , initial, , rhyme] = line.split(' ');
      if (!rhyme) continue;
      const tone = tones.get(rhyme) as SoundClass['tone'];
      classes.set(+id, { id: +id, initial, rhyme, tone, group: groupOf.get(rhyme) ?? '' });
    }
    const byChar = new Map<string, SoundClass[]>();
    for (const line of await get('Dzih.txt')) {
      const [c, id] = line.split(' ');
      if (!id) continue;
      const k = fold(c);
      const list = byChar.get(k) ?? [];
      if (!list.some((s) => s.id === +id)) list.push(classes.get(+id)!);
      byChar.set(k, list);
    }
    return new Guangyun(byChar);
  }

  classesOf(c: string): SoundClass[] {
    return this.byChar.get(fold(c)) ?? [];
  }

  /** 音X: the classes the character shares with X, or X's own when 廣韻 files the reading under X. */
  homophone(c: string, x: string): SoundClass[] {
    const xs = this.classesOf(x);
    const shared = this.classesOf(c).filter((s) => xs.some((t) => t.id === s.id));
    return shared.length ? shared : xs;
  }

  /** AB反: A's initial with B's rhyme and tone, each read in the class its modern reading fits. */
  fanqie(a: string, b: string): SoundClass[] {
    const as = this.classesOf(a);
    const bs = this.classesOf(b);
    const ma = modern(a);
    const mb = modern(b);
    const upper = as.filter((s) => (INITIALS[s.initial] ?? []).includes(initialOf(ma)));
    const lower = bs.filter((s) => fits(mb, s));
    const out: SoundClass[] = [];
    for (const i of new Set((upper.length ? upper : as).map((s) => s.initial))) {
      for (const r of lower.length ? lower : bs) out.push({ ...r, id: 0, initial: i });
    }
    return out;
  }

  /** The pinyin of a character in these classes, or null when no single candidate fits. */
  pinyin(c: string, classes: SoundClass[], hint?: string): string | null {
    if (!classes.length) return null;
    let fit = candidates(c).filter((p) => classes.some((s) => fits(p, s)));
    if (!fit.length) fit = candidates(c).filter((p) => classes.some((s) => fits(p, s, true)));
    if (fit.length <= 1) return fit[0] ?? null;
    if (hint && fit.includes(modern(hint))) return modern(hint);
    const near = hint ? fit.filter((p) => final(p) === final(modern(hint))) : [];
    if (near.length === 1) return near[0];
    // Readings that differ only in a colloquial or rare form: take the first, most common one.
    return fit.every((p) => classes.every((s) => fits(p, s))) ? fit[0] : null;
  }

  /** The classes behind each candidate reading, so a tone named by a commentary can be checked. */
  tonesOf(c: string, p: string): number[] {
    return this.classesOf(c)
      .filter((s) => fits(p, s))
      .map((s) => s.tone);
  }
}
