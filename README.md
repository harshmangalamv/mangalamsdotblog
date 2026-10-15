# mangalams.blog

A text-first personal blog, built to last. Posts are plain text files and the site is plain static HTML. There are no frameworks and no npm dependencies; Node is only used to build.

## Write a post

```powershell
npm run new -- "My title"      # creates posts_raw\dd-mm-yyyy-N.txt as a draft
npm run dev                    # build with drafts + preview at http://localhost:5500
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
- **Headers** (before the first blank line): `Title:` (required), `Date:`, `Status: draft` (left out of the published site), `Slug:` (custom URL), `Description:` (custom summary for search engines and link previews).
- To publish, delete the `Status: draft` line, then commit and push.

### Formatting

| Write | Get |
|---|---|
| a blank line | new paragraph |
| `\` at the end of a line | line break (poetry) |
| `## Heading` / `### Subheading` | headings (each one is linkable: `/post/#heading-text`; no links inside headings) |
| `> quoted text` | block quote |
| `- item` or `1. item` | lists (leave a blank line before) |
| `[text](https://example.com)` | link (`https://`, `mailto:` or `/site-path` only) |
| `**bold**`, `*italic*`, `` `code` `` | emphasis, code |
| `![description](/assets/photo.jpg)` | image (put files in `assets/`) |
| `---` | horizontal rule |
| `\*` | a literal `*` |

Everything else is plain text, and `<`, `>` and `&` are always shown as written.

### URLs are permanent

The first time a post is built, its URL is chosen from the title (`/my-title/`) and recorded in `slugs.json`. After that:
- Editing the title does **not** change the URL.
- Adding `Slug: new-url` moves the post. The old URL redirects to the new one.
- Deleting a post (or setting it back to draft) removes it from the site, but its URL is never given to another post.
- Titles without Latin letters (e.g. Hindi) get the post id as their URL (`/05-09-2026-1/`). Add `Slug:` for a readable one.

Commit `slugs.json` along with your posts. If you push a post without building first, CI records the URL and commits `slugs.json` for you, so run `git pull` before your next push.

## Other pages

`pages_raw/about.txt` becomes `/about/`. Any other `pages_raw/<name>.txt` becomes `/<name>/` and appears in the menu. It uses the same format, with only `Title:` and `Description:` headers.

## Commands

| Command | What it does |
|---|---|
| `npm run new -- "Title"` | new draft for today |
| `npm run dev` | build including drafts, then serve `dist/` on :5500 |
| `npm run build` | production build into `dist/` |
| `npm run serve` | serve the existing `dist/` |
| `npm test` | run the tests (includes building this repository) |

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
posts_raw/        posts (source of truth)
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
