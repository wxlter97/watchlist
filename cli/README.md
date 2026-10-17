# watch-order-cli

Command-line client for the [Watch Order API](https://watchlist.wxlter.dev/developers): in what order to watch
movie and TV franchises (release, chronological, curated), where to stream a title, upcoming releases and cast.
No account or API key. Node 18+.

```bash
npx watch-order-cli franchises
npx watch-order-cli order marvel --order chronological
npm install -g watch-order-cli   # installs the `watch-order` command
```

| Command | What it does |
| --- | --- |
| `watch-order franchises` | List every franchise |
| `watch-order order <franchise> [--order <id>]` | Titles in a watch order (default: release) |
| `watch-order title <titleId>` | One title and its franchises |
| `watch-order upcoming <ids>` | Releases in the next 365 days |
| `watch-order providers <tmdbId> <movie\|tv> [--region US]` | Where to watch |
| `watch-order credits <tmdbId> <movie\|tv>` | Main cast |
| `watch-order health` | Service status |

Options: `--lang en|es`, `--json` (raw API JSON, for scripts and agents), `--base-url <url>` (or `$WATCH_ORDER_URL`).
Exit codes: `0` ok, `1` API or network error, `2` wrong usage.

The CLI calls `/api/v1/…`, waits for `Retry-After` and retries once on a `429` (limit: 60 requests per minute).
OpenAPI: <https://watchlist.wxlter.dev/openapi.json>. Title data comes from TMDB; "where to watch" from JustWatch.
