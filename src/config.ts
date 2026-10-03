import { ConfigModule, type ConfigService } from '@nestjs/config';
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

export type Env = z.infer<typeof Env>;
export type Config = ConfigService<Env, true>;

/** Loads `.env` when present, then validates it together with the process environment. */
export const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  validate: (raw) => Env.parse(raw),
});

/** @deprecated Read settings through ConfigService. */
export const env = Env.parse(process.env);
