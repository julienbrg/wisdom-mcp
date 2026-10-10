[![Corpus](https://img.shields.io/badge/corpus-8%20texts%20%C2%B7%202%2C969%20passages-45a2f8?labelColor=8c1c84)](#corpus)
[![CI](https://github.com/julienbrg/wisdom-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/julienbrg/wisdom-mcp/actions/workflows/ci.yml)
[![NestJS](https://img.shields.io/badge/NestJS-v12-E0234E?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.28-F69220?logo=pnpm)](https://pnpm.io/)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js)](https://nodejs.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

# Wisdom MCP

An MCP server for agentic hybrid search over philosophical and spiritual texts, built on Kevin Owocki's [Wisdom Context Window](https://wisdom.owocki.com/). The server only retrieves: your own model searches, reads, quotes and translates. See the [design write-up](https://julienberanger.com/wisdom-mcp-agentic-hybrid-search).

## Motivation

Ask a model what the Stoics or the Daodejing say about anger and it will often paraphrase, or invent a plausible line with a plausible reference. For texts like these, the exact words and where they come from matter.

Wisdom MCP gives the model tools instead of answers. It searches a curated corpus with keywords and embeddings, then returns the original text with a precise reference. The model does the reasoning and translation, and quotes what it actually read. The corpus can grow without retraining anything, and every quote can be checked against its source.

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

This imports the 8 pilot works from the Wisdom Context Window, with their original-language texts, and its concept graph: 208 concepts, each with a summary, key passages and links to parallel, opposing, related and broader concepts. Downloads are cached in `CORPUS_CACHE`, so later runs work offline, and each run replaces the works and concepts it imports.

The corpus badge at the top of this README is static: after an import changes the counts, update it with `select count(*) from texts` and `select count(*) from passages`.

| Work                | Translation                | Reference      | Original                    |
| ------------------- | -------------------------- | -------------- | --------------------------- |
| Tao Te Ching        | James Legge                | chapter.para   | Chinese Wikisource (王弼本) |
| Analects            | James Legge                | book.chapter   | Chinese Wikisource          |
| Dhammapada          | F. Max Müller              | verse          | SuttaCentral                |
| Bhagavad Gita       | Edwin Arnold               | chapter.verses | gita/gita dataset, by verse |
| Enchiridion         | Thomas Wentworth Higginson | section        | Perseus                     |
| Meditations         | Meric Casaubon             | book.section   | Perseus, by section         |
| Sermon on the Mount | King James Version         | chapter:verse  | Perseus                     |
| Ecclesiastes        | King James Version         | chapter:verse  | Sefaria                     |

Every quotable passage has a reference and an original. Front matter, translators' notes, indexes and headings are kept but flagged `is_apparatus`.

### Transcriptions

`read_passages` gives each original a transcription under it, so a reader who doesn't know the script can say it aloud. It is labelled as a pronunciation aid, never as the source. The import computes it into `originals.transcription`.

| Language                  | Scheme                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| Classical Chinese (`lzh`) | Hanyu Pinyin with tone marks, using classical readings                                           |
| Ancient Greek (`grc`)     | Romanization with accents and breathings: ē and ō for η and ω, h for the rough breathing, ῳ → ōi |
| Biblical Hebrew (`hbo`)   | SBL general-purpose style, read from the points: v, kh, f for spirants, dagesh forte doubled     |
| Sanskrit (`san`)          | IAST                                                                                             |
| Pali (`pli`)              | None, already in Latin script                                                                    |

Pinyin libraries guess polyphones from modern usage, which is often wrong for classical texts: 不亦說乎 is _bù yì yuè hū_, not _shuō_. So every occurrence of a polyphone whose classical reading depends on its sense (說, 樂, 為, 好, 惡, 知, 行, 長, 見, 食…) takes its reading from `data/pinyin/<work>.json`, keyed by reference and character position. The import fails and lists every occurrence that has no reviewed reading.

```sh
pnpm readings:draft
```

This drafts both readings files from 《經典釋文》 (論語音義 and 老子音義, 四部叢刊本 on Chinese Wikisource). Each headword is aligned on the text, and each note is resolved to a 廣韻 sound class through [ytenx](https://github.com/BYVoid/ytenx): 「音X」 is X's class, and 「AB反」 is A's initial with B's rhyme. The script then picks the pinyin reading that is the regular Mandarin outcome of that class. A note marked 下同 carries its reading to later occurrences in the same book. An occurrence with no note takes the usual reading (如字), since 釋文 notes only departures from it. For the Analects, each reading is cross-checked against 朱熹《論語集注》.

Each entry records its source and the original note, e.g. `"note": "音恱注同"`, and `check` when 集注 agrees. Entries where the sources disagree, or where a note couldn't be resolved, carry a `todo` saying why. The import refuses them until they are reviewed.

To fix or add a reading, edit the entry: set `pinyin`, remove `todo`, add `"reviewed": "<your name>"`, and give your reasoning in `note`. `pnpm readings:draft` keeps reviewed entries when it runs again.

```sh
pnpm corpus:index
```

This writes search keywords for each quotable passage, rebuilds the keyword index and embeds the passages, using `MISTRAL_API_KEY`. Results are cached in `CORPUS_CACHE` by passage text, so run it again after every import at no extra cost.

## Tools

| Tool              | Input            | Returns                                                                                    |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `search_passages` | `query`          | Up to 20 hits (id, author, work, reference, snippet), at most 3 per work                   |
| `read_passages`   | `ids` (max 10)   | Each reference unit once: the original to quote, its source, and the translation as an aid |
| `check_quote`     | `quote`, `work`? | The exact match (id, work, reference), or the closest candidates                           |
| `list_concepts`   | `filter`?        | Concepts (id, name, original term, gloss, tradition, school), optionally filtered          |
| `get_concept`     | `id`             | Summary, key passages with their passage ids, and parallels, tensions and related concepts |

Search is hybrid: an FTS5 keyword index over passage text and keywords, and a vector index over Mistral embeddings, merged with reciprocal rank fusion. When too few passages contain every term, keyword search adds passages that contain any of them, ignoring common English stop words. If the embedding call fails or takes more than 5 seconds, search returns keyword results only and says so. `read_passages` stops at about 6,000 words. `check_quote` compares quotes with whitespace and punctuation removed but diacritics kept, through the trigram index on originals and the keyword index on translations. `list_concepts` matches its filter against a concept's id, name, gloss, tradition, school and domains. `get_concept` resolves a key passage to a passage id when its work is in the corpus, and lists the others by work as context only, with a 40-word snippet of each. The server sends its quoting rules to the client as MCP `instructions`.

## Endpoints

- `POST /mcp`: MCP over Streamable HTTP
- `GET /health`: liveness check
- `GET /docs`: Swagger UI

## Testing from Claude Code

`.mcp.json` registers the local server with Claude Code as `wisdom`. Start it with `pnpm start`, approve it in `/mcp`, then ask a question:

```text
/wisdom How to improve global cooperation?
```

The `wisdom` skill first restates the question as the human situation underneath it, then answers with `search_passages` and `read_passages` only, quoting the originals with their references and its own translations. It may run one web search to understand an unfamiliar term, never as answer content. Ask follow-up questions in the same window. The whole conversation, with the reframed question, every tool call, the ids read and the number of calls per turn, is written to `test/output/<NNNNN>-<mon>-<dd>-<question-slug>.md`, numbered from `00001`, which is git-ignored.

## Evaluation

```sh
pnpm eval
```

This runs `search_passages` on each situation in `test/eval/situations.json` and reports Recall@10: the share of the passages judged relevant that appear in the first 10 hits, per situation and on average. It needs a built corpus and `MISTRAL_API_KEY`, so it is not part of CI. Run it before each launch; the target is 0.7.

The set has 44 situations written as a person would ask them, each with 3 to 6 passages judged relevant by hand, at most 3 per work since search returns at most 3 hits per work. A hit counts only if it is the same passage, not another passage of the same reference.

| Date       | Recall@10 | Situations |
| ---------- | --------- | ---------- |
| 2026-10-10 | 0.184     | 44         |

## Compatibility

Any MCP client that speaks Streamable HTTP can use the server. Local clients such as Cursor, VS Code, Zed, Gemini CLI or Codex CLI connect to `http://localhost:3000/mcp` directly. Web apps such as Claude, ChatGPT, Le Chat, Perplexity, Gemini and Grok, and LLM APIs, need a public HTTPS URL. See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) for plans, setup per service, and how to expose the server.

## Scripts

| Script                | What it does                    |
| --------------------- | ------------------------------- |
| `pnpm build`          | Compile to `dist/`              |
| `pnpm start`          | Run the compiled server         |
| `pnpm corpus:import`  | Import the pilot corpus         |
| `pnpm corpus:index`   | Build the search indexes        |
| `pnpm readings:draft` | Draft the pinyin readings files |
| `pnpm eval`           | Measure search Recall@10        |
| `pnpm test`           | Build, then run the tests       |
| `pnpm lint`           | ESLint                          |
| `pnpm format:check`   | Prettier check                  |
| `pnpm typecheck`      | TypeScript without emitting     |

## Credits

- [Kevin Owocki](https://github.com/owocki), for the [Wisdom Context Window](https://wisdom.owocki.com/): the corpus of texts, summaries and concept graph this server searches.
- [Chinese Wikisource](https://zh.wikisource.org/), [Perseus Digital Library](https://www.perseus.tufts.edu/), [SuttaCentral](https://suttacentral.net/), [Sefaria](https://www.sefaria.org/) and the [gita/gita](https://github.com/gita/gita) dataset, for the original-language texts.
- 陸德明《經典釋文》 and 朱熹《論語集注》, as transcribed on Chinese Wikisource, and [ytenx](https://github.com/BYVoid/ytenx) by BYVoid, for the 廣韻 sound classes behind the pinyin readings.
- [pinyin-pro](https://github.com/zh-lx/pinyin-pro), for the base pinyin.
- [sqlite-vec](https://github.com/asg017/sqlite-vec) by Alex Garcia, for vector search inside SQLite.
- The [Model Context Protocol](https://modelcontextprotocol.io) TypeScript SDK.

## License

GPL-3.0

## Contact

**Julien Béranger** ([GitHub](https://github.com/julienbrg))

- Element: [@julienbrg:matrix.org](https://matrix.to/#/@julienbrg:matrix.org)
- Farcaster: [julien-](https://warpcast.com/julien-)
- Telegram: [@julienbrg](https://t.me/julienbrg)
