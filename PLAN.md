# dichoptic.art — Plan

Site to browse and submit dichoptic image pairs. Built and run locally first, designed to deploy free on Vercel + Neon + Cloudflare R2 (see Hosting target).

## Principles
- Clean, minimal UI. Image grid is the product; chrome stays out of the way.
- Dark only: one dark theme, no light mode, no theme switch. Neutral dark background so image colors read true.
- Layered build: each phase ends with a working site.
- Every pair has room for credit (credit, submitted by, author), all optional. Shown prominently when present.
- Storage behind one small interface, with a local-disk and an R2 implementation, so moving from local to hosted is configuration, not a rewrite.
- Same database engine everywhere: Postgres locally and in production, so nothing is migrated at deploy time.

## Stack
- **SvelteKit** (TypeScript) — one app for pages + server routes; no separate backend. Deployed with `adapter-vercel`.
- **Postgres** + **Drizzle** ORM. Locally in Docker; hosted on Neon. Text search uses Postgres full-text search (`tsvector` + GIN index).
- **sharp** for thumbnails, composites and perceptual hashes.
- Images behind a `Storage` interface: `presignUpload`, `get`, `move`, `delete`, `url`. Local implementation writes under `data/uploads/` and serves its own upload endpoint in place of a presigned URL; the R2 implementation uses the S3 API.
- **No auth, no accounts.** Anyone can upload, like and browse. Credit is typed in per upload. Ownership is a secret key, not a login — see Ownership below.

## Image pair model

Two upload modes. The uploader chooses explicitly: **"one image"** or **"two images"** (no auto-detection).
Accepted formats: JPEG, PNG, WebP. Limit: **20 MB per uploaded file**, enforced server-side (a single side-by-side file counts as one file).

1. **Two images** — a left image and a right image.
2. **One image** (side-by-side) — the left half is the left image, the right half is the right image. Stored exactly as uploaded, one file; it is never split.

Storage follows `source_mode` (`two_files` \| `single_file`): two files are stored as `left` + `right`, one image as a single file. For two files, the viewer shows the left image on the left and has a **swap sides** control that exchanges them (view-only; stored data never changes). A single file is displayed as one image, untouched. Every feature that needs the two sides as separate pieces (swap sides, fusion outline, pair scaling) is available only for two-file pairs; the image page hides those controls for single files. Grid thumbnails show the side-by-side pair: a single file is just resized, and a two-file pair is joined into a composite at upload.

### Upload flow
- **Drag and drop** onto the page (or click to browse), with a **live preview** of the pair as it will be shown: for one image, the image as uploaded; for two images, the pair side by side.
- **Size mismatch warning** (non-blocking, two-image uploads only): the two images have different pixel dimensions.
- **Duplicate check** (non-blocking): on submit, a perceptual hash (dHash via `sharp`) of the whole pair image is compared with approved, non-deleted items. For a single file that is the file itself; for two files it is the side-by-side composite already built for thumbnails, so the same pair is caught whichever way it was uploaded. If one is within a small distance, the form shows "This might be a duplicate of: [link]" with **Submit anyway** and **Cancel**. It never rejects. To keep the files across that step, they are already in a `tmp/` storage prefix (see below) and are moved on confirm. One hash is stored per item (`phash`).

### Upload mechanics (direct to storage)
Vercel caps request bodies at about 4.5 MB, below the 20 MB file limit, so files never pass through the app server:
1. The browser asks the server for upload URLs, declaring file type and size. The server rejects anything over 20 MB or not JPEG/PNG/WebP, then returns presigned URLs for `tmp/<id>` (size and type constrained in the signature).
2. The browser uploads straight to storage; the form shows progress.
3. On submit, the server reads the files from `tmp/`, re-checks the real size and format with `sharp`, builds thumbnails, composite and `phash`, runs the duplicate check, then moves the originals to their final keys.
4. Orphaned `tmp/` files are removed by an R2 lifecycle rule (expire after 1 day); the local implementation sweeps on startup.
The processing function runs with a raised `maxDuration` on Vercel.

### Viewer
- **Fullscreen** (all pairs): button and `F` key; the pair fills the screen, `Esc` exits.
- **Pair scaling** (two-file pairs only): sliders for image size and the gap between the images. View-only, remembered in `localStorage` for the session (a convenience, not stored server-side).
- **Fusion outline** (two-file pairs only): a toggle and a thickness slider that draw a frame around each of the two images to help the eyes lock. Works in normal and fullscreen view. The frame is a CSS border outside the image area, so it never covers or alters image pixels, and it follows the images when they are scaled or swapped. **On by default** at 8 px. One neutral light gray (about `#bdbdbd`) chosen to contrast strongly with the dark page background (at least 7:1), thickness roughly 1–40 px. Setting is remembered in `localStorage`, a per-visitor convenience that is not sent to the server.
- **Keyboard**: `←` / `→` previous / next, `F` fullscreen, `O` outline on/off and `S` swap sides (both two-file pairs only), `Esc` exit fullscreen. Previous/next follows the context you came from: siblings within a collection, or the feed or search you opened it from (carried in the URL as sort, filters and query, so no server state).
- **Copy link / share**: a "Copy link" button on image and collection pages, plus the browser's native share sheet (Web Share API) where available. No third-party share buttons, so no outside scripts or trackers load.

### Fields
| Field | Notes |
|---|---|
| title | required |
| description | optional |
| credit_name | optional free text; may credit anyone |
| credit_url | optional |
| submitted_by | optional free text; who is posting this |
| author | optional free text; who made it. Form checkbox "same as submitted by" copies `submitted_by` into `author` and disables the field. Only the two strings are stored; on edit the box is pre-checked when they are equal and non-empty |
| date | day the work was made or taken; defaults to the posting day, can be set to any past date; shown on the page. Does not affect feed order (Newest always uses the posting time). Pairs in a collection inherit the collection's date when empty |
| dimension | `2D` \| `3D` |
| medium | `photography` \| `art` \| `digital_art` |
| alteration | `unaltered` \| `digitally_altered` |
| chromacy | `none` \| `di` \| `tri` \| `tetra` \| `penta` \| `hexa` — "none" = same colors in both images |
| chromacy_type | only when chromacy ≠ none; pick from the preset list (see Tags) or enter free text |
| filter_info | always offered when medium = photography, hidden otherwise; free text (filter per image, e.g. "red / cyan, Wratten 25") |
| tags | custom, free-form |
| source_mode | `two_files` \| `single_file` |
| phash | perceptual hash of the whole pair image, for duplicate check |
| collection_id | optional; set at upload, immutable (see Collections) |
| private | bool, default false; see Private submissions |
| owner_id | FK to `owners`; never exposed publicly |
| created_at | |
| deleted_at | null = visible; set by soft delete (also on collections) |
| status | `pending` \| `approved` \| `rejected` (also on collections); see Moderation |
| reject_reason | optional text |

## Tags
Four **fixed categories** (dimension, medium, alteration, chromacy) are real columns (fast filtering, enforced values). **Custom tags** are a normal many-to-many table, lowercase-normalized, with autocomplete from existing tags to prevent near-duplicates.

`chromacy_type` preset list lives in its own table (`code`, `name`, `chromacy` level); user-entered values are stored as-is and can be promoted to presets later. The type picker lists presets matching the selected chromacy level, plus a free-text option. Seed presets:

| Code | Name | Level |
|---|---|---|
| TRT | True Red Tetrachromacy | tetra |
| TCP | True Cyan Pentachromacy | penta |
| TMP | True Magenta Pentachromacy | penta |
| TBPH | Triple Band Pass Hexachromacy (using Infitec glasses) | hexa |

## Ownership (no accounts)
- On a visitor's first upload (or like), the server creates an **owner key**: a long random secret. There is one key per person, not per item, so a single recovery link covers all their submissions. The DB stores only its hash in `owners`; the raw key lives in an httpOnly cookie.
- Every image and collection records `owner_id`. Edit and delete are allowed only when the request's key hashes to that `owner_id`.
- **`/me`** — "my submissions": images and collections owned by the current key, with edit/delete. Shows the **recovery link** `/claim/<key>`.
- **`/claim/<key>`** — opening it on any device sets the cookie, so that device now owns the same submissions. The link is also shown right after each upload with a "save this link" note.
- The key doubles as the like-dedupe identity, so likes follow the owner across claimed devices.
- The owner cookie is only ever set after the visitor accepts cookies (see Cookie consent). Opening `/claim/<key>` shows the same prompt first.
- Consequences: the link is effectively a password — anyone holding it can edit and delete. Losing both cookie and link means losing edit access (no recovery without accounts). Edit/delete are server-enforced, never UI-only.
- Editable: all metadata, credit, tags, replacing files (not collection membership).
- **Delete is soft.** It sets `deleted_at` on the row; nothing is removed from the database or from storage. Deleted items disappear from feeds, search (rows filtered out, FTS entries ignored via the join), collection grids, `/me` and like counts shown on the site, and their pages and files return 404. Every public query filters `deleted_at IS NULL`. Restoring is a manual DB change for now.
- Deleting a collection deletes everything in it (see Collections).

## Private submissions
- The uploader can mark an image or a collection **private** at upload (a checkbox), and flip it later in the edit form. A private item is visible only to its owner (cookie or recovery link) and to a signed-in admin.
- A private item never appears in feeds, search, `/by/:name`, neighbour navigation, tag suggestions or the duplicate check; it cannot be liked; its page and files return 404 to everyone else; it emits no link-preview tags and has no share buttons.
- A collection's privacy applies to every pair in it (pairs added later inherit it; flipping the collection flips them all). Pairs inside a collection have no privacy setting of their own.
- Private items skip moderation. Making one public queues it for review when `MODERATION=on`.
- `/admin` lists private submissions so admins can open them; opening one needs the admin cookie, which now applies site-wide.

## Moderation (optional, off by default)
- Env flag `MODERATION=on|off`, default **off**. When off, every submission is approved immediately and nothing below is visible.
- When on, new images and collections get `status = pending` and are hidden from everyone but their owner until approved.
- `status`: `pending` \| `approved` \| `rejected` on images and collections (default `approved`, so flipping the flag never touches existing content). Every public query filters `deleted_at IS NULL AND status = 'approved'`, next to the soft-delete filter.
- **Admin**: `/admin` lists the pending queue (pair preview, metadata, credit) with Approve / Reject (optional reason). Guarded by an `ADMIN_TOKEN` env secret entered once and kept in a cookie; the app refuses to start with `MODERATION=on` and no token. This is operator access only, not a user account.
- Collections are reviewed as a unit: approving a collection also approves the images in it at that moment. Images added to an approved collection later queue individually. A collection with no approved images does not appear.
- Owners see their own pending and rejected items in `/me` with a status badge and the rejection reason. Pending items are not likeable and are not found by search.
- Edits to already-approved items do not send them back to the queue.
- Turning the flag off leaves existing pending items pending until reviewed; new submissions are approved at once.
- Cookie banner text is unaffected: moderation adds no cookies beyond the admin's own.

## Abuse limits
Open uploads need a brake. Two thresholds, counted over a rolling 24 h window (every new image or collection is one submission):
- **Flag**: when a client crosses the lower threshold, it is marked **flagged**. Submissions still go through; the client and its recent submissions are listed under "Flagged" in `/admin` for you to review.
- **Pause**: when a client or the whole site crosses the higher threshold, **submissions go offline for everyone**, even when only one client crossed the threshold. Upload and create endpoints return a "submissions are paused" message; browsing, search and likes keep working. They stay paused until you review and click **Resume** in `/admin`; there is no auto-resume.
- Counted per IP address, plus site-wide. On Vercel the real client IP is read from the forwarded header (`x-forwarded-for`), taking only the value Vercel sets.
- Works independently of the `MODERATION` flag, but needs `ADMIN_TOKEN` (so `/admin` is always available once abuse limits are on).
- Thresholds are env values. Defaults: flag a client above **30 submissions in 24 h**; pause above **100 in 24 h** from one client or **300 site-wide in 24 h**.
- Table `submission_log(client_ip, created_at)` feeds the counts; flagged and paused state lives in a small `site_state` table.

## Cookie consent
- Banner on first visit with **Accept** and **Deny**, equal prominence. Text: *"This site uses cookies only to remember your likes and to let you edit or delete your own submissions. Nothing else about you is stored."*
- The site sets exactly one cookie (the owner key) and stores no analytics, tracking or other user data. The text must stay true; adding anything else means updating it.
- The choice is kept in `localStorage` (not a cookie) so the banner does not reappear. It is sent to the server only as a request header on actions that may set the cookie (likes, uploads, opening a recovery link), and never stored.
- **Accept:** owner key created on first like or upload, as described above.
- **Deny:** no cookie is ever set. Browsing, search and uploading still work, but likes are disabled (clicking a like re-opens the prompt) and an upload gets no edit access. The post-upload page still shows the recovery link, and opening it prompts for consent first.

## Collections
- title, description, credit, submitted_by, author (same fields and checkbox as images)
- **Thumbnail**: the owner picks one of the collection's images as its cover (`cover_image_id`); defaults to the first image added.
- **Master settings**: optional defaults for dimension, medium, alteration, chromacy, chromacy_type, filter_info, tags.
- Inheritance: an image field left empty inherits the collection master at read time; an explicit value overrides. Collection tags are unioned with image tags.
- An image belongs to at most one collection (keeps inheritance unambiguous). Uploading into a collection requires owning that collection.
- **Images in a collection live only inside it.** They never appear on their own in feeds or search results; the collection appears instead. Their `/image/:id` page still works (with a link back to the collection), and likes on them still count. A collection's first image is added when the collection is created, so a collection is never empty.
- `collection_id` is set once, at upload, and never changes. Images can't be moved into, out of, or between collections. New images can still be uploaded into a collection you own.
- **Deleting a collection soft-deletes all its images with it** (same `deleted_at` rule as above).
- Deleting the last remaining image of a collection deletes the collection. Deleting the cover image resets the cover to the first remaining image.
- Bulk upload into a collection: pick shared settings once, then add many pairs, each needing only title (optional) + files.

## Likes
One `likes(owner_id, target_type, target_id)` table covering images and collections, unique per owner+target. An owner row is created on first like, so dedupe is best-effort (clearing cookies without the recovery link allows re-liking). Denormalized `like_count` on both targets, updated in the same transaction.

## Feeds
- **Newest** — `created_at DESC`.
- **Most liked** — `like_count DESC`, tie-break newest. All-time default; window filter (week / month / all) is a cheap later add.
- Both: standalone images and collections (a collection shows its cover and image count), cursor pagination, same filter bar as search.

## Submitter pages
- `submitted_by` on an image or collection links to `/by/:name`, listing everything submitted under that name (standalone images and collections, same sort and filters as feeds).
- Only `submitted_by` links this way; `credit_name` and `author` are plain text and not searchable pages (they are still full-text searchable).
- Names are free text, matched case-insensitively after trimming and collapsing whitespace. There are no accounts, so anyone can type any name; the page groups by the string, not a verified identity.

## Thumbnails
- Generated at upload with `sharp`: WebP at 400, 800 and 1600 px wide, for the side-by-side pair (grids, previews: the single file itself, or the composite built from two files). Pages use `srcset` so small screens load small files.
- The viewer and fullscreen use the **original** files, so color-critical pairs are never re-encoded. Thumbnails are converted to sRGB; originals are untouched.
- Stored through the `Storage` interface next to the originals; soft delete hides them the same way.

## Link previews
- Image and collection pages emit Open Graph and Twitter card tags: `og:title` (title), `og:description` (description, falling back to credit / submitted by), `og:image` (the 1600 px side-by-side composite thumbnail; a collection uses its cover), `og:url`, `og:type`, plus `twitter:card = summary_large_image`.
- Image URLs in the tags must be absolute, so the site needs a configured public base URL (`PUBLIC_URL` env). Previews only work once hosted; locally the tags are present but unreachable by outside crawlers.
- Pending, rejected and deleted items emit no preview tags and return 404 to non-owners, so unapproved content never leaks through a shared link.
- No cookies or scripts involved.

## Search
- **Text**: Postgres full-text search over title, description, credit, submitted_by, author, tag names.
- **Tags**: filter chips — dimension, medium, alteration, chromacy (+ type), custom tags. Combine with AND across categories.
- Images inside a collection are matched too, but the result shown is their collection (once, even if several images match). Filters on a collection match its master values or any of its images' effective values.
- One search page: query box + filters, results sortable by newest / most liked. The feeds are the same view with preset sort and no query.

## Pages
- `/me` — my submissions, recovery link
- `/claim/:key` — adopts an owner key on this device, redirects to `/me`
- `/image/:id/edit`, `/collection/:id/edit` — owner only
- `/admin` — moderation queue (when `MODERATION=on`), flagged clients, Resume after a pause; needs `ADMIN_TOKEN`
- `/` — Browse: feeds (tabs: Newest | Most liked) with the search box and filters
- `/image/:id` — large pair, swap-sides control (two-file pairs), credit, submitted by / author (when set), tags, filter info, like, collection link
- `/collection/:id` — master info header + grid
- `/by/:name` — everything submitted under a name
- `/upload` — one image / two images choice, drag and drop, live preview, metadata form, warnings

## Phases
1. **Skeleton** — SvelteKit, Postgres schema (Docker), storage interface (local), owner key + cookie, `/claim`.
2. **Upload + view** — both upload modes, drag and drop with live preview, size warning, thumbnail variants, image page with swap-sides control, fullscreen, credit.
2b. **Duplicate check** — perceptual hashes, confirm step.
3. **Metadata** — fixed categories, custom tags, conditional fields (chromacy type, filter info).
4. **Feeds** — newest + most liked, grid, pagination.
5. **Likes** — images, then collections.
6. **Collections** — CRUD, master settings, inheritance, bulk add.
5b. **Cookie banner** — consent state in `localStorage`, gate owner-cookie creation on it; ship with likes.
6a. **Moderation** — `MODERATION` flag, `status` column, `/admin` queue, status badges in `/me`.
6a2. **Abuse limits** — `submission_log`, flag and pause thresholds, `/admin` Flagged and Resume.
6b. **My submissions** — `/me`, edit/delete for images and collections, server-side owner checks.
7. **Search** — Postgres full-text search + tag filters.
7b. **Viewer extras and submitter pages** — keyboard nav with feed/collection context, pair scaling, copy link / share, link preview tags, `/by/:name`.
8. **Polish** — empty states, validation messages, mobile layout.

## Hosting target (free)
| Piece | Service |
|---|---|
| App + API | SvelteKit on **Vercel** (`adapter-vercel`) |
| Database | **Neon** Postgres (sleeps when idle, wakes on request; not paused permanently) |
| Files | **Cloudflare R2** (S3 API, public bucket for images, no egress fees) |

- Config by env on Vercel: `DATABASE_URL`, R2 credentials and bucket, `PUBLIC_URL`, `MODERATION`, `ADMIN_TOKEN`, abuse thresholds.
- Vercel's free Hobby plan is for non-commercial use; free-tier limits change, so check them before launch.
- Local-to-hosted switch: point `DATABASE_URL` at Neon and select the R2 storage implementation. Run migrations with Drizzle.

## Later (not now)
Custom domain, reporting of content by visitors, edit history, rotating/revoking a leaked owner key, an admin removal path.

## Decisions to approve
_None right now._
