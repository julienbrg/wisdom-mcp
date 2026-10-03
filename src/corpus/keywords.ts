import { chatJson } from './mistral.js';

export interface PassageText {
  id: string;
  body: string;
}

const MAX_CHARS = 4000;

const SYSTEM = `You write search keywords for passages taken from old English translations of philosophical and spiritual texts.
For each passage, write one line of 8 to 15 modern English words or short phrases, separated by commas, for what it is about: its themes, the situations and feelings it speaks to, and modern words for its archaic ones (a passage on a "talebearer" gets "gossip").
Never quote the passage and never add commentary.
Reply with a JSON object mapping each passage id to its line.`;

/** Missing ids are left out of the result, so a later run can retry them. */
export async function generateKeywords(passages: PassageText[]): Promise<Map<string, string>> {
  const input = passages.map((p) => ({ id: p.id, text: p.body.slice(0, MAX_CHARS) }));
  const reply = await chatJson(SYSTEM, JSON.stringify(input), { attempts: 5 });

  const out = new Map<string, string>();
  if (reply && typeof reply === 'object') {
    for (const { id } of passages) {
      const line = (reply as Record<string, unknown>)[id];
      if (typeof line === 'string' && line.trim()) out.set(id, line.replace(/\s+/g, ' ').trim());
    }
  }
  return out;
}
