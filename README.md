# ninefold frontend

**1.0.0** · [Try Ninefold](https://ninefold.duckdns.org/) · [Full project README](https://github.com/yofujitsu/lore-fm#readme) · [Changelog](CHANGELOG.md)

Pick nine releases, build a board for your current era, send it to the group chat. Albums, EPs, singles — from all-time favorites to the deep cuts you keep on repeat.

This is the React app. The sibling `lore-fm` checkout contains the Spring backend, catalog credentials, Compose deployment and the full [development/deployment guide](https://github.com/yofujitsu/lore-fm#readme).

## What's here

- Spotify and MusicBrainz search together with source links, release-type/year filters, debounced requests and stale-response protection. Provider choice stays under the hood.
- A big desktop Top 9 beside a search sidebar, with stacked mobile panels, rounded controls and dark lavender/cool light themes.
- Add, replace, remove and swap covers; drag Move, use arrow keys, or select a destination. Duplicate release IDs are prevented; incomplete boards work.
- Optional board name and nickname, each up to 40 Unicode characters. Drafts autosave locally; up to 20 named snapshots can be saved, loaded, updated, renamed or deleted.
- One-step Undo for release, board-name and nickname edits. Theme changes preserve the current theme and history. Clear board keeps the name, nickname and theme.
- Readonly snapshot links with clipboard fallback. Anyone with a link can open the board; there is no public discovery feed in 1.0.0.
- Native 1440×1980 PNG export with release titles and artists beneath uncropped covers. Named headings use `nickname's board name` or `someone's board name`; unnamed boards fall back to Top 9.
- Seven typed homepage prompts with pause/resume, a stable screen-reader heading and reduced-motion support.
- GitHub link in the header and Spotify/MusicBrainz credits in the footer and PNG.

Shared pages use the same palette and headings as exports. Covers can be unavailable or blocked by CORS; placeholders and export warnings cover those cases.

## Stack

React **19.3.0**, TypeScript **5.9**, Vite **8.3.2**, plain CSS, Vitest **5.0.3**, Testing Library and jsdom. State uses React hooks and browser localStorage; sharing uses Compression Streams; export uses Canvas; saved snapshots use Web Locks. The Docker runtime serves `dist/` with **Caddy 2** and proxies the Spring API on the same origin.

DM Sans and Manrope are requested from Google Fonts with system-font fallbacks. Branding SVGs are bundled in `public/brand`.

## Develop locally

Requires **Node.js 22.12+**. Keep both repositories as siblings named `lore-fm` and `lore-fm-frontend`. Start the Java 21 backend using its [README](https://github.com/yofujitsu/lore-fm#readme), then run from this directory:

```powershell
npm.cmd ci
npm.cmd run dev
```

On Linux/macOS use `npm ci` and `npm run dev`. Open [127.0.0.1:5173](http://127.0.0.1:5173/). Vite proxies `/api` to `http://127.0.0.1:8080`; catalog keys belong only in the backend `.env`.

For another backend or occupied port:

```powershell
$env:NINEFOLD_API_TARGET = 'http://127.0.0.1:8081'
npm.cmd run dev -- --port 5174
```

On Linux/macOS: `NINEFOLD_API_TARGET=http://127.0.0.1:8081 npm run dev -- --port 5174`. Ports and hostnames have separate browser drafts and saved libraries.

## Check and build

```powershell
npm.cmd test -- --run
npm.cmd run build
```

The build type-checks TypeScript and writes `dist/`. Checks cover search races, partial/unavailable results, editing/history, draft validation, snapshot storage, readonly sharing, clipboard fallback, headline motion and PNG rendering. `npm ci` uses the lockfile; there are no extra state-management or drag libraries.

`npm.cmd run preview` previews the compiled frontend only. It does not supply the dev API proxy; use Caddy or another same-origin reverse proxy for an end-to-end production preview.

## Deploy

From the sibling backend checkout, with Docker Linux containers and Compose 2.30+:

```powershell
docker compose up -d --build --wait
.\scripts\smoke-deployment.ps1
```

Open [localhost:8090](http://localhost:8090/). The frontend Docker build runs tests and the production build; its runtime contains the compiled app, bundled brand assets and Caddy. Shared `/top/*` links resolve to `index.html`; missing compiled assets return 404; `/api` is forwarded to the backend.

The [backend README](https://github.com/yofujitsu/lore-fm#docker-and-deployment) describes Ubuntu setup, image transfer for a small VPS, DNS, HTTPS, updates, rollback and logs. Live app: [ninefold.duckdns.org](https://ninefold.duckdns.org/). The old sslip.io address remains available.

For a frontend-only image update on the VPS:

```sh
cd /opt/ninefold
docker compose --env-file .env.deployment up -d --no-build --no-deps --wait frontend
```

This assumes the new image has already been loaded. The app's `1.0.0` version leaves stored board/share schemas at version 1, so existing data remains compatible.

## Boards, links and browser support

Drafts use `ninefold.board.v1`; the local snapshot library uses `ninefold.boards.v1`. Changes to a draft leave saved snapshots alone until Update is used. Corrupt stored libraries remain intact until an explicit reset. Older saved snapshots without a board name use their library name when loaded.

Boards stay in the current browser and origin. Changing domain starts a separate library; old boards remain on the previous address. Shared links are readonly snapshots and do not import into or overwrite the viewer's draft. Editing your board requires generating a new link to share that edit.

Share payloads are limited to 8000 encoded characters and 64 KiB of inflated JSON. Unsafe URLs, unsupported schemas and malformed data are rejected. PNG export waits up to five seconds for anonymous cover requests. Sharing/export needs at least one release. Use a current browser with Compression Streams, Canvas and Web Locks; snapshot writes require HTTPS or localhost.

Optional SoundCloud/YouTube adapters live in the backend and are hidden from this UI. Configure them only in the backend and call them explicitly through its API.

## Contributing and license

Small patches and useful music-search examples are welcome. Run the checks, keep provider attribution visible and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

By [yofujitsu](https://github.com/yofujitsu). Project code and original documentation use [MIT](LICENSE). The Code of Conduct, brand assets, font services and catalog artwork have separate terms; see [Third-party notices](THIRD_PARTY_NOTICES.md).
