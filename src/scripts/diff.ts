import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CliModule } from '../cli.module.js';
import { diffCorpus, importedBlocks } from '../corpus/diff.js';
import { fetchWcw } from '../corpus/wcw.js';
import { PILOT_WORKS } from '../corpus/works.js';
import { DB, type Db } from '../database/database.module.js';

const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
try {
  const { newWorks, changed } = diffCorpus(
    await fetchWcw(),
    PILOT_WORKS,
    importedBlocks(app.get<Db>(DB)),
  );
  console.log('On the site, not in PILOT_WORKS yet:');
  console.table(newWorks);
  console.log('Imported works whose passage blocks changed, so a re-import shifts their ids:');
  console.table(changed);
} finally {
  await app.close();
}
