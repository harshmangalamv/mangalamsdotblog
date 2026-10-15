// Zero-dependency local server for dist/ that mimics GitHub Pages:
// /post -> 301 /post/, /post/ -> /post/index.html, unknown -> 404.html with status 404.
//
//   node scripts/serve.mjs [port]     (default 5500)

import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve("dist");
const port = Number(process.argv[2]) || 5500;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};

async function stat(p) {
  return fs.stat(p).catch(() => null);
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://localhost");
    const decoded = decodeURIComponent(pathname);
    let file = path.join(root, decoded);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }

    let s = await stat(file);
    if (s?.isDirectory()) {
      if (!decoded.endsWith("/")) {
        res.writeHead(301, { Location: `${pathname}/` }).end();
        return;
      }
      file = path.join(file, "index.html");
      s = await stat(file);
    }

    let status = 200;
    if (!s?.isFile()) {
      status = 404;
      file = path.join(root, "404.html");
    }
    const body = await fs.readFile(file);
    res.writeHead(status, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
    console.log(status, req.url);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

server.listen(port, () => {
  console.log(`Serving dist/ at http://localhost:${port}/  (Ctrl+C to stop)`);
});
