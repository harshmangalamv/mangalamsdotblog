// Build-time HTML templates. Every interpolated value is escaped unless it is
// already-rendered HTML (post bodies from markup.mjs, or other templates).

import { escapeHtml as e, formatDateLong } from "./util.mjs";
import { jsonLd } from "./seo.mjs";

// The site's mark, shown beside the name. Empty for now: the logo is being designed.
// To add it later, set this to an inline <svg class="mark" aria-hidden="true">…</svg>
// (and replace favicon.svg). Style it with .site-name .mark in css/style.css.
export const MARK = "";

const readingTime = (post) => (post.minutes >= 3 ? ` <span class="reading-time">${post.minutes} min read</span>` : "");

export function layout(site, page) {
  const {
    title, // full <title>
    description,
    path, // canonical path, e.g. "/my-post/"; null for 404
    type = "website",
    date = null,
    noindex = false,
    current = null, // nav item to mark as current
    body,
    scripts = [],
    structured = [], // schema.org items for this page (see seo.mjs)
  } = page;

  const url = path ? site.url + path : null;
  const nav = site.nav
    .filter((item) => item.key !== "home") // the name already links home
    .map((item) => {
      const aria = item.key === current ? ' aria-current="page"' : "";
      return `<li><a href="${e(item.href)}"${aria}>${e(item.label)}</a></li>`;
    })
    .join("");

  const meta = [
    `<meta name="description" content="${e(description)}">`,
    url ? `<link rel="canonical" href="${e(url)}">` : "",
    `<meta property="og:site_name" content="${e(site.title)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:title" content="${e(page.ogTitle || title)}">`,
    `<meta property="og:description" content="${e(description)}">`,
    url ? `<meta property="og:url" content="${e(url)}">` : "",
    date ? `<meta property="article:published_time" content="${e(date)}">` : "",
    `<meta name="twitter:card" content="summary">`,
    `<meta name="author" content="${e(site.author)}">`,
    // Opt-outs for AI training and text-and-data mining (honoured by some crawlers;
    // robots.txt carries the main rules).
    `<meta name="robots" content="${noindex ? "noindex, " : ""}noai, noimageai">`,
    `<meta name="tdm-reservation" content="1">`,
    // rel="me" tells search engines and the fediverse these profiles are the same person
    ...(site.profiles || []).map((href) => `<link rel="me" href="${e(href)}">`),
    jsonLd(structured),
  ]
    .filter(Boolean)
    .join("\n  ");

  const homeAria = current === "home" ? ' aria-current="page"' : "";

  return `<!DOCTYPE html>
<html lang="${e(site.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#eceaf3" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#14142a" media="(prefers-color-scheme: dark)">
  <title>${e(title)}</title>
  ${meta}
  <link rel="alternate" type="application/atom+xml" title="${e(site.title)}" href="/feed.xml">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${e(site.assets.css)}">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="site-name" href="/"${homeAria}>${MARK}<span>${e(site.title)}</span></a>
    <nav aria-label="Site"><ul>${nav}</ul></nav>
  </header>
  <main id="main">
${body}
  </main>
  <footer class="site-footer">
    <p>© ${site.since && site.since < new Date().getUTCFullYear() ? `${site.since}–` : ""}${new Date().getUTCFullYear()} ${e(site.author)}. <a href="/feed.xml">Subscribe with RSS</a></p>
  </footer>
${scripts.map((src) => `  <script type="module" src="${e(src)}"></script>`).join("\n")}
</body>
</html>
`;
}

export function preview(post) {
  return `<article class="preview">
  <h2><a href="/${e(post.slug)}/">${e(post.title)}</a></h2>
  <p class="meta"><time datetime="${e(post.date)}">${e(formatDateLong(post.date))}</time>${readingTime(post)}</p>
  <p class="excerpt">${e(post.excerpt)}</p>
</article>`;
}

function seriesNote(post) {
  const s = post.seriesInfo;
  if (!s) return "";
  return `\n    <p class="series-note">Part ${s.index + 1} of ${s.parts.length} in <a href="#series">${e(s.name)}</a></p>`;
}

function seriesNav(post) {
  const s = post.seriesInfo;
  if (!s) return "";
  const items = s.parts
    .map((p) =>
      p === post
        ? `<li><span aria-current="page">${e(p.title)}</span></li>`
        : `<li><a href="/${e(p.slug)}/">${e(p.title)}</a></li>`
    )
    .join("");
  return `\n  <nav class="series" id="series" aria-labelledby="series-label"><h2 id="series-label">${e(s.name)}</h2><ol>${items}</ol></nav>`;
}

function contents(post) {
  if (!post.toc?.length) return "";
  const items = post.toc.map((h) => `<li><a href="#${e(h.id)}">${h.html}</a></li>`).join("");
  return `\n  <nav class="toc" aria-labelledby="toc-label"><h2 id="toc-label">Contents</h2><ol>${items}</ol></nav>`;
}

export function postBody(post, { older, newer }) {
  const draft = post.draft ? `<p class="draft-banner">Draft. Only visible in local preview.</p>\n` : "";
  const cell = (p, cls, label, rel) =>
    p
      ? `<a class="${cls}" rel="${rel}" href="/${e(p.slug)}/"><span class="label">${label}</span><span class="title">${e(p.title)}</span></a>`
      : "";
  const links = cell(older, "older", "Older", "prev") + cell(newer, "newer", "Newer", "next");
  const nav = links ? `\n<nav class="post-nav" aria-label="More essays">${links}</nav>` : "";

  return `${draft}<article class="post">
  <header class="post-header">
    <h1>${e(post.title)}</h1>
    <p class="meta"><time datetime="${e(post.date)}">${e(formatDateLong(post.date))}</time>${readingTime(post)}</p>${seriesNote(post)}
  </header>${contents(post)}
  <div class="prose">
${post.content}
  </div>
${seriesNav(post)}
</article>${nav}`;
}

export function homeBody(firstPageHtml, feed, site) {
  if (!firstPageHtml) return `<p class="empty">The first essay is on its way.</p>`;
  const attrs = feed.pages > 1 ? ` data-pages="${feed.pages}" data-prefix="${e(feed.prefix)}" data-key="${e(feed.key)}"` : "";
  return `<h1 class="visually-hidden">${e(site.title)}</h1>
<div id="feed" class="feed"${attrs}>
${firstPageHtml}
</div>
<p class="feed-end"><a href="/archive/">Every essay, by year</a></p>`;
}

export function archiveBody(posts) {
  const heading = `<header class="post-header"><h1>Archive</h1><p class="meta">${posts.length} ${posts.length === 1 ? "essay" : "essays"}</p></header>`;
  if (!posts.length) return `<article class="post">${heading}<p class="empty">Nothing published yet.</p></article>`;
  const years = new Map();
  for (const p of posts) {
    const y = p.date.slice(0, 4);
    if (!years.has(y)) years.set(y, []);
    years.get(y).push(p);
  }
  const sections = [...years]
    .map(([year, list]) => {
      const items = list
        .map((p) => {
          const short = new Date(`${p.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
          return `<li><time datetime="${e(p.date)}">${e(short)}</time><a href="/${e(p.slug)}/">${e(p.title)}</a></li>`;
        })
        .join("\n      ");
      return `  <section class="archive-year" aria-labelledby="y${e(year)}">
    <h2 id="y${e(year)}">${e(year)}</h2>
    <ul>
      ${items}
    </ul>
  </section>`;
    })
    .join("\n");
  return `<article class="post archive">
  ${heading}
${sections}
</article>`;
}

export function pageBody(page) {
  return `<article class="post">
  <header class="post-header"><h1>${e(page.title)}</h1></header>
  <div class="prose">
${page.content}
  </div>
</article>`;
}

export function notFoundBody() {
  return `<article class="post">
  <header class="post-header"><h1>Page not found</h1></header>
  <div class="prose">
    <p>Nothing lives at this address. It may have been mistyped, or the essay may have been taken down.</p>
    <p>Start from the <a href="/">latest essays</a> or browse the <a href="/archive/">archive</a>.</p>
  </div>
</article>`;
}

export function redirectPage(site, toPath) {
  const url = site.url + toPath;
  return `<!DOCTYPE html>
<html lang="${e(site.language)}">
<head>
  <meta charset="utf-8">
  <title>Moved</title>
  <link rel="canonical" href="${e(url)}">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url=${e(toPath)}">
</head>
<body>
  <p>This post has moved to <a href="${e(toPath)}">${e(url)}</a>.</p>
</body>
</html>
`;
}

export function atomFeed(site, posts, updated) {
  const entries = posts
    .map(
      (p) => `  <entry>
    <id>${e(p.atomId)}</id>
    <title>${e(p.title)}</title>
    <link rel="alternate" type="text/html" href="${e(`${site.url}/${p.slug}/`)}"/>
    <published>${p.date}T00:00:00Z</published>
    <updated>${p.date}T00:00:00Z</updated>
    <summary>${e(p.excerpt)}</summary>
    <content type="html">${e(p.feedContent || p.content)}</content>
  </entry>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${e(site.language)}" xml:base="${e(site.url)}/">
  <title>${e(site.title)}</title>
  <subtitle>${e(site.description)}</subtitle>
  <id>${e(site.url)}/</id>
  <link rel="alternate" type="text/html" href="${e(site.url)}/"/>
  <link rel="self" type="application/atom+xml" href="${e(site.url)}/feed.xml"/>
  <author><name>${e(site.author)}</name></author>
  <updated>${updated}T00:00:00Z</updated>
${entries}
</feed>
`;
}

export function sitemap(site, entries) {
  const urls = entries
    .map((u) => `  <url><loc>${e(site.url + u.path)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

// The email is never written into the page; contact.js assembles it on click.
export function emailReveal(encoded) {
  return `<span class="email" data-x="${e(encoded)}"><button type="button" class="email-reveal" hidden>Show email address</button><noscript>Turn on JavaScript to see the email address.</noscript></span>`;
}

// robots.txt: search engines read everything; AI training crawlers read nothing;
// AI answer and user-requested fetchers read only the listed paths.
export function robots(site) {
  const c = site.crawlers || {};
  const lines = ["# Search engines: everything.", "User-agent: *", "Allow: /", ""];
  if (c.blocked?.length) {
    lines.push("# AI training crawlers: nothing.");
    for (const bot of c.blocked) lines.push(`User-agent: ${bot}`);
    lines.push("Disallow: /", "");
  }
  if (c.limited?.length) {
    lines.push("# AI answer engines and user-requested fetches: only these pages.");
    for (const bot of c.limited) lines.push(`User-agent: ${bot}`);
    for (const allowed of c.limitedAllow || []) lines.push(`Allow: ${allowed}`);
    lines.push("Disallow: /", "");
  }
  lines.push(`Sitemap: ${site.url}/sitemap.xml`, "");
  return lines.join("\n");
}
