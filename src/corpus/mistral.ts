import { setTimeout as sleep } from 'node:timers/promises';
import { env } from '../config.js';

const API = 'https://api.mistral.ai/v1';

export const EMBEDDING_DIMENSIONS = 1024;

interface Options {
  signal?: AbortSignal;
  attempts?: number;
}

async function post<T>(path: string, body: unknown, { signal, attempts = 1 }: Options): Promise<T> {
  if (!env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY is not set');
  for (let i = 1; ; i++) {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.MISTRAL_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok) return (await res.json()) as T;
    if (i >= attempts || (res.status !== 429 && res.status < 500)) {
      throw new Error(`Mistral ${path}: ${res.status} ${await res.text()}`);
    }
    await sleep((Number(res.headers.get('retry-after')) || 5 * i) * 1000);
  }
}

/** Unit-length vectors, so the cosine distance stored in passages_vec is meaningful. */
export async function embed(texts: string[], options: Options = {}): Promise<Float32Array[]> {
  const res = await post<{ data: { index: number; embedding: number[] }[] }>(
    '/embeddings',
    { model: env.EMBEDDING_MODEL, input: texts },
    options,
  );
  return res.data.sort((a, b) => a.index - b.index).map((d) => normalize(d.embedding));
}

export async function chatJson(system: string, user: string, options: Options = {}) {
  const res = await post<{ choices: { message: { content: string } }[] }>(
    '/chat/completions',
    {
      model: env.KEYWORDS_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
    options,
  );
  return JSON.parse(res.choices[0].message.content) as unknown;
}

export function normalize(v: ArrayLike<number>): Float32Array {
  const out = Float32Array.from(v);
  const n = Math.hypot(...out);
  return n ? out.map((x) => x / n) : out;
}
