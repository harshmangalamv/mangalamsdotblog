# mangalams.blog

A text-first personal blog, built to last. Posts are plain text files and the site is plain static HTML. There are no frameworks and no npm dependencies; Node is only used to build.

**Writing?** See [WRITING.md](WRITING.md) for the writer's guide, and `examples/long-essay.txt` for an essay that uses every feature.
On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution is disabled.

## Write a post

```powershell
npm run new -- "My title"            # creates drafts\dd-mm-yyyy-N.txt (local only, gitignored)
npm run dev                          # build with drafts + preview at http://localhost:5500
npm run publish-draft -- dd-mm-yyyy-N   # moves it into posts_raw\ with today's date
```

A post file looks like this:

```txt
Title: My title
Date: 2026-10-15
Status: draft

First paragraph. Single line breaks
are joined into one line.

Second paragraph.
```

- **Filename** `dd-mm-yyyy-N.txt` (N = 1, 2, 3… for that day). The filename date is the post's date. `Date:` is optional, and if present must match the filename.
- **Headers** (before the first blank line): `Title:` (required), `Date:`, `Status: draft` (left out of the published site), `Slug:` (custom URL), `Description:` (custom summary for search engines and link previews), `Series:` (links essays with the same series name as Part 1, 2, …), `Related:` (comma-separated URL names of published essays, listed as "Read these next" at the end), `Case:` (`lower` or `standard`; see House style).
- **House style**: from 24 October 2026, sentences start in lowercase and names keep their capitals. `npm run publish-draft` rewrites the file this way and lists any capitalised word it was unsure about (names it doesn't know); the build applies the same rule. Add names to `site.config.json` → `style.keepCapitalized`. `Case: standard` opts a post out. Older posts are untouched.
- **Drafts** live in `drafts/`, which is gitignored, so unfinished writing never reaches GitHub. `npm run publish-draft` moves a draft into `posts_raw/`; then `npm run build`, commit `posts_raw/` and `slugs.json`, and push. `Status: draft` still works as a safety net for a file in `posts_raw/`.

### Formatting

| Write | Get |
|---|---|
| a blank line | new paragraph |
| `\` at the end of a line | line break (poetry) |
| `## Heading` / `### Subheading` | headings (each one is linkable: `/post/#heading-text`; no links inside headings). Four or more `##` add a Contents list |
| `> quoted text` | block quote |
| `- item` or `1. item` | lists (leave a blank line before) |
| `[text](https://example.com)` | link (`https://`, `mailto:` or `/site-path` only) |
| `**bold**`, `*italic*`, `` `code` `` | emphasis, code |
| `![description](/assets/photo.jpg)` | image (put files in `assets/`) |
| `---` | horizontal rule |
| `text[^src]` and a line `[^src]: source` | numbered footnote, listed under "Notes" (the build stops on a missing or unused note) |
| `\| a \| b \|` + `\|---\|--:\|` + rows | table (`--:` right-aligns, `:--:` centres; every row needs the same number of cells) |
| `<!-- note to self -->` | comment, never published |
| `\*` | a literal `*` |

Everything else is plain text, and `<`, `>` and `&` are always shown as written.

### URLs are permanent

The first time a post is built, its URL is chosen from the title (`/my-title/`) and recorded in `slugs.json`. After that:
- Editing the title does **not** change the URL.
- Adding `Slug: new-url` moves the post. The old URL redirects to the new one.
- Deleting a post (or setting it back to draft) removes it from the site, but its URL is never given to another post.
- Titles without Latin letters (e.g. Hindi) get the post id as their URL (`/05-09-2026-1/`). Add `Slug:` for a readable one.

Commit `slugs.json` along with your posts. If you push a post without building first, CI records the URL and commits `slugs.json` for you, so run `git pull` before your next push.

## Search engines

Built in on every build, nothing to do per post:
- A `<title>`, description, canonical URL and Open Graph tags on every page; your name in the home and About titles.
- Structured data (schema.org JSON-LD, `scripts/lib/seo.mjs`): `WebSite` + `Person` on the home page, `BlogPosting` on each essay, `ProfilePage` on About. `Person.sameAs` and `<link rel="me">` list the profiles in `site.config.json` → `profiles`, which is how Google connects the site to your name.
- `sitemap.xml` (with dates), `robots.txt`, real 404s, permanent URLs, fast static pages, mobile-friendly layout.

One-time setup (done by hand, see the steps in CLAUDE.md › Search engines): verify the domain in Google Search Console and Bing Webmaster Tools, submit the sitemap, and link the blog from your GitHub and LinkedIn profiles.

Good habits per essay: a specific title, a `Description:` line for anything long, a link to related earlier essays, and sources linked in footnotes.

## Content control

- **AI crawlers** (`site.config.json` → `crawlers`, written into `robots.txt`): search engines read everything; AI *training* crawlers (GPTBot, ClaudeBot, Google-Extended, Meta, Common Crawl…) read nothing; AI *answer* engines and user-requested fetches (ChatGPT search, Claude, Perplexity…) read only the home page, archive and About. Edit the lists or `limitedAllow` to change this.
- **Rights**: essays are © all rights reserved, with a text-and-data-mining opt-out (`/.well-known/tdmrep.json`, `tdm-reservation` and `noai` meta tags). Code is MIT. See `LICENSE`.
- **Email**: never written in any file or page. `site.config.json` → `contact` holds a scrambled copy (`npm run encode-email -- you@example.com`); `{{email}}` in a page shows a "Show email address" button that assembles it in the reader's browser.
- Limits: robots.txt is a request the major AI companies honour, not a lock. Hard blocking needs a proxy such as Cloudflare in front of the site.

## Sidebar

The second column (beside essays on wide screens, below them on phones) is set in `site.config.json` → `sidebar`:
- `intro`: the short hello (inline formatting allowed: `*italic*`, `[link](https://…)`).
- `blogroll`: a list of `{ "name": …, "url": … }` for "Blogs I read".
The archive by year is built automatically from published posts.

## Start here

`site.config.json` → `startHere` (`intro` plus a list of essay URL names) builds `/start-here/`, adds "Start here" first in the menu and a one-line pointer above the home feed. Remove `startHere` to turn all three off. A name that isn't a published essay stops the build.

## Other pages

`pages_raw/about.txt` becomes `/about/`. Any other `pages_raw/<name>.txt` becomes `/<name>/` and appears in the menu. It uses the same format, with only `Title:` and `Description:` headers.

## Commands

| Command | What it does |
|---|---|
| `npm run new -- "Title"` | new draft for today in `drafts/` |
| `npm run publish-draft -- <name> [--keep-date]` | move a draft into `posts_raw/` (dated today unless `--keep-date`) |
| `npm run dev` | build including drafts, then serve `dist/` on :5500 |
| `npm run build` | production build into `dist/` |
| `npm run serve` | serve the existing `dist/` |
| `npm test` | run the tests (includes building this repository) |
| `npm run encode-email -- you@example.com` | scrambled address for `site.config.json` → `contact` |

Requires Node 20 or newer. Nothing to install.

## How it is published

Pushing to `master` runs `.github/workflows/deploy.yml`, which tests, builds and deploys `dist/` to GitHub Pages. `dist/` is never committed.

The site has:
- `/` latest 10 posts, with older ones loaded as you scroll
- `/<slug>/` posts
- `/archive/` every post by year
- `/about/`
- `/feed.xml` (Atom), `/sitemap.xml` and `/robots.txt`
- `404.html`

One-time setup, already required for this to work: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. The custom domain `mangalams.blog` is set on the same page; DNS is at Hostinger.

## Layout

```
posts_raw/        published posts (source of truth)
drafts/           drafts, local only (gitignored)
examples/         reference essay using every feature (never built)
pages_raw/        standalone pages (about)
assets/           images and files, served at /assets/
css/style.css     the only stylesheet
src/feed.js       the only client script (home page infinite scroll)
scripts/          build.mjs, serve.mjs, new-post.mjs, lib/
test/             node:test suite
slugs.json        URL registry: post id -> [current slug, old slugs...]
site.config.json  title, URL, author, description, page sizes
```

## Direction

Text-first, fast, minimal. Inspired by seths.blog, paulgraham.com and nav.al.

MIT licensed.
