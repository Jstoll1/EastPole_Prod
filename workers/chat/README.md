# eastpole-chat — Cloudflare Worker

Brokers chat requests from `index.html` / `terminal.html` to the Claude API.

- Endpoint: `POST /chat`
- Model: `claude-haiku-4-5`
- Streams Anthropic SSE back to the browser
- Holds `ANTHROPIC_API_KEY` as a Cloudflare secret — never in code

## First-time deploy

```bash
cd workers/chat
npm install                                  # installs wrangler
npx wrangler login                           # if not already authed
npx wrangler secret put ANTHROPIC_API_KEY    # paste the sk-ant-... key when prompted
npx wrangler deploy                          # builds + deploys to the *.workers.dev subdomain
```

After `wrangler deploy` completes it prints the deployed URL — looks like `https://eastpole-chat.<your-subdomain>.workers.dev`. Note that URL; the frontend points at it.

## Updates

```bash
cd workers/chat
npx wrangler deploy
```

## Tail logs

```bash
npx wrangler tail
```

## Endpoint contract

Request:
```json
POST /chat
Content-Type: application/json

{
  "message": "How are my picks doing?",
  "history": [
    {"role": "user", "text": "Who's leading?"},
    {"role": "assistant", "text": "Cameron Young is at -8 thru 14..."}
  ],
  "userEmail": "user@example.com"
}
```

Response: `text/event-stream` — Anthropic SSE format relayed verbatim. The client reads `content_block_delta` events with `delta.type === "text_delta"` for streamed tokens.

## Cost guardrails

- Anthropic key has a usage cap set in the console (configure in Settings → Limits)
- 1000-char input limit per message
- Cheap regex-based off-topic filter rejects obvious off-topic / injection attempts before any API call
- Last 10 turns of history sent (older turns dropped client-side)
- 600-token output cap forces concise chat-length responses
- Prompt caching on system prompt + first-turn context (~95% of tokens) — first call writes the cache, subsequent calls within ~5min hit at 0.1× cost

## Sources of context

- ESPN scoreboard (live leaderboard + tournament metadata)
- DataGolf via existing `datagolf-proxy.jhs797.workers.dev` (win probabilities)
- Published Google Sheet TSV (pool entries, picks, tiebreakers)

All three are fetched in parallel with `cf: { cacheTtl: 60 }` so back-to-back chats within a minute reuse the same upstream payloads.
