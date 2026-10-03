import { cached } from '../cache.js';
import { decodeEntities, squash, type SourceText } from './source.js';

const API = 'https://www.sefaria.org/api/v3/texts/Ecclesiastes?version=hebrew';

interface Response {
  versions: { versionTitle: string; license: string; text: string[][] }[];
}

export function cleanVerse(html: string): string {
  return squash(
    decodeEntities(
      html.replace(/<span class="mam-spi-[^"]*">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, ' '),
    ),
  );
}

export async function loadSefaria(cacheDir: string): Promise<SourceText> {
  const res = JSON.parse(
    (await cached(cacheDir, 'sefaria-ecclesiastes.json', API)).toString(),
  ) as Response;
  const [version] = res.versions;
  const units = new Map();
  version.text.forEach((verses, c) =>
    verses.forEach((html, v) =>
      units.set(`${c + 1}:${v + 1}`, {
        body: cleanVerse(html),
        url: `https://www.sefaria.org/Ecclesiastes.${c + 1}.${v + 1}?lang=he`,
      }),
    ),
  );
  return { license: `${version.license} (Sefaria, ${version.versionTitle})`, units };
}
