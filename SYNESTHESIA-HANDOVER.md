# /synesthesia — Handover

How the colour tests are built, how to run and extend them, and what is left. Read with [SYNESTHESIA.md](SYNESTHESIA.md) (the plan: what the tests are for and the decisions behind them). State as of 3 November 2026.

## What it is

An unlisted part of dichoptic.art for one participant (a friend) to record synesthetic colour: she marks parts of texts, letters, numbers and formulas with a colour (or "no colour", or a note), and the page records every answer with timecodes. Reachable only by link: nothing on the site links to it, `robots.txt` is untouched, and every page sends `noindex, nofollow` (meta tag and `X-Robots-Tag`).

- Live: https://dichoptic.art/synesthesia
- Admin (needs the site's admin sign-in at `/admin`): `/synesthesia/admin` (items and results), `/synesthesia/export` (downloads and participants)

## Where the code is

| Path | What |
|---|---|
| `src/routes/synesthesia/` | Pages. `+page` home (categories, unfinished items, screen checklist, continue); `a/[id]` marking one item; `results/` her results; `reverse/` reverse test; `picks/` adding her own songs; `admin/` and `export/` for the admin; `api/` answers, position, lyrics search. `+layout` sets noindex, the grey surround and the maths stylesheet. |
| `src/lib/synesthesia/` | Page code shared by those routes: `Item.svelte` (marking screen), `Marker.svelte` (text selection: tap, handles, magnifier), `MathMarker.svelte` (maths selection: tap, snapping box, group strip; a root's √ and a fraction's bar count as symbols of their own), `Picker.svelte` (Okhsl wheel and sliders), `ResultText.svelte` (text or maths drawn in her colours), `outbox.svelte.ts` (answers saved on the device and sent in order), `segment.ts` (graphemes, words, maths symbols, coverage), `okhsl.ts` (colour maths), `checklist.ts`, `stimulus.ts` (item ids), `temml.css` + `fonts/` (Latin Modern Math). |
| `src/lib/server/synesthesia.ts` | Server side: participant cookie, categories, picking the next item, retests, answers in force, finishing, results, song picks. |
| `src/lib/server/synesthesiaAdmin.ts`, `synesthesiaExport.ts`, `lyrics.ts` | Admin queries, JSON/CSV export, LRCLIB search. |
| `src/lib/server/db/schema.ts` | Tables, all prefixed `syn_` (see Data). Migrations `drizzle/0009`–`0011`. |
| `scripts/synesthesia/` | Import scripts that fill the pools (see Content). `pool.ts` (adding items), `sources.ts` (fetching and cutting passages). |
| `tests/okhsl.test.ts`, `tests/segment.test.ts` | Colour conversion and text/maths splitting. |
| Root layout `src/routes/+layout.svelte` | Hides the site header and cookie banner on `/synesthesia` (the only change to the main site). |

## How it works

- **Participant**: a random id in a cookie (`syn_participant`, path `/synesthesia`, httpOnly, 10 years). A browser becomes a participant row only with its first answer; visiting or starting items records nothing. Answers from anyone else are filtered out by this id (the export page lists participants with their devices).
- **Items** (`syn_stimuli`) never change: the id is a hash of the content (and, for her songs, her id). Removing an item means hiding it (admin item page), which only keeps it out of new rounds.
- **Attempts** (`syn_attempts`): one go at one item; a retest is a new attempt at the same item. An attempt is finished once every part (word, letter or maths symbol, by the item's `unit`) is covered by a colour or "no colour" answer.
- **Answers** (`syn_answers`) are append-only: `colour`, `none`, `note`, `flag` ("I know this song"), and `retract` (undo of another answer). Each has the range (graphemes, or maths symbol indices), the colour (Okhsl + hex + Oklab), the note, and timecodes: device clock and time zone, ms since the item was shown, ms since the previous answer, server receive time. The device keeps unsent answers (`localStorage`) and resends until the server has them; a resent answer is stored once (client id).
- **Sessions** (`syn_sessions`): one per tab visit, with device info and the screen checklist answers.
- **Blind while answering**: the marking page only learns which parts are done, never their colours. Results shows colours; each view is logged (`syn_result_views`).
- **Reverse test** (`syn_reverse`): random colours (saturation leaning vivid, lightness leaning middle, each new one clearly different from the last); she writes something with that colour or "nothing".

## Content

Every pool is filled by a script, safe to run again (existing items are skipped). Run against the local database by default (`DATABASE_URL` in `.env`); for production set `DATABASE_URL` to the Neon URL for that command.

| Category | Script | Source | Items on production |
|---|---|---|---|
| Texts | `import-wikipedia.ts`, `import-texts.ts` | Wikipedia openings; Gutenberg (Austen, Dickens, Melville, Carroll, Wilde, KJV, Thoreau, US Constitution, Dickinson, Blake); uk.wikisource (Shevchenko, Kotliarevskyi, Lesia Ukrainka, Franko, Nechui-Levytskyi, Kvitka-Osnovianenko, a folk tale, the Constitution); Wikinews; Wikibooks; one recipe written for the tests | 38 |
| Parallel texts | `import-parallel.ts` | UDHR Articles 1, 3, 19 (github.com/eric-muller/udhr) and 3 passages written for the tests, each in Ukrainian and English only | 12 |
| Terminology | `import-wikipedia.ts` | Wikipedia (mitochondria, heraldry, rigging, EEG, bills of exchange) | 10 |
| Separate words | `import-words.ts --bruk <dir> --dic <file>` | Ukrainian Brown Corpus lemma frequencies; English subtitle frequencies filtered by Hunspell en_US base forms | 20 (×20 words) |
| Made-up words | `import-pseudowords.ts --dic <file>` | Generated from English letter statistics; real words, inflections, sound-alikes, unpronounceable clusters and rude strings removed | 10 (×20) |
| Colour words | `import-generated.ts` | Fixed lists | 4 |
| Related / distant languages | `import-wikipedia.ts` | Wikipedia openings (bread, moon, sun…) | 10 / 11 |
| Alphabets, numbers, time | `import-generated.ts` (`more` adds new numbers and clock times) | Fixed and generated | 19 / 6 / 11 |
| Maths | `import-maths.ts` (`more` adds random arithmetic and equations) | LaTeX by school topic, rendered to MathML with Temml | 15 |
| Songs (retired) | `import-lyrics.ts` | Wikisource (and Gutenberg for Burns): nine Ukrainian/English pairs. Retired 3 Nov 2026: off the home page, items hidden, earlier answers kept in results and admin. Do not run the script again | 0 (18 hidden) |
| Your songs | added by her on `/synesthesia/picks` | LRCLIB search or pasted lyrics; visible only to her | — |

`import-words.ts` and `import-pseudowords.ts` need two local files: the BRUK tagged texts (`git clone` github.com/brown-uk/corpus, `data/disambig`) and a Hunspell en_US `.dic` (github.com/wooorm/dictionaries, `dictionaries/en/index.dic`). They are not in the repo.

Adding more: run a script again with new titles (`import-wikipedia.ts <category> <lang> Title…`), a higher `--count`/`--seed` (words, made-up words), `more` (numbers, time, maths), or new entries in the lists at the top of `import-texts.ts`, `import-parallel.ts`. Check new items on the admin pages and hide any that came out wrong.

Pitfalls the scripts already guard against (worth knowing when adding sources): Wikipedia and Wikisource rate-limit (scripts wait and retry); a phrase search can land on a page that only quotes the words (opening words must begin a line); short Wikisource pages are often lists of versions (the scripts follow the first matching link); poems are taken from Wikisource's poem blocks; re-running with changed cleanup would duplicate an article, so Wikipedia items are matched by page id.

## Running it

- Local: `npm run db`, `npm run dev`, then http://localhost:5173/synesthesia. On a phone on the same Wi-Fi: `npm run dev -- --host` and the computer's address (Node is allowed through the firewall on this machine).
- Migrations: `npm run db:migrate` (production: same with `DATABASE_URL` set). Migrations 0009–0011 add the `syn_` tables and only touch those.
- Checks: `npm run check`, `npm test`.
- Production state (3 Nov 2026): migrations applied up to 0011; all pools imported. Japanese 月 (moon) is missing from distant languages: the Wikipedia page is a disambiguation page.

## Admin and data

- `/synesthesia/admin`: categories with counts; item lists with source and tags (filter by language, show hidden); item pages with the text as shown, use per participant, every participant's answers drawn in colour, and hide/unhide. `/synesthesia/admin/participant/<id>`: one participant's answered items and reverse-test answers.
- `/synesthesia/export`: `answers.csv` (one row per answer, with the text covered, colour in hex/Okhsl/Oklab, all timecodes, and whether it was undone), `reverse.csv`, `all.json` (everything, including sessions, devices, items and result views), and the participant list.
- Consistency analysis is meant to happen on the export (compare attempts at the same item per word/letter/symbol in Oklab); nothing is scored on the site.

## Changes from the plan

Recorded in SYNESTHESIA.md as they were made; the main ones:
- Made-up words are generated (UniPseudo's method) rather than taken from ARC/Wuggy (ARC is a web form only, Wuggy needs Python); sound-alikes are filtered approximately.
- English separate words use subtitle frequencies filtered by a dictionary, Ukrainian ones the BRUK corpus, rather than rating norms.
- Three English songs replaced (Rock-a-bye Baby, Greensleeves, Blow the Man Down) because Wikisource lacks the planned ones in usable form.
- Retests are a category that re-serves her finished items, not a separate three-repeat module. Hidden items are not retested.
- The preloaded Songs category is retired (only her own songs remain); the "I know this song" flag belonged to it and no longer shows on new items.
- A song she adds uses the whole lyrics.

## Not done / ideas

- No long-text splitting: every passage is cut to about a screen when imported, so it has not been needed.
- The sound-alike filter for made-up words is approximate (no pronunciation dictionary).
- Some song and poem texts come with two verse lines per line where the source page is laid out that way.
- Possible later: spatial arrangement test for time units (sequence-space synesthesia), more items per pool as she works through them, an in-page consistency view for the admin.
