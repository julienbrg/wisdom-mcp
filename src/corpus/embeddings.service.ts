import { Injectable } from '@nestjs/common';
import { MistralService } from './mistral.service.js';

const CACHE_SIZE = 1000;
const TIMEOUT_MS = 5000;

@Injectable()
export class EmbeddingsService {
  // LRU: a model often repeats a search while it refines the others.
  private readonly cache = new Map<string, Float32Array>();

  constructor(private readonly mistral: MistralService) {}

  /** `tokens` is what Mistral billed for the call: 0 on a cache hit. */
  async embed(text: string): Promise<{ vector: Float32Array; tokens: number }> {
    const key = text.trim().toLowerCase();
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      return { vector: hit, tokens: 0 };
    }

    const {
      vectors: [vector],
      tokens,
    } = await this.mistral.embed([text], { signal: AbortSignal.timeout(TIMEOUT_MS) });
    this.cache.set(key, vector);
    if (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value!);
    return { vector, tokens };
  }
}
