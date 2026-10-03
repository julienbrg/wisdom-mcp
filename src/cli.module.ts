import { Module } from '@nestjs/common';
import { AppConfigModule } from './config.js';
import { MistralService } from './corpus/mistral.service.js';
import { DatabaseModule } from './database/database.module.js';

/** Config, database and Mistral for the offline corpus scripts, without the HTTP server. */
@Module({
  imports: [AppConfigModule, DatabaseModule],
  providers: [MistralService],
})
export class CliModule {}
