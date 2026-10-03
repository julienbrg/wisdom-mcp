import { cached } from '../cache.js';
import { decodeEntities, squash, type SourceText } from './source.js';

const RAW = 'https://raw.githubusercontent.com/PerseusDL/canonical-greekLit/master/data';
const SKIPPED = new Set(['note', 'head', 'bibl', 'label']);

interface Edition {
  urn: string;
  // How many levels of the citation scheme make one reference unit.
  depth: number;
  sep: string;
}

const EDITIONS: Record<string, Edition> = {
  'sermon-on-the-mount': { urn: 'tlg0031.tlg001.perseus-grc2', depth: 2, sep: ':' },
  meditations: { urn: 'tlg0562.tlg001.perseus-grc2', depth: 1, sep: '.' },
  enchiridion: { urn: 'tlg0557.tlg002.perseus-grc2', depth: 1, sep: '.' },
};

// Leaf text of every textpart, keyed by its citation path ("5.3", "4.12.2").
export function parseTei(xml: string): Map<string, string> {
  const body = xml.slice(xml.indexOf('<body'));
  const texts = new Map<string, string>();
  const divs: (string | null)[] = [];
  let skip = 0;

  for (const [token] of body.matchAll(/<[^>]+>|[^<]+/g)) {
    if (token[0] !== '<') {
      const path = divs.filter((n): n is string => n !== null).join('.');
      if (!skip && path) texts.set(path, (texts.get(path) ?? '') + decodeEntities(token));
      continue;
    }
    const [, close, name] = token.match(/^<(\/?)([\w:]+)/) ?? [];
    if (!name || token.endsWith('/>')) continue;
    if (SKIPPED.has(name)) skip += close ? -1 : 1;
    else if (name === 'div') {
      if (close) divs.pop();
      else
        divs.push(
          /type="textpart"/.test(token) ? (token.match(/\bn="([^"]+)"/)?.[1] ?? null) : null,
        );
    }
  }
  for (const [path, text] of texts) {
    if (squash(text)) texts.set(path, squash(text));
    else texts.delete(path);
  }
  return texts;
}

export function group(texts: Map<string, string>, depth: number, sep: string) {
  const units = new Map<string, { path: string; body: string }[]>();
  for (const [path, body] of texts) {
    if (!body) continue;
    const parts = path.split('.');
    const unit = parts.slice(0, depth).join(sep);
    units.set(unit, [...(units.get(unit) ?? []), { path, body }]);
  }
  return units;
}

export async function loadPerseus(workId: string, cacheDir: string): Promise<SourceText> {
  const ed = EDITIONS[workId];
  const [tg, work] = ed.urn.split('.');
  const xml = (
    await cached(cacheDir, `${ed.urn}.xml`, `${RAW}/${tg}/${work}/${ed.urn}.xml`)
  ).toString();
  const license = xml.match(/<licence[^>]*>([^<]+)/)?.[1].trim();
  if (!license) throw new Error(`${ed.urn}: no licence in the TEI header`);

  const units = new Map();
  for (const [unit, parts] of group(parseTei(xml), ed.depth, ed.sep)) {
    const body =
      parts.length === 1
        ? parts[0].body
        : parts.map((p) => `(${p.path.split('.').slice(ed.depth).join('.')}) ${p.body}`).join('\n');
    const passage = unit.replaceAll(ed.sep, '.');
    units.set(unit, {
      body,
      url: `https://scaife.perseus.org/reader/urn:cts:greekLit:${ed.urn}:${passage}/`,
    });
  }
  return { license: `${license} (Perseus Digital Library)`, units };
}
