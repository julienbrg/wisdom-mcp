import { readFileSync } from 'node:fs';
import { gitaRange } from './originals/gita-verses.js';
import { squash, type BilaraSegment, type SourceText } from './originals/source.js';

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

// Where each Wikisource paragraph of a chapter starts, in Giles's sections. "22+" starts within
// section 22, which then spans both paragraphs.
const ART_OF_WAR_PARAGRAPHS = [
  '1 5 15 26',
  '1 8 10 15 16 19',
  '1 3 6 8 11 12 17 18',
  '1 5 8 11 17',
  '1 5 12 16 19 21',
  '1 3 6 10 13 19 22+ 29',
  '1 5 15 23 27 33',
  '1 7 11 12',
  '1 11 15 18 40 42',
  '1 14 21 25 27',
  '1 15 20 29 35 42 52 63',
  '1 5 15',
  '1 7 14 20 26',
].map(startsOf);

// Where each Sefaria mishnah of a chapter of Pirkei Avot starts, in Gorfinkle's numbering, which
// follows Taylor's. "11+" starts within his 11, which then spans both.
const AVOT_MISHNAYOT = [
  '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18',
  '1 2 3 4 6 7 8 9 13 15 16 17 18 19 20 21',
  '1 2 4 5 6 7 8 10 11 13 15 16 17 18 19 20 21 23',
  '1 2 3 4 6 8 9 10 11 12 13 15 16 18 19 21 22 23 24 25 28 29',
  '1 2 4 5 8 9 10 11 11+ 13 14 15 16 17 18 19 20 21 22 23 24 25 26',
  '1 2 3 4 5 6 7 8 9 10 11',
].map(startsOf);

function startsOf(starts: string): number[] {
  return starts.split(' ').map((s) => (s.endsWith('+') ? parseFloat(s) + 0.5 : +s));
}

// The source units that sections from..to of a chapter fall in, by where each unit starts.
function unitsOf(table: number[][], sep: string, ch: number, from: number, to: number): string {
  const starts = table[ch - 1];
  const first = starts.findLastIndex((s) => s <= from) + 1;
  const last = starts.findLastIndex((s) => s < to + 1) + 1;
  return first === last ? `${ch}${sep}${first}` : `${ch}${sep}${first}-${last}`;
}

/** The source paragraphs that Giles's sections from..to of a chapter fall in: "6.6-7". */
export function artOfWarUnit(ch: number, from: number, to: number): string {
  return unitsOf(ART_OF_WAR_PARAGRAPHS, '.', ch, from, to);
}

/** The mishnayot that Gorfinkle's sayings from..to of a chapter fall in: "5:8-9". */
export function avotUnit(ch: number, from: number, to: number): string {
  return unitsOf(AVOT_MISHNAYOT, ':', ch, from, to);
}

// Giles's notes are in brackets, and some run over several blocks: an unclosed one goes on with
// the quotation after it, and a block ending in "]" closes one.
function artOfWar(): Scheme {
  let ch = 0;
  let secs: [number, number] | null = null;
  let open = false;
  return {
    start: /^Chapter I\. /,
    split: /(?<=\])\n(?=\d+\. )/,
    read(piece) {
      const m = piece.match(/^Chapter ([IVX]+)\./);
      if (m) {
        [ch, secs, open] = [roman(m[1]), null, false];
        return { heading: true };
      }
      const text = squash(piece);
      if (text.startsWith('[') || text.endsWith(']') || (open && text.startsWith('"'))) {
        const depth = (text.match(/\[/g)?.length ?? 0) - (text.match(/\]/g)?.length ?? 0);
        open = text.startsWith('[') ? depth > 0 : open && !text.endsWith(']');
        return { heading: true };
      }
      open = false;
      // "5, 6." for two sections in one; the scan drops a period now and then ("9 There").
      const n = text.match(/^(\d+)(?:, (\d+))?(\.?)\s+/);
      const last = secs?.[1] ?? 0;
      if (n && +n[1] > last && +n[1] <= last + 2 && (n[3] || +n[1] === last + 1)) {
        secs = [+n[1], +(n[2] ?? n[1])];
        return { text: piece.replace(/^\d+(?:, \d+)?\.?\s+/, '') };
      }
      return { text: piece };
    },
    ref() {
      if (!ch || !secs) return null;
      const [from, to] = secs;
      return {
        ref: from === to ? `${ch}.${from}` : `${ch}.${from}-${to}`,
        refUnit: artOfWarUnit(ch, from, to),
      };
    },
  };
}

// Gorfinkle's sayings are numbered within each chapter, several to a block at times, and the next
// one may start midline, after the end of a sentence ("(31).  13. He used to say"). His notes open
// with their number in brackets, and the sayings read before and after each chapter are not part of
// the tractate.
function pirkeiAvot(): Scheme {
  let ch = 0;
  let sayings: [number, number] | null = null;
  return {
    start: /^CHAPTER I$/,
    end: /TRANSCRIPTION NOTES$/,
    read(piece) {
      const m = piece.match(/^CHAPTER ([IVX]+)$/);
      if (m) [ch, sayings] = [roman(m[1]), null];
      if (m || /^[([]/.test(piece)) return { heading: true };
      let first = 0;
      let last = sayings?.[1] ?? 0;
      while (new RegExp(`(?:^|[.!?)'"]\\s+)${last + 1}\\.\\s`).test(piece)) {
        last++;
        first ||= last;
      }
      if (!first) return { heading: true };
      sayings = [first, last];
      return { text: piece.replace(/^\d+\.\s+/, '') };
    },
    ref() {
      if (!ch || !sayings) return null;
      const [from, to] = sayings;
      return {
        ref: from === to ? `${ch}:${from}` : `${ch}:${from}-${to}`,
        refUnit: avotUnit(ch, from, to),
      };
    },
  };
}

const SCHEMES: Record<string, () => Scheme> = {
  'tao-te-ching': taoTeChing,
  analects,
  dhammapada,
  'bhagavad-gita': bhagavadGita,
  enchiridion,
  meditations,
  'art-of-war': artOfWar,
  'sermon-on-the-mount': bible,
  ecclesiastes: bible,
  job: bible,
  proverbs: bible,
  psalms: bible,
  'pirkei-avot': pirkeiAvot,
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
  /**
   * A scan's footnotes, which run from the first one on a page to the next page head, but for the
   * blocks of text that open like a note by margin noise, or follow one the scan misplaced.
   */
  footnotes?: {
    note(text: string, raw: string): boolean;
    head(text: string): boolean;
    text?: string[];
    /** Blocks that open a page's notes though they do not look like it. */
    notes?: string[];
  };
}

const LOWER = /\p{Ll}/u;

// A scan's page head, page number or chapter heading: short and mostly capitals, though the OCR
// reads some of them in lowercase ("THl WOEKS OF MOTSE", "m THE WORKS OE HSt)]SrTZE . xvii").
function scanHead(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  const capitals = letters.filter((c) => /\p{Lu}/u.test(c)).length;
  return (
    /^\W*(?:BOOK|CHAP)/.test(text) ||
    capitals >= letters.length * 0.7 ||
    (text.split(' ').length <= 9 && /W[OQ0][RBEK]{1,2}S O[FEPKR]\b/.test(text))
  );
}

// Legge's notes are set in smaller type, so their lines run longer than the text's, which never pass
// 56 characters; a block that opens with a paragraph number is still text.
function smallType(text: string, raw: string): boolean {
  if (/\p{L}{25}/u.test(text)) return false;
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const full = (lines.length > 1 ? lines.slice(0, -1) : lines)
    .map((l) => l.length)
    .sort((a, b) => a - b);
  return full[full.length >> 1] > 56 && !/^(?:Chapter \S+ )?\d+(?:-\d+)?[.,] /.test(text);
}

// The I Ching's page heads ("SECT. I. THE KHWAN HEXAGRAM. 59", "62 THE Yi KING. TEXT.", "HEX. 3.
// APPENDIX I. 215", "CHAP. II, APPENDIX III. 351", "214 THE APPENDIXES. SECT. I.") and titles.
const LEGGE_HEAD =
  /^(?:S[\w?]{2,3}[.,?]? (?:\S{1,3}[.,]? )?(?:T\w{1,2} |APPENDIX)|HEX\W.{0,10}APPENDIX|CHAP\W.{0,8}APPENDIX|APPENDIX [IVXL]+\.? \S*\d|\W?\d+ T\S{1,3} (?:[Yy]\S{0,2} KING|APPEN\w+))/;
const LEGGE_TITLE =
  /^(?:[IVXLTl]+\.? T\S{1,2} \S.{0,28}|THE APPENDIXES\.|APPENDIX [IVXL]+\.(?: Treatise.*)?|Section \S+?[.,]?(?: \S+\.)?|TEXT\. SECTION.*|Tue GREAT APPENDIX.*|Treatise on .*|Supplementary .*|A P\.?\s?[BR]\s?E\s?N.*)$/;
const leggeHead = (text: string) => LEGGE_HEAD.test(text) || LEGGE_TITLE.test(text);
// Titles, page heads (but for one the scan runs into the first line of the page) and rules the
// scan reads as one long word.
const leggeApparatus = (text: string) =>
  LEGGE_TITLE.test(text) ||
  (LEGGE_HEAD.test(text) && !/(?:\p{Ll}+ ){4}/u.test(text)) ||
  /\p{L}{25}/u.test(text);

// Plato's translators give no Stephanus numbers, so each work is aligned on the Stephanus sections
// of the Perseus English translation, whose milestones are those of the Greek. Titles, book heads,
// the persons and scene of a dialogue, and the translator's notes are apparatus.
const plato = (start: RegExp, notes: string[] = []): Layout => ({
  start,
  apparatus: (text) =>
    !LOWER.test(text) ||
    /^(?:PERSONS OF THE DIALOGUE|SCENE:|PLACE OF THE NARRATION:)/.test(text) ||
    notes.some((n) => text.startsWith(n)),
});

// A scan's page heads, signature marks and stray letters; its footnotes are left out by the anchors.
const scan = (start: RegExp, skip?: [RegExp, RegExp]): Layout => ({
  start,
  skip,
  apparatus: (text) => scanHead(text) || (text.match(/\p{L}/gu)?.length ?? 0) < 4,
});

// Translations with no numbers, aligned by hand on the source paragraphs, or Plato's as above.
// The later Greek works are aligned the same way on a Perseus or First1KGreek English
// translation, or on the translator's own chapter numbers.
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
  // A scan. Footnotes open with the OCR of their mark, or with its number; stray letters are noise.
  mozi: {
    start: /^BOOK I$/,
    apparatus: (text) => scanHead(text) || (text.match(/\p{L}/gu)?.length ?? 0) < 4,
    footnotes: {
      note: (text) => /^(?:[*®^’•»°]|\d{1,2} \p{Lu})/u.test(text),
      head: scanHead,
      text: ['Examples of sucli are', '^ Chow of Yin in wine', '^ and none in the world'],
    },
  },
  // A scan, with folio numbers and margin summaries run into the text, even before a note's mark.
  xunzi: {
    start: /^BOOK I$/,
    end: /^CHINESE INDEX/,
    apparatus: (text) => scanHead(text) || (text.match(/\p{L}/gu)?.length ?? 0) < 4,
    footnotes: {
      note: (text) => /^(?:[^\p{L}\d\s]?\p{L}?\s)?[*®^’•»°]|^1 \p{Lu}/u.test(text),
      head: scanHead,
      text: [
        'peaceful or uneasy, beneficial',
        'Wherein is it that man is truly man',
        'The young serve the old',
        'I desire to be mean and yet noble',
        'Li Sze ® questioned',
        "*'Ts‘u^ and Yueh® would not admit",
        'This is not so. T‘ang and Wu were the best',
        '^ laziness ; they provide for weeping',
        "^ ' wEen everyone’s powers",
        '^te^olioy of But the righteous king',
        '•not equal to that of the horse',
        '^ the clear water at the top',
        '’! purity, nothing can overturn it',
        'Yao ^ asked Shun',
        'Fan-jo and Chii-shu',
      ],
    },
  },
  // A scan. Notes run from the first one on a page to the next page head or title.
  'i-ching': {
    start: /^TEXT\. SECTION/,
    apparatus: (text) => leggeApparatus(text) || (text.match(/\p{L}/gu)?.length ?? 0) < 4,
    footnotes: {
      note: smallType,
      head: leggeHead,
      text: [
        'XI. ‘The little come and the great gone',
        'its correct place. (Its subject) occupies',
        'to the subject of the line), and its being',
        'Strength in A4ien',
      ],
      notes: ['XIV. Ta YG means', 'LI. Paragraph 1. See what'],
    },
  },
  // A scan: page numbers and section titles have no lowercase (or read "5i"), and notes open with *.
  'tao-te-ching-giles': {
    start: /^TAO IN ITS TRANSCENDENTAL ASPECT/,
    apparatus: (text) => text.startsWith('*') || !LOWER.test(text) || /^\d+[il]?$/.test(text),
  },
  euthyphro: plato(/^EUTHYPHRO: Why have you left the Lyceum/),
  apology: plato(/^How you, O Athenians, have been affected/),
  crito: plato(/^SOCRATES: Why have you come at this hour/),
  phaedo: plato(/^ECHECRATES: Were you yourself, Phaedo/, ['(Compare Milton', "'But when lust"]),
  theaetetus: plato(/^EUCLID: Have you only just arrived/),
  symposium: plato(/^Concerning the things about which you ask/),
  phaedrus: plato(/^SOCRATES: My dear Phaedrus, whence come you/),
  'alcibiades-i': plato(/^SOCRATES: I dare say that you may be surprised/),
  protagoras: plato(/^COMPANION: Where do you come from, Socrates/),
  gorgias: plato(/^CALLICLES: The wise man, as the proverb says/),
  meno: plato(/^MENO: Can you tell me, Socrates/),
  republic: plato(/^I went down yesterday to the Piraeus/),
  timaeus: plato(/^SOCRATES: One, two, three; but where/),
  laws: plato(/^ATHENIAN: Tell me, Strangers, is a God/),
  'seventh-letter': plato(/^plato to the kindred and friends of dion/),
  metaphysics: scan(/^1 ALL men by nature desire to know/),
  'nicomachean-ethics': {
    start: /^Every art, and every science reduced/,
    end: /^NOTES$/,
    apparatus: (text) => !LOWER.test(text) || /^(?:Chapter [IVXL]+\.|\[Illustration\])$/.test(text),
  },
  politics: {
    start: /^As we see that every city is a society/,
    end: /^INDEX$/,
    apparatus: (text) => !LOWER.test(text),
  },
  rhetoric: { start: /^Rhetoric is a counterpart/, apparatus: (text) => text.startsWith('#') },
  'discourses-selection': {
    start: /^OF THE THINGS WHICH ARE IN OUR POWER/,
    apparatus: (text) => !LOWER.test(text),
  },
};

/** Where each unit starts, in order: a block's opening words, or after "…", words within one. */
export type Anchor = [unit: string | null, at: string];

const loadAnchors = (workId: string): Anchor[] =>
  JSON.parse(
    readFileSync(new URL(`../../data/alignments/${workId}.json`, import.meta.url), 'utf-8'),
  ) as Anchor[];

// "10.6" to "10.7" in one block is "10.6-7", as sourceUnits reads it, and Stephanus "70a" to "70c"
// is "70a-c", but "70d" to "71b" is "70d-71b".
function span(from: string, to: string): string {
  const [f, t] = [from, to].map((u) => u.match(/^(\d+)([a-e])$/));
  if (f || t) {
    if (!f || !t) throw new Error(`no range from ${from} to ${to}`);
    if (+t[1] < +f[1] || (t[1] === f[1] && t[2] <= f[2]))
      throw new Error(`no range from ${from} to ${to}`);
    return `${from}-${t[1] === f[1] ? t[2] : to}`;
  }
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
  const texts = blocks.map(squash);
  const start = texts.findIndex((t) => layout.start.test(t));
  if (start < 0) throw new Error(`${workId}: main text start not found`);
  let k = 0;
  let unit: string | null = null;
  let ended = false;
  let skipping = false;
  let inNotes = false;
  const notes = blocks.map((b, n) => {
    if (!layout.footnotes) return false;
    const text = texts[n];
    if (layout.footnotes.head(text)) return (inNotes = false);
    const { note, text: notNotes = [], notes: opening = [] } = layout.footnotes;
    if (notNotes.some((o) => text.startsWith(o))) return (inNotes = false);
    return (inNotes ||= note(text, b) || opening.some((o) => text.startsWith(o)));
  });
  const segments = blocks.map((raw, n) => {
    const text = texts[n];
    ended ||= n > start && !!layout.end?.test(text);
    if (layout.skip?.[0].test(text)) skipping = true;
    else if (layout.skip?.[1].test(text)) skipping = false;
    let ref: string | null = null;
    if (n >= start && !ended && !skipping && !notes[n] && !layout.apparatus(text, raw)) {
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

const letters = (s: string) =>
  s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

const sutta = (id: string) => id.split(':')[0];

/**
 * Sujato's translations, split on SuttaCentral's paragraphs: each block is found, in order, in the
 * run of segments of one sutta it was made from. Its reference is that segment range, and its unit
 * the root paragraphs they belong to. Titles, headings and colophons are apparatus.
 */
export function bilara(workId: string, blocks: string[], all: BilaraSegment[]): Segment[] {
  const segments = all.map((s) => ({ ...s, letters: letters(s.text) })).filter((s) => s.letters);
  let stream = '';
  const first = new Map<number, number>();
  const ends = new Map<number, number>();
  segments.forEach((s, i) => {
    first.set(stream.length, i);
    stream += s.letters;
    ends.set(stream.length, i);
  });
  const range = (a: string, b: string) => (a === b ? a : `${a}-${b.split(':')[1]}`);
  let cursor = 0;
  const missing: string[] = [];
  const out = blocks.map((raw, n) => {
    const none = { n, part: 0, raw, text: raw, ref: null, refUnit: null, apparatus: true };
    const needle = letters(raw.replace(/^#\s*/, ''));
    if (!needle) return none;
    const within = (at: number) => {
      const [a, b] = [first.get(at), ends.get(at + needle.length)];
      return a !== undefined && b !== undefined && sutta(segments[a].id) === sutta(segments[b].id);
    };
    let at = stream.indexOf(needle, cursor);
    while (at >= 0 && !within(at)) at = stream.indexOf(needle, at + 1);
    if (at < 0) {
      missing.push(squash(raw).slice(0, 60));
      return none;
    }
    cursor = at + needle.length;
    const run = segments.slice(first.get(at), ends.get(cursor)! + 1);
    if (run.every((s) => s.heading)) return none;
    const [a, b] = [run[0], run[run.length - 1]];
    return { ...none, ref: range(a.id, b.id), refUnit: range(a.unit, b.unit), apparatus: false };
  });
  if (missing.length)
    throw new Error(`${workId}: not in the SuttaCentral translation:\n${missing.join('\n')}`);
  return out;
}

export function segment(
  workId: string,
  blocks: string[],
  source?: Pick<SourceText, 'units' | 'segments'>,
): Segment[] {
  if (ANCHORED[workId]) return anchored(workId, blocks, loadAnchors(workId));
  if (source?.segments) return bilara(workId, blocks, source.segments);
  if (ALIGNED.has(workId)) {
    if (!source) throw new Error(`${workId}: references come from the source text`);
    return aligned(blocks, source.units);
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
