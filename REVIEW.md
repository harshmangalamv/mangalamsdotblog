# Code review: mangalams.blog

First review 2026-10-15. Status updated the same day after the static-site rebuild.

## Done

| # | Issue | Resolution |
|---|---|---|
| A1 | CI triggered on `main`, but the branch is `master` | New `deploy.yml` on `master` |
| A2 | No viewport meta, so phones showed the desktop layout | In every page |
| A3 | Dates showed a day early west of UTC | Formatted at build time in UTC |
| A4 | Every post URL returned HTTP 404 | Real `/<slug>/index.html` pages; 404 only for missing pages |
| A5 | Trailing slash broke routing | Pages serve `/x/` and redirect `/x` → `/x/` |
| A6/A7 | Infinite scroll broke on mobile / with short first pages | IntersectionObserver on the window; refills until the screen is full |
| A8 | Deleting a raw post didn't unpublish it | `dist/` is rebuilt from scratch each deploy |
| A9 | Titles inserted unescaped | Everything escaped by default |
| A10 | Blank home page if the meta fetch failed | Home is static HTML; no fetch is needed to show posts |
| A11 | Tab title never changed | `<title>Post · mangalams.blog</title>` |
| A12 | README paragraph rule was wrong | README rewritten |
| B1/B2 | URLs changed with titles; Hindi titles gave empty slugs | `slugs.json` registry, `Slug:` header, redirects for old URLs |
| B3 | Two date sources could disagree | `Date:` optional and must match the filename |
| B4 | No drafts | `Status: draft`, `npm run new`, `npm run dev` preview |
| B5 | Mixed line endings | `.gitattributes` (LF) |
| B6 | Node 20 (end of life) in CI | Node 24; actions checkout v6, setup-node v6, upload-pages-artifact v5, deploy-pages v5 |
| C1 | Pre-rendered pages | Done |
| C2 | No RSS | `/feed.xml` (Atom, full content), `/sitemap.xml`, `/robots.txt` |
| C3 | No meta tags | description, canonical, Open Graph, twitter:card, `lang`, favicon |
| C4 | No formatting | Markdown subset: links, emphasis, headings, quotes, lists, images, rules, line breaks |
| C5 | No archive | `/archive/`, grouped by year |
| C7 | Feed cache only invalidated on post count | Feed files are content-hashed; restore state is keyed by that hash |
| C8 | Reading UX | Window scrollbar visible, focus outlines, underlined body links, older/newer links under posts |
| UX | Design refresh (branch `ux_refresh`) | Single reading column, flame mark, automatic dark mode, deliberate type scale (fixes the title-size conflict), linkable headings, reading time, skip link, print styles, RSS footer |
| C9 | Dead code | SPA runtime replaced (see the deletion list in the commit notes) |

## Still open, by value

1. **Write the About page** (`pages_raw/about.txt`). It is still placeholder text.
2. **Series support for the Bihar essays**: a `Series:` header plus "Part n of m" and in-series previous/next links.
3. **Social preview image**: a default `og:image` (and optionally one per post) so shared links show a card instead of plain text.
4. **`Updated:` header** for revised essays, shown under the date and used as `<updated>` in the feed.
5. **Search**: unnecessary until there are about 100 posts; the archive plus Ctrl+F covers it until then.
