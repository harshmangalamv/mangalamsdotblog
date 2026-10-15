# mangalams.blog — knowledge store

Harsh's personal blog, meant to run for life. Text-first and minimal (seths.blog, paulgraham.com, nav.al).
It is a **static site generator** with zero npm dependencies: Node builds plain HTML into `dist/`, and GitHub Actions deploys it to Pages.

- Repo: github.com/harshmangalamv/mangalamsdotblog · branch **`master`** (not main)
- Local: `D:\Projects\mangalamsdotblog` (Windows; keep all tooling on D:)
- Hosting: GitHub Pages with **Source: GitHub Actions**. Custom domain `mangalams.blog` (CNAME); DNS at Hostinger
- License: MIT. Requires Node ≥ 20 (CI uses 24)

## Mental model

```
posts_raw/dd-mm-yyyy-N.txt ─┐
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
| `scripts/lib/util.mjs` | escape, slugify (ASCII only), UTC date formatting, excerpt truncation |
| `scripts/serve.mjs` | local server mimicking Pages (301 to trailing slash, 404.html with status 404) |
| `scripts/new-post.mjs` | `npm run new -- "Title"` → today's draft |
| `test/build.test.mjs` | node:test: markup, parser, slugs, dates, an end-to-end fixture build, and a build of the real repo |
| `.github/workflows/deploy.yml` | push to master → test → build → commit slugs.json if new → upload → deploy |
| `css/style.css` | one stylesheet. The window scrolls; the sidebar is sticky on desktop and stacks on ≤900px |

## Post format

Filename `dd-mm-yyyy-N.txt`. The filename date is the source of truth. Header lines `Key: value` run until the first blank line or the first line that is not a `Key:` line.
Keys: `Title` (required), `Date` (optional, must equal the filename date), `Status` (`published`|`draft`), `Slug`, `Description`. Unknown keys fail the build.
Body syntax: README.md › Formatting.

## Invariants (do not break)

1. **URLs are forever.** `slugs.json` maps id → `[current, ...old]`. Slugs are assigned once (on first publish), never change on title edits, move only via an explicit `Slug:` (the old one becomes a redirect), and are never reused, not even after deletion. Drafts are never registered.
2. **Dates are calendar days in UTC.** Formatting happens at build time with `timeZone:"UTC"`, so no client-side date code is needed.
3. **Everything is escaped by default.** Only `post.content`/`page.content` (from markup.mjs) are inserted raw.
4. **Fail loudly.** Bad filenames, date mismatches, unknown headers, unsafe links and slug clashes stop the build.
5. **The Atom `<id>` is `tag:<host>,<date>:<post id>`**, so it is stable even if the slug changes. Never change this format.
6. **Stay dependency-free and static.** Prefer build-time work over runtime JS.
7. Reserved top-level names: archive, assets, css, data, js, feed, rss, atom, page, tag, tags, search, 404, index, plus every `pages_raw` name.

## Known quirks

- `.post-title` declares 58px/800, but `.content h1` has higher specificity, so titles render at 38px normal. This is how the live site has always looked; change it deliberately if wanted.
- If CI assigns a URL (a post pushed without a local build), it commits `slugs.json`. Run `git pull` before the next push.

## Status (2026-10-15)

- Published: `22-02-2026-2` "Ail Ail Aimshh" → `/ail-ail-aimshh/`.
- Local and uncommitted: `posts_raw/05-09-2026-1.txt` "the flickering lamp". It will publish on the next push unless it gets `Status: draft`.
- Planned: a fact-backed series on why Bihar remains poor. Links (`[text](https://…)`) are supported for citations.
- Remaining ideas: REVIEW.md.

## Working rules for Claude

- Run `npm test` after any change. Add a test for any new syntax or rule.
- Never commit `dist/`. Never hand-edit `slugs.json` except to fix a mistake, and keep old slugs.
- Keep this file current when architecture or conventions change.
