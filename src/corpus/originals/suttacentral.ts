import { cached } from '../cache.js';
import { squash, type BilaraSegment, type SourceText } from './source.js';

const RAW =
  'https://raw.githubusercontent.com/suttacentral/bilara-data/published/root/pli/ms/sutta/kn/dhp';
const API = 'https://suttacentral.net/api/bilarasuttas';

// One file per vagga, named after its verse range.
const VAGGAS = [
  '1-20',
  '21-32',
  '33-43',
  '44-59',
  '60-75',
  '76-89',
  '90-99',
  '100-115',
  '116-128',
  '129-145',
  '146-156',
  '157-166',
  '167-178',
  '179-196',
  '197-208',
  '209-220',
  '221-234',
  '235-255',
  '256-272',
  '273-289',
  '290-305',
  '306-319',
  '320-333',
  '334-359',
  '360-382',
  '383-423',
];

// "ud" with [10, 10] is ud1.1 … ud1.10, ud2.1 … ud2.10.
const chapters = (collection: string, sizes: number[]) =>
  sizes.flatMap((size, c) =>
    Array.from({ length: size }, (_, i) => `${collection}${c + 1}.${i + 1}`),
  );

// The suttas of each work, in the order of its translation.
const SUTTAS: Record<string, string[]> = {
  'pali-core-suttas': ['sn56.11', 'mn10', 'mn118', 'snp1.8', 'an3.65', 'dn31'],
  'sutta-nipata': chapters('snp', [12, 14, 12, 16, 19]),
  udana: chapters('ud', [10, 10, 10, 10, 10, 10, 10, 10]),
  itivuttaka: Array.from({ length: 112 }, (_, i) => `iti${i + 1}`),
};

// Segment ids are "dhp<verse>:<line>"; line 0 and 0.x hold titles, and a vagga's
// last verse carries its closing title ("Pupphavaggo catuttho.").
export function versesOf(segments: Record<string, string>): Map<number, string> {
  const verses = new Map<number, string[]>();
  for (const [id, text] of Object.entries(segments)) {
    const m = id.match(/^dhp(\d+):([1-9]\d*)$/);
    if (!m || /vaggo\s+\S+\.\s*$/.test(text)) continue;
    verses.set(+m[1], [...(verses.get(+m[1]) ?? []), squash(text)]);
  }
  return new Map([...verses].map(([n, lines]) => [n, lines.join('\n')]));
}

async function loadDhammapada(cacheDir: string): Promise<SourceText> {
  const units = new Map();
  for (const range of VAGGAS) {
    const file = `dhp${range}_root-pli-ms.json`;
    const segments = JSON.parse((await cached(cacheDir, file, `${RAW}/${file}`)).toString());
    for (const [n, body] of versesOf(segments)) {
      units.set(`${n}`, { body, url: `https://suttacentral.net/dhp${range}/pli/ms` });
    }
  }
  return { license: 'CC0 1.0 (SuttaCentral, Mahāsaṅgīti edition)', units };
}

export interface Bilara {
  keys_order: string[];
  root_text: Record<string, string>;
  translation_text: Record<string, string>;
  html_text: Record<string, string>;
}

const OPENS_PARAGRAPH = /<(?:p|h\d|li)\b/;
// Titles, the nipāta and vagga lines, section headings, colophons and the uddāna's intro.
const HEADING = /<(?:h\d|li)\b|class='(?:end\w*|uddana-intro)'/;

/**
 * One source unit per paragraph of the root text, named after its first segment ("ud1.1:2.1"),
 * with verse lines on lines of their own.
 */
export function paragraphsOf(uid: string, sutta: Bilara) {
  const units = new Map<string, { body: string; url: string }>();
  const segments: BilaraSegment[] = [];
  let unit = '';
  let lines: string[] = [];
  const close = () => {
    const body = lines.join('').trim();
    if (unit && body) units.set(unit, { body, url: `https://suttacentral.net/${uid}/pli/ms` });
  };
  for (const id of sutta.keys_order) {
    const html = sutta.html_text[id] ?? '{}';
    if (!unit || OPENS_PARAGRAPH.test(html.split('{}')[0])) {
      close();
      [unit, lines] = [id, []];
    }
    const root = squash(sutta.root_text[id] ?? '');
    if (root) lines.push(/verse-line/.test(html) ? `${root}\n` : `${root} `);
    const text = squash((sutta.translation_text[id] ?? '').replace(/<[^>]*>/g, ''));
    if (text) segments.push({ id, unit, text, heading: HEADING.test(html) });
  }
  close();
  return { units, segments };
}

export async function loadSuttaCentral(workId: string, cacheDir: string): Promise<SourceText> {
  if (workId === 'dhammapada') return loadDhammapada(cacheDir);
  const suttas = SUTTAS[workId];
  if (!suttas) throw new Error(`no SuttaCentral texts for ${workId}`);
  const units = new Map<string, { body: string; url: string }>();
  const segments: BilaraSegment[] = [];
  for (const uid of suttas) {
    const url = `${API}/${uid}/sujato`;
    const sutta = JSON.parse((await cached(cacheDir, `bilara-${uid}-sujato.json`, url)).toString());
    const parsed = paragraphsOf(uid, sutta as Bilara);
    for (const [unit, part] of parsed.units) units.set(unit, part);
    segments.push(...parsed.segments);
  }
  return { license: 'CC0 1.0 (SuttaCentral, Mahāsaṅgīti edition)', units, segments };
}
