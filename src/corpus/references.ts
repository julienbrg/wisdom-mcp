import { readFileSync } from 'node:fs';
import { gitaRange } from './originals/gita-verses.js';
import { squash } from './originals/source.js';

export interface Segment {
  n: number;
  part: number;
  raw: string;
  text: string;
  ref: string | null;
  refUnit: string | null;
  apparatus: boolean;
}

type Ref = { ref: string; refUnit: string };
type Step = { heading: true } | { heading?: false; text: string };

interface Scheme {
  start: RegExp;
  end?: RegExp;
  split?: RegExp;
  read(piece: string): Step;
  ref(): Ref | null;
}

export function roman(s: string): number {
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = v[s[i]];
    n += cur < (v[s[i + 1]] ?? 0) ? -cur : cur;
  }
  return n;
}

const ORDINALS = [
  'FIRST',
  'SECOND',
  'THIRD',
  'FOURTH',
  'FIFTH',
  'SIXTH',
  'SEVENTH',
  'EIGHTH',
  'NINTH',
  'TENTH',
  'ELEVENTH',
  'TWELFTH',
];

function taoTeChing(): Scheme {
  let ch = 0;
  let para = 0;
  return {
    start: /^Ch\. 1\. 1\./,
    read(piece) {
      if (/^PART [\dIVX]+\.$/.test(piece)) return { heading: true };
      let m = piece.match(/^(?:Ch\. )?(\d+)\. (\d+)\.\s*/);
      if (m && +m[1] === ch + 1) {
        ch = +m[1];
        para = +m[2];
        return { text: piece.slice(m[0].length) };
      }
      m = piece.match(/^(\d+)\.(?:\s+|$)/);
      if (m) {
        const n = +m[1];
        const rest = piece.slice(m[0].length);
        if (n === para + 1) para = n;
        else if (n === ch + 1) [ch, para] = [n, 0];
        else return { text: piece };
        return rest ? { text: rest } : { heading: true };
      }
      return { text: piece };
    },
    ref: () => (ch ? { ref: para ? `${ch}.${para}` : `${ch}`, refUnit: `${ch}` } : null),
  };
}

function analects(): Scheme {
  let book = 0;
  let chap = 0;
  return {
    start: /^CONFUCIAN ANALECTS\.\s+BOOK I\./,
    split: /\n\s*(?=CHAP(?:TER|\.)? [IVXL]+\b)/,
    read(piece) {
      let m = piece.match(/^(?:CONFUCIAN ANALECTS\.\s+)?BOOK ([IVXL]+)\./);
      if (m) {
        [book, chap] = [roman(m[1]), 0];
        return { heading: true };
      }
      // Counted, not read: the printed numerals have typos (two XVIIs in book II).
      m = piece.match(/^CHAP(?:TER|\.)? [IVXL]+\.?\s*/);
      if (m) {
        chap++;
        return { text: piece.slice(m[0].length) };
      }
      return { text: piece };
    },
    ref: () => (chap ? { ref: `${book}.${chap}`, refUnit: `${book}.${chap}` } : null),
  };
}

function dhammapada(): Scheme {
  let unit = '';
  return {
    start: /^Chapter I\. /,
    read(piece) {
      if (/^Chapter [IVXL]+\. /.test(piece)) return { heading: true };
      const m = piece.match(/^(\d+)(?:, (\d+))?\.\s*/);
      if (m) {
        unit = m[2] ? `${m[1]}-${m[2]}` : m[1];
        return { text: piece.slice(m[0].length) };
      }
      return { text: piece };
    },
    ref: () => (unit ? { ref: unit, refUnit: unit } : null),
  };
}

function bhagavadGita(): Scheme {
  let ch = 0;
  let passage = 0;
  return {
    start: /^CHAPTER I$/,
    end: /^\[FN#1\]/,
    read(piece) {
      const m = piece.match(/^CHAPTER ([IVXL]+)$/);
      if (m) [ch, passage] = [roman(m[1]), 0];
      if (m || /^HERE END/.test(piece)) return { heading: true };
      passage++;
      return { text: piece };
    },
    ref() {
      if (!ch) return null;
      const unit = `${ch}.${gitaRange(ch, passage)}`;
      return { ref: unit, refUnit: unit };
    },
  };
}

function enchiridion(): Scheme {
  let sec = 0;
  return {
    start: /^THE ENCHIRIDION$/,
    end: /^Footnotes$/,
    read(piece) {
      const m = piece.match(/^([IVXL]+)(?:\[\d+\])?$/);
      if (m) sec = roman(m[1]);
      return m || piece === 'THE ENCHIRIDION' ? { heading: true } : { text: piece };
    },
    ref: () => (sec ? { ref: `${sec}`, refUnit: `${sec}` } : null),
  };
}

function meditations(): Scheme {
  let book = 0;
  let sec = 0;
  return {
    start: /^THE FIRST BOOK$/,
    end: /^APPENDIX$/,
    read(piece) {
      let m = piece.match(/^THE (\w+) BOOK$/);
      if (m) {
        [book, sec] = [ORDINALS.indexOf(m[1]) + 1, 0];
        return { heading: true };
      }
      // This edition has no 2.5 or 6.38, so a section may skip one number.
      m = piece.match(/^([IVXLC]+)\.?\s+/);
      const n = m ? roman(m[1]) : 0;
      if (m && n > sec && n <= sec + 2) {
        sec = n;
        return { text: piece.slice(m[0].length) };
      }
      return { text: piece };
    },
    ref: () => (sec ? { ref: `${book}.${sec}`, refUnit: `${book}.${sec}` } : null),
  };
}

function bible(): Scheme {
  let unit = '';
  return {
    start: /^\d\d:\d{3}:\d{3} /,
    read(piece) {
      const m = piece.match(/^\d\d:(\d{3}):(\d{3})\s+/);
      if (m) {
        unit = `${+m[1]}:${+m[2]}`;
        return { text: piece.slice(m[0].length) };
      }
      return { text: piece };
    },
    ref: () => (unit ? { ref: unit, refUnit: unit } : null),
  };
}

const SCHEMES: Record<string, () => Scheme> = {
  'tao-te-ching': taoTeChing,
  analects,
  dhammapada,
  'bhagavad-gita': bhagavadGita,
  enchiridion,
  meditations,
  'sermon-on-the-mount': bible,
  ecclesiastes: bible,
};

// Texts with no numbers, where each Chinese paragraph is followed by Legge's translation of it.
const ALIGNED = new Set(['great-learning', 'doctrine-of-the-mean', 'mencius']);

const HAN = /\p{Script=Han}/gu;
const bigrams = (s: string) => {
  const han = s.match(HAN) ?? [];
  return han.slice(1).map((c, i) => han[i] + c);
};

// The chapter a Chinese paragraph comes from, by the share of its character pairs found in it.
// A paragraph may run over into the next chapter: "14-15", "1A.6-7".
function locate(
  pairs: string[],
  units: { unit: string; pairs: Set<string> }[],
  previous: number,
): { at: number; unit: string } | null {
  const share = (i: number, of = pairs) =>
    of.filter((p) => units[i].pairs.has(p)).length / of.length;
  const scores = units.map((_, i) => share(i));
  const best = Math.max(...scores);
  if (best < 0.5) return null;
  // Short paragraphs can score as well elsewhere: stay closest to where the last one was.
  const at = scores
    .map((s, i) => (s >= best - 0.05 ? i : -1))
    .filter((i) => i >= 0)
    .sort((a, b) => Math.abs(a - previous - 0.5) - Math.abs(b - previous - 0.5))[0];
  const unit = units[at].unit;
  const rest = pairs.filter((p) => !units[at].pairs.has(p));
  if (rest.length < 3 || rest.length < pairs.length * 0.1) return { at, unit };
  const prefix = (u: string) => u.replace(/\d+$/, '');
  for (const next of [at - 1, at + 1]) {
    const other = units[next]?.unit;
    if (!other || prefix(other) !== prefix(unit) || share(next, rest) < 0.8) continue;
    const [a, b] = next < at ? [other, unit] : [unit, other];
    return { at, unit: `${a}-${b.match(/\d+$/)![0]}` };
  }
  return { at, unit };
}

function aligned(blocks: string[], source: ReadonlyMap<string, { body: string }>): Segment[] {
  const units = [...source].map(([unit, { body }]) => ({ unit, pairs: new Set(bigrams(body)) }));
  let previous = -1;
  let unit: string | null = null;
  return blocks.map((raw, n) => {
    const han = raw.match(HAN)?.length ?? 0;
    const chinese = han * 2 > raw.replace(/\s/g, '').length;
    if (raw.trim().startsWith('#') || (chinese && !/[，。：；！？、]/.test(raw))) unit = null;
    else if (chinese) {
      const found = locate(bigrams(raw), units, previous);
      if (found) previous = found.at;
      unit = found?.unit ?? null;
    }
    // The Chinese paragraphs are the source text, so only the translation is quotable.
    const at = chinese ? null : unit;
    return { n, part: 0, raw, text: raw, ref: at, refUnit: at, apparatus: !at };
  });
}

interface Layout {
  start: RegExp;
  end?: RegExp;
  /** A section left out, from the first heading up to the second. */
  skip?: [RegExp, RegExp];
  apparatus(text: string, raw: string): boolean;
}

const LOWER = /\p{Ll}/u;

// Translations with no numbers, aligned by hand on the source paragraphs.
const ANCHORED: Record<string, Layout> = {
  // Giles's notes and chapter arguments are indented, and titles have no lowercase.
  'chuang-tzu': {
    start: /^CHAPTER I\.$/,
    end: /^_INDEX_$/,
    apparatus: (text, raw) => raw.startsWith(' ') || text.startsWith('[') || !LOWER.test(text),
  },
  liezi: {
    start: /^## Book I$/,
    skip: [/^## Footnotes$/, /^## Book /],
    apparatus: (text) => /^(?:#|\*\*\*)/.test(text),
  },
  // A scan: page numbers and section titles have no lowercase (or read "5i"), and notes open with *.
  'tao-te-ching-giles': {
    start: /^TAO IN ITS TRANSCENDENTAL ASPECT/,
    apparatus: (text) => text.startsWith('*') || !LOWER.test(text) || /^\d+[il]?$/.test(text),
  },
};

/** Where each unit starts, in order: a block's opening words, or after "…", words within one. */
export type Anchor = [unit: string | null, at: string];

const loadAnchors = (workId: string): Anchor[] =>
  JSON.parse(
    readFileSync(new URL(`../../data/alignments/${workId}.json`, import.meta.url), 'utf-8'),
  ) as Anchor[];

// "10.6" to "10.7" in one block is "10.6-7", as sourceUnits reads it.
function span(from: string, to: string): string {
  const [, prefix, a] = from.match(/^(.*?)(\d+)$/)!;
  const [, prefix2, b] = to.match(/^(.*?)(\d+)$/)!;
  if (prefix !== prefix2 || +b <= +a) throw new Error(`no range from ${from} to ${to}`);
  return `${from}-${b}`;
}

/**
 * Each block takes the unit of the last anchor before it, or a range when a unit starts within
 * it; an anchor with no unit leaves its block out. Every anchor must be found, in order.
 */
export function anchored(workId: string, blocks: string[], anchors: Anchor[]): Segment[] {
  const layout = ANCHORED[workId];
  const start = blocks.findIndex((b) => layout.start.test(squash(b)));
  if (start < 0) throw new Error(`${workId}: main text start not found`);
  let k = 0;
  let unit: string | null = null;
  let ended = false;
  let skipping = false;
  const segments = blocks.map((raw, n) => {
    const text = squash(raw);
    ended ||= n > start && !!layout.end?.test(text);
    if (layout.skip?.[0].test(text)) skipping = true;
    else if (layout.skip?.[1].test(text)) skipping = false;
    let ref: string | null = null;
    if (n >= start && !ended && !skipping && !layout.apparatus(text, raw)) {
      let from = unit;
      let pos = -1;
      let left = false;
      for (; k < anchors.length; k++) {
        const [next, at] = anchors[k];
        const i = at.startsWith('…')
          ? text.indexOf(at.slice(1), pos + 1)
          : pos < 0 && text.startsWith(at)
            ? 0
            : -1;
        if (i < 0) break;
        pos = i;
        if (next === null) {
          left = true;
          k++;
          break;
        }
        if (i === 0) from = next;
        unit = next;
      }
      if (!left && unit) ref = from === unit ? unit : span(from!, unit);
    }
    return { n, part: 0, raw, text: raw, ref, refUnit: ref, apparatus: !ref };
  });
  if (k < anchors.length) throw new Error(`${workId}: anchor not found: ${anchors[k].join(' ')}`);
  return segments;
}

export function segment(
  workId: string,
  blocks: string[],
  source?: ReadonlyMap<string, { body: string }>,
): Segment[] {
  if (ANCHORED[workId]) return anchored(workId, blocks, loadAnchors(workId));
  if (ALIGNED.has(workId)) {
    if (!source) throw new Error(`${workId}: references come from the source text`);
    return aligned(blocks, source);
  }
  const scheme = SCHEMES[workId]?.();
  if (!scheme) throw new Error(`no reference scheme for ${workId}`);

  const start = blocks.findIndex((b) => scheme.start.test(b.trim()));
  if (start < 0) throw new Error(`${workId}: main text start not found`);
  const after = scheme.end
    ? blocks.findIndex((b, i) => i > start && scheme.end!.test(b.trim()))
    : -1;
  const end = after < 0 ? blocks.length : after;

  return blocks.flatMap((block, n) => {
    if (n < start || n >= end) {
      return [{ n, part: 0, raw: block, text: block, ref: null, refUnit: null, apparatus: true }];
    }
    const pieces = scheme.split ? block.split(scheme.split) : [block];
    return pieces.map((raw, part) => {
      const step = scheme.read(raw.trim());
      const at = step.heading ? null : scheme.ref();
      return {
        n,
        part,
        raw,
        text: step.heading ? raw : step.text,
        ref: at?.ref ?? null,
        refUnit: at?.refUnit ?? null,
        apparatus: !at,
      };
    });
  });
}
