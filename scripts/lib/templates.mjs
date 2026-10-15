// Build-time HTML templates. Every interpolated value is escaped unless it is
// already-rendered HTML (post bodies from markup.mjs, or other templates).

import { escapeHtml as e, formatDateLong } from "./util.mjs";

export function layout(site, page) {
  const {
    title, // full <title>
    description,
    path, // canonical path, e.g. "/my-post/"; null for 404
    type = "website",
    date = null,
    noindex = false,
    isHome = false,
    current = null, // nav item to mark as current
    body,
    scripts = [],
  } = page;

  const url = path ? site.url + path : null;
  const nav = site.nav
    .map((item) => {
      const aria = item.key === current ? ' aria-current="page"' : "";
      return `<li><a href="${e(item.href)}"${aria}>${e(item.label)}</a></li>`;
    })
    .join("");

  const siteTitle = isHome
    ? `<h1 class="site-title"><a href="/">${e(site.title)}</a></h1>`
    : `<p class="site-title"><a href="/">${e(site.title)}</a></p>`;

  const meta = [
    `<meta name="description" content="${e(description)}">`,
    url ? `<link rel="canonical" href="${e(url)}">` : "",
    noindex ? `<meta name="robots" content="noindex">` : "",
    `<meta property="og:site_name" content="${e(site.title)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:title" content="${e(page.ogTitle || title)}">`,
    `<meta property="og:description" content="${e(description)}">`,
    url ? `<meta property="og:url" content="${e(url)}">` : "",
    date ? `<meta property="article:published_time" content="${e(date)}">` : "",
    `<meta name="twitter:card" content="summary">`,
  ]
    .filter(Boolean)
    .join("\n  ");

  return `<!DOCTYPE html>
<html lang="${e(site.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(title)}</title>
  ${meta}
  <link rel="alternate" type="application/atom+xml" title="${e(site.title)}" href="/feed.xml">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${e(site.assets.css)}">
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      ${siteTitle}
      <nav class="menu" aria-label="Site"><ul>${nav}</ul></nav>
    </aside>
    <main class="content-pane">
      <div class="content">
${body}
      </div>
    </main>
  </div>
${scripts.map((src) => `  <script type="module" src="${e(src)}"></script>`).join("\n")}
</body>
</html>
`;
}

export function preview(post) {
  return `<article class="blog-preview">
  <h2><a href="/${e(post.slug)}/">${e(post.title)}</a></h2>
  <p class="blog-date"><time datetime="${e(post.date)}">${e(formatDateLong(post.date))}</time></p>
  <p>${e(post.excerpt)}</p>
</article>`;
}

export function postBody(post, { older, newer }) {
  const draft = post.draft ? `<p class="draft-banner">Draft — not published. Only visible in local preview.</p>\n` : "";
  const links = [
    older ? `<a class="older" rel="prev" href="/${e(older.slug)}/">← ${e(older.title)}</a>` : "",
    newer ? `<a class="newer" rel="next" href="/${e(newer.slug)}/">${e(newer.title)} →</a>` : "",
  ].join("");
  const nav = links ? `\n<nav class="post-nav" aria-label="More posts">${links}</nav>` : "";

  return `${draft}<article class="post">
  <h1 class="post-title">${e(post.title)}</h1>
  <p class="post-meta"><time datetime="${e(post.date)}">${e(formatDateLong(post.date))}</time></p>
  <div class="post-body">
${post.content}
  </div>
</article>${nav}`;
}

export function homeBody(firstPageHtml, feed) {
  if (!firstPageHtml) return `<p class="empty">Nothing published yet.</p>`;
  const attrs = feed.pages > 1 ? ` data-pages="${feed.pages}" data-prefix="${e(feed.prefix)}" data-key="${e(feed.key)}"` : "";
  return `<div id="feed"${attrs}>
${firstPageHtml}
</div>
<p class="feed-end"><a href="/archive/">All posts →</a></p>`;
}

export function archiveBody(posts) {
  if (!posts.length) return `<article class="post"><h1 class="post-title">Archive</h1><p>Nothing published yet.</p></article>`;
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
          return `<li><time datetime="${e(p.date)}">${e(short)}</time> <a href="/${e(p.slug)}/">${e(p.title)}</a></li>`;
        })
        .join("\n      ");
      return `  <section class="archive-year">
    <h2>${e(year)}</h2>
    <ul class="archive-list">
      ${items}
    </ul>
  </section>`;
    })
    .join("\n");
  return `<article class="post archive">
  <h1 class="post-title">Archive</h1>
${sections}
</article>`;
}

export function pageBody(page) {
  return `<article class="post">
  <h1 class="post-title">${e(page.title)}</h1>
  <div class="post-body">
${page.content}
  </div>
</article>`;
}

export function notFoundBody() {
  return `<article class="post">
  <h1 class="post-title">Not found</h1>
  <div class="post-body">
    <p>There is nothing at this address. Try the <a href="/">home page</a> or the <a href="/archive/">archive</a>.</p>
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
    <content type="html">${e(p.content)}</content>
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
