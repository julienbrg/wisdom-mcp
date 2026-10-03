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
