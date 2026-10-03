import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DB, type Db } from './database/database.module.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @ApiOperation({ summary: 'Liveness check, including the database' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  check() {
    this.db.prepare('select 1').get();
    return { status: 'ok' };
  }
}
