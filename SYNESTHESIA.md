# /synesthesia — Plan (draft)

A test suite for one participant (a friend) to record her synesthetic colour experiences: colour for text she selects, "no colour" where there is none, notes, and a reverse test (colour → word). Planning phase; nothing built yet.

## Principles
- **Unlisted, not protected.** Reachable only by link. Not in the nav, not linked from any page, not in `robots.txt` (listing it there would advertise it). The page sends `<meta name="robots" content="noindex">` and an `X-Robots-Tag: noindex` header. The code and this plan live in the public repo; that is accepted.
- **Separate from the main site's chrome.** Own layout (no site header, no cookie banner). The main site's cookie notice does not cover this page; it sets its own participant cookie (see Data).
- **Nothing is overwritten.** Every confirmed answer is a new record with timecodes; a correction is a new record that supersedes the old one. History is the data.
- **Blind while answering.** While she is marking an item (first time or retest), her earlier answers are never shown. Results does show them; result views are logged.
- **Phone first-class.** Everything works by touch on a small screen and is tested on real phones (see Mobile).
- **No translations outside Parallel texts.** A meaning appears in one language only (one Wikipedia subject, one weekday list, one colour name); the same content in two languages is what Parallel texts are for.
- **Large, growing pools.** Every category draws from a source big enough to keep adding tests later (see Stimulus pools). Items never change once added, so a result always points at the exact text that was shown.

## Flow
- **On opening the page**, if she was in the middle of an item, a "Continue where you left off" button comes first (see Mobile).
- **Home: a list of categories** (known-language texts, terminology, separate words, pseudowords, similar languages, dissimilar languages, alphabets, numbers, maths, time, her picks, reverse test, retests). She picks any one and can switch at any time; nothing forces an order.
- **Inside a category she gets one item at a time** (a text, a word list, an alphabet…), the next one she has not started, in a random order fixed per browser (the order is recorded).
- **Everything is saved as she marks it.** There is no submit step; each confirmed answer is stored immediately with its timecodes.
- **Finished:** when every part of the item is covered by an answer (a colour or "no colour"), it moves to **Results** and a "Next" button offers a new item. It does not jump away by itself, so she can still add overlapping answers (a sentence over words she already marked) before moving on.
- **Skip / leave partly done:** "Skip" (or switching category) puts the item in **Unfinished**, with whatever she has marked so far. Unfinished has its own list, per category and overall, and she can reopen any item there and continue.
- "Every part covered" means every word for texts and word lists, and every character for alphabets, numbers and single items; maths counts every symbol. Answers on larger spans (a whole sentence) cover the words inside them.
- _Hidden from the home page for now (3 Nov 2026); the code is kept._ **Retests are one more category** (see Retests below): it hands her items she has already finished, at random, to go through again. She uses it whenever she likes; there is no fixed schedule.

## Mobile
A phone is a first-class device, not a fallback: everything works by touch on a small screen, and is tested on a real iPhone (Safari) and Android phone (Chrome), not only in a resized desktop browser.

- **Selecting by touch**
  - Tap selects a word; handles resize the selection (see Selecting text). A drag that starts on a handle moves it; any other drag scrolls, so selecting never fights with scrolling.
  - Handles are teardrops hanging below the line, with touch areas much larger than they look (at least ~44 px, the usual touch-target size).
  - While a handle is dragged, a **magnifier** above the finger shows where it will land, since the finger covers the spot.
  - Text size is adjustable on every item.
  - The phone's own text selection, magnifier and long-press menu are switched off on the test text, and double-tap does not zoom the page.
  - Maths: tap a symbol, drag the corners of its box, or pick an enclosing group from the strip (see Mathematics).
- **Colour picker always on screen**, so going through many words never waits on a panel opening or closing. On phones it is docked at the bottom, compact: a smaller wheel with the two sliders beside it, and one row of buttons (confirm, "no colour", note, "copy colour") within thumb reach. The text scrolls in the space above, keeping the selection in view; a button tucks the panel away to read the whole text. In landscape and on wide screens it sits beside the text.
- **On-screen keyboard** (notes, reverse test, adding her picks): the layout follows the visible area above the keyboard, so the field and its button are never hidden.
- **Unreliable connection**: answers are written to the device first and sent in order, retried until the server confirms. Timecodes are taken on the device when she acts, so a slow or offline moment never changes them. A small indicator shows anything not yet sent.
- **Orientation and interruptions**: rotating the phone, switching apps or locking the screen keeps the current item, selection and picker state.
- **Reloading or coming back later**: the page offers **"Continue where you left off"**: the same item, scrolled to the same place, with the same unit selected. Her position is saved on the server with her participant id as she goes (and on the device as a fallback), so this also works after closing the browser. Choosing not to continue leads to the category list; the item stays in Unfinished.
- **Colour on phone screens**: features that tint the screen (Night Shift, True Tone, blue-light filters, reading modes) shift colours. At the start of a session a short checklist asks her to turn these off, and her answer is stored with the session, along with the screen's colour gamut (sRGB or wide-gamut P3) as reported by the browser. Brightness: a steady, comfortable level, not automatic.
- **Fonts**: the page ships its own fonts (Noto families for every script, plus the maths font), so text looks the same on every phone instead of depending on what the system has installed.
- **Long texts** are split into passages that fit a screen or two, so she is never marking inside a very long scroll.

## Colour picker
- **Space: Okhsl** (Björn Ottosson's perceptual HSL built on Oklab). Hue on a wheel, saturation and lightness as sliders. Unlike plain OKLCH it maps the whole square onto colours the screen can show, so no slider position is "out of gamut"; unlike HSL, equal steps look like equal steps and hues keep their lightness.
- Large swatch of the current colour next to the selection; slider tracks show the gradient they would produce.
- **Resets to the same start for every new selection**: knobs at full saturation and middle lightness, but neutral grey shown (and saved, if confirmed untouched) until the wheel or a slider is touched, so the previous answer does not pull the next one (anchoring). "Copy colour" reuses colours when she means it: tap any word coloured on this visit or the last one (a visit is a browser tab) to copy its colours (all of them, if several), or "Previous" for the latest answer's. For that the server sends the page the colours of those two visits only, never shown unless she copies; older visits stay blind.
- Stored per colour: Okhsl (h, s, l), OKLab/OKLCH, and sRGB hex, so analysis can use perceptual distances directly.
- **Neutral surround.** The test page uses a mid-grey background (the main site is dark), with stimuli in a fixed neutral text colour. Recorded per session: background, screen size, device pixel ratio, user agent. Screens differ in colour; she should use the same device when possible, and the device is recorded either way.
- **One or more colours per selection.** One by default; "Add colour" sets the picker's colour aside (a chip, tap to remove) and starts the picker afresh for the next, and Confirm saves them all in order (two-tone letters, stripes). Stored as the first colour plus `more` (the rest); results draw them as equal stripes. Gradients and the like can still be described in the note. (Changed 4 Nov 2026 from one colour only.)

## Answer types for a selection
- **Colour** (one, or several in order).
- **No colour experience.**
- **Note** (free text), attachable to either of the above or on its own.

## Selecting text
- Text is split into **graphemes** with `Intl.Segmenter`, so combining marks, Hangul syllables, Thai vowel marks and emoji count as one character. A selection is a range of grapheme indices in the stimulus.
- The same segmenter gives **word** and **sentence** boundaries for every language, including Thai, Japanese and Chinese, which have no spaces.
- **Tap selects a word** (a character in alphabets and single-character items). The selection gets **two handles**, one at each end; dragging them expands or contracts it in either direction:
  - across words, a handle jumps word by word; inside a word it moves letter by letter, so part of a word or a single letter needs no separate mode;
  - a handle can cross sentence and line breaks, so any range works, from one letter to several sentences;
  - dragging near the top or bottom edge scrolls the text;
  - **touch-and-hold on a letter** selects just that letter, as a shortcut for letter-level answers inside texts.
- **After she confirms, the next unmarked word is selected automatically**, with its own handles, so marking a whole text is mostly "pick colour, confirm". Tapping anywhere jumps there instead. A brief pause before the next word lights up, and an **undo** for the last answer, keep this from turning into autopilot.
- With a mouse, the same: click selects a word, handles drag, and dragging across text selects a range directly.
- Custom selection, not the browser's native text selection, which is unreliable on phones (see Mobile).
- **Selections may overlap or nest**: a sentence and words inside it can each have their own answer. Selected ranges are shown with an underline mark, never filled with her chosen colour while a test is running (see Blind).

## Timecodes
Every record carries:
- `answered_at` — when the answer was confirmed (one time per answer);
- `shown_at` — when the stimulus appeared, and the time since the previous answer, so response times can be worked out; measured with `performance.now()` so they are not affected by clock changes;
- absolute times (ISO, with timezone) and the server's receive time;
- session id and stimulus id.

Response time is a known marker in synesthesia research (genuine associations tend to be fast and consistent), so the latencies are worth having.

## Reverse test
- A colour is shown full-size; she types something that has that colour (a letter, word, number, anything), or marks "nothing".
- **Random colours** in Okhsl: every hue equally likely; saturation leaning towards vivid (1 − (1 − u)³, mean 0.75); lightness leaning towards the middle (mean of two uniform draws, spread over 0.15–0.85); each new colour at least 0.15 apart (Oklab distance) from the previous one. The colour shown is stored with the answer.
- Same timecodes as above.

## Retests
The standard measure for synesthesia is test–retest consistency: the same thing coloured again later, compared by how far apart the colours are.

- **A category that draws from her finished items**, from any category, picked at random. The item is shown fresh, exactly as the first time, with none of her earlier answers visible; she marks it the same way, and it follows the same finished / skip rules.
- **Defaults** (not a decision, easy to change): an item is not offered again on the same day it was finished, and items retested least often or longest ago come up first.
- A retest is stored as a new attempt at the same item. Selections need not match the first time; the comparison is per unit (each word, character or symbol) using the answer that covers it, in OKLab (perceptual distance). "No colour" in one attempt and a colour in the other counts as a mismatch.
- Consistency per item, per category and over time comes out of the export; nothing is scored while she is answering.

## Sections and stimuli

### Known languages (English, Ukrainian)
- Running texts (see "Choosing texts" below).
- Texts on unfamiliar subjects, with terminology. Subjects chosen for her (decided: chosen by us, not with her): mitochondria, heraldry, ship rigging, EEG, bills of exchange.
- Separate words without context (sampled from word norms, see below).
- **Parallel texts**: the same passage in Ukrainian and English. If colours follow meaning they should agree across the two; if they follow letters they will not.
- **Colour-word controls**: colour names (червоний, red), objects with a typical colour (banana, sky, сніг), and words whose meaning and letters might disagree. This separates synesthetic colour from ordinary association.

### Pseudowords (English only)
Meaningless but pronounceable English words. Ukrainian is left out: there is no ready-made Ukrainian set.
- **Generated the way UniPseudo does it** (New et al., 2023): a letter model learned from real English words (which letter follows each pair of letters, and how often) writes new strings. (The ARC database is only available through a web form, and Wuggy needs Python; this needs neither and makes as many as wanted.)
- Thrown away: anything that is a real word (the Hunspell en_US dictionary plus the 50 000 most frequent subtitle words, so inflected forms and common names go too), strings with consonant clusters rare in that position in English ("stf-", "md-"), triple letters, and strings close to rude words.
- 20 per item, five in each length band (3–4, 5–6, 7–8, 9–11 letters), like the separate-words items.
- Sound-alikes of real words ("brane" for brain) are refused approximately, without a pronunciation dictionary: common English spellings of the same sound are swapped one at a time (ane/ain, ee/ea, ph/f, ea/e, gu/g…), plus a dropped or added final e, single for doubled letters, and common endings (-s, -ed, -ing…); any variant that is a real word rules the string out.

### Less-known, similar languages
Latin, French, German, Belarusian, Polish (Latin script but Slavic, close to Ukrainian in vocabulary: familiar words in an unfamiliar spelling).

### Unknown, dissimilar languages
Arabic, Korean, Japanese, Chinese, Thai, Hebrew. Right-to-left text (Arabic, Hebrew) needs selection that follows logical order; grapheme ranges handle this.

### Alphabets
- Ukrainian (33), English (26), Greek (24, also used in maths).
- Arabic: 28 letters, and separately the positional forms (isolated, initial, medial, final). This tests whether colour follows the letter or its shape.
- Hebrew: 22 letters and the 5 final forms.
- Hangul: 14 basic consonants and 10 basic vowels, then whole syllable blocks.
- Japanese: hiragana and katakana (46 each, same sounds, different shapes, a useful comparison).
- Thai: consonants (44), vowel signs and tone marks.
- Chinese has no alphabet: a set of very common characters and simple radicals.
- Upper and lower case shown separately where they exist.

### Numbers
- Digits 0–9, multi-digit numbers, number words (nought to ten in Ukrainian, the tens and up in English, so no number is in both).

### Mathematics
School maths up to simple calculus: operators and signs, variables, fractions, powers and roots, functions (sin, log), limits, derivatives, integrals, simple equations.

**Properly typeset**, with every symbol selectable:
- Expressions are written in LaTeX in the stimulus files and converted to **MathML** (with Temml, at build time). Browsers render MathML natively (Chrome, Firefox, Safari incl. iOS), rendered with Temml's Latin Modern stylesheet and the Latin Modern Math font (the standard LaTeX font), served by the site itself, so it looks like LaTeX on every device.
- MathML is a tree: each symbol (`<mi>` variable, `<mn>` number, `<mo>` operator) is a leaf, and groups (fraction, exponent, root, limit subscript, whole expression) are its parents.
- Marks the browser draws itself, not written as symbols, still count as symbols (each at its element's opening tag), selectable by tapping and coloured like any other: the √ of a root (`<msqrt>`/`<mroot>`) and the bar of a fraction (`<mfrac>`, unless drawn without one). A tap on a fraction bar's thin band goes to the bar, since the letters' boxes above and below overlap it.
- Text-style handles do not suit maths: they follow reading order, which jumps between numerator and denominator, sub- and superscripts in ways that do not match what she sees. Maths selection is **spatial and snaps to the structure**:
  - **Tap a symbol** to select it. It gets a **box with four corner handles** around it.
  - **Drag a corner** to grow or shrink the box over the formula. The selection is the smallest meaningful piece covering every symbol in the box: a run of neighbours at the same level (`a + b` inside `a + b + c`), or, when the box reaches across levels, the whole group (catch the 2 of x² and you get x²; reach from the numerator over the fraction line and you get the whole fraction). The box snaps to that piece as she drags, so she always sees exactly what is selected.
  - **A strip of the enclosing groups** in the picker panel (x → x² → x² + 1 → the whole fraction → the whole expression), each a small rendered preview; one tap selects that level. Fast for whole groups, and clear about what each level is.
  - Formulas are rendered large, with the same magnifier while dragging.
- A maths selection is stored as the leaf indices it covers, the path to its group, and the LaTeX of that part, so the export is readable.

### Time
Weekdays, months, seasons, times of day, hours, in both languages. Synesthetes who colour time units often also place them in space (sequence–space synesthesia); a later optional test could ask her to arrange them on a canvas.

## Choosing texts for known languages
Goal: a set that is varied in a way we can show, not just by impression.

1. **Axes** to cover:
   - genre/register: literary prose, poetry, song lyrics, news, scientific, technical/instructions, legal/official, dialogue, children's, religious/archaic, advertising, social-media style;
   - theme: nature, people/relationships, emotions, body/health, food, city/technology, war/violence, abstract/philosophical;
   - tone: emotional valence (pleasant/unpleasant) and arousal (calm/intense);
   - concreteness: concrete scenes vs abstract argument;
   - era: archaic, classic, contemporary;
   - form: sentence length and complexity.
2. **A grid** of genre × theme. Fill each cell with candidates, and pick one per cell so the set spans the other axes too.
3. **Measured diversity** (optional but cheap): embed candidate passages with a multilingual sentence model (LaBSE or multilingual-E5) and choose by farthest-point sampling, so each next text is the one least like those already chosen.
4. **Single words** chosen from published word norms, stratified so every level is represented:
   - English: concreteness (Brysbaert et al., ~40k words), valence/arousal/dominance (Warriner et al., ~14k), age of acquisition (Kuperman et al.), frequency (SUBTLEX-US);
   - Ukrainian: fewer norms exist; translate a stratified English set and also sample by frequency from a Ukrainian corpus.
5. **Song lyrics.** _Dropped (3 Nov 2026): the preloaded songs below are retired; only her picks remain. The items are hidden, answers already given to them are kept._ Originally: one Ukrainian and one English song per kind of song, so both languages cover the same moods:

   | Kind | Ukrainian | English |
   |---|---|---|
   | Lullaby | Ой ходить сон коло вікон (folk) | Rock-a-bye Baby (traditional) |
   | Carol | Щедрик (folk words) | God Rest Ye Merry, Gentlemen (traditional) |
   | Love song | Ніч яка місячна (Starytsky) | A Red, Red Rose (Burns) |
   | Lament / ballad | Реве та стогне Дніпр широкий (Shevchenko) | Greensleeves (traditional) |
   | Marching / historical | Ой у лузі червона калина (Charnetsky) | When Johnny Comes Marching Home (traditional) |
   | Work / road song | Розпрягайте, хлопці, коні (folk) | Blow the Man Down (shanty) |
   | Children's / nonsense | Танцювала риба з раком (folk) | Twinkle, Twinkle, Little Star (Jane Taylor) |
   | Hymn | Боже великий, єдиний (Konysky) | Amazing Grace (Newton) |
   | Comic | Ой ти, дівчино, з горіха зерня (Franko) | Oh My Darling, Clementine (traditional) |

   - Shown as text only, one or two verses each, so a song is about the size of a prose passage.
   - Most of these she will know with their tunes. A flag **"I know this song"** per lyric item, and the note for anything the melody adds, separates heard-in-the-head songs from text.
   - **Her picks**: a category of songs she chooses herself, as many as she likes, added one at a time. On the page she searches by title or artist; the lyrics are looked up in **LRCLIB** (lrclib.net, free, no key) and shown, and the whole song becomes the item (blank lines between verses kept), stored with the LRCLIB id. The lookup goes through our server (identifying the site in the request, as LRCLIB asks), not straight from the browser. **Pasting the lyrics by hand is always available**: LRCLIB is community-run and often busy (it answered "server busy", HTTP 503, to most requests when tested), so the server retries a 503 a few times with growing pauses (about 1, 2, 4 seconds) before giving up, while the page shows that it is still searching. It has Ukrainian songs, but a test search for "Океан Ельзи" in Cyrillic returned nothing, so a Cyrillic search is also tried in Latin transliteration (Okean Elzy) and the results merged. Each becomes an item in her picks, marked "known song", and is coloured like any other item. Interesting because familiar, emotionally loaded songs may colour differently. These items are stored with source "participant" and shown only on her test pages.

## Stimulus pools
Every category draws from a source large enough to keep adding items for a long time, not from a hand-picked list that runs out.

**How pools grow**
- Each category has an **import script** (`scripts/synesthesia/`) that takes items from its source, applies the category's filters (length, language, topic, the axes from "Choosing texts"), tags each item with those axes, and adds it to the pool.
- **Adding tests later = running the script again** with a higher count or new filters, or pointing it at a new source. Hand-made items (curated lists, our translations) go through the same import from a small file in the repo. Her song picks are the exception: she adds them on the page.
- Items are **immutable** once added: the id is a hash of the content, so nothing she has answered ever changes or gets renumbered. Removing an item only hides it from new rounds.
- Raw downloaded sources are not committed; the scripts record where each item came from (source, document, position) so an item can be traced and re-fetched.
- The first round uses a small part of each pool; sampling by the tagged axes keeps later additions as varied as the first.

**Sources by category**

| Category | Source | Size, roughly |
|---|---|---|
| Ukrainian texts | uk.wikisource (classics, folk songs), Ukrainian Wikipedia | thousands of works; 1M+ articles |
| English texts | Project Gutenberg, en.wikisource, English Wikipedia | 70k+ books; 6M+ articles |
| Terminology texts | Wikipedia articles from chosen specialist categories, both languages | effectively unlimited |
| Parallel texts | Wikisource works with existing translations; our own translations; the Universal Declaration of Human Rights (Ukrainian and English only: the same text in a language she does not read tells nothing about meaning) | grows as we translate |
| Separate words (EN) | OpenSubtitles frequencies (FrequencyWords) kept only where the word is a lowercase base form in Hunspell en_US (no names, fragments or inflections) | about 19 000 words |
| Separate words (UK) | lemma frequencies from the hand-tagged Ukrainian Brown Corpus (BRUK); nouns, verbs, adjectives and adverbs; names excluded by their tag | about 36 000 words |
| Pseudowords (EN) | generated from English letter statistics, real words removed | unlimited |
| Similar and dissimilar languages | Tatoeba sentences, Wikipedia and Wikisource in each language, UDHR | thousands to millions of sentences per language |
| Alphabets | Unicode data for each script | complete by nature; extended by adding scripts |
| Numbers | generated (digits, lengths, number words) | unlimited |
| Maths | generated from templates per school topic (arithmetic, algebra, functions, limits, derivatives, integrals), written as LaTeX | unlimited |
| Time | fixed sets (weekdays, months, seasons) plus generated phrases (dates, clock times) | small fixed core, unlimited phrases |
| Lyrics (retired) | Wikisource, folk-song collections | — |
| Her picks | songs she adds on the page | as many as she adds |
| Reverse test | random colours over the Okhsl space | unlimited |

## Data
- New tables, prefix `syn_`:
  - `syn_sessions` (id, participant, started_at, device info, random seed);
  - `syn_stimuli` (the pools: id = content hash, category, content, axes tags, source, hidden flag; rows never updated);
  - `syn_events` (append-only: session, stimulus id, attempt, range, answer type, colour, note, flags, timecodes); corrections refer to the record they supersede.
- Stimuli are filled in by the import scripts; answers reference the stimulus id, so the exact text is always known.
- **Participant**: no login and no secret link. Each browser gets a random id in a cookie on first visit (httpOnly, scoped to `/synesthesia`, long-lived), recorded with every answer, so answers from anyone else can be filtered out later. A new device or cleared cookies gives a new id; the device info stored per session tells them apart.
- **Results** (for her): her finished items, and unfinished ones with at least one answer (marked unfinished, with a link to continue; seeing their colours before finishing is logged like any result view), with her colours shown on them (text underlined or highlighted in her colour, alphabets as a colour chart), her notes, and retest attempts side by side with the originals. Each time she opens a result it is logged, so analysis can tell whether she had seen an item's colours before retesting it.
- **Export** to JSON and CSV for analysis, behind the admin cookie.
- Progress is saved per answer, so she can stop and resume at any point.

## Decisions to approve
_None right now._

Decided: open to anyone with the link; answers carry a per-browser id (cookie) for filtering. One or more colours per selection ("Add colour"); anything else about colour goes in notes. Picker always on screen, reset for each selection to saturation max and middle lightness, showing grey until touched, with "copy colour" (from any word coloured on this visit or the last). No confidence rating. Maths is properly typeset (MathML), each symbol and group selectable. Text: tap selects a word, handles expand or contract, auto-advance to the next unmarked word. Maths: tap a symbol, a box with corner handles that snaps to the formula's structure, and a strip of enclosing groups. Interface in English. Categories she picks freely; items autosave and go to Results when fully covered or to Unfinished when skipped; retests are a category that re-serves her finished items at random, blind, with no fixed schedule. Results shows her colours (views logged). Lyrics: only "her picks", songs she adds herself, any number, one at a time (the preloaded Ukrainian/English songs were dropped).
