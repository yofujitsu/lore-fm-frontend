# Ninefold frontend

React, TypeScript and Vite for music search and a visual Top 9. The Spring Boot backend is in the sibling `lore-fm` directory.

Requires Node.js 22.12+.

```powershell
cd F:\java_pr\lore-fm-frontend
npm.cmd ci
npm.cmd run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The dev server proxies `/api` to `http://127.0.0.1:8080`; start the backend separately. Configure Spotify credentials and the MusicBrainz User-Agent only in the backend, following its README. MusicBrainz needs no login or API key.

To use another backend, set `$env:NINEFOLD_API_TARGET = 'http://127.0.0.1:8081'` before starting Vite. If needed, use `npm.cmd run dev -- --port 5174`.

## Features

- Combined Spotify/MusicBrainz search with a 400ms debounce, request cancellation and stale response protection.
- Safe links to all available catalog sources; partial results remain usable during outages, with unavailable catalogs distinguished from healthy empty searches.
- Nine fixed slots: add, remove, replace and swap releases; duplicate IDs are prevented.
- Undo the previous release or nickname change; theme changes do not enter history, and Undo preserves the current theme. History lasts until reload.
- Clear all slots with confirmation while preserving the nickname and theme; Undo can restore them.
- Filter the current results by release type and exact year, with a Clear filters action. Unknown years are excluded when a year is selected; filters persist across queries without extra requests.
- Mouse/touch dragging from Move handles and keyboard arrow movement. Click Move and choose a slot as an alternative.
- Optional nickname of up to 40 Unicode characters and Dark/Light themes.
- Up to 20 named local Top 9 snapshots: save, load, update, rename and delete with confirmation. Changes to a draft never silently update a saved snapshot.
- Versioned local draft saving and restoration on reload under `ninefold.board.v1`.
- Validated saved data, storage failure warnings, safe source links and missing artwork fallbacks.

Click **Add** to fill the first empty slot. Select a slot first to fill or replace that position. Partial boards are supported. Named snapshots use the validated, versioned `ninefold.boards.v1` library. Unreadable libraries remain stored until an explicit confirmed reset. Drafts and snapshots are local to the browser and origin; different ports have separate drafts. Sharing and PNG export are available for any nonempty board.

## Sharing and PNG export

Click **Share board** to create a compressed, versioned snapshot link. The app attempts to copy it; a read-only field and **Copy link** remain available when clipboard access is blocked. Board edits invalidate the previous link. Shared pages at `/top/<payload>` display metadata and artwork without searching providers, are read-only, and do not read or overwrite the viewer's own draft.

The snapshot preserves all nine positions, including empty slots. Limits: 8000 encoded characters and 64 KiB of inflated UTF-8 JSON. Malformed payloads, unsupported versions and unsafe artwork/source URLs are rejected; decoded text has control characters removed.

**Download PNG** exports a 1440×1980 image with Ninefold branding, the nickname, theme and uncropped artwork, with the release title and artists beneath each cover. Long captions end with an ellipsis to fit their column. Empty slots and unavailable covers use placeholders. Blocked/missing covers are reported after export. Covers load anonymously with CORS and a five-second maximum wait. PNG export also works on shared pages. Add at least one release to enable sharing/export.

These features use the native [Compression Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API) and [Canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image), with no additional runtime packages. Named snapshots use native Web Locks to serialize writes across tabs and require HTTPS or localhost. Use a current browser. Clipboard failure has a manual-copy fallback.

A localhost link only opens on the same machine. Deployed links use the current origin. The production frontend server must serve `index.html` for `/top/*` paths as well as the homepage, while forwarding `/api` to the backend.

## Checks

```powershell
npm.cmd test -- --run
npm.cmd run build
```

`npm ci` uses the lockfile for reproducible installation. No extra state management or drag-and-drop dependencies are required.

For production, serve `dist/` and proxy `/api` through the same origin. Vite's proxy only works in the dev server; `vite preview` does not replace a reverse proxy.


## Docker and HTTPS

The sibling backend provides `compose.yaml` for both projects. From `lore-fm`, run `docker compose up -d --build --wait` and open [http://localhost:8090](http://localhost:8090). The frontend image builds and tests with Node 22, then serves the compiled app using Caddy. The same server forwards `/api` and serves `index.html` for shared `/top/*` links. Missing compiled assets return 404.

The backend README describes VPS image transfer and `deploy.env.example` for automatic HTTPS. Catalog credentials stay in the backend runtime environment. Run its `scripts/smoke-deployment.ps1` to check the production routes and API proxy.
