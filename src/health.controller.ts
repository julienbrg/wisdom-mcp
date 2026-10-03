import { Controller, Get, Inject } from '@nestjs/common';
import { DB, type Db } from './database/database.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  check() {
    this.db.prepare('select 1').get();
    return { status: 'ok' };
  }
}
