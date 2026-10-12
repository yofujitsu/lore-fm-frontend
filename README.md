# ninefold / frontend

<img width="2195" height="1285" alt="image" src="https://github.com/user-attachments/assets/f5b9be57-3e92-40ee-881a-f46293d212e6" />

---

Pick your top 9 albums, EPs and singles. Make a board for your lore or current era, then share a link or PNG.

<img width="1440" height="1980" alt="ninefold-top9" src="https://github.com/user-attachments/assets/ebbc0e2f-3aa3-4088-9bec-06dce4c148cb" />

[Open Ninefold](https://ninefold.duckdns.org/) · [Backend](https://github.com/yofujitsu/lore-fm)

## Quick start

Requires Node.js 22.12+ and a running [backend](https://github.com/yofujitsu/lore-fm#quick-start) on port 8080. Clone both repositories into the same folder:

```sh
git clone https://github.com/yofujitsu/lore-fm.git
git clone https://github.com/yofujitsu/lore-fm-frontend.git
```

Configure catalog access in `lore-fm/.env` and start the backend:

- **Spotify:** create an app in the [Developer Dashboard](https://developer.spotify.com/dashboard), select Web API, then copy Client ID and Client Secret from Settings into `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`. [Premium is required](https://developer.spotify.com/documentation/web-api/tutorials/getting-started).
- **MusicBrainz:** [no API key needed](https://musicbrainz.org/doc/MusicBrainz_API). Set `MUSICBRAINZ_ENABLED=true` and `MUSICBRAINZ_USER_AGENT=Ninefold/1.0.0 (mailto:you@example.com)` with your own email.

Use the [backend quick start](https://github.com/yofujitsu/lore-fm#quick-start) for the `.env` template and launch command. Keep credentials in the backend.

In a second terminal:

```sh
cd lore-fm-frontend
npm ci
npm run dev
```

Open [127.0.0.1:5173](http://127.0.0.1:5173/). On Windows, use `npm.cmd` instead of `npm` if needed.

Build locally:

```sh
npm run build
```

## Contributing

Open an issue or send a focused pull request. Run `npm test -- --run` and `npm run build` before submitting changes. Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE). Music artwork and provider assets keep their own terms; see [Third-party notices](THIRD_PARTY_NOTICES.md).
