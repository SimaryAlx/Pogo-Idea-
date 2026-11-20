# clipZ

A clipping marketplace: brands fund campaigns, clippers post short-form clips (TikTok, Reels, Shorts, X) and get paid per verified view.

## What's inside

| Path | What it is |
| --- | --- |
| `web/` | Frontend (static SPA, no build step): landing, campaign discovery, campaign pages, leaderboard, auth, and dashboards for clippers, brands and admins |
| `web/js/core.js` | All business logic (campaigns, clips, earnings, payouts, roles). Shared by the server and the browser demo |
| `server/` | Backend API (Node 18+, zero dependencies): token auth, scrypt password hashing, JSON-file storage |

## Run it

```bash
npm start            # http://localhost:3000  (API + frontend)
```

Demo accounts (password `demo1234`): `clipper@clipz.demo`, `brand@clipz.demo`, `admin@clipz.demo`.

Environment variables: `PORT`, `DATA_DIR` (where `db.json` is kept), `JWT_SECRET`, `CORS_ORIGIN`, `SIMULATE_VIEWS=1` (grow views every minute for demos).

## Two modes

- **Demo (GitHub Pages)** — `web/js/config.js` has an empty `CLIPZ_API_URL`, so the site runs entirely in the browser with data in `localStorage`.
- **Live** — served by `server/index.js` (or set `CLIPZ_API_URL` to a deployed API). Every call is `POST /api/<method>` with a JSON body and `Authorization: Bearer <token>`.

## Before real launch

These parts are simulated and need real providers:

1. **View tracking** — `syncViews` in `core.js` generates view growth. Replace with platform APIs or a tracking provider.
2. **Payments** — brand "Add funds" does not charge a card; clipper payouts are marked paid manually by an admin.
3. **Storage** — a JSON file is fine for testing; move to Postgres for production traffic.
4. **Email verification / password reset** are not implemented.
