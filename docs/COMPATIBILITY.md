# Compatibility with AI services

Wisdom MCP speaks the [Model Context Protocol](https://modelcontextprotocol.io/) over [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http) at `POST /mcp`, without authentication. Any client that supports remote MCP servers over Streamable HTTP can use it. What changes from one service to the next is where the client runs, and so which URL it can reach.

This page reflects the state of each service as of October 2026. Plans and menus change often: check the linked documentation before relying on a detail.

## Local or public

There are two kinds of clients:

- **Clients that run on your machine**: coding tools, CLIs and desktop apps with a config file. They reach `http://localhost:3000/mcp` directly. Nothing else is needed.
- **Clients that run in the cloud**: web chat apps and LLM APIs. They call the server from their own infrastructure, so it must be reachable at a public HTTPS URL.

## Exposing the server

The server binds to `127.0.0.1`. To give it a public HTTPS URL, either deploy it behind a reverse proxy, or run a tunnel in front of the local server:

```sh
# Cloudflare Tunnel, quick mode: prints a https://<random>.trycloudflare.com URL
cloudflared tunnel --url http://localhost:3000

# or ngrok
ngrok http 3000
```

Both [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) and [ngrok](https://ngrok.com/docs/) work.

Then set `PUBLIC_URL` to that origin and restart the server:

```sh
PUBLIC_URL=https://wisdom.example.com pnpm start
```

`/mcp` only accepts requests whose `Host` header matches the hostname of `PUBLIC_URL`, as a guard against [DNS rebinding](https://en.wikipedia.org/wiki/DNS_rebinding). With a public `PUBLIC_URL`, local clients pointing at `localhost:3000` are rejected. Run a second instance for local use, or point local clients at the public URL too.

The connector URL to paste into every service below is `https://<your-host>/mcp`.

### Before going public

The server has no authentication. Anyone with the URL can call `search_passages`, and every search spends [Mistral API](https://docs.mistral.ai/) credit on embeddings and keywords. Before leaving it public:

- put it behind a rate limit at the proxy or tunnel
- use an unguessable hostname, and keep it private
- or stop the tunnel when you're done

The tools are read-only, so exposure costs money, not data.

## Summary

### Chat apps

| Service                                                                                                     | Custom MCP                   | Plans                                          | Auth for this server   | Notes                                                                |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| [Claude](https://claude.ai/) (web, desktop, mobile)                                                         | Yes                          | Free (1 connector), Pro, Max, Team, Enterprise | None                   | Added on the web, then available everywhere                          |
| [ChatGPT](https://chatgpt.com/)                                                                             | Yes, in Developer mode       | Plus, Pro, Business, Enterprise, Edu           | None                   | Web only; on workspaces, admins may restrict it                      |
| [Le Chat](https://chat.mistral.ai/) (Mistral)                                                               | Yes                          | All plans with connectors                      | None                   | Custom MCP Connector tab                                             |
| [Perplexity](https://www.perplexity.ai/)                                                                    | Yes                          | Pro, Max, Enterprise                           | None                   | Pick Streamable HTTP as transport                                    |
| [Gemini](https://gemini.google.com/) (personal)                                                             | Yes, as a custom app         | Personal account, 18+, US, English             | None                   | Added on the web, then available on mobile                           |
| [Gemini Enterprise](https://cloud.google.com/gemini-enterprise)                                             | Yes, admin-configured        | Gemini Enterprise / Business                   | None or OAuth          | Public preview                                                       |
| [Grok](https://grok.com/)                                                                                   | Yes                          | Accounts with Connectors                       | None                   | grok.com/connectors                                                  |
| [Microsoft 365 Copilot](https://www.microsoft.com/microsoft-365/copilot)                                    | Via admins or Copilot Studio | Microsoft 365 Copilot licence                  | None, API key or OAuth | No per-user "paste a URL" option                                     |
| Microsoft Copilot (consumer)                                                                                | No                           |                                                |                        |                                                                      |
| [Meta AI](https://www.meta.ai/), [DeepSeek](https://chat.deepseek.com/), [Qwen Chat](https://chat.qwen.ai/) | No custom connector found    |                                                |                        | Their models can still drive the server through a local client below |

### Coding tools and desktop clients

All of these run locally and can use `http://localhost:3000/mcp` as is.

| Client                                                                                  | Config                                                                               | Key for the URL                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| [Claude Code](https://docs.claude.com/en/docs/claude-code/mcp)                          | `.mcp.json` (already in this repo) or `claude mcp add`                               | `url`, with `"type": "http"`                  |
| [Claude Desktop](https://claude.ai/download)                                            | Settings → Connectors (public URL), or `claude_desktop_config.json` via `mcp-remote` |                                               |
| [VS Code](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) (GitHub Copilot) | `.vscode/mcp.json`                                                                   | `url`, with `"type": "http"`, under `servers` |
| [Cursor](https://cursor.com/docs/context/mcp)                                           | `.cursor/mcp.json` or `~/.cursor/mcp.json`                                           | `url`                                         |
| [Windsurf](https://docs.windsurf.com/windsurf/cascade/mcp)                              | `~/.codeium/windsurf/mcp_config.json`                                                | `serverUrl`                                   |
| [Zed](https://zed.dev/docs/ai/mcp)                                                      | `settings.json`, `context_servers`                                                   | `url`                                         |
| [JetBrains AI Assistant](https://www.jetbrains.com/help/ai-assistant/mcp.html)          | Settings → Tools → AI Assistant → MCP                                                | URL, transport Streamable HTTP                |
| [Cline](https://docs.cline.bot/mcp/configuring-mcp-servers)                             | `cline_mcp_settings.json`                                                            | `url`, with `"type": "streamableHttp"`        |
| [Continue](https://docs.continue.dev/customize/deep-dives/mcp)                          | `config.yaml`, `mcpServers`                                                          | `url`, with `type: streamable-http`           |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli)                               | `~/.gemini/settings.json`                                                            | `httpUrl` (`url` means SSE)                   |
| [Codex CLI](https://developers.openai.com/codex/mcp)                                    | `~/.codex/config.toml`                                                               | `url`                                         |
| [LM Studio](https://lmstudio.ai/docs/app/mcp)                                           | `mcp.json`                                                                           | `url`                                         |

### LLM APIs

The provider calls the server from its own infrastructure, so these need the public URL.

| API                                                                                        | Mechanism                                                             |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [OpenAI Responses API](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) | `tools: [{ type: "mcp", server_url }]`                                |
| [Anthropic Messages API](https://docs.claude.com/en/docs/agents-and-tools/mcp-connector)   | `mcp_servers` parameter, with the `mcp-client-2025-11-20` beta header |
| [xAI API](https://docs.x.ai/)                                                              | Remote MCP tools, passing the server URL as a tool                    |

## Chat apps

### Claude

On [claude.ai](https://claude.ai/), open Settings → Connectors → Add custom connector. Paste `https://<your-host>/mcp`, leave the OAuth fields empty, and save. Then enable it per conversation from the tools menu.

Free plans get one custom connector. On Team and Enterprise, an owner adds it for the organization first. See [Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

The server sends its quoting rules as MCP `instructions`. Claude follows them, so quotes come with the original and the reference.

### ChatGPT

1. Turn on [Developer mode](https://developers.openai.com/api/docs/guides/developer-mode) in ChatGPT's settings. The menu has moved between "Security and login" and "Apps & Connectors → Advanced" across rollouts.
2. Create a new app or connector: give it a name and description, paste `https://<your-host>/mcp`, and choose "No authentication".
3. In a conversation, pick it from the composer's Developer mode tools.

It's available on Plus, Pro, Business, Enterprise and Edu, on the web only. Workspace admins can turn it off. Developer mode supports both read and write tools; both of this server's tools are read-only. See [OpenAI's help article](https://help.openai.com/en/articles/12584461).

### Le Chat

Open Intelligence → Connectors, click "+ Add Connector" and switch to the Custom MCP Connector tab. Give it a name without spaces (`wisdom`), paste the URL, and choose no authentication. See [Mistral's MCP connector docs](https://docs.mistral.ai/le-chat/knowledge-integrations/connectors/mcp-connectors) and [Configuring a custom connector](https://help.mistral.ai/en/articles/393572-configuring-a-custom-connector).

### Perplexity

Open Account settings → Connectors → "+ Custom connector", and choose Remote. Enter a name and the URL, and pick **Streamable HTTP** as the transport: picking SSE makes validation fail. Choose no authentication. It's available on Pro, Max and Enterprise; the option doesn't show on free accounts, and lags behind on mobile.

### Gemini

On [gemini.google.com](https://gemini.google.com/), open Settings → Connected Apps → Add a custom app, and paste the URL. You need:

- a personal Google account
- to be 18 or older, and in the US
- Keep Activity turned on
- the app set to English

Once added on the web, the app also shows up in the Gemini mobile app. See [Connect & manage custom apps](https://support.google.com/gemini/answer/17209137).

On [Gemini Enterprise](https://cloud.google.com/gemini-enterprise), an administrator registers the server instead. See [Set up your custom MCP server connection](https://support.google.com/g/answer/17106276).

### Grok

Go to [grok.com/connectors](https://grok.com/connectors), click New Connector → Custom, and enter the URL. See [Grok connectors](https://docs.x.ai/grok/connectors).

### Microsoft 365 Copilot

There is no way for an individual user to add an MCP server. Two routes exist:

- **Copilot Studio:** a maker opens an agent, goes to Tools → Add a tool → New tool → Model Context Protocol, and enters the URL with authentication "None". Copilot Studio only speaks Streamable HTTP, which is what this server uses. See [MCP in Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-extend-action-mcp).
- **Admin center:** an admin creates an MCP-based connector in the Microsoft 365 admin center and deploys it to the organization.

### Services without custom connectors

These apps have no option to add your own MCP server:

- the consumer [Microsoft Copilot](https://copilot.microsoft.com/) app
- [Meta AI](https://www.meta.ai/)
- [DeepSeek](https://chat.deepseek.com/)
- [Qwen Chat](https://chat.qwen.ai/)

Their models are still usable with Wisdom MCP through a local client: DeepSeek and Qwen through their APIs in Cline or Continue, and Llama or Qwen weights in LM Studio.

## Coding tools and desktop clients

### Claude Code

This repository's [`.mcp.json`](../.mcp.json) already registers the server as `wisdom`. Start the server, approve it in `/mcp`, and use the `/wisdom` skill. To add it elsewhere:

```sh
claude mcp add --transport http wisdom http://localhost:3000/mcp
```

### Claude Desktop

Custom connectors added on claude.ai also show up in Claude Desktop, but they need the public URL. To use the local server instead, bridge it with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wisdom": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp"]
    }
  }
}
```

### VS Code

Add the server to `.vscode/mcp.json`. The root key is `servers`, not `mcpServers`, and `type` is required. Its tools then show up in Copilot Chat's Agent mode.

```json
{
  "servers": {
    "wisdom": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Cursor

Add the server to `.cursor/mcp.json`, or to `~/.cursor/mcp.json` for every project. Cursor detects Streamable HTTP from the URL.

```json
{
  "mcpServers": {
    "wisdom": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Windsurf

Add the server to `~/.codeium/windsurf/mcp_config.json`. Note the key `serverUrl`, not `url`.

```json
{
  "mcpServers": {
    "wisdom": {
      "serverUrl": "http://localhost:3000/mcp"
    }
  }
}
```

### Zed

In Zed's `settings.json`, or through Settings → AI → MCP Servers → Add Remote Server:

```json
{
  "context_servers": {
    "wisdom": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### JetBrains AI Assistant

Open Settings → Tools → AI Assistant → Model Context Protocol, add a server, enter the URL, and choose Streamable HTTP as the transport.

### Cline

Add the server to `cline_mcp_settings.json`, from the MCP Servers panel:

```json
{
  "mcpServers": {
    "wisdom": {
      "type": "streamableHttp",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Continue

Add the server to `config.yaml`:

```yaml
mcpServers:
  - name: wisdom
    type: streamable-http
    url: http://localhost:3000/mcp
```

### Gemini CLI

Add the server to `~/.gemini/settings.json`. Use `httpUrl`: in Gemini CLI, `url` means the older SSE transport and fails silently.

```json
{
  "mcpServers": {
    "wisdom": {
      "httpUrl": "http://localhost:3000/mcp"
    }
  }
}
```

### Codex CLI

Add the server to `~/.codex/config.toml`:

```toml
[mcp_servers.wisdom]
url = "http://localhost:3000/mcp"
```

Or from the command line:

```sh
codex mcp add wisdom --url http://localhost:3000/mcp
```

Older versions also need `experimental_use_rmcp_client = true` at the top level of the file. See [Codex MCP](https://developers.openai.com/codex/mcp).

### LM Studio

Add the server to LM Studio's `mcp.json`, from Program → Install → Edit mcp.json. This lets a local model such as Qwen or Llama use the corpus with no cloud service at all, apart from the Mistral embeddings.

```json
{
  "mcpServers": {
    "wisdom": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## LLM APIs

### OpenAI Responses API

```json
{
  "model": "gpt-5",
  "input": "What do the Stoics say about anger?",
  "tools": [
    {
      "type": "mcp",
      "server_label": "wisdom",
      "server_url": "https://<your-host>/mcp",
      "require_approval": "never"
    }
  ]
}
```

By default, OpenAI asks for approval before each call; `require_approval: "never"` turns that off for this server. See [Remote MCP](https://developers.openai.com/api/docs/guides/tools-connectors-mcp).

### Anthropic Messages API

```json
{
  "model": "claude-opus-5-5",
  "max_tokens": 4096,
  "messages": [{ "role": "user", "content": "What do the Stoics say about anger?" }],
  "mcp_servers": [{ "type": "url", "url": "https://<your-host>/mcp", "name": "wisdom" }],
  "tools": [{ "type": "mcp_toolset", "mcp_server_name": "wisdom" }]
}
```

Send it with the `anthropic-beta: mcp-client-2025-11-20` header. Only tools are supported, which is all this server exposes. See [MCP connector](https://docs.claude.com/en/docs/agents-and-tools/mcp-connector).

### xAI API

The [xAI API](https://docs.x.ai/) accepts remote MCP servers as tools: pass the server URL and xAI handles the connection.

## Further reading

- [MCP transports specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP clients list](https://modelcontextprotocol.io/clients)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector), to test the server before adding it anywhere
- [Calmara's MCP compatibility table](https://calmara.app/mcp-compatibility)
