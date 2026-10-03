import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';

const API = 'https://api.mistral.ai/v1';

export interface RequestOptions {
  signal?: AbortSignal;
  attempts?: number;
}

@Injectable()
export class MistralService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get embeddingModel() {
    return this.config.get('EMBEDDING_MODEL', { infer: true });
  }

  get keywordsModel() {
    return this.config.get('KEYWORDS_MODEL', { infer: true });
  }

  /** Unit-length vectors, so the cosine distance stored in passages_vec is meaningful. */
  async embed(texts: string[], options: RequestOptions = {}): Promise<Float32Array[]> {
    const res = await this.post<{ data: { index: number; embedding: number[] }[] }>(
      '/embeddings',
      { model: this.embeddingModel, input: texts },
      options,
    );
    return res.data.sort((a, b) => a.index - b.index).map((d) => normalize(d.embedding));
  }

  /** Throws a SyntaxError when the model replies with malformed or truncated JSON. */
  async chatJson(system: string, user: string, maxTokens: number, options: RequestOptions = {}) {
    const res = await this.post<{ choices: { message: { content: string } }[] }>(
      '/chat/completions',
      {
        model: this.keywordsModel,
        temperature: 0,
        max_tokens: maxTokens,
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

  private async post<T>(path: string, body: unknown, options: RequestOptions): Promise<T> {
    const { signal, attempts = 1 } = options;
    const key = this.config.get('MISTRAL_API_KEY', { infer: true });
    if (!key) throw new Error('MISTRAL_API_KEY is not set');
    for (let i = 1; ; i++) {
      const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
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
}

export function normalize(v: ArrayLike<number>): Float32Array {
  const out = Float32Array.from(v);
  const n = Math.hypot(...out);
  return n ? out.map((x) => x / n) : out;
}
