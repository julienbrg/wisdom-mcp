import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service.js';
import { PassagesService } from './passages.service.js';
import { SearchService } from './search.service.js';

@Module({
  providers: [EmbeddingsService, SearchService, PassagesService],
  exports: [SearchService, PassagesService],
})
export class CorpusModule {}
