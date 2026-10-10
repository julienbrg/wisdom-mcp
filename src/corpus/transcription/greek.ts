// Romanization that keeps accents and breathings: η and ω take a macron, or a circumflex when
// the Greek has one; the rough breathing is an h before the word, and the iota subscript an i.
const LETTERS: Record<string, string> = {
  α: 'a',
  β: 'b',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'ē',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'y',
  φ: 'ph',
  χ: 'ch',
  ψ: 'ps',
  ω: 'ō',
};
const VELARS = new Set(['γ', 'κ', 'ξ', 'χ']);
const VOWELS = new Set(['α', 'ε', 'η', 'ι', 'ο', 'υ', 'ω']);
const DIPHTHONG_U = new Set(['α', 'ε', 'η', 'ο']);

const ACUTE = '́';
const GRAVE = '̀';
const CIRCUMFLEX = '͂';
const DIAERESIS = '̈';
const ROUGH = '̔';
const SUBSCRIPT = 'ͅ';

interface Letter {
  base: string;
  upper: boolean;
  marks: string;
}

function letters(word: string): Letter[] {
  const out: Letter[] = [];
  for (const c of word.normalize('NFD')) {
    if (/\p{M}/u.test(c) && out.length) out.at(-1)!.marks += c;
    else {
      const lower = c.toLowerCase();
      out.push({ base: lower, upper: lower !== c, marks: '' });
    }
  }
  return out;
}

function word(w: string): string {
  const ls = letters(w);
  const named = ls.filter((l) => LETTERS[l.base]);
  const allUpper = named.length > 1 && named.every((l) => l.upper);
  let rough = false;
  let out = '';
  ls.forEach((l, i) => {
    const prev = ls[i - 1];
    const next = ls[i + 1];
    if (l.marks.includes(ROUGH)) rough = true;
    let s = LETTERS[l.base];
    if (s === undefined) {
      out += l.base;
      return;
    }
    if (l.base === 'γ' && next && VELARS.has(next.base)) s = 'n';
    if (l.base === 'ρ' && l.marks.includes(ROUGH)) {
      s = 'rh';
      rough = false;
    }
    if (
      l.base === 'υ' &&
      ((prev && DIPHTHONG_U.has(prev.base) && !l.marks.includes(DIAERESIS)) ||
        (next?.base === 'ι' && !next.marks.includes(DIAERESIS)))
    ) {
      s = 'u';
    }
    if (l.marks.includes(CIRCUMFLEX)) s = s.replace('ē', 'e').replace('ō', 'o') + '̂';
    if (l.marks.includes(ACUTE)) s += ACUTE;
    if (l.marks.includes(GRAVE)) s += GRAVE;
    if (l.marks.includes(DIAERESIS)) s += DIAERESIS;
    if (l.marks.includes(SUBSCRIPT)) s += 'i';
    if (l.upper) s = allUpper ? s.toUpperCase() : s[0].toUpperCase() + s.slice(1);
    out += s;
  });
  if (rough && ls[0] && VOWELS.has(ls[0].base)) {
    out =
      ls[0].upper && !allUpper
        ? 'H' + out[0].toLowerCase() + out.slice(1)
        : (allUpper ? 'H' : 'h') + out;
  }
  return out.normalize('NFC');
}

export function romanizeGreek(text: string): string {
  return text
    .replace(/[ʼ᾽’]/g, '’')
    .replace(/ʽ/g, '')
    .replace(/;/g, '?')
    .replace(/[··]/g, ';')
    .replace(/[\p{Script=Greek}\p{M}]+/gu, word);
}
