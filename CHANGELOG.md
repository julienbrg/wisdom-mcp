# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- NestJS (ESM) project with pnpm, TypeScript, ESLint, Prettier and a CI workflow.
- SQLite database through better-sqlite3, with sqlite-vec loaded at startup and numbered SQL migrations applied on boot.
- Schema for `works`, `texts`, `passages`, `originals` and `translations`, plus the `passages_fts`, `originals_fts` and `passages_vec` indexes.
- MCP server over Streamable HTTP at `/mcp`, with host header validation and no tools yet.
- `/health` route that also checks the database.
- Swagger UI at `/docs`.
- Smoke tests for the schema, sqlite-vec, `/health` and the MCP `initialize` handshake.
- GPL-3.0 `LICENSE` file and matching `license` field in `package.json`.
- `pnpm corpus:import`, which imports the 8 pilot works (Tao Te Ching, Analects, Dhammapada, Bhagavad Gita, Enchiridion, Meditations, Sermon on the Mount, Ecclesiastes) from the Wisdom Context Window. It keeps the corpus slugs and passage numbers, and can be run again.
- Work registry with author, title, original title and language, tradition, translator, translation year and Gutenberg source.
- Normalization that rejoins hard line breaks and hyphenated words, keeps verse lines, strips italics markers and footnote anchors, and keeps the source text in `raw`.
- References in each work's own numbering. Corpus passages that hold several chapters are split, and the translators' introductions, notes, indexes and headings are flagged as apparatus.
- Original-language texts stored by reference unit, with source URL and licence, from Chinese Wikisource, Perseus, SuttaCentral, Sefaria and the gita/gita dataset. Translation units are mapped onto source units where the divisions differ.
- Downloads cached under `CORPUS_CACHE`, with retries on rate limits.
- `pnpm corpus:index`, which writes a line of modern English search keywords for each quotable passage with a Mistral model, rebuilds the FTS5 index over passage text and keywords, and embeds passages into `passages_vec` with Mistral embeddings. Keywords and embeddings are cached by passage text under `CORPUS_CACHE`, so reruns after an import cost no API calls.
- `search_passages` MCP tool: hybrid search that runs FTS5 (all terms first, then any term) and vector search, merges them with reciprocal rank fusion (k=60), keeps at most 3 hits per work and returns the top 20 with snippets. Quoted phrases are kept as phrases, and apparatus is never returned.
- Keyword-only fallback, flagged in the result, when the embedding call fails or takes longer than 5 seconds, and a 1,000-entry cache of query embeddings.
- `read_passages` MCP tool: up to 10 ids, returned as whole reference units with the original text, its source and licence, and the English translation as an aid, or the translation alone when no original is available. Output is capped at about 6,000 words, cutting the aid translation first and then the original at a sentence boundary.
- Server instructions sent at `initialize`, covering search language, quoting, translation and passages as data.
- `.mcp.json` that registers the local server with Claude Code as `wisdom`.
- `/wisdom` Claude Code skill, which answers a question and its follow-ups with `search_passages` and `read_passages` only and writes the whole conversation, with every tool call, to `test/output/` (git-ignored).
- `/wisdom` answers are a synthesis of the quoted passages only, with no advice of the model's own, and open with a `short_answer` (yes, no, or one sentence) and a `confidence` from 0 to 1 that the transcript records in each turn and in its summary table.
- `MISTRAL_API_KEY`, `EMBEDDING_MODEL` and `KEYWORDS_MODEL` settings.
- Settings load through `@nestjs/config`, which reads `.env` when it exists and validates it with zod. The corpus scripts boot a Nest application context, so they share the server's configuration.
