# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- macOS `.DS_Store` files are now gitignored.
- The Swagger document now takes its version from `package.json` instead of a hard-coded `0.1.0`.
- Exports used only inside their own module are no longer exported.
- Bhagavad Gita references are now the verse range each Arnold passage renders (e.g. 18.64-65) instead of a whole chapter. The Sanskrit is stored by verse, and a table maps each passage onto its verses: aligned offline with a local embedding model against the gita/gita English translations, keeping verse order, then checked by hand. `read_passages` now returns only those verses, in Sanskrit and English.
- Meditations references are now one Casaubon section each (book.section) instead of a whole book. The Greek is stored by Perseus chapter, and a hand-checked table maps each of Casaubon's sections onto the chapters it translates, because his numbering merges and splits them. `read_passages` now returns only the matching section, in Greek and English.
- The keyword fallback that matches any term now ignores common English stop words, so hits no longer come in on words like "should" or "to" alone. Quoted phrases are kept, and a query made only of stop words still searches every term.
- README title renamed to Wisdom MCP, with the corpus badge first.

### Added

- `list_concepts` and `get_concept` tools over the Wisdom Context Window concept graph: 208 concepts with their summary, key passages, and parallels, tensions, related and broader concepts. `corpus:import` fetches and caches the graph into the new `concepts`, `concept_passages` and `concept_links` tables. Key passages from works in the corpus come with their passage id, and the others are listed without one. The server instructions point broad questions to the concepts before searching.
- `check_quote` tool: checks a quote against the stored originals and public-domain translations, ignoring whitespace, punctuation and section markers, and returns the exact match with its passage id, work and reference, or the closest candidates ranked by trigram overlap. An optional `work` (id, or part of its title or author) narrows the check.
- Retrieval test set in `test/eval/situations.json`: 44 situations, each with the passages judged relevant by hand, and `pnpm eval`, which runs search on each and reports Recall@10 per situation and overall. The first run scores 0.184 against a target of 0.7.
- knip, with a `pnpm knip` script and a CI step after the build, to keep unused files, exports and dependencies out of the repo.
- `docs/COMPATIBILITY.md`, a guide to the chat apps, coding tools and LLM APIs that can use the server as a connector: plans, setup per service, and how to expose the server over HTTPS. Linked from a new Compatibility section in the README.
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
- `/wisdom` answers are a synthesis of the quoted passages only, with no advice of the model's own, with three parts: a `short_answer` (exactly yes or no for a yes/no question, otherwise one sentence), a `confidence` from 0 to 1, and a titled summary of 1 to 3 paragraphs. The transcript records `short_answer` and `confidence` in each turn and in its closing `Totals` table.
- Reframing step: the server instructions and `/wisdom` restate a question about modern specifics as the human situation underneath it before searching, while still answering the original question. `/wisdom` records the reframe under `### Reframed question`, scores `confidence` against the original question, and may run one web search to understand an unfamiliar term, never as answer content.
- `/wisdom` transcripts are numbered: `test/output/<NNNNN>-<date>-<slug>.md`, counting up from `00001`.
- `MISTRAL_API_KEY`, `EMBEDDING_MODEL` and `KEYWORDS_MODEL` settings.
- README badges for NestJS, CI, TypeScript, pnpm, Node.js and the license, plus a static corpus badge with the number of texts and passages.
- Settings load through `@nestjs/config`, which reads `.env` when it exists and validates it with zod. The corpus scripts boot a Nest application context, so they share the server's configuration.
