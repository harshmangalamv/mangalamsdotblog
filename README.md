# mangalams.blog

Minimal vanilla JS blog app (no build step) with client-side routing and JSON-backed posts.

## Prerequisites

Use any one of these:
- Python 3
- Node.js (for `npx`)

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

## Important Notes

- Do not open `index.html` directly from the file system (`file://...`). The app loads JSON via `fetch`, which requires HTTP.
- Start the server from the repository root so paths like `/src/main.js` and `/data/...` resolve correctly.
- Routing is client-side (`/`, `/about`, and blog slugs). If your server does not support SPA fallback, opening or refreshing deep links directly may return 404.

## Project Structure

- `index.html`: app entry point
- `src/main.js`: bootstraps route resolution
- `src/runtime/router.js`: route handling
- `data/`: post index and post JSON files
- `css/style.css`: styling

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
