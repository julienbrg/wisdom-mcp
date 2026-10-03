import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().default(3000),
  PUBLIC_URL: z.url().default('http://localhost:3000'),
  DATABASE_PATH: z.string().default('./data/app.db'),
  CORPUS_CACHE: z.string().default('./data/cache'),
});

export const env = Env.parse(process.env);
export const MCP_URL = new URL('/mcp', env.PUBLIC_URL);
