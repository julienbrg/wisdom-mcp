import { cached } from '../cache.js';
import { decodeEntities, squash, type SourceText } from './source.js';

const API = 'https://www.sefaria.org/api/v3/texts';

const MAM = 'Miqra according to the Masorah';

// Each work's Sefaria book and Hebrew version, and what to drop from its markup.
const BOOKS: Record<string, { book: string; version: string; drop?: RegExp }> = {
  ecclesiastes: { book: 'Ecclesiastes', version: MAM },
  job: { book: 'Job', version: MAM },
  proverbs: { book: 'Proverbs', version: MAM },
  psalms: { book: 'Psalms', version: MAM },
  // Torat Emet cites verses in brackets, and runs the saying recited after a chapter into 6:11.
  'pirkei-avot': {
    book: 'Pirkei_Avot',
    version: 'Torat Emet 357',
    drop: /\s*\([^()<>]*\)|<br><br>[\s\S]*$/g,
  },
};

interface Response {
  versions: { versionTitle: string; license: string; text: string[][] }[];
}

export function cleanVerse(html: string): string {
  return squash(
    decodeEntities(
      html
        .replace(/<span class="mam-spi-[^"]*">[^<]*<\/span>/g, '')
        .replace(/<br\s*\/?>/g, ' ')
        .replace(/<[^>]+>/g, ''),
    ),
  );
}

export async function loadSefaria(workId: string, cacheDir: string): Promise<SourceText> {
  if (!BOOKS[workId]) throw new Error(`${workId}: no Sefaria book`);
  const { book, version, drop } = BOOKS[workId];
  const url = `${API}/${book}?version=${encodeURIComponent(`hebrew|${version}`)}`;
  const res = JSON.parse(
    (await cached(cacheDir, `sefaria-${workId}.json`, url)).toString(),
  ) as Response;
  const [found] = res.versions;
  if (!found) throw new Error(`${workId}: Sefaria has no ${version} for ${book}`);
  const units = new Map();
  found.text.forEach((verses, c) =>
    verses.forEach((html, v) =>
      units.set(`${c + 1}:${v + 1}`, {
        body: cleanVerse(drop ? html.replace(drop, '') : html),
        url: `https://www.sefaria.org/${book}.${c + 1}.${v + 1}?lang=he`,
      }),
    ),
  );
  return { license: `${found.license} (Sefaria, ${found.versionTitle})`, units };
}
