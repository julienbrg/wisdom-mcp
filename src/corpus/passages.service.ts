import { Inject, Injectable } from '@nestjs/common';
import { DB, type Db } from '../database/database.module.js';

export const MAX_IDS = 10;
const MAX_WORDS = 6000;

const LANGUAGES: Record<string, string> = {
  lzh: 'Classical Chinese',
  pli: 'Pali',
  san: 'Sanskrit',
  grc: 'Ancient Greek',
  hbo: 'Biblical Hebrew',
};

const SCHEMES: Record<string, string> = {
  lzh: 'Hanyu Pinyin, classical readings',
  grc: 'romanization',
  hbo: 'romanization',
  san: 'IAST',
};

interface Unit {
  workId: string;
  refUnit: string;
  hits: { id: string; ref: string | null }[];
}

interface UnitRow {
  author: string;
  title: string;
  original_title: string | null;
  original_language: string;
  translator: string | null;
  year: number | null;
}

export interface ReadResult {
  text: string;
  truncated: boolean;
  missing: string[];
}

@Injectable()
export class PassagesService {
  private readonly passage;
  private readonly unit;
  private readonly original;
  private readonly aid;

  constructor(@Inject(DB) db: Db) {
    this.passage = db.prepare<[string], { work_id: string; ref_unit: string; ref: string | null }>(
      `select p.work_id, p.ref_unit, p.ref from passages p join texts t on t.id = p.text_id
       where p.id = ? and p.is_apparatus = 0 and t.quotable = 1 and p.ref_unit is not null`,
    );
    this.unit = db.prepare<[string], UnitRow>(
      `select w.author, w.title, w.original_title, w.original_language, t.translator, t.year
       from works w left join texts t on t.work_id = w.id and t.quotable = 1
       where w.id = ? limit 1`,
    );
    this.original = db.prepare<
      [string, string],
      { body: string; transcription: string | null; source_url: string; license: string }
    >(
      `select body, transcription, source_url, license from originals
       where work_id = ? and ref_unit = ?`,
    );
    this.aid = db.prepare<[string, string], { body: string }>(
      `select p.body from passages p join texts t on t.id = p.text_id
       where p.work_id = ? and p.ref_unit = ? and p.is_apparatus = 0 and t.quotable = 1
       order by p.position`,
    );
  }

  /** One block per reference unit, so hits that share a unit are returned once. */
  read(ids: string[]): ReadResult {
    const units = new Map<string, Unit>();
    const missing: string[] = [];
    for (const id of new Set(ids)) {
      const p = this.passage.get(id);
      if (!p) {
        missing.push(id);
        continue;
      }
      const key = `${p.work_id}\0${p.ref_unit}`;
      if (!units.has(key)) units.set(key, { workId: p.work_id, refUnit: p.ref_unit, hits: [] });
      units.get(key)!.hits.push({ id, ref: p.ref });
    }

    const share = Math.floor(MAX_WORDS / Math.max(units.size, 1));
    let truncated = false;
    const blocks = [...units.values()].map((u) => {
      const block = this.format(u, share);
      truncated ||= block.truncated;
      return block.text;
    });
    if (missing.length) blocks.push(`Not found or not quotable: ${missing.join(', ')}.`);
    if (units.size) {
      blocks.push(
        'No authorised modern translation is stored for these passages: translate the ' +
          'original yourself and label the translation as your own.',
      );
    }
    return { text: blocks.join('\n\n'), truncated, missing };
  }

  private format(u: Unit, share: number) {
    const w = this.unit.get(u.workId)!;
    const original = this.original.get(u.workId, u.refUnit);
    let aid = this.aid
      .all(u.workId, u.refUnit)
      .map((r) => r.body)
      .join('\n\n');
    const aidLabel = `${w.translator ?? 'unknown translator'}${w.year ? `, ${w.year}` : ''}, public domain`;
    const lines = [
      `${w.author}, ${w.title}${w.original_title ? ` (${w.original_title})` : ''}, ${u.refUnit}`,
      `Covers hits: ${u.hits.map((h) => (h.ref ? `${h.id} (${h.ref})` : h.id)).join(', ')}.`,
    ];

    if (!original) {
      const cut = cutWords(aid, share);
      lines.push(
        'No original is available for this passage: quote the translation below with its ' +
          'translator and year.',
        '',
        `TRANSLATION (quote this; ${aidLabel})`,
        cut.text +
          (cut.cut ? `\n[Cut at about ${share} words; reference ${u.refUnit} continues.]` : ''),
      );
      return { text: lines.join('\n'), truncated: cut.cut };
    }

    const language = LANGUAGES[w.original_language] ?? w.original_language;
    const orig = cutWords(original.body, share, true);
    // The transcription follows the original word for word, so it is cut to the same length.
    const transcription = original.transcription
      ? cutWords(original.transcription, countWords(orig.text)).text
      : '';
    const aidBudget = Math.max(share - countWords(orig.text) - countWords(transcription), 0);
    const aidCut = cutWords(aid, aidBudget);
    aid = aidCut.text;

    lines.push(
      `Original language: ${language}. Source: ${original.source_url} (${original.license}).`,
      '',
      'ORIGINAL (quote this)',
      orig.text +
        (orig.cut ? `\n[Cut at a sentence boundary; reference ${u.refUnit} continues.]` : ''),
    );
    if (transcription) {
      const scheme = SCHEMES[w.original_language] ?? 'transcription';
      lines.push(
        '',
        `TRANSCRIPTION (pronunciation aid, ${scheme}; not the source, do not quote it as the original)`,
        transcription,
      );
    }
    if (aid) {
      lines.push(
        '',
        `AID TRANSLATION (${aidLabel})`,
        aid + (aidCut.cut ? '\n[Aid translation cut to stay within the size limit.]' : ''),
      );
    } else if (aidCut.cut) {
      lines.push('', '[Aid translation left out to stay within the size limit.]');
    }
    return { text: lines.join('\n'), truncated: orig.cut || aidCut.cut };
  }
}

// Each Chinese character counts as a word, since Classical Chinese has no spaces.
const WORD = /\p{Script=Han}|[^\s\p{Script=Han}]*[\p{L}\p{N}][^\s\p{Script=Han}]*/gu;
const SENTENCE_END = /[.!?;:·。！？；：׃।॥]["'”’»)\]]*(?=\s|$)|[。！？；]/gu;

export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

export function cutWords(text: string, max: number, atSentence = false) {
  let n = 0;
  let end = -1;
  for (const m of text.matchAll(WORD)) {
    if (++n > max) {
      end = m.index;
      break;
    }
  }
  if (end < 0) return { text, cut: false };

  let head = text.slice(0, end);
  if (atSentence) {
    const last = [...head.matchAll(SENTENCE_END)].at(-1);
    if (last) head = head.slice(0, last.index + last[0].length);
  }
  return { text: head.trimEnd(), cut: true };
}
