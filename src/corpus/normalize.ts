export function isVerse(raw: string): boolean {
  const lines = raw.split('\n').filter((l) => l.trim());
  return lines.length > 1 && lines.every((l) => /^\s/.test(l));
}

export function normalize(raw: string, verse = isVerse(raw)): string {
  const text = raw.replace(/\[(?:FN#)?\d+\]/g, '').replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1$2');

  if (verse) {
    return text
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }
  return text
    .replace(/(\w-)\n\s*(?=\w)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
