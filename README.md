[![Corpus](https://img.shields.io/badge/corpus-18%20texts%20%C2%B7%2019%2C440%20passages-45a2f8?labelColor=8c1c84)](#corpus)
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

| Variable                | Default                 | Purpose                                                   |
| ----------------------- | ----------------------- | --------------------------------------------------------- |
| `NODE_ENV`              | `development`           | `production` turns off Swagger UI at `/docs`              |
| `PORT`                  | `3000`                  | HTTP port, bound to `127.0.0.1`                           |
| `PUBLIC_URL`            | `http://localhost:3000` | Public origin; the only host and origin allowed on `/mcp` |
| `DATABASE_PATH`         | `./data/app.db`         | SQLite file                                               |
| `CORPUS_CACHE`          | `./data/cache`          | Downloaded texts used by the corpus import                |
| `MISTRAL_API_KEY`       |                         | Mistral API key for keywords and embeddings               |
| `EMBEDDING_MODEL`       | `mistral-embed`         | Embedding model (1,024 dimensions)                        |
| `KEYWORDS_MODEL`        | `ministral-8b-latest`   | Model that writes search keywords                         |
| `RATE_LIMIT_PER_MINUTE` | `30`                    | Tool calls per client IP per minute on `/mcp`             |
| `SEARCH_LIMIT_PER_DAY`  | `200`                   | `search_passages` calls per client IP per day             |

Over either rate limit, `/mcp` answers 429 with a JSON-RPC error and a `Retry-After` header. Clients are told apart by IP, taken from `X-Forwarded-For` as set by the reverse proxy in front of the server. Counters are kept in memory, so a restart resets them.

`/mcp` rejects JSON-RPC batches, request bodies over 16 KB, and a `Host` or `Origin` header naming another host than `PUBLIC_URL`. Requests without `Origin`, as sent by non-browser clients, pass.

## Corpus

```sh
pnpm corpus:import
```

This imports the 18 pilot works from the Wisdom Context Window, with their original-language texts, and its concept graph: 208 concepts, each with a summary, key passages and links to parallel, opposing, related and broader concepts. Downloads are cached in `CORPUS_CACHE`, so later runs work offline, and each run replaces the works and concepts it imports.

The cached Wisdom Context Window dump is never downloaded again on its own. To see what changed on the site first:

```sh
pnpm corpus:diff
```

This downloads the latest dump, without touching the cached copy, and lists the full texts on the site that are not in `PILOT_WORKS` yet, then the imported works a re-import would change: a different number of passage blocks, or passages no longer in the block their id points to (`edited`). Passage ids such as `analects:123` are positional, so those works' ids would shift. It reads the database and changes nothing. Then re-import from the latest dump:

```sh
pnpm corpus:import --refresh
```

`--refresh` downloads the dump again and overwrites the cached copy. The original-language texts and the concept graph stay cached.

The corpus badge at the top of this README is static: after an import changes the counts, update it with `select count(*) from texts` and `select count(*) from passages`.

| Work                 | Translation                | Reference      | Original                    |
| -------------------- | -------------------------- | -------------- | --------------------------- |
| Tao Te Ching         | James Legge                | chapter.para   | Chinese Wikisource (王弼本) |
| Sayings of Lao Tzŭ   | Lionel Giles               | chapter        | Chinese Wikisource (王弼本) |
| Analects             | James Legge                | book.chapter   | Chinese Wikisource          |
| Great Learning       | James Legge                | chapter        | Chinese Wikisource (章句)   |
| Doctrine of the Mean | James Legge                | chapter        | Chinese Wikisource (章句)   |
| Mencius              | James Legge                | book.chapter   | Chinese Wikisource (集注)   |
| Chuang Tzŭ           | Herbert A. Giles           | chapter.para   | Chinese Wikisource          |
| Book of Lieh Tzŭ     | Lionel Giles               | book.para      | Chinese Wikisource          |
| Yi King (I Ching)    | James Legge                | hexagram, App. | Chinese Wikisource          |
| Art of War           | Lionel Giles               | chapter.para   | Chinese Wikisource          |
| Works of Motse       | Yi-Pao Mei                 | chapter.para   | Chinese Wikisource          |
| Works of Hsüntze     | Homer H. Dubs              | book.para      | Chinese Wikisource          |
| Dhammapada           | F. Max Müller              | verse          | SuttaCentral                |
| Bhagavad Gita        | Edwin Arnold               | chapter.verses | gita/gita dataset, by verse |
| Enchiridion          | Thomas Wentworth Higginson | section        | Perseus                     |
| Meditations          | Meric Casaubon             | book.section   | Perseus, by section         |
| Sermon on the Mount  | King James Version         | chapter:verse  | Perseus                     |
| Ecclesiastes         | King James Version         | chapter:verse  | Sefaria                     |

Every quotable passage has a reference and an original. Front matter, translators' notes, indexes and headings are kept but flagged `is_apparatus`.

The Great Learning, the Doctrine of the Mean and Mencius come from Zhu Xi's 《四書章句集注》, and follow his chapters as Legge does: the Great Learning counts from 0, the text of Confucius, then ten chapters of commentary, and Mencius is book, part and chapter (`1A.1`). The Wisdom Context Window gives these three with no numbers, each Chinese paragraph followed by Legge's translation of it. So each Chinese paragraph is matched to the chapter whose text it shares the most character pairs with, and the translation after it takes that chapter. The Chinese paragraphs are flagged `is_apparatus`, and a paragraph that runs over into the next chapter takes a range, such as `14-15`.

The three Giles translations have no numbers either, and no Chinese, so they are aligned by hand in `data/alignments/<work>.json`: in order, the opening words of the block where each unit starts, or `…` and words within a block, which then takes a range such as `10.6-7`. Chuang Tzŭ is a full translation and goes by chapter and Wikisource paragraph (`17.12`). The Book of Lieh Tzŭ is a selection, by book and paragraph of the Chinese (Giles's Book VII is the Chinese book 8, 說符, so it is `8.x`). The Sayings of Lao Tzŭ rearranges sayings by theme, each taking the 王弼本 chapter it comes from, so it shares the Legge Tao Te Ching's original and readings. Giles's notes, page numbers and section titles are flagged `is_apparatus`.

The Art of War keeps Giles's section numbers (`6.22`), and each section takes the Wikisource paragraph of its chapter it falls in, or a range of them (`6.6-7`); his bracketed notes are apparatus. Mei's Motse and Dubs's Hsüntze are scans with footnotes, page heads and margin summaries run into the text, aligned by hand like the Giles translations, by chapter (or book) and Wikisource paragraph: a footnote runs from the first one on a page to the next page head. Dubs translates 19 of the 32 books and the eulogy that ends book 32. Legge's Yi King is also a scan, whose notes are told from the text by their smaller type, which the OCR gives as longer lines. The Text goes by hexagram (`15`); the appendixes by Legge's numbering: the 彖 and 象 by hexagram (`App. I.15`, `App. II.15`), the 繫辭 by section and chapter (`App. III.1.5`), the 文言 by hexagram and chapter (`App. IV.1.2`), the 說卦 by chapter (`App. V.5`), the 序卦 by part (`App. VI.2`) and the 雜卦 whole (`App. VII`). The originals are the Wikisource pages of the hexagrams and of the 易傳.

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
pnpm readings:draft [work…]
```

This drafts the Analects, Laozi and Zhuangzi readings files from 《經典釋文》 (論語音義 and 老子音義, 四部叢刊本 on Chinese Wikisource). Each headword is aligned on the text, and each note is resolved to a 廣韻 sound class through [ytenx](https://github.com/BYVoid/ytenx): 「音X」 is X's class, and 「AB反」 is A's initial with B's rhyme. The script then picks the pinyin reading that is the regular Mandarin outcome of that class. A note marked 下同 carries its reading to later occurrences in the same book. An occurrence with no note takes the usual reading (如字), since 釋文 notes only departures from it. For the Analects, each reading is cross-checked against 朱熹《論語集注》. The Great Learning, the Doctrine of the Mean and Mencius take their readings from 集注 alone, since 釋文 has no 音義 for Mencius: each phonetic note (「去聲」, 「音X」, 「AB反」) is placed in the passage it follows and read the same way, and a note it allows two readings for goes to review. The Zhuangzi takes its readings from 莊子音義 (卷二十六 to 二十八 of the same edition). Its 下同 only carries a reading on to the phrase the note names (「下爲是皆同」) or to its headword, since a 下同 there runs through long chapters over other senses of the same character. The Liezi takes its readings from 殷敬順's 釋文, printed inline with 張湛's notes in the 四庫全書 edition: the two editions are aligned character by character, a note opening with a reading is placed on the words before it, and its 下同 stops with its paragraph, since Giles translates only some of them. The I Ching takes its readings from 周易音義 (卷二, 四部叢刊本), which reads 王弼's arrangement, where each line's 象 follows the line: each hexagram's text is set out in that order before the headwords are aligned on it. The Art of War, Mozi and Xunzi have no 音義 in this pipeline: every occurrence takes the usual reading, reviewed by hand for the Art of War and for senses that context settles in Mozi and Xunzi (惡乎 wū, 所惡 wù, 王天下 wàng).

Each entry records its source and the original note, e.g. `"note": "音恱注同"`, and `check` when 集注 agrees. Entries where the sources disagree, or where a note couldn't be resolved, carry a `todo` saying why. The import refuses them until they are reviewed.

The script also lists the notes it skips: a note on a character missing from the polyphone list, whose reading differs from pinyin-pro's. Add such a character to `POLYPHONES` in `src/corpus/transcription/pinyin.ts`, with its usual reading in `RUZI` in `src/corpus/transcription/shiwen.ts`, and run the script again.

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
- `GET /docs`: Swagger UI, outside production

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

The set has 51 situations written as a person would ask them, each with 3 to 6 passages judged relevant by hand, at most 3 per work since search returns at most 3 hits per work. A hit counts only if it is the same passage, not another passage of the same reference.

| Date       | Recall@10 | Situations |
| ---------- | --------- | ---------- |
| 2026-10-10 | 0.184     | 44         |
| 2026-10-17 | 0.184     | 51         |

## Compatibility

Any MCP client that speaks Streamable HTTP can use the server. Local clients such as Cursor, VS Code, Zed, Gemini CLI or Codex CLI connect to `http://localhost:3000/mcp` directly. Web apps such as Claude, ChatGPT, Le Chat, Perplexity, Gemini and Grok, and LLM APIs, need a public HTTPS URL. See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) for plans, setup per service, and how to expose the server.

## Scripts

| Script                | What it does                     |
| --------------------- | -------------------------------- |
| `pnpm build`          | Compile to `dist/`               |
| `pnpm start`          | Run the compiled server          |
| `pnpm corpus:import`  | Import the pilot corpus          |
| `pnpm corpus:diff`    | Compare the corpus with the site |
| `pnpm corpus:index`   | Build the search indexes         |
| `pnpm readings:draft` | Draft the pinyin readings files  |
| `pnpm eval`           | Measure search Recall@10         |
| `pnpm test`           | Build, then run the tests        |
| `pnpm lint`           | ESLint                           |
| `pnpm format:check`   | Prettier check                   |
| `pnpm typecheck`      | TypeScript without emitting      |

## Privacy

Every tool call is logged to the `usage` table in the server's SQLite database:

- the time and the tool called
- the query: the search query, the quote checked, the concept filter or concept id
- the passage ids returned or read, and the number of hits
- the duration, whether search fell back to keywords only, and the embedding tokens billed by Mistral

No IP address, client name or session id is stored. After 30 days, a job that runs daily replaces each query with its SHA-256 hash and keeps the other fields. The log is used to improve search: to review retrieval quality and how many calls it takes to answer a question.

## Credits

- [Kevin Owocki](https://github.com/owocki), for the [Wisdom Context Window](https://wisdom.owocki.com/): the corpus of texts, summaries and concept graph this server searches.
- [Chinese Wikisource](https://zh.wikisource.org/), [Perseus Digital Library](https://www.perseus.tufts.edu/), [SuttaCentral](https://suttacentral.net/), [Sefaria](https://www.sefaria.org/) and the [gita/gita](https://github.com/gita/gita) dataset, for the original-language texts.
- 陸德明《經典釋文》, 朱熹《四書章句集注》 and 殷敬順's 列子釋文 (四庫全書本), as transcribed on Chinese Wikisource, and [ytenx](https://github.com/BYVoid/ytenx) by BYVoid, for the 廣韻 sound classes behind the pinyin readings.
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
