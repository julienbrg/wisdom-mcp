import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service.js';
import { MistralService } from './mistral.service.js';
import { PassagesService } from './passages.service.js';
import { SearchService } from './search.service.js';

@Module({
  providers: [MistralService, EmbeddingsService, SearchService, PassagesService],
  exports: [SearchService, PassagesService],
})
export class CorpusModule {}
