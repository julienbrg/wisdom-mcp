import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const USER_AGENT = 'wisdom-mcp/0.1 (https://github.com/julienbrg/wisdom-mcp)';

export async function cached(dir: string, name: string, url: string): Promise<Buffer> {
  const path = join(dir, name);
  if (existsSync(path)) return readFileSync(path);

  const body = await download(url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, body);
  return body;
}

async function download(url: string, attempts = 5): Promise<Buffer> {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (i === attempts || (res.status !== 429 && res.status < 500)) {
      throw new Error(`GET ${url}: ${res.status}`);
    }
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep((retryAfter || 5 * i) * 1000);
  }
}
