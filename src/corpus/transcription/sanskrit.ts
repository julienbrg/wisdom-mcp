// IAST from Devanagari.
const VOWELS: Record<string, string> = {
  अ: 'a',
  आ: 'ā',
  इ: 'i',
  ई: 'ī',
  उ: 'u',
  ऊ: 'ū',
  ऋ: 'ṛ',
  ॠ: 'ṝ',
  ऌ: 'ḷ',
  ए: 'e',
  ऐ: 'ai',
  ओ: 'o',
  औ: 'au',
};
const SIGNS: Record<string, string> = {
  'ा': 'ā',
  'ि': 'i',
  'ी': 'ī',
  'ु': 'u',
  'ू': 'ū',
  'ृ': 'ṛ',
  'ॄ': 'ṝ',
  'ॢ': 'ḷ',
  'े': 'e',
  'ै': 'ai',
  'ो': 'o',
  'ौ': 'au',
};
const CONSONANTS: Record<string, string> = {
  क: 'k',
  ख: 'kh',
  ग: 'g',
  घ: 'gh',
  ङ: 'ṅ',
  च: 'c',
  छ: 'ch',
  ज: 'j',
  झ: 'jh',
  ञ: 'ñ',
  ट: 'ṭ',
  ठ: 'ṭh',
  ड: 'ḍ',
  ढ: 'ḍh',
  ण: 'ṇ',
  त: 't',
  थ: 'th',
  द: 'd',
  ध: 'dh',
  न: 'n',
  प: 'p',
  फ: 'ph',
  ब: 'b',
  भ: 'bh',
  म: 'm',
  य: 'y',
  र: 'r',
  ल: 'l',
  व: 'v',
  श: 'ś',
  ष: 'ṣ',
  स: 's',
  ह: 'h',
  ळ: 'ḷ',
};
const MARKS: Record<string, string> = {
  'ं': 'ṃ',
  'ः': 'ḥ',
  'ँ': 'm̐',
  ऽ: '’',
  '।': '|',
  '॥': '||',
  '्': '',
  '़': '',
};
const DIGITS = '०१२३४५६७८९';

export function romanizeSanskrit(text: string): string {
  let out = '';
  const chars = [...text];
  chars.forEach((c, i) => {
    if (CONSONANTS[c]) {
      const next = chars[i + 1] === '़' ? chars[i + 2] : chars[i + 1];
      out += CONSONANTS[c] + (next === '्' || (next && SIGNS[next]) ? '' : 'a');
    } else out += VOWELS[c] ?? SIGNS[c] ?? MARKS[c] ?? (DIGITS.includes(c) ? DIGITS.indexOf(c) : c);
  });
  return out;
}
