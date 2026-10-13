import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';

process.env.DATABASE_PATH = ':memory:';
process.env.PUBLIC_URL = 'http://localhost';
process.env.MISTRAL_API_KEY = '';
process.env.RATE_LIMIT_PER_MINUTE = '3';
process.env.SEARCH_LIMIT_PER_DAY = '1';

let app: INestApplication;
let base: string;

before(async () => {
  const { AppModule } = await import('../dist/app.module.js');
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  base = `http://localhost:${port}`;
});

after(() => app.close());

function rpc(id: number, method: string, params: object) {
  return fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

async function assertLimited(res: Response, id: number) {
  assert.equal(res.status, 429);
  assert.ok(res.headers.get('retry-after'));
  assert.deepEqual(await res.json(), {
    jsonrpc: '2.0',
    id,
    error: { code: -32000, message: 'Rate limit exceeded. Try again later.' },
  });
}

test('search_passages is capped per day', async () => {
  const search = { name: 'search_passages', arguments: { query: 'anger' } };
  const first = await rpc(1, 'tools/call', search);
  assert.equal(first.status, 200);
  await first.text();
  await assertLimited(await rpc(2, 'tools/call', search), 2);
});

test('tool calls are limited per minute, other requests are not', async () => {
  const read = { name: 'read_passages', arguments: { ids: ['nope:1'] } };
  const second = await rpc(3, 'tools/call', read);
  assert.equal(second.status, 200);
  await second.text();
  await assertLimited(await rpc(4, 'tools/call', read), 4);

  const list = await rpc(5, 'tools/list', {});
  assert.equal(list.status, 200);
  await list.text();
});
