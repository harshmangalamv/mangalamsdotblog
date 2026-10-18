# mangalams.blog — knowledge store

A personal blog, meant to run for life. Text-first and minimal (seths.blog, paulgraham.com, nav.al).
It is a **static site generator** with zero npm dependencies: Node builds plain HTML into `dist/`, and GitHub Actions deploys it to Pages.

- Repo: github.com/harshmangalamv/mangalamsdotblog · branch **`master`** (not main)
- Hosting: GitHub Pages with **Source: GitHub Actions**. Custom domain `mangalams.blog` (CNAME); DNS at Hostinger
- License: MIT. Requires Node ≥ 20 (CI uses 24)

## Mental model

```
posts_raw/dd-mm-yyyy-N.txt ─┐   (drafts/ too, only with --drafts)
pages_raw/<name>.txt ───────┤
slugs.json (URL registry) ──┼─ scripts/build.mjs ─▶ dist/  (gitignored, deployed by CI)
site.config.json ───────────┤     index.html                  first 10 previews + /js/feed.js
css/ src/feed.js assets/ ───┘     <slug>/index.html           one per post (+ redirect pages for old slugs)
                                  archive/ <page>/ 404.html
                                  data/feed.<hash>.<n>.json   preview HTML for pages 2..n
                                  feed.xml sitemap.xml robots.txt CNAME favicon.svg
```

Every page is complete HTML, so it works with JS disabled. The only JS is `src/feed.js`, which adds infinite scroll on the home page plus scroll restore on Back.

## Files

| Path | Role |
|---|---|
| `scripts/build.mjs` | entry point. `--drafts` includes drafts (preview only). Exports `build({root,outDir,drafts,log})` |
| `scripts/lib/content.mjs` | reads and validates `posts_raw/` and `pages_raw/`: header parsing, filename rules, Date/Status/Slug checks |
| `scripts/lib/markup.mjs` | small Markdown subset → HTML. Always escapes; links must be https/mailto/`/path` |
| `scripts/lib/slugs.mjs` | URL registry logic (`assignSlugs`) |
| `scripts/lib/templates.mjs` | all HTML/XML templates. Escapes every value except pre-rendered HTML |
| `scripts/lib/seo.mjs` | schema.org JSON-LD: WebSite + Person (home), BlogPosting (posts), ProfilePage (about). Person.sameAs = `site.config.json` → `profiles` |
| `scripts/lib/util.mjs` | escape, slugify (ASCII only), UTC date formatting, excerpt truncation |
| `scripts/serve.mjs` | local server mimicking Pages (301 to trailing slash, 404.html with status 404) |
| `scripts/encode-email.mjs` / `src/contact.js` | scramble / click-to-reveal email (`{{email}}` in pages_raw only). Same XOR KEY in both |
| `scripts/new-post.mjs` / `scripts/publish-draft.mjs` / `scripts/lib/drafts.mjs` | `npm run new` → `drafts/` (gitignored, local only); `npm run publish-draft -- <name> [--keep-date]` → moves into `posts_raw/` dated today, drops `Status:`, updates `Date:` |
| `test/build.test.mjs` | node:test: markup, parser, slugs, dates, an end-to-end fixture build, and a build of the real repo |
| `.github/workflows/deploy.yml` | push to master → test → build → commit slugs.json if new → upload → deploy |
| `css/style.css` | one stylesheet, token-based (`:root` vars; dark values under `prefers-color-scheme`). Essay column (`--measure` 36rem) + sidebar (`--side` 15rem) from 64rem up; one column below that (sidebar after the essay). Header + footer, print styles |

## Post format

Filename `dd-mm-yyyy-N.txt`. The filename date is the source of truth. Header lines `Key: value` run until the first blank line or the first line that is not a `Key:` line.
Keys: `Title` (required), `Date` (optional, must equal the filename date), `Status` (`published`|`draft`), `Slug`, `Description`, `Series`. Unknown keys fail the build.
Body syntax: README.md › Formatting. Writer-facing guide: WRITING.md. Example of every feature: `examples/long-essay.txt` (never built; a test keeps it valid).
Drafts: `drafts/` is gitignored and read only by `build --drafts`; a broken draft can't block a deploy. Never commit drafts; never add `drafts/` back to git.
Markup extras: footnotes `[^id]` + `[^id]: …` (strict: missing/unused/duplicate fail), pipe tables (strict cell counts), `<!-- comments -->` stripped. Series = posts sharing a `Series:` name, ordered by date. Contents list when a post has ≥4 `##`. Page-owned ids (main, notes, series, toc-label, …) are reserved from heading ids.

## Invariants (do not break)

1. **URLs are forever.** `slugs.json` maps id → `[current, ...old]`. Slugs are assigned once (on first publish), never change on title edits, move only via an explicit `Slug:` (the old one becomes a redirect), and are never reused, not even after deletion. Drafts are never registered.
2. **Dates are calendar days in UTC.** Formatting happens at build time with `timeZone:"UTC"`, so no client-side date code is needed.
3. **Everything is escaped by default.** Only `post.content`/`page.content` (from markup.mjs) are inserted raw.
4. **Fail loudly.** Bad filenames, date mismatches, unknown headers, unsafe links and slug clashes stop the build.
5. **The Atom `<id>` is `tag:<host>,<date>:<post id>`**, so it is stable even if the slug changes. Never change this format.
6. **Stay dependency-free and static.** Prefer build-time work over runtime JS.
7. **Never write the owner's email in plain text** anywhere (repo files, pages, feed, JSON-LD, commit messages). Only the scrambled `contact` value + `{{email}}`.
8. **Content control**: essays are © all rights reserved (LICENSE); AI training crawlers fully disallowed, AI answer/user fetchers limited to `/`, `/archive/`, `/about/` (config → robots.txt); TDM opt-out via `/.well-known/tdmrep.json` (workflow uploads hidden files) + meta. Don't loosen without the owner asking.
9. Reserved top-level names: archive, assets, css, data, js, feed, rss, atom, page, tag, tags, search, 404, index, plus every `pages_raw` name.

## Design system ("ink by day, lamplight by night")

- No logo yet (one is being designed). `MARK` in templates.mjs is the empty slot beside the site name; `favicon.svg` is a placeholder "m". Essays end in plain space. Don't add decoration.
- Background "Neel" (pale indigo; a nod to Champaran's indigo and the 1917 satyagraha in Bihar). Day: paper `#eceaf3`, ink `#1b1a2b`, links indigo `#2f3592`. Night (automatic, follows the reader's OS/browser theme): paper `#14142a`, ink `#ebe8f5`, links amber `#e9b765`. All text/link/muted pairs pass WCAG AA.
- Type: system serif stack (Charter / Sitka Text / Georgia...), no web fonts. Body 17→19px, line-height 1.65, ~65ch measure.
- Two columns (echoing the old Blogspot layout): sidebar on every page with "Hi" (the owner's own intro words), "Blogs I read" and an archive by year (`<details>`, current post's year open, current post bold; drafts never listed). Content comes from `site.config.json` → `sidebar`. Muted small headings, no boxes.
- Wordmark (site name, top left): 22→28px regular weight, always smaller than essay titles (32→42px bold). Nav links stay 15px muted.
- No all-caps labels, no `→` arrows, no cards or shadows. Structure comes from whitespace; hairline rules only where they separate the essay from navigation.
- Section headings get ids and link to themselves; links/footnotes inside headings are rejected by the build.
- Footnotes, contents and the series box are muted, small, and use hairline rules, never an accent colour.
- Reading time shows only for essays of 3+ minutes (230 wpm).

## Search engines

- Goal: the blog ranks for "Harsh Mangalam Verma" and for its essay topics. Identity = Person JSON-LD + `rel="me"` + name in home/About titles + reciprocal links from GitHub/LinkedIn.
- Manual setup the owner does once (cannot be automated from the repo):
  1. Google Search Console → add *Domain* property `mangalams.blog` → add the TXT record at Hostinger DNS → verify → Sitemaps → submit `https://mangalams.blog/sitemap.xml` → URL inspection → request indexing for `/` and `/about/`.
  2. Bing Webmaster Tools → import from Search Console (also feeds DuckDuckGo, Yahoo, ChatGPT search).
  3. GitHub profile "Website" → `https://mangalams.blog`; LinkedIn → Contact info → Website + a Featured link.
- Validate structured data after template changes: https://search.google.com/test/rich-results
- Never put `noindex` on real pages; only drafts, redirects and 404 carry it.

## Known quirks

- If CI assigns a URL (a post pushed without a local build), it commits `slugs.json`. Run `git pull` before the next push.

## Working rules for Claude

- **Private notes live outside this public repo**, in the Claude Project doc `claude/NOTES.md` (status, decisions, reminders) and `claude/REVIEW.md`. Read NOTES.md at the start of a session; write personal or status information there, never here. Anything committed to this repo is public.

- Run `npm test` after any change. Add a test for any new syntax or rule.
- Never commit `dist/`. Never hand-edit `slugs.json` except to fix a mistake, and keep old slugs.
- Keep this file current when architecture or conventions change.
