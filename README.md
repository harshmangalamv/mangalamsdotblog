# mangalams.blog

Minimal vanilla JS blog app (no build step) with client-side routing and JSON-backed posts.

## Prerequisites

Use any one of these:
- Python 3
- Node.js (for index generation tooling)

## Run Locally

Run from the project root (`mangalamsdotblog`) using an HTTP server.

### Option 1: Python

```powershell
python -m http.server 5500
```

Then open:
- http://localhost:5500/

### Option 2: Node (`serve`)

```powershell
npx serve -s . -l 5500
```

Then open:
- http://localhost:5500/

## Content Authoring Rules

Source of truth:
- Write raw posts in `posts_raw/`.

Raw post filename format:
- `dd-mm-yyyy-N.txt`
- `N` is the post number for that date (1, 2, 3...)

Examples:
- `22-02-2026-1.txt`
- `22-02-2026-2.txt`

Raw file format:
```txt
Title: Your title
Date: 2026-02-22

First paragraph.

Second paragraph.
```

Parsing rules:
- 2+ blank lines = new paragraph
- single line breaks inside a paragraph become spaces
- tabs/multiple spaces are normalized
- output HTML is escaped and wrapped in `<p>...</p>`

## Index Build Tooling (Option 3)

This project auto-generates index artifacts from post files.

Generate content JSON from raw source:
```powershell
npm run build:content
```

Generate index artifacts:
```powershell
npm run build:index
```

Do both:
```powershell
npm run build:all
```

Generate only one post:
```powershell
node scripts/parse-raw-posts.mjs --file posts_raw\\22-02-2026-1.txt
```

Generated files:
- `data/blogIndex.json` (canonical metadata index)
- `data/blogIndex.meta.json` (page size and totals)
- `data/blogSlugMap.json` (slug -> post id)
- `data/blogFeed.<hash>.page.N.json` (paged metadata for infinite scroll)

How app loads data:
- Home page fetches `blogIndex.meta.json`, then `${pageFilePrefix}.1.json`, then page 2/3/... on scroll.
- Blog detail page fetches full content only after click via `blogSlugMap.json` + `/data/<id>.json`.

## GitHub Automation

Workflow file:
- `.github/workflows/build-index.yml`

Behavior:
- On push to `main` (when raw posts, scripts, data, or `package.json` changes), GitHub Actions runs `npm run build:all`.
- If generated data files changed, the workflow commits and pushes them.

## Git Push Safety

Commit/push these:
- `index.html`, `src/`, `css/`, `assets/`
- `scripts/build-index.mjs`
- `data/dd-mm-yyyy-N.json` post files
- generated index artifacts used by the app:
  - `data/blogIndex.json`
  - `data/blogIndex.meta.json`
  - `data/blogSlugMap.json`
  - `data/blogFeed.<hash>.page.N.json`
- `.github/workflows/build-index.yml`, `package.json`, `README.md`, `.gitignore`

Do not push (ignored by `.gitignore`):
- `node_modules/`
- editor/OS junk (`.vscode/`, `.idea/`, `.DS_Store`, `Thumbs.db`)
- temp files (`*.tmp`, `*.temp`)
- legacy unused data:
  - `data/posts/`
  - `data/blogIndex.page.*.json`
  - old-format post files (`data/yyyy-mm-dd-*.json`)

## Important Notes

- Do not open `index.html` directly from the file system (`file://...`). The app loads JSON via `fetch`, which requires HTTP.
- Start the server from the repository root so paths like `/src/main.js` and `/data/...` resolve correctly.
- Routing is client-side (`/`, `/about`, and blog slugs). If your server does not support SPA fallback, opening or refreshing deep links directly may return 404.

## Product Direction

Writing style and UX inspiration:
- seths.blog
- paulgraham.com
- nav.al

Target direction:
- Keep the site text-first, fast, and minimal.
- Publish thoughtful short/medium essays with simple navigation.

## Hosting Plan

Deployment target:
- Host as a static site on GitHub (GitHub Pages or equivalent static hosting from the repo).
- Map your `mangalams.blog` domain from Hostinger to the GitHub-hosted site via DNS.
