interface SourceUnit {
  body: string;
  url: string;
}

export interface SourceText {
  license: string;
  units: Map<string, SourceUnit>;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  thinsp: ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#')
      return String.fromCodePoint(parseInt(e.slice(e[1] === 'x' ? 2 : 1), e[1] === 'x' ? 16 : 10));
    return ENTITIES[e] ?? m;
  });
}

export function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
