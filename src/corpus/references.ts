import { gitaRange } from './originals/gita-verses.js';

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

export function segment(workId: string, blocks: string[]): Segment[] {
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
