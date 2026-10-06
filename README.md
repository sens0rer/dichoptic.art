# dichoptic.art

Browse and submit dichoptic image pairs. SvelteKit + Postgres (Drizzle) + sharp. The full design is in [PLAN.md](PLAN.md).

## Run locally

Requires Node 22+. Postgres comes from the `embedded-postgres` package (real Postgres binaries, no Docker); any Postgres works if you point `DATABASE_URL` at it.

```bash
npm install
cp .env.example .env      # dev secrets; change them anywhere that is not your machine
npm run db                # starts Postgres on :5433 (keep this terminal open)
npm run db:migrate        # in a second terminal: schema + chromacy type presets
npm run dev               # http://localhost:5173
npm run seed              # optional: uploads the pairs in samples/ through the real endpoints
```

Uploaded files live under `data/uploads/` (local `Storage` implementation; originals are never re-encoded, thumbnails are WebP).

## Configuration (`.env`)

| Variable | Default | |
|---|---|---|
| `DATABASE_URL` | – | required |
| `SECRET` | – | required; signs local upload URLs and the admin cookie |
| `ADMIN_TOKEN` | – | required; sign-in for `/admin` |
| `PUBLIC_URL` | `http://localhost:5173` | absolute base for link-preview tags |
| `MODERATION` | `off` | `on` queues new submissions for approval in `/admin` |
| `FLAG_THRESHOLD` / `PAUSE_THRESHOLD` / `SITE_PAUSE_THRESHOLD` | 30 / 100 / 300 | submissions per rolling 24 h: flag a client / pause everyone because of one client / pause everyone site-wide |
| `UPLOAD_DIR` | `data/uploads` | local storage root |

## Scripts

| | |
|---|---|
| `npm run check` | svelte-check |
| `npm test` | unit tests (query params, metadata validation, pair processing) |
| `npm run db:generate` | new migration after editing `src/lib/server/db/schema.ts` |
| `npx tsx scripts/smoke.ts` | end-to-end API checks against a running dev server |
| `npx tsx scripts/smoke-admin.ts` | moderation and abuse-limit checks; start the dev server with `MODERATION=on FLAG_THRESHOLD=2 PAUSE_THRESHOLD=4 SITE_PAUSE_THRESHOLD=1000` |

## Not yet done (hosting)

The app is wired for Vercel (`adapter-vercel`), but the hosted pieces from the plan are not: the R2 `Storage` implementation (swap it in at `src/lib/server/storage/index.ts` and update `fileUrl` in `src/lib/urls.ts`), the Neon database, and the Vercel project. `npm run build` ends in a symlink error on Windows because of the Vercel adapter; it works on Vercel/Linux.
