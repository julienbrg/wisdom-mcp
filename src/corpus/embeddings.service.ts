import { Injectable } from '@nestjs/common';
import { MistralService } from './mistral.service.js';

const CACHE_SIZE = 1000;
const TIMEOUT_MS = 5000;

@Injectable()
export class EmbeddingsService {
  // LRU: a model often repeats a search while it refines the others.
  private readonly cache = new Map<string, Float32Array>();

  constructor(private readonly mistral: MistralService) {}

  async embed(text: string): Promise<Float32Array> {
    const key = text.trim().toLowerCase();
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit;
    }

    const [vector] = await this.mistral.embed([text], { signal: AbortSignal.timeout(TIMEOUT_MS) });
    this.cache.set(key, vector);
    if (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value!);
    return vector;
  }
}
