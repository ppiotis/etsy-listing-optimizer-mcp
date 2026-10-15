<p align="center"><img src="logo.svg" width="96" alt="Etsy Listing Optimizer logo"></p>

# Etsy Listing Optimizer MCP

[![CI](https://github.com/ppiotis/etsy-listing-optimizer-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/ppiotis/etsy-listing-optimizer-mcp/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

**Write and audit Etsy listings that follow the rules and rank.** Give your agent the product facts and target keywords. It returns titles that always fit Etsy's 140-character limit, 13 tags that always fit 20 characters, a structured description, and a 0–100 listing score with specific fixes. Built for digital-product and handmade sellers.

- **Deterministic and rule-based.** Same input, same output. No LLM inside, no randomness.
- **No Etsy account, no API key, no network.** Works only on the data you provide.
- **Accurate by design.** It never invents descriptors like "handmade" or "gold". It uses only what you confirm, and asks about the rest.

## Tools

| Tool | What it does |
|---|---|
| `generate_titles` | 3–4 variants (`seo_keyword_first`, `concise` ≤70, `benefit_led`, `branded`), all ≤140 chars, primary keyword first, no word >2×, `% : & +` at most once |
| `generate_tags` | Up to 13 unique tags ≤20 chars, multi-word phrases first, plural/word-order duplicates removed, characters sanitised. Returns `skipped` phrases and `ask_seller_about_modifiers` |
| `generate_description` | Keyword-led opening (first 160 chars), sections (why you'll love it / what's included / how it works / size / delivery), digital-download disclosure |
| `analyze_listing` | Score 0–100 + grade A–F over 16 checks in title, tags, description and media, plus `blockers` and `top_fixes` |
| `cluster_keywords` | Group a raw keyword list into themes, pick a primary per theme, flag tag-ready phrases |
| `suggest_long_tail` | Expand a seed into long-tail variants with proven digital/physical modifiers and your attributes |

All tools are `readOnlyHint: true`, `openWorldHint: false`.

## Install

### Remote (Streamable HTTP, recommended once hosted)

This server is stateless with no user data, so it is ideal to host. Deploy with one of:

- **Vercel:** `vercel deploy` (uses `vercel.json` + `api/mcp.js`; endpoint `https://<project>.vercel.app/mcp`)
- **Docker / Fly / Render / Cloud Run:** `docker build -t etsy-listing-optimizer-mcp . && docker run -p 3000:3000 etsy-listing-optimizer-mcp`

Then add to your client:

```json
{ "mcpServers": { "etsy-listing-optimizer": { "url": "https://<your-host>/mcp" } } }
```

Optional: set `MCP_AUTH_TOKEN` on the server and send `Authorization: Bearer <token>`.

### Local (stdio)

Requires Node.js 20+.

```json
{ "mcpServers": { "etsy-listing-optimizer": { "command": "npx", "args": ["-y", "github:ppiotis/etsy-listing-optimizer-mcp"] } } }
```

From source: `git clone https://github.com/ppiotis/etsy-listing-optimizer-mcp && cd etsy-listing-optimizer-mcp && npm ci && npm run build && node dist/stdio.js` (HTTP: `npm run start:http`, then `http://127.0.0.1:3000/mcp`).

## Skills included

- `etsy-seo-fundamentals`: Etsy's hard limits and ranking best practices.
- `etsy-listing-workflow`: facts → keywords → title/tags/description → verify.
- `etsy-listing-audit`: score an existing listing and show before → after.

## Security & privacy

- **No network calls, no telemetry, no credentials.** It never touches Etsy. Runtime deps: the MCP SDK and `zod`.
- **Stateless.** Nothing is stored. Each HTTP request gets a fresh server instance.
- **Validated input.** zod schemas with length and count caps on every field; 1 MB HTTP body cap.
- **Hosted hardening.** Optional bearer token (constant-time compare); binds to `127.0.0.1` unless `HOST` is set; `/health` endpoint.

## Reviewer test plan

1. **New digital listing.** Add the plugin and ask: *"Create an Etsy listing for my minimalist wedding budget planner PDF. Keywords: wedding budget planner, wedding planner printable, budget spreadsheet, wedding checklist. It's editable and printable."* → Expect three titles, all ≤140 characters and starting "Wedding Budget Planner"; 13 tags each ≤20 characters (e.g. `budget planner`, `gift for bride`, `digital download`); and a description that says no physical item ships.
2. **Hard limits.** Ask: *"Give me tags for a 'personalized extraordinarily beautiful watercolor nursery wall art print'"* → Expect every tag ≤20 characters. Over-long phrases are shortened to their head noun or listed under `skipped`, never cut mid-word.
3. **Accuracy guard.** Ask: *"Tags for my gold name necklace, keywords: personalized name necklace, gold name necklace, mothers day gift."* → Expect fewer than 13 tags with no "handmade"/"boho", and the bot asking which of handmade / custom / minimalist… are true. Answer "handmade and dainty" → `handmade necklace`, `dainty necklace` appear.
4. **Audit.** Paste: *title "BEST PLANNER EVER planner planner planner", tags "planner, planners", description "Nice planner."* and ask *"score this for 'wedding budget planner'"* → Expect grade **F** with fixes for ALL CAPS, keyword stuffing, too few tags, a duplicate plural tag, a short description and a missing keyword. Ask it to rewrite → the new version scores **A/B**.
5. **Keyword research.** Paste 15–20 raw keywords and ask *"cluster these and pick my primary"* → Expect themed clusters, a `suggested_primary` per theme, and tag-ready flags.

## Development

```bash
npm ci
npm test               # build + unit/property tests + e2e over stdio and Streamable HTTP
npm audit --omit=dev
```

## Disclaimer

Not affiliated with or endorsed by Etsy, Inc. "Etsy" is a trademark of Etsy, Inc.

## License

MIT © Paris Piotis
