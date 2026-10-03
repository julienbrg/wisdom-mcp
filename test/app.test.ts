import assert from 'node:assert/strict';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';

process.env.DATABASE_PATH = ':memory:';
process.env.PUBLIC_URL = 'http://localhost';

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

test('mcp answers initialize', async () => {
  const res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    }),
  });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /"serverInfo":\{"name":"wisdom-mcp"/);
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
