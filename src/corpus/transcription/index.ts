import { romanizeGreek } from './greek.js';
import { romanizeHebrew } from './hebrew.js';
import { romanizeSanskrit } from './sanskrit.js';

const SCHEMES: Record<string, (text: string) => string> = {
  grc: romanizeGreek,
  hbo: romanizeHebrew,
  san: romanizeSanskrit,
};

/** A pronunciation aid for an original in a non-Latin script, or null when it needs none. */
export function transcribe(language: string, text: string): string | null {
  return SCHEMES[language]?.(text) ?? null;
}
