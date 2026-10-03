import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().default(3000),
  PUBLIC_URL: z.url().default('http://localhost:3000'),
  DATABASE_PATH: z.string().default('./data/app.db'),
  CORPUS_CACHE: z.string().default('./data/cache'),
  MISTRAL_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default('mistral-embed'),
  KEYWORDS_MODEL: z.string().default('mistral-small-latest'),
});

export const env = Env.parse(process.env);
export const MCP_URL = new URL('/mcp', env.PUBLIC_URL);
