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

| Variable        | Default                 | Purpose                                      |
| --------------- | ----------------------- | -------------------------------------------- |
| `PORT`          | `3000`                  | HTTP port, bound to `127.0.0.1`              |
| `PUBLIC_URL`    | `http://localhost:3000` | Public origin; its host is allowed on `/mcp` |
| `DATABASE_PATH` | `./data/app.db`         | SQLite file                                  |

## Endpoints

- `POST /mcp`: MCP over Streamable HTTP
- `GET /health`: liveness check
- `GET /docs`: Swagger UI

## Scripts

| Script              | What it does                    |
| ------------------- | ------------------------------- |
| `pnpm build`        | Compile to `dist/`              |
| `pnpm start`        | Run the compiled server         |
| `pnpm test`         | Build, then run the smoke tests |
| `pnpm lint`         | ESLint                          |
| `pnpm format:check` | Prettier check                  |
| `pnpm typecheck`    | TypeScript without emitting     |

## Credits

- [Kevin Owocki](https://github.com/owocki), for the [Wisdom Context Window](https://wisdom.owocki.com/): the corpus of texts, summaries and concept graph this server searches.
- [sqlite-vec](https://github.com/asg017/sqlite-vec) by Alex Garcia, for vector search inside SQLite.
- The [Model Context Protocol](https://modelcontextprotocol.io) TypeScript SDK.

## License

GPL-3.0

## Contact

**Julien Béranger** ([GitHub](https://github.com/julienbrg))

- Element: [@julienbrg:matrix.org](https://matrix.to/#/@julienbrg:matrix.org)
- Farcaster: [julien-](https://warpcast.com/julien-)
- Telegram: [@julienbrg](https://t.me/julienbrg)
