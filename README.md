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
| `STORAGE`, `R2_*`, `FILES_BASE` | `local` | see Deploy |

## Scripts

| | |
|---|---|
| `npm run check` | svelte-check |
| `npm test` | unit tests (query params, metadata validation, pair processing) |
| `npm run db:generate` | new migration after editing `src/lib/server/db/schema.ts` |
| `npx tsx scripts/smoke.ts` | end-to-end API checks against a running dev server |
| `npx tsx scripts/smoke-admin.ts` | moderation and abuse-limit checks; start the dev server with `MODERATION=on FLAG_THRESHOLD=2 PAUSE_THRESHOLD=4 SITE_PAUSE_THRESHOLD=1000` |

## Deploy (Vercel + Neon + Cloudflare R2)

The code is ready; the accounts are yours to create.

1. **Neon**: create a project, copy the *pooled* connection string. Run the migrations once from your machine: `DATABASE_URL="<neon url>" npm run db:migrate`.
2. **Cloudflare R2**: create a bucket and make it public (custom domain, or the `r2.dev` URL). Then:
   - create an API token with Object Read & Write on that bucket (gives the access key id and secret);
   - add a CORS rule allowing `PUT` from your site's origin with headers `content-type` and `content-length`;
   - add a lifecycle rule that deletes objects under the `tmp/` prefix after 1 day.
3. **Vercel**: import the GitHub repo and set these environment variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled URL |
   | `SECRET`, `ADMIN_TOKEN` | long random strings (`openssl rand -base64 32`) |
   | `PUBLIC_URL` | the site's URL, e.g. `https://dichoptic.art` |
   | `STORAGE` | `r2` |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | from Cloudflare |
   | `FILES_BASE` | the bucket's public URL, no trailing slash |
   | `MODERATION`, `FLAG_THRESHOLD`, `PAUSE_THRESHOLD`, `SITE_PAUSE_THRESHOLD` | optional, see above |

Notes:
- With a public bucket, file URLs are unguessable but not access-checked, so a deleted or unapproved pair's files stay reachable to anyone who already has the exact URL. To keep the app's visibility checks on files, leave `FILES_BASE` unset: images are then served through `/files` (bytes pass through Vercel functions, which costs function time and bandwidth).
- Vercel's free Hobby plan is for non-commercial use, and free-tier limits change, so check them before launch.
- `npm run build` ends in a symlink error on Windows because of the Vercel adapter; it works on Vercel.

## Credits

The 3D-glasses logo (`src/lib/assets/logo.svg`, `favicon.svg`) is "3D Glasses" by Merlin2525 from [Open Clipart](https://openclipart.org/detail/176790/3d-glasses), released under CC0 (public domain).
