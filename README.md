# Ninefold frontend

React, TypeScript and Vite for music search and a visual Top 9. The Spring Boot backend is in the sibling `lore-fm` directory.

Requires Node.js 22.12+.

```powershell
cd F:\java_pr\lore-fm-frontend
npm.cmd ci
npm.cmd run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The dev server proxies `/api` to `http://127.0.0.1:8080`; start the backend separately. Configure Spotify credentials only in the backend, following its README.

To use another backend, set `$env:NINEFOLD_API_TARGET = 'http://127.0.0.1:8081'` before starting Vite. If needed, use `npm.cmd run dev -- --port 5174`.

## Features

- Search with a 400ms debounce, request cancellation and stale response protection.
- Nine fixed slots: add, remove, replace and swap releases; duplicate IDs are prevented.
- Mouse/touch dragging from Move handles and keyboard arrow movement. Click Move and choose a slot as an alternative.
- Optional nickname of up to 40 Unicode characters and Dark/Light themes.
- Versioned local draft saving and restoration on reload under `ninefold.board.v1`.
- Validated saved data, storage failure warnings, safe source links and missing artwork fallbacks.

Click **Add** to fill the first empty slot. Select a slot first to fill or replace that position. Partial boards are supported. Drafts are local to the browser and origin; different ports have separate drafts. Sharing and PNG export are available for any nonempty board.

## Sharing and PNG export

Click **Share board** to create a compressed, versioned snapshot link. The app attempts to copy it; a read-only field and **Copy link** remain available when clipboard access is blocked. Board edits invalidate the previous link. Shared pages at `/top/<payload>` display metadata and artwork without searching providers, are read-only, and do not read or overwrite the viewer's own draft.

The snapshot preserves all nine positions, including empty slots. Limits: 8000 encoded characters and 64 KiB of inflated UTF-8 JSON. Malformed payloads, unsupported versions and unsafe artwork/source URLs are rejected; decoded text has control characters removed.

**Download PNG** exports a 1440×1740 image with Ninefold branding, the nickname, theme and uncropped artwork. Empty slots and unavailable covers use placeholders. Blocked/missing covers are reported after export. Covers load anonymously with CORS and a five-second maximum wait. PNG export also works on shared pages. Add at least one release to enable sharing/export.

These features use the native [Compression Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API) and [Canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image), with no additional runtime packages. Use a current browser. Clipboard failure has a manual-copy fallback.

A localhost link only opens on the same machine. Deployed links use the current origin. The production frontend server must serve `index.html` for `/top/*` paths as well as the homepage, while forwarding `/api` to the backend.

## Checks

```powershell
npm.cmd test -- --run
npm.cmd run build
```

`npm ci` uses the lockfile for reproducible installation. No extra state management or drag-and-drop dependencies are required.

For production, serve `dist/` and proxy `/api` through the same origin. Vite's proxy only works in the dev server; `vite preview` does not replace a reverse proxy.

