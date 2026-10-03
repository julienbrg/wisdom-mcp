import { cached } from '../cache.js';
import { squash, type SourceText } from './source.js';

const RAW =
  'https://raw.githubusercontent.com/suttacentral/bilara-data/published/root/pli/ms/sutta/kn/dhp';

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

export async function loadSuttaCentral(cacheDir: string): Promise<SourceText> {
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
