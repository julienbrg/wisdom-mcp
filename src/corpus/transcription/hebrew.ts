// SBL general-purpose style, read from the points: spirant b, k, p become v, kh, f, a dagesh
// forte doubles, a vocal shewa is e, and vowel letters (matres lectionis) are not written.
const CONSONANTS: Record<string, [hard: string, soft?: string]> = {
  א: ['’'],
  ב: ['b', 'v'],
  ג: ['g'],
  ד: ['d'],
  ה: ['h'],
  ו: ['v'],
  ז: ['z'],
  ח: ['ch'],
  ט: ['t'],
  י: ['y'],
  כ: ['k', 'kh'],
  ך: ['k', 'kh'],
  ל: ['l'],
  מ: ['m'],
  ם: ['m'],
  נ: ['n'],
  ן: ['n'],
  ס: ['s'],
  ע: ['‘'],
  פ: ['p', 'f'],
  ף: ['p', 'f'],
  צ: ['ts'],
  ץ: ['ts'],
  ק: ['q'],
  ר: ['r'],
  ש: ['sh'],
  ת: ['t'],
};
const VOWELS: Record<string, string> = {
  '\u05B1': 'e',
  '\u05B2': 'a',
  '\u05B3': 'o',
  '\u05B4': 'i',
  '\u05B5': 'e',
  '\u05B6': 'e',
  '\u05B7': 'a',
  '\u05B8': 'a',
  '\u05B9': 'o',
  '\u05BA': 'o',
  '\u05BB': 'u',
  '\u05C7': 'o',
};
const SHEWA = '\u05B0';
const DAGESH = '\u05BC';
const SIN_DOT = '\u05C2';
const GUTTURALS = new Set(['ח', 'ע', 'ה']);

interface Letter {
  c: string;
  points: string;
}

function letters(w: string): Letter[] {
  const out: Letter[] = [];
  for (const c of w) {
    if (CONSONANTS[c]) out.push({ c, points: '' });
    else if (out.length) out.at(-1)!.points += c;
  }
  return out;
}

const vowelOf = (l: Letter) => [...l.points].map((p) => VOWELS[p] ?? '').join('') || undefined;

function word(w: string): string {
  const ls = letters(w);
  let out = '';
  let prevVowel = false;
  let prevShewa = false;
  ls.forEach((l, i) => {
    const next = ls[i + 1];
    const dagesh = l.points.includes(DAGESH);
    const vowel = vowelOf(l);
    const shewa = l.points.includes(SHEWA);
    const first = i === 0;

    // Vowel letters: holam and shuruq on vav, and yod or he after a vowel with none of their own.
    if (l.c === 'ו' && !first && !prevVowel && !shewa) {
      const holam = l.points.includes('\u05B9') || l.points.includes('\u05BA');
      if (holam || (dagesh && !vowel)) {
        out += holam ? 'o' : 'u';
        prevVowel = true;
        prevShewa = false;
        return;
      }
    }
    if ((l.c === 'י' || l.c === 'א') && !first && prevVowel && !vowel && !shewa && !dagesh) return;
    if (l.c === 'ה' && !next && prevVowel && !vowel && !dagesh) return;

    const [hard, soft] = CONSONANTS[l.c];
    let s = l.c === 'ש' && l.points.includes(SIN_DOT) ? 's' : soft && !dagesh ? soft : hard;
    if (l.c === 'א' && (first || !next)) s = '';
    if (dagesh && !first && prevVowel && l.c !== 'ו' && s !== 'sh' && s !== 'ch') s = s[0] + s;
    else if (l.c === 'ו' && dagesh && prevVowel) s = 'vv';

    // A patah under a final guttural is sounded before it.
    if (!next && vowel === 'a' && GUTTURALS.has(l.c) && l.points.includes('\u05B7')) {
      out += 'a' + s;
      prevVowel = false;
      return;
    }
    out += s;
    if (vowel) out += vowel;
    else if (shewa && next && (first || prevShewa || dagesh)) out += 'e';
    prevVowel = Boolean(vowel) || (shewa && next !== undefined && (first || prevShewa || dagesh));
    prevShewa = shewa && !prevVowel;
  });
  return out;
}

export function romanizeHebrew(text: string): string {
  return text
    .replace(/[\u0591-\u05AF\u05BD\u05C0]|\u034F/g, '')
    .replace(/\u05BE/g, '-')
    .replace(/\u05C3/g, '.')
    .replace(/[\u05D0-\u05EA][\u05B0-\u05C7]*(?:[\u05D0-\u05EA][\u05B0-\u05C7]*)*/g, word);
}
