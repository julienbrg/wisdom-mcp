# wisdom-mcp

An MCP server for agentic hybrid search over philosophical and spiritual texts, built on Kevin Owocki's [Wisdom Context Window](https://wisdom.owocki.com/). The server only retrieves: your own model searches, reads, quotes and translates. See the [design write-up](https://julienberanger.com/wisdom-mcp-agentic-hybrid-search).

## Motivation

Ask a model what the Stoics or the Tao Te Ching say about anger and it will often paraphrase, or invent a plausible line with a plausible reference. For texts like these, the exact words and where they come from matter.

wisdom-mcp gives the model tools instead of answers. It searches a curated corpus with keywords and embeddings, then returns the original text with a precise reference. The model does the reasoning and translation, and quotes what it actually read. The corpus can grow without retraining anything, and every quote can be checked against its source.

## Requirements

- Node 24
- pnpm 10

## Setup

```sh
pnpm install
cp .env.example .env
pnpm build
pnpm start
```

The database is created at `DATABASE_PATH` on first boot, and migrations in `migrations/` are applied in order.

Settings come from `.env` and the environment, which takes precedence, and are validated at startup by the server and the corpus scripts alike. Without `MISTRAL_API_KEY`, search falls back to keywords only.

| Variable          | Default                 | Purpose                                      |
| ----------------- | ----------------------- | -------------------------------------------- |
| `PORT`            | `3000`                  | HTTP port, bound to `127.0.0.1`              |
| `PUBLIC_URL`      | `http://localhost:3000` | Public origin; its host is allowed on `/mcp` |
| `DATABASE_PATH`   | `./data/app.db`         | SQLite file                                  |
| `CORPUS_CACHE`    | `./data/cache`          | Downloaded texts used by the corpus import   |
| `MISTRAL_API_KEY` |                         | Mistral API key for keywords and embeddings  |
| `EMBEDDING_MODEL` | `mistral-embed`         | Embedding model (1,024 dimensions)           |
| `KEYWORDS_MODEL`  | `ministral-8b-latest`   | Model that writes search keywords            |

## Corpus

```sh
pnpm corpus:import
```

This imports the 8 pilot works from the Wisdom Context Window, with their original-language texts. Downloads are cached in `CORPUS_CACHE`, so later runs work offline, and each run replaces the works it imports.

| Work                | Translation                | Reference     | Original                    |
| ------------------- | -------------------------- | ------------- | --------------------------- |
| Tao Te Ching        | James Legge                | chapter.para  | Chinese Wikisource (王弼本) |
| Analects            | James Legge                | book.chapter  | Chinese Wikisource          |
| Dhammapada          | F. Max Müller              | verse         | SuttaCentral                |
| Bhagavad Gita       | Edwin Arnold               | chapter       | gita/gita dataset           |
| Enchiridion         | Thomas Wentworth Higginson | section       | Perseus                     |
| Meditations         | Meric Casaubon             | book.section  | Perseus, by book            |
| Sermon on the Mount | King James Version         | chapter:verse | Perseus                     |
| Ecclesiastes        | King James Version         | chapter:verse | Sefaria                     |

Every quotable passage has a reference and an original. Front matter, translators' notes, indexes and headings are kept but flagged `is_apparatus`.

```sh
pnpm corpus:index
```

This writes search keywords for each quotable passage, rebuilds the keyword index and embeds the passages, using `MISTRAL_API_KEY`. Results are cached in `CORPUS_CACHE` by passage text, so run it again after every import at no extra cost.

## Tools

| Tool              | Input          | Returns                                                                                    |
| ----------------- | -------------- | ------------------------------------------------------------------------------------------ |
| `search_passages` | `query`        | Up to 20 hits (id, author, work, reference, snippet), at most 3 per work                   |
| `read_passages`   | `ids` (max 10) | Each reference unit once: the original to quote, its source, and the translation as an aid |

Search is hybrid: an FTS5 keyword index over passage text and keywords, and a vector index over Mistral embeddings, merged with reciprocal rank fusion. If the embedding call fails or takes more than 5 seconds, search returns keyword results only and says so. `read_passages` stops at about 6,000 words. The server sends its quoting rules to the client as MCP `instructions`.

## Endpoints

- `POST /mcp`: MCP over Streamable HTTP
- `GET /health`: liveness check
- `GET /docs`: Swagger UI

## Scripts

| Script               | What it does                |
| -------------------- | --------------------------- |
| `pnpm build`         | Compile to `dist/`          |
| `pnpm start`         | Run the compiled server     |
| `pnpm corpus:import` | Import the pilot corpus     |
| `pnpm corpus:index`  | Build the search indexes    |
| `pnpm test`          | Build, then run the tests   |
| `pnpm lint`          | ESLint                      |
| `pnpm format:check`  | Prettier check              |
| `pnpm typecheck`     | TypeScript without emitting |

## Credits

- [Kevin Owocki](https://github.com/owocki), for the [Wisdom Context Window](https://wisdom.owocki.com/): the corpus of texts, summaries and concept graph this server searches.
- [Chinese Wikisource](https://zh.wikisource.org/), [Perseus Digital Library](https://www.perseus.tufts.edu/), [SuttaCentral](https://suttacentral.net/), [Sefaria](https://www.sefaria.org/) and the [gita/gita](https://github.com/gita/gita) dataset, for the original-language texts.
- [sqlite-vec](https://github.com/asg017/sqlite-vec) by Alex Garcia, for vector search inside SQLite.
- The [Model Context Protocol](https://modelcontextprotocol.io) TypeScript SDK.

## License

GPL-3.0

## Contact

**Julien Béranger** ([GitHub](https://github.com/julienbrg))

- Element: [@julienbrg:matrix.org](https://matrix.to/#/@julienbrg:matrix.org)
- Farcaster: [julien-](https://warpcast.com/julien-)
- Telegram: [@julienbrg](https://t.me/julienbrg)
