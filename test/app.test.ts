import assert from 'node:assert/strict';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';

process.env.DATABASE_PATH = ':memory:';
process.env.PUBLIC_URL = 'http://localhost';
process.env.MISTRAL_API_KEY = '';

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

test('health reports ok', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

async function rpc(method: string, params: object) {
  const res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  assert.equal(res.status, 200);
  const body = await res.text();
  const json = body.startsWith('{') ? body : body.match(/^data: (.*)$/m)![1];
  return JSON.parse(json).result;
}

test('mcp answers initialize with server instructions', async () => {
  const result = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' },
  });
  assert.equal(result.serverInfo.name, 'wisdom-mcp');
  assert.match(result.instructions, /Search in English/);
});

test('mcp lists its tools', async () => {
  const { tools } = await rpc('tools/list', {});
  assert.deepEqual(
    tools.map((t: { name: string }) => t.name),
    ['search_passages', 'read_passages', 'check_quote'],
  );
});

test('search_passages falls back to keywords without the embedding API', async () => {
  const result = await rpc('tools/call', {
    name: 'search_passages',
    arguments: { query: 'anger' },
  });
  assert.deepEqual(result.structuredContent, { hits: [], degraded: true });
  assert.match(result.content[0].text, /keyword results only/);
});

test('read_passages reports unknown ids', async () => {
  const result = await rpc('tools/call', { name: 'read_passages', arguments: { ids: ['nope:1'] } });
  assert.equal(result.content[0].text, 'Not found or not quotable: nope:1.');
});

test('check_quote reports no match on an empty corpus and rejects unknown works', async () => {
  const none = await rpc('tools/call', {
    name: 'check_quote',
    arguments: { quote: 'A good name is better than precious ointment' },
  });
  assert.equal(none.content[0].text, 'No exact match and no close candidate.');
  assert.deepEqual(none.structuredContent, { exact: [], candidates: [] });

  const unknown = await rpc('tools/call', {
    name: 'check_quote',
    arguments: { quote: 'A good name', work: 'Plato' },
  });
  assert.equal(unknown.isError, true);
  assert.match(unknown.content[0].text, /No work matches "Plato"/);
});

test('mcp rejects foreign hosts', async () => {
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const req = request(`${base}/mcp`, {
      method: 'POST',
      headers: { host: 'evil.example', 'content-type': 'application/json' },
    });
    req.on('response', (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end('{}');
  });
  assert.equal(status, 403);
});
