# DeepSeek 随行

[Open DeepSeek 随行](https://145736.github.io/deepseek-go-mobile/) · [中文使用与开发说明](README.zh-CN.md)

An iPhone-first static frontend derived from [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo), with a restrained LobeChat-inspired interface. No application server, cloud database, proxy, or third-party AI provider.

- Default model: `deepseek-flash`.
- Direct browser requests exclusively to `https://api.deepseek.com`.
- Official server-side web tools, Files API, safety checks, ASR and TTS.
- API keys in browser localStorage; conversations and attachments in local IndexedDB.
- Safari safe-area and keyboard handling, home-screen manifest/icons, light/dark themes.
- Chats, branches, citations, history import/export retained from upstream.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm type
pnpm lint
pnpm build
```

Node.js 22.15+ and pnpm 11+. Publish `dist/` on any HTTPS static host. No environment secrets are required. Native Node build script works on Windows, macOS and Linux. GitHub Pages publishes the prebuilt `gh-pages` branch. No ChatGPT or GitHub login is required to open the site. See `docs/DEPLOYMENT.md`.

## Provenance

Upstream commit: `5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c` (v0.1.1). Original MIT license retained at `LICENSE` and in the distribution. Original README preserved in `docs/`. LobeChat is a visual reference; no LobeChat code was copied. This is an independent derivative, not an official DeepSeek client.

See `docs/VERIFICATION.md` for testing and limitations.
