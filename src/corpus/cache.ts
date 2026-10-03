import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export async function cached(dir: string, name: string, url: string): Promise<Buffer> {
  const path = join(dir, name);
  if (existsSync(path)) return readFileSync(path);

  const res = await fetch(url, { headers: { 'user-agent': 'wisdom-mcp corpus import' } });
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, body);
  return body;
}
