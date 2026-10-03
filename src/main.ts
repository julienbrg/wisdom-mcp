import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { env } from './config.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.set('trust proxy', 1);
app.enableShutdownHooks();

await app.listen(env.PORT, '127.0.0.1');
