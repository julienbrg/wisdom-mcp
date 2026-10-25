import { cached } from '../cache.js';
import { decodeEntities, squash, type SourceText } from './source.js';

const RAW = {
  perseus: 'https://raw.githubusercontent.com/PerseusDL/canonical-greekLit/master/data',
  first1k: 'https://raw.githubusercontent.com/OpenGreekAndLatin/First1KGreek/master/data',
};
const SKIPPED = new Set(['note', 'head', 'bibl', 'label']);
// The repository's licence, for the files whose header has none (Plato's).
const REPO_LICENCE =
  'Available under a Creative Commons Attribution-ShareAlike 4.0 International License';

interface Edition {
  urn: string;
  // How many levels of the citation scheme make one reference unit.
  depth: number;
  sep: string;
  /** A level left out of the unit: Diogenes Laertius numbers his sections through each book. */
  skip?: number;
  /** Prefixed to the unit, for a work that joins two editions. */
  prefix?: string;
  repo?: keyof typeof RAW;
}

/** A work cited by Stephanus sections or Bekker columns, and the textpart it is in an edition of several. */
interface StephanusEdition {
  urn: string;
  part?: string;
  bekker?: boolean;
}

const LIVES: Edition = { urn: 'tlg0004.tlg001.perseus-grc2', depth: 3, sep: '.', skip: 1 };

const EDITIONS: Record<string, Edition | Edition[]> = {
  'sermon-on-the-mount': { urn: 'tlg0031.tlg001.perseus-grc2', depth: 2, sep: ':' },
  meditations: { urn: 'tlg0562.tlg001.perseus-grc2', depth: 2, sep: '.' },
  enchiridion: { urn: 'tlg0557.tlg002.perseus-grc2', depth: 1, sep: '.' },
  // Long's selection is by chapter, and ends with the whole Encheiridion.
  'discourses-selection': [
    { urn: 'tlg0557.tlg001.perseus-grc2', depth: 2, sep: '.' },
    { urn: 'tlg0557.tlg002.perseus-grc2', depth: 1, sep: '.', prefix: 'Ench. ' },
  ],
  'lives-of-eminent-philosophers': LIVES,
  'epicurus-letters': LIVES,
  'outlines-of-pyrrhonism': {
    urn: 'tlg0544.tlg001.1st1K-grc1',
    depth: 3,
    sep: '.',
    skip: 1,
    repo: 'first1k',
  },
  enneads: { urn: 'tlg2000.tlg001.1st1K-grc1', depth: 3, sep: '.', repo: 'first1k' },
};

// Burnet's Plato.
const STEPHANUS: Record<string, StephanusEdition> = {
  euthyphro: { urn: 'tlg0059.tlg001.perseus-grc1' },
  apology: { urn: 'tlg0059.tlg002.perseus-grc2' },
  crito: { urn: 'tlg0059.tlg003.perseus-grc2' },
  phaedo: { urn: 'tlg0059.tlg004.perseus-grc2' },
  theaetetus: { urn: 'tlg0059.tlg006.perseus-grc2' },
  symposium: { urn: 'tlg0059.tlg011.perseus-grc2' },
  phaedrus: { urn: 'tlg0059.tlg012.perseus-grc2' },
  'alcibiades-i': { urn: 'tlg0059.tlg013.perseus-grc2' },
  protagoras: { urn: 'tlg0059.tlg022.perseus-grc2' },
  gorgias: { urn: 'tlg0059.tlg023.perseus-grc2' },
  meno: { urn: 'tlg0059.tlg024.perseus-grc2' },
  republic: { urn: 'tlg0059.tlg030.perseus-grc2' },
  timaeus: { urn: 'tlg0059.tlg031.perseus-grc2' },
  laws: { urn: 'tlg0059.tlg034.perseus-grc2' },
  'seventh-letter': { urn: 'tlg0059.tlg036.perseus-grc2', part: '7' },
  // Bywater's Ethics and Ross's Metaphysics, Politics and Rhetoric.
  'nicomachean-ethics': { urn: 'tlg0086.tlg010.perseus-grc2', bekker: true },
  metaphysics: { urn: 'tlg0086.tlg025.perseus-grc2', bekker: true },
  politics: { urn: 'tlg0086.tlg035.perseus-grc2', bekker: true },
  rhetoric: { urn: 'tlg0086.tlg038.perseus-grc2', bekker: true },
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

export function group(texts: Map<string, string>, depth: number, sep: string, skip?: number) {
  const units = new Map<string, { path: string; body: string }[]>();
  for (const [path, body] of texts) {
    if (!body) continue;
    const parts = path.split('.');
    const unit = parts
      .slice(0, depth)
      .filter((_, i) => i !== skip)
      .join(sep);
    units.set(unit, [...(units.get(unit) ?? []), { path, body }]);
  }
  return units;
}

/**
 * The text of each Stephanus section ("70b"), from its milestone to the next, with the citation
 * path it starts in ("70", "1.327"). Speakers' labels are kept, and each speech or paragraph
 * starts a line. Only the textpart `part` is read, if given. With `bekker`, the units are Bekker
 * columns ("1094a"), from their page milestones; a column restated at the start of a book goes on.
 */
export function parseStephanus(xml: string, part?: string, bekker = false) {
  const body = xml.slice(xml.indexOf('<body'));
  const sections = new Map<string, { path: string; lines: string[] }>();
  const divs: (string | null)[] = [];
  let skip = 0;
  let current: { path: string; lines: string[] } | undefined;
  let line = false;
  let last: string | undefined;
  const append = (text: string) => {
    if (line || !current!.lines.length) current!.lines.push('');
    current!.lines[current!.lines.length - 1] += text;
    line = false;
  };

  for (const [token] of body.matchAll(/<[^>]+>|[^<]+/g)) {
    const path = divs.filter((n): n is string => n !== null);
    const inside = !part || path[0] === part;
    if (token[0] !== '<') {
      if (skip || !inside || !current) continue;
      append(decodeEntities(token));
      continue;
    }
    const [, close, name] = token.match(/^<(\/?)([\w:]+)/) ?? [];
    if (!name) continue;
    if (name === 'milestone' && inside) {
      const n = token.match(/\bn="(\d+[a-e])"/)?.[1];
      if (bekker && n === last) continue;
      if ((bekker ? /unit="page"/ : /unit="section"/).test(token) && n) {
        if (sections.has(n))
          throw new Error(`${bekker ? 'Bekker column' : 'Stephanus section'} ${n} twice`);
        current = { path: path.join('.'), lines: [] };
        sections.set(n, current);
        last = n;
      } else if (/unit="para"/.test(token)) line = true;
    }
    if (token.endsWith('/>')) continue;
    if (SKIPPED.has(name) && name !== 'label') skip += close ? -1 : 1;
    else if (name === 'div') {
      if (close) divs.pop();
      else
        divs.push(
          /type="textpart"/.test(token) ? (token.match(/\bn="([^"]+)"/)?.[1] ?? null) : null,
        );
    } else if (!close && ['said', 'p', 'l'].includes(name)) line = true;
    else if (!skip && inside && current && (name === 'del' || name === 'add')) {
      // Burnet's deletions and additions, in his brackets.
      append(name === 'del' ? (close ? ']' : '[') : close ? '⟩' : '⟨');
    }
  }
  const texts = new Map<string, { path: string; body: string }>();
  for (const [n, { path, lines }] of sections) {
    const body = lines.map(squash).filter(Boolean).join('\n');
    if (body) texts.set(n, { path, body });
  }
  return texts;
}

async function loadTei(
  urn: string,
  cacheDir: string,
  fallback?: string,
  repo: keyof typeof RAW = 'perseus',
) {
  const [tg, work] = urn.split('.');
  const xml = (
    await cached(cacheDir, `${urn}.xml`, `${RAW[repo]}/${tg}/${work}/${urn}.xml`)
  ).toString();
  const license = xml.match(/<licence[^>]*>([^<]+)/)?.[1].trim() || fallback;
  if (!license) throw new Error(`${urn}: no licence in the TEI header`);
  const library = repo === 'first1k' ? 'First1KGreek' : 'Perseus Digital Library';
  return { xml, license: `${license} (${library})` };
}

const reader = (urn: string, passage: string) =>
  `https://scaife.perseus.org/reader/urn:cts:greekLit:${urn}:${passage}/`;

export async function loadPerseus(workId: string, cacheDir: string): Promise<SourceText> {
  const steph = STEPHANUS[workId];
  if (steph) {
    const { xml, license } = await loadTei(steph.urn, cacheDir, REPO_LICENCE);
    const units = new Map();
    for (const [n, { path, body }] of parseStephanus(xml, steph.part, steph.bekker))
      units.set(n, { body, url: reader(steph.urn, path) });
    return { license, units, stephanus: true };
  }
  const units = new Map();
  const editions = [EDITIONS[workId]].flat();
  const teis = await Promise.all(
    editions.map((ed) => loadTei(ed.urn, cacheDir, undefined, ed.repo)),
  );
  const license = teis[0].license;
  for (const [i, ed] of editions.entries()) {
    const tei = teis[i];
    if (tei.license !== license) throw new Error(`${workId}: its editions have different licences`);
    for (const [unit, parts] of group(parseTei(tei.xml), ed.depth, ed.sep, ed.skip)) {
      // A section that runs over two lives, or chapters, is one unit, its parts unlabelled.
      const label = (path: string) => path.split('.').slice(ed.depth).join('.');
      const body =
        parts.length === 1
          ? parts[0].body
          : parts.map((p) => (label(p.path) ? `(${label(p.path)}) ${p.body}` : p.body)).join('\n');
      const passage = parts[0].path.split('.').slice(0, ed.depth).join('.');
      units.set((ed.prefix ?? '') + unit, { body, url: reader(ed.urn, passage) });
    }
  }
  return { license, units };
}
