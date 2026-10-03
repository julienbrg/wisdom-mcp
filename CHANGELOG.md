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
