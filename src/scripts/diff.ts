import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CliModule } from '../cli.module.js';
import { diffCorpus, importedPassages } from '../corpus/diff.js';
import { fetchWcw } from '../corpus/wcw.js';
import { PILOT_WORKS } from '../corpus/works.js';
import { DB, type Db } from '../database/database.module.js';

const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
try {
  const { newWorks, changed } = diffCorpus(
    await fetchWcw(),
    PILOT_WORKS,
    importedPassages(app.get<Db>(DB)),
  );
  console.log('On the site, not in PILOT_WORKS yet:');
  console.table(newWorks);
  console.log(
    'Imported works a re-import would change (edited: passages no longer in their block):',
  );
  console.table(changed);
} finally {
  await app.close();
}
