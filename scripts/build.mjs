// Builds the whole site into dist/ as plain static files.
//
//   node scripts/build.mjs            production build (drafts skipped)
//   node scripts/build.mjs --drafts   local preview including drafts
//
// Inputs:  site.config.json, posts_raw/, pages_raw/, css/, src/, assets/, CNAME, slugs.json
// Output:  dist/ (never committed; GitHub Actions deploys it to Pages)

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readPosts, readPages, ContentError } from "./lib/content.mjs";
import { assignSlugs, SlugError } from "./lib/slugs.mjs";
import { truncateWords, SLUG_PATTERN } from "./lib/util.mjs";
import * as t from "./lib/templates.mjs";

// Top-level paths the site itself uses; a post can never take these URLs.
const RESERVED = ["archive", "assets", "css", "data", "js", "feed", "rss", "atom", "page", "tag", "tags", "search", "404", "index"];

const hash = (data) => createHash("sha256").update(data).digest("hex").slice(0, 10);

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw new Error(`${path.basename(file)} is not valid JSON: ${err.message}`);
  }
}

async function writeFile(outDir, rel, content) {
  const file = path.join(outDir, ...rel.split("/"));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function exists(p) {
  return fs.access(p).then(() => true, () => false);
}

export async function build({ root = process.cwd(), outDir = path.join(root, "dist"), drafts = false, log = console.log } = {}) {
  const config = await readJson(path.join(root, "site.config.json"), null);
  if (!config) throw new Error("site.config.json is missing.");
  const site = { language: "en", pageSize: 10, feedSize: 20, ...config, url: config.url.replace(/\/+$/, "") };

  // ---- content ---------------------------------------------------------
  const all = await readPosts(root);
  const pages = await readPages(root);
  const published = all.filter((p) => !p.draft);
  const draftPosts = drafts ? all.filter((p) => p.draft) : [];

  const reserved = new Set([...RESERVED, ...Object.keys(pages)]);
  for (const name of Object.keys(pages)) {
    if (!SLUG_PATTERN.test(name)) throw new ContentError(`pages_raw/${name}: page filenames must be lowercase a-z, 0-9 and hyphens (e.g. now.txt).`);
    if (RESERVED.includes(name)) throw new ContentError(`pages_raw/${name}: "${name}" is a reserved path.`);
  }

  // ---- URLs ------------------------------------------------------------
  const registryFile = path.join(root, "slugs.json");
  const before = await readJson(registryFile, {});
  for (const [id, slugs] of Object.entries(before)) {
    const clash = Array.isArray(slugs) && slugs.find((s) => s in pages);
    if (clash) throw new SlugError(`pages_raw/${clash}: that URL already belongs to post ${id} in slugs.json.`);
  }
  const { registry, notes } = assignSlugs(published, before, reserved);
  const registryChanged = JSON.stringify(before) !== JSON.stringify(registry);
  if (registryChanged) {
    await fs.writeFile(registryFile, `${JSON.stringify(registry, null, 2)}\n`);
    notes.forEach((n) => log(`  url: ${n}`));
  }
  // Drafts get provisional URLs for preview only; they are never recorded.
  if (draftPosts.length) assignSlugs(draftPosts, registry, reserved);

  const posts = [...published, ...draftPosts].sort((a, b) =>
    a.date === b.date ? b.seq - a.seq : a.date < b.date ? 1 : -1
  );
  for (const p of posts) {
    p.excerpt = p.description || truncateWords(p.text, 280);
    p.minutes = Math.max(1, Math.round(p.text.split(/\s+/).filter(Boolean).length / 230));
    p.atomId = `tag:${new URL(site.url).hostname},${p.date}:${p.id}`;
    // Feed readers resolve "#notes" against the site root, so point fragments at the post.
    p.feedContent = p.content.replace(/href="#/g, `href="${site.url}/${p.slug}/#`);
  }

  // ---- output ----------------------------------------------------------
  const resolvedOut = path.resolve(outDir);
  if (resolvedOut === path.resolve(root) || !resolvedOut.startsWith(path.resolve(root) + path.sep)) {
    throw new Error(`Refusing to clean output directory outside the project: ${resolvedOut}`);
  }
  await fs.rm(resolvedOut, { recursive: true, force: true });
  await fs.mkdir(resolvedOut, { recursive: true });

  // Static assets, fingerprinted with ?v= so browsers never keep stale CSS/JS.
  const css = await fs.readFile(path.join(root, "css", "style.css"));
  const feedJs = await fs.readFile(path.join(root, "src", "feed.js"));
  await writeFile(resolvedOut, "css/style.css", css);
  await writeFile(resolvedOut, "js/feed.js", feedJs);
  site.assets = { css: `/css/style.css?v=${hash(css)}`, feedJs: `/js/feed.js?v=${hash(feedJs)}` };
  if (await exists(path.join(root, "assets"))) {
    await fs.cp(path.join(root, "assets"), path.join(resolvedOut, "assets"), { recursive: true });
  }
  for (const file of ["CNAME", "favicon.svg"]) {
    if (await exists(path.join(root, file))) await fs.copyFile(path.join(root, file), path.join(resolvedOut, file));
  }

  site.nav = [
    { key: "home", label: "Home", href: "/" },
    { key: "archive", label: "Archive", href: "/archive/" },
    ...Object.entries(pages).map(([name, pg]) => ({ key: name, label: pg.title, href: `/${name}/` })),
  ];

  // Posts
  posts.forEach((post, i) => {
    post.newer = posts[i - 1] || null;
    post.older = posts[i + 1] || null;
  });

  // Series: posts sharing a "Series:" name, oldest first = part 1.
  const series = new Map();
  for (const post of [...posts].reverse()) {
    if (!post.series) continue;
    if (!series.has(post.series)) series.set(post.series, []);
    series.get(post.series).push(post);
  }
  for (const post of posts) {
    if (!post.series) continue;
    const parts = series.get(post.series);
    post.seriesInfo = { name: post.series, parts, index: parts.indexOf(post) };
  }

  // Contents list for long essays: 4 or more top-level sections.
  for (const post of posts) {
    const sections = [...post.content.matchAll(/<h2 id="([^"]+)"><a class="anchor" href="#[^"]+">(.*?)<\/a><\/h2>/g)].map((m) => ({ id: m[1], html: m[2] }));
    post.toc = sections.length >= 4 ? sections : [];
  }
  for (const post of posts) {
    const html = t.layout(site, {
      title: `${post.title} · ${site.title}`,
      ogTitle: post.title,
      description: post.excerpt,
      path: `/${post.slug}/`,
      type: "article",
      date: post.date,
      noindex: post.draft,
      body: t.postBody(post, { older: post.older, newer: post.newer }),
    });
    await writeFile(resolvedOut, `${post.slug}/index.html`, html);
    for (const alias of post.aliases) {
      await writeFile(resolvedOut, `${alias}/index.html`, t.redirectPage(site, `/${post.slug}/`));
    }
  }

  // Home feed: page 1 is in the HTML; later pages are JSON loaded on scroll.
  const previews = posts.map((p) => t.preview(p));
  const pageCount = Math.max(1, Math.ceil(previews.length / site.pageSize));
  const feedKey = hash(previews.join("\n"));
  const prefix = `/data/feed.${feedKey}.`;
  for (let n = 2; n <= pageCount; n += 1) {
    const items = previews.slice((n - 1) * site.pageSize, n * site.pageSize);
    await writeFile(resolvedOut, `data/feed.${feedKey}.${n}.json`, JSON.stringify({ items }));
  }
  await writeFile(
    resolvedOut,
    "index.html",
    t.layout(site, {
      title: site.title,
      description: site.description,
      path: "/",
      current: "home",
      body: t.homeBody(previews.slice(0, site.pageSize).join("\n"), { pages: pageCount, prefix, key: feedKey }, site),
      scripts: pageCount > 1 ? [site.assets.feedJs] : [],
    })
  );

  // Archive, standalone pages, 404
  await writeFile(
    resolvedOut,
    "archive/index.html",
    t.layout(site, {
      title: `Archive · ${site.title}`,
      description: `Every post on ${site.title}.`,
      path: "/archive/",
      current: "archive",
      body: t.archiveBody(posts),
    })
  );
  for (const [name, pg] of Object.entries(pages)) {
    await writeFile(
      resolvedOut,
      `${name}/index.html`,
      t.layout(site, {
        title: `${pg.title} · ${site.title}`,
        description: pg.description || truncateWords(pg.text, 160) || site.description,
        path: `/${name}/`,
        current: name,
        body: t.pageBody(pg),
      })
    );
  }
  await writeFile(
    resolvedOut,
    "404.html",
    t.layout(site, { title: `Page not found · ${site.title}`, description: site.description, path: null, noindex: true, body: t.notFoundBody() })
  );

  // Feed, sitemap, robots (published posts only)
  const live = posts.filter((p) => !p.draft);
  const updated = live[0]?.date || "1970-01-01";
  await writeFile(resolvedOut, "feed.xml", t.atomFeed(site, live.slice(0, site.feedSize), updated));
  await writeFile(
    resolvedOut,
    "sitemap.xml",
    t.sitemap(site, [
      { path: "/", lastmod: live[0]?.date },
      { path: "/archive/", lastmod: live[0]?.date },
      ...Object.keys(pages).map((name) => ({ path: `/${name}/` })),
      ...live.map((p) => ({ path: `/${p.slug}/`, lastmod: p.date })),
    ])
  );
  await writeFile(resolvedOut, "robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

  log(`Built ${live.length} post(s)${draftPosts.length ? ` + ${draftPosts.length} draft(s)` : ""}, ${pageCount} feed page(s) -> ${path.relative(root, resolvedOut) || "."}`);
  return { posts, registryChanged, outDir: resolvedOut };
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  build({ drafts: args.has("--drafts") }).catch((err) => {
    const known = err instanceof ContentError || err instanceof SlugError;
    console.error(known ? `\nBuild failed:\n${err.message}\n` : err);
    process.exit(1);
  });
}
