import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderBody, renderInline } from "../scripts/lib/markup.mjs";
import { parsePost, ContentError } from "../scripts/lib/content.mjs";
import { assignSlugs, SlugError } from "../scripts/lib/slugs.mjs";
import { slugify, formatDateLong, truncateWords, htmlToText } from "../scripts/lib/util.mjs";
import { build } from "../scripts/build.mjs";
import { encodeEmail } from "../scripts/encode-email.mjs";
import { createDraft, publishDraft, styleSource } from "../scripts/lib/drafts.mjs";
import { lowercaseBody } from "../scripts/lib/style.mjs";

const post = (text, file = "05-09-2026-1.txt") => parsePost(text, file);

// ---------------------------------------------------------------- markup

test("plain paragraphs render exactly like the original parser", () => {
  const raw = "Line one\nline two.  \n\n\nSecond   para\twith tabs.\n";
  assert.equal(renderBody(raw), "<p>Line one line two.</p>\n<p>Second para with tabs.</p>");
});

test("everything is escaped", () => {
  assert.equal(renderInline(`<script>alert("x")</script> & 'q'`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;");
});

test("links: safe schemes only, nested parens, escaped text", () => {
  assert.equal(
    renderInline("see [Bihar <b>](https://en.wikipedia.org/wiki/Bihar_(state))."),
    'see <a href="https://en.wikipedia.org/wiki/Bihar_(state)" rel="noopener">Bihar &lt;b&gt;</a>.'
  );
  assert.equal(renderInline("[home](/archive/)"), '<a href="/archive/">home</a>');
  assert.throws(() => renderInline("[x](javascript:alert(1))"), /Unsupported link target/);
  assert.throws(() => renderInline("[x](www.example.com)"), /Unsupported link target/);
});

test("emphasis, code and backslash escapes", () => {
  assert.equal(renderInline("**bold** and *it* and `a<b`"), "<strong>bold</strong> and <em>it</em> and <code>a&lt;b</code>");
  assert.equal(renderInline("5 * 3 * 2"), "5 * 3 * 2");
  assert.equal(renderInline("\\*not italic\\*"), "*not italic*");
  assert.equal(renderInline("a lone [bracket and (paren)"), "a lone [bracket and (paren)");
});

test("blocks: headings, quotes, lists, rule, figure, hard breaks", () => {
  const html = renderBody(
    [
      "## Why",
      "",
      "> quoted line",
      "> continues",
      "",
      "- one",
      "  wrapped",
      "- two",
      "",
      "1. first",
      "2. second",
      "",
      "---",
      "",
      "![A map](/assets/map.png)",
      "",
      "roses are red\\",
      "violets are blue",
    ].join("\n")
  );
  assert.equal(
    html,
    [
      '<h2 id="why"><a class="anchor" href="#why">Why</a></h2>',
      "<blockquote><p>quoted line continues</p></blockquote>",
      "<ul><li>one wrapped</li><li>two</li></ul>",
      "<ol><li>first</li><li>second</li></ol>",
      "<hr>",
      '<figure><img src="/assets/map.png" alt="A map" loading="lazy"><figcaption>A map</figcaption></figure>',
      "<p>roses are red<br>\nviolets are blue</p>",
    ].join("\n")
  );
});

test("headings get unique, linkable ids and cannot hold links", () => {
  assert.equal(
    renderBody("## Why *Bihar*?\n\n### Why Bihar?\n\n## बिहार"),
    [
      '<h2 id="why-bihar"><a class="anchor" href="#why-bihar">Why <em>Bihar</em>?</a></h2>',
      '<h3 id="why-bihar-2"><a class="anchor" href="#why-bihar-2">Why Bihar?</a></h3>',
      '<h2 id="section"><a class="anchor" href="#section">बिहार</a></h2>',
    ].join("\n")
  );
  assert.throws(() => renderBody("## See [this](https://a.b)"), /Headings cannot contain links/);
});

test("footnotes: numbered by first use, repeat refs, notes section, strict errors", () => {
  const html = renderBody("A.[^src] B.[^two] C.[^src]\n\n[^src]: [Census](https://census.gov.in), provisional.\n[^two]: Second note\ncontinues.");
  assert.match(html, /<sup class="fn-ref" id="fnref-src"><a href="#fn-src"[^>]*>1<\/a><\/sup>/);
  assert.match(html, /<sup class="fn-ref" id="fnref-two"><a href="#fn-two"[^>]*>2<\/a><\/sup>/);
  assert.match(html, /<sup class="fn-ref" id="fnref-src-2"><a href="#fn-src"[^>]*>1<\/a><\/sup>/);
  assert.match(html, /<li id="fn-src"><a href="https:\/\/census\.gov\.in" rel="noopener">Census<\/a>, provisional\. <a class="fn-back" href="#fnref-src"/);
  assert.match(html, /<li id="fn-two">Second note continues\./);
  assert.throws(() => renderBody("x[^nope]"), /used but never defined/);
  assert.throws(() => renderBody("x\n\n[^a]: unused"), /defined but never used/);
  assert.throws(() => renderBody("x[^a]\n\n[^a]: one\n[^a]: two"), /defined twice/);
  assert.equal(htmlToText(html).startsWith("A. B. C."), true); // excerpts skip the markers
});

test("tables: header, alignment, inline formatting, escaped pipes, strict shape", () => {
  assert.equal(
    renderBody("| State | Literacy |\n|---|--:|\n| **Bihar** | 63.82% |\n| a \\| b | 1 |"),
    '<div class="table-wrap"><table><thead><tr><th scope="col">State</th><th scope="col" class="align-right">Literacy</th></tr></thead>' +
      '<tbody><tr><td><strong>Bihar</strong></td><td class="align-right">63.82%</td></tr><tr><td>a | b</td><td class="align-right">1</td></tr></tbody></table></div>'
  );
  assert.throws(() => renderBody("| a | b |\n|---|---|\n| 1 |"), /Table row 1 has 1 cells/);
  assert.equal(renderBody("| not a table"), "<p>| not a table</p>");
});

test("comments never reach the page", () => {
  assert.equal(renderBody("<!-- todo:\ncheck this -->\nKept <!-- hidden --> text."), "<p>Kept text.</p>");
  assert.throws(() => renderBody("oops <!-- never closed"), /not closed/);
});

test("inline dashes and colons do not become structure", () => {
  assert.equal(renderBody("knowledge equalizers - far better: yes"), "<p>knowledge equalizers - far better: yes</p>");
});

// ---------------------------------------------------------------- parser

test("parses header, BOM and CRLF", () => {
  const p = post("﻿Title: Hello & <you>\r\nDate: 2026-09-05\r\n\r\nBody.\r\n");
  assert.equal(p.title, "Hello & <you>");
  assert.equal(p.date, "2026-09-05");
  assert.equal(p.content, "<p>Body.</p>");
  assert.equal(p.draft, false);
});

test("Date header is optional but must match the filename", () => {
  assert.equal(post("Title: T\n\nBody").date, "2026-09-05");
  assert.throws(() => post("Title: T\nDate: 2026-09-06\n\nBody"), /does not match the filename/);
});

test("rejects bad filenames, impossible dates, unknown headers, empty bodies", () => {
  assert.throws(() => post("Title: T\n\nB", "2026-09-05-1.txt"), ContentError);
  assert.throws(() => post("Title: T\n\nB", "31-02-2026-1.txt"), /not a real calendar date/);
  assert.throws(() => post("Titel: T\n\nB"), /unknown header "Titel:"/);
  assert.throws(() => post("Title: T\n\n   \n"), /body is empty/);
  assert.throws(() => post("Date: 2026-09-05\n\nB"), /missing "Title:"/);
});

test("forgetting the blank line after the header loses nothing", () => {
  const p = post("Title: T\nDate: 2026-09-05\nThis is the first line.\n\nSecond.");
  assert.equal(p.content, "<p>This is the first line.</p>\n<p>Second.</p>");
});

test("Status: draft and Slug: are read and validated", () => {
  assert.equal(post("Title: T\nStatus: draft\n\nB").draft, true);
  assert.throws(() => post("Title: T\nStatus: later\n\nB"), /Status/);
  assert.equal(post("Title: T\nSlug: why-bihar-1\n\nB").slug, "why-bihar-1");
  assert.throws(() => post("Title: T\nSlug: Why Bihar\n\nB"), /Slug/);
});

// ---------------------------------------------------------------- slugs

const P = (id, title, extra = {}) => ({ id, title, date: id.slice(6, 10) + "-" + id.slice(3, 5) + "-" + id.slice(0, 2), seq: Number(id.split("-")[3]), slug: null, ...extra });

test("slug is fixed at first build; later title edits do not change it", () => {
  const first = assignSlugs([P("05-09-2026-1", "The Lamp")], {}, new Set());
  assert.deepEqual(first.registry, { "05-09-2026-1": ["the-lamp"] });
  const again = assignSlugs([P("05-09-2026-1", "The Flickering Lamp")], first.registry, new Set());
  assert.deepEqual(again.registry, first.registry);
});

test("explicit Slug: moves the URL and keeps the old one as an alias", () => {
  const posts = [P("05-09-2026-1", "x", { slug: "lamp" })];
  const { registry } = assignSlugs(posts, { "05-09-2026-1": ["the-lamp"] }, new Set());
  assert.deepEqual(registry["05-09-2026-1"], ["lamp", "the-lamp"]);
  assert.equal(posts[0].slug, "lamp");
  assert.deepEqual(posts[0].aliases, ["the-lamp"]);
});

test("collisions: older post keeps the plain slug; reserved and deleted slugs are never reused", () => {
  const posts = [P("06-09-2026-1", "Same"), P("05-09-2026-1", "Same"), P("07-09-2026-1", "Archive")];
  const { registry } = assignSlugs(posts, { "01-01-2026-1": ["gone"] }, new Set(["archive"]));
  assert.deepEqual(registry["05-09-2026-1"], ["same"]);
  assert.deepEqual(registry["06-09-2026-1"], ["same-2"]);
  assert.deepEqual(registry["07-09-2026-1"], ["archive-2"]);
  assert.deepEqual(registry["01-01-2026-1"], ["gone"]);
  assert.throws(() => assignSlugs([P("08-09-2026-1", "x", { slug: "gone" })], registry, new Set()), SlugError);
});

test("non-ASCII titles fall back to the post id", () => {
  assert.equal(slugify("बिहार क्यों गरीब है"), "");
  const { registry } = assignSlugs([P("05-09-2026-1", "बिहार")], {}, new Set());
  assert.deepEqual(registry["05-09-2026-1"], ["05-09-2026-1"]);
  assert.equal(slugify("Café & Crème — part 2!"), "cafe-and-creme-part-2");
});

// ---------------------------------------------------------------- dates

test("dates never shift with timezone", () => {
  assert.equal(formatDateLong("2026-02-22"), "February 22, 2026");
});

test("plain text from HTML keeps punctuation tight and blocks apart", () => {
  assert.equal(htmlToText(renderBody("A [link](https://a.b), **bold** and `code`.\n\nNext &amp; last.")), "A link, bold and code. Next &amp; last.");
  assert.equal(htmlToText("<h2>One</h2><p>Two<br>three</p><ul><li>a</li><li>b</li></ul>"), "One Two three a b");
});

test("excerpts cut at a word boundary", () => {
  assert.equal(truncateWords("aaa bbb ccc ddd", 9), "aaa bbb…");
  assert.equal(truncateWords("short", 9), "short");
});

// ---------------------------------------------------------------- end to end

async function fixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blog-"));
  const base = {
    "site.config.json": JSON.stringify({ title: "t.blog", url: "https://t.blog/", author: "A", description: "D", pageSize: 2 }),
    "css/style.css": "body{}",
    "src/feed.js": "// js",
    "src/contact.js": "// js",
    CNAME: "t.blog\n",
    "pages_raw/about.txt": "Title: About\n\nHi.",
  };
  for (const [rel, content] of Object.entries({ ...base, ...files })) {
    const f = path.join(root, rel);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, content);
  }
  return root;
}

const read = (root, rel) => fs.readFile(path.join(root, "dist", rel), "utf8");
const has = (root, rel) => fs.access(path.join(root, "dist", rel)).then(() => true, () => false);

test("full build: pages, feed, drafts, redirects, unpublishing", async () => {
  const root = await fixture({
    "posts_raw/01-01-2026-1.txt": "Title: Old <one>\n\nFirst & best.",
    "posts_raw/02-01-2026-1.txt": "Title: Two\nSlug: second\n\nSee [one](/old-one/).",
    "posts_raw/03-01-2026-1.txt": "Title: Three\n\nThird.",
    "posts_raw/04-01-2026-1.txt": "Title: Draft\nStatus: draft\n\nWIP.",
    "slugs.json": JSON.stringify({ "02-01-2026-1": ["two"], "09-09-2025-1": ["deleted-post"] }),
  });
  const log = () => {};
  await build({ root, log });

  // slugs.json recorded new URLs, kept the deleted post's slug reserved, never the draft
  const reg = JSON.parse(await fs.readFile(path.join(root, "slugs.json"), "utf8"));
  assert.deepEqual(reg, {
    "01-01-2026-1": ["old-one"],
    "02-01-2026-1": ["second", "two"],
    "03-01-2026-1": ["three"],
    "09-09-2025-1": ["deleted-post"],
  });

  // post pages, escaped titles, canonical, prev/next
  const one = await read(root, "old-one/index.html");
  assert.match(one, /<h1>Old &lt;one&gt;<\/h1>/);
  assert.match(one, /<a class="site-name" href="\/"><span>t\.blog<\/span><\/a>/);
  assert.match(one, /<a href="\/feed\.xml">Subscribe with RSS<\/a>/);
  assert.match(one, /<a class="skip-link" href="#main">/);
  assert.doesNotMatch(one, /min read/); // short essays show no reading time
  assert.match(one, /<title>Old &lt;one&gt; · t\.blog<\/title>/);
  assert.match(one, /<link rel="canonical" href="https:\/\/t\.blog\/old-one\/">/);
  assert.match(one, /<meta name="viewport"/);
  assert.match(one, /<time datetime="2026-01-01">January 1, 2026<\/time>/);
  assert.match(one, /rel="next" href="\/second\/"><span class="label">Newer<\/span><span class="title">Two<\/span>/);
  assert.match(await read(root, "second/index.html"), /<a href="\/old-one\/">one<\/a>/);

  // old slug redirects; deleted and draft posts are not published
  assert.match(await read(root, "two/index.html"), /url=\/second\//);
  assert.equal(await has(root, "deleted-post/index.html"), false);
  assert.equal(await has(root, "draft/index.html"), false);

  // home: first page inline, rest as JSON, newest first
  const home = await read(root, "index.html");
  assert.match(home, /data-pages="2"/);
  assert.ok(home.indexOf("/three/") < home.indexOf("/second/"));
  const feedPart = home.slice(home.indexOf('<div id="feed"'), home.indexOf("</main>"));
  assert.doesNotMatch(feedPart, /old-one/); // page 1 of the feed holds 2 posts here
  const [page2] = (await fs.readdir(path.join(root, "dist", "data"))).filter((f) => f.endsWith(".2.json"));
  assert.match(JSON.parse(await read(root, `data/${page2}`)).items[0], /\/old-one\//);

  // archive, about, 404, feed, sitemap, robots, CNAME
  assert.match(await read(root, "archive/index.html"), /Jan 1<\/time><a href="\/old-one\/">/);
  assert.match(await read(root, "archive/index.html"), /3 essays/);
  assert.match(await read(root, "about/index.html"), /<p>Hi\.<\/p>/);
  assert.match(await read(root, "404.html"), /noindex/);
  const feed = await read(root, "feed.xml");
  assert.match(feed, /<id>tag:t\.blog,2026-01-01:01-01-2026-1<\/id>/);
  assert.match(feed, /First &amp;amp; best\./); // HTML content, escaped once more for XML
  assert.doesNotMatch(feed, /WIP/);
  assert.match(await read(root, "sitemap.xml"), /<loc>https:\/\/t\.blog\/second\/<\/loc><lastmod>2026-01-02<\/lastmod>/);
  assert.match(await read(root, "robots.txt"), /Sitemap: https:\/\/t\.blog\/sitemap\.xml/);
  assert.equal(await read(root, "CNAME"), "t.blog\n");

  // a second build is a no-op for slugs.json
  const second = await build({ root, log });
  assert.equal(second.registryChanged, false);

  // drafts appear only in preview builds, and are never recorded
  await build({ root, log, drafts: true });
  assert.match(await read(root, "draft/index.html"), /draft-banner/);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "slugs.json"), "utf8"))["04-01-2026-1"], undefined);
});

test("series and contents", async () => {
  const sections = ["One", "Two", "Three", "Four"].map((h) => `## ${h}\n\nText.`).join("\n\n");
  const root = await fixture({
    "posts_raw/01-01-2026-1.txt": "Title: Part A\nSeries: Why Bihar\n\nFirst.",
    "posts_raw/02-01-2026-1.txt": `Title: Part B\nSeries: Why Bihar\n\n${sections}\n\nSee [notes](#notes).[^x]\n\n[^x]: A note.`,
    "posts_raw/03-01-2026-1.txt": "Title: Unrelated\n\n## Only\n\nOne section.",
  });
  await build({ root, log: () => {} });
  const b = await read(root, "part-b/index.html");
  assert.match(b, /Part 2 of 2 in <a href="#series">Why Bihar<\/a>/);
  assert.match(b, /<li><a href="\/part-a\/">Part A<\/a><\/li><li><span aria-current="page">Part B<\/span><\/li>/);
  assert.match(b, /<nav class="toc"[^>]*><h2 id="toc-label">Contents<\/h2><ol><li><a href="#one">One<\/a><\/li>/);
  assert.match(await read(root, "part-a/index.html"), /Part 1 of 2/);
  assert.doesNotMatch(await read(root, "part-a/index.html"), /class="toc"/); // short essays get no contents
  const unrelated = await read(root, "unrelated/index.html");
  assert.doesNotMatch(unrelated, /series-note|class="toc"/);
  // feed readers get absolute links for in-page anchors
  assert.match(await read(root, "feed.xml"), /href=&quot;https:\/\/t\.blog\/part-b\/#notes&quot;/);
});

test("longer essays show reading time", async () => {
  const words = Array.from({ length: 700 }, (_, i) => `word${i}`).join(" ");
  const root = await fixture({ "posts_raw/01-01-2026-1.txt": `Title: Long\n\n${words}` });
  await build({ root, log: () => {} });
  assert.match(await read(root, "long/index.html"), /<span class="reading-time">3 min read<\/span>/);
  assert.match(await read(root, "index.html"), /3 min read/);
});

test("search engines: name in titles, author links, valid structured data", async () => {
  const root = await fixture({
    "site.config.json": JSON.stringify({ title: "t.blog", url: "https://t.blog", author: "A Writer", description: "D", profiles: ["https://github.com/a"] }),
    "posts_raw/01-01-2026-1.txt": "Title: One </script> two\n\nBody text here.",
    "posts_raw/02-01-2026-1.txt": "Title: Draft\nStatus: draft\n\nWIP.",
  });
  await build({ root, log: () => {}, drafts: true });
  const ld = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);

  const home = await read(root, "index.html");
  assert.match(home, /<title>t\.blog · A Writer<\/title>/);
  assert.match(home, /<link rel="me" href="https:\/\/github\.com\/a">/);
  assert.match(home, /<meta name="author" content="A Writer">/);
  const [site, person] = ld(home)["@graph"];
  assert.equal(site["@type"], "WebSite");
  assert.deepEqual([person["@type"], person.name, person.url, person.sameAs], ["Person", "A Writer", "https://t.blog/about/", ["https://github.com/a"]]);

  const post = await read(root, "one-script-two/index.html");
  assert.doesNotMatch(post, /<\/script> two/); // a title can never break out of the JSON block
  const [article] = ld(post)["@graph"];
  assert.equal(article["@type"], "BlogPosting");
  assert.equal(article.headline, "One </script> two");
  assert.equal(article.datePublished, "2026-01-01");
  assert.equal(article.author.name, "A Writer");

  const about = await read(root, "about/index.html");
  assert.match(about, /<title>About · A Writer<\/title>/);
  assert.equal(ld(about)["@graph"][0]["@type"], "ProfilePage");

  assert.doesNotMatch(await read(root, "draft/index.html"), /application\/ld\+json/); // drafts carry no structured data
});

test("content control: AI crawler rules, data-mining opt-out, hidden email", async () => {
  const email = "someone@example.org";
  const root = await fixture({
    "site.config.json": JSON.stringify({
      title: "t.blog", url: "https://t.blog", author: "A", description: "D",
      contact: encodeEmail(email),
      crawlers: { blocked: ["GPTBot", "ClaudeBot"], limited: ["OAI-SearchBot"], limitedAllow: ["/$", "/about/"] },
    }),
    "pages_raw/about.txt": "Title: About\n\nWrite to me: {{email}}",
    "posts_raw/01-01-2026-1.txt": "Title: Essay\n\nText.",
  });
  await build({ root, log: () => {} });

  const robots = await read(root, "robots.txt");
  assert.match(robots, /User-agent: \*\nAllow: \/\n/); // search engines see everything
  assert.match(robots, /User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: \/\n/);
  assert.match(robots, /User-agent: OAI-SearchBot\nAllow: \/\$\nAllow: \/about\/\nDisallow: \/\n/);
  assert.deepEqual(JSON.parse(await read(root, ".well-known/tdmrep.json")), [{ location: "/*", "tdm-reservation": 1 }]);

  const about = await read(root, "about/index.html");
  assert.match(about, /<meta name="tdm-reservation" content="1">/);
  assert.match(about, /<meta name="robots" content="noai, noimageai">/);
  assert.match(about, /<span class="email" data-x="[0-9a-f]+"><button type="button" class="email-reveal" hidden>/);
  assert.match(about, /<script type="module" src="\/js\/contact\.js\?v=/);

  // The address never appears in any built file, in any common form.
  const files = await fs.readdir(path.join(root, "dist"), { recursive: true });
  for (const f of files) {
    const full = path.join(root, "dist", f);
    if ((await fs.stat(full)).isDirectory()) continue;
    const text = await fs.readFile(full, "utf8");
    assert.ok(!text.includes("someone") && !text.includes("example.org"), `email leaked into ${f}`);
  }
  assert.match(await read(root, "404.html"), /<meta name="robots" content="noindex, noai, noimageai">/);
});

test("the email encoder round-trips with the in-browser decoder", async () => {
  const src = await fs.readFile(new URL("../src/contact.js", import.meta.url), "utf8");
  const key = src.match(/const KEY = "([^"]+)"/)[1];
  const decode = (hex) => hex.match(/../g).reverse().map((h, i) => String.fromCharCode(parseInt(h, 16) ^ key.charCodeAt(i % key.length))).join("");
  for (const addr of ["a@b.co", "harsh.v+blog@example.com"]) assert.equal(decode(encodeEmail(addr)), addr);
});

test("{{email}} without a configured contact fails the build", async () => {
  const root = await fixture({ "pages_raw/contact.txt": "Title: Contact\n\n{{email}}" });
  await assert.rejects(build({ root, log: () => {} }), /no "contact"/);
});

test("drafts/ is local-only: previewed with --drafts, ignored by the real build", async () => {
  const root = await fixture({
    "posts_raw/01-01-2026-1.txt": "Title: Live\n\nPublished.",
    "drafts/02-01-2026-1.txt": "Title: Wip\n\nNot yet.",
    "drafts/03-01-2026-1.txt": "Titel: typo in a half-written draft\n\nBroken.",
  });
  // A broken draft never blocks publishing: the production build doesn't read drafts/.
  await build({ root, log: () => {} });
  assert.equal(await has(root, "wip/index.html"), false);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "slugs.json"), "utf8"))["02-01-2026-1"], undefined);
  // The preview build reads drafts/ and reports problems in them.
  await assert.rejects(build({ root, log: () => {}, drafts: true }), /unknown header "Titel:"/);
  await fs.rm(path.join(root, "drafts/03-01-2026-1.txt"));
  await build({ root, log: () => {}, drafts: true });
  assert.match(await read(root, "wip/index.html"), /draft-banner/);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "slugs.json"), "utf8"))["02-01-2026-1"], undefined);
});

test("the same post name in drafts/ and posts_raw/ is an error", async () => {
  const root = await fixture({ "posts_raw/01-01-2026-1.txt": "Title: A\n\nx", "drafts/01-01-2026-1.txt": "Title: B\n\ny" });
  await assert.rejects(build({ root, log: () => {}, drafts: true }), /also exists in posts_raw/);
});

test("new drafts go to drafts/; publishing moves them to posts_raw/ with the publish date", async () => {
  const root = await fixture({ "posts_raw/18-10-2026-1.txt": "Title: Earlier today\n\nx" });
  const day = new Date(2026, 9, 18, 21, 0); // 18 Oct 2026, local time

  const file = await createDraft(root, "Lamps", day);
  assert.equal(path.relative(root, file).replace(/\\/g, "/"), "drafts/18-10-2026-2.txt"); // skips the taken number
  await fs.writeFile(file, "Title: Lamps\nDate: 2026-10-18\nStatus: draft\nSeries: Light\n\nBody.\n");

  // Published three days later: renamed to that day, Date updated, Status dropped.
  const dest = await publishDraft(root, "18-10-2026-2", { now: new Date(2026, 9, 21, 9, 0) });
  assert.equal(path.basename(dest), "21-10-2026-1.txt");
  assert.equal(await fs.readFile(dest, "utf8"), "Title: Lamps\nDate: 2026-10-21\nSeries: Light\n\nBody.\n");
  assert.equal(await fs.access(file).then(() => true, () => false), false);

  // --keep-date keeps the draft's own date.
  const kept = await createDraft(root, "Old idea", day);
  assert.equal(path.basename(await publishDraft(root, path.basename(kept), { keepDate: true })), "18-10-2026-2.txt");

  // Missing or broken drafts are refused, and a broken draft stays where it is.
  await assert.rejects(publishDraft(root, "01-01-2030-1"), /No draft named/);
  await fs.writeFile(path.join(root, "drafts/19-10-2026-1.txt"), "Titel: oops\n\nx");
  await assert.rejects(publishDraft(root, "19-10-2026-1"), /unknown header/);
  assert.equal(await fs.access(path.join(root, "drafts/19-10-2026-1.txt")).then(() => true, () => false), true);
});

test("the example essay in examples/ stays valid", async () => {
  const text = await fs.readFile(new URL("../examples/long-essay.txt", import.meta.url), "utf8");
  const post = parsePost(text, "16-10-2026-1.txt");
  assert.equal(post.draft, true);
  assert.match(post.content, /<table>/);
  assert.match(post.content, /class="footnotes"/);
});

test("sidebar: hello, blogs I read, archive by year with the current post marked", async () => {
  const root = await fixture({
    "site.config.json": JSON.stringify({
      title: "t.blog", url: "https://t.blog", author: "A", description: "D",
      sidebar: { intro: "Views are *mine* <b>.", blogroll: [{ name: "Naval", url: "https://nav.al/" }] },
    }),
    "posts_raw/01-01-2025-1.txt": "Title: Old\n\nx",
    "posts_raw/01-01-2026-1.txt": "Title: New\n\ny",
    "posts_raw/02-01-2026-1.txt": "Title: Newer\n\nz",
    "drafts/03-01-2026-1.txt": "Title: Secret draft\n\nw",
  });
  await build({ root, log: () => {}, drafts: true });

  const home = await read(root, "index.html");
  // after the essay column in the page, so phones show it below the essay
  assert.ok(home.indexOf("</main>") < home.indexOf('<aside class="sidebar"'));
  assert.match(home, /<h2 id="side-hi">Hi<\/h2>\s*<p>Views are <em>mine<\/em> &lt;b&gt;\.<\/p>\s*<p><a href="\/about\/">More about me<\/a><\/p>/);
  assert.match(home, /<li><a href="https:\/\/nav\.al\/" rel="noopener">Naval<\/a><\/li>/);
  assert.match(home, /<details open><summary>2026 <span class="count">\(2\)<\/span><\/summary>/);
  assert.match(home, /<details><summary>2025 <span class="count">\(1\)<\/span><\/summary>/);
  assert.doesNotMatch(home.slice(home.indexOf("<aside")), /Secret draft/); // drafts never listed

  // On a post, its year is open and the post is marked as the current page.
  const old = await read(root, "old/index.html");
  assert.match(old, /<details open><summary>2025/);
  assert.match(old, /<a href="\/old\/" aria-current="page">Old<\/a>/);
});

test("build fails loudly on a broken post", async () => {
  const root = await fixture({ "posts_raw/01-01-2026-1.txt": "Title: T\nDate: 2026-01-02\n\nB" });
  await assert.rejects(build({ root, log: () => {} }), /does not match the filename/);
});

test("page filenames must be URL-safe", async () => {
  const root = await fixture({ "pages_raw/About Me.txt": "Title: A\n\nB" });
  await assert.rejects(build({ root, log: () => {} }), /page filenames must be lowercase/);
});

// ---------------------------------------------------------------- house style

const STYLE = { lowercaseFrom: "2026-10-24", keepCapitalized: ["Gandhi", "Bihar"] };

test("style: sentence starts are lowercased, names keep their capitals", () => {
  const r = lowercaseBody("The earth is round. In Bihar, I wrote. Gandhi walked.\n\nPatna is old. Patna again, in Patna.", STYLE);
  assert.equal(r.text, "the earth is round. in Bihar, I wrote. Gandhi walked.\n\nPatna is old. Patna again, in Patna.");
  assert.deepEqual(r.changes, ["The → the", "In → in"]);
});

test("style: unknown words are kept and reported, never guessed", () => {
  const r = lowercaseBody("Zorblax rules here.", STYLE);
  assert.equal(r.text, "Zorblax rules here.");
  assert.deepEqual(r.unsure, ["Zorblax"]);
  // Seen in lowercase elsewhere in the post: an ordinary word.
  assert.equal(lowercaseBody("Escalators hum. we ride escalators.", STYLE).text, "escalators hum. we ride escalators.");
});

test("style: quotes, links, code, block quotes, tables, comments, acronyms and wrapped lines are left alone", () => {
  const src = [
    '"The quote stays." [The link](/x/) stays.',
    "> The block quote stays.",
    "| The | table |",
    "|---|---|",
    "| x | y |",
    "<!-- The comment stays. -->",
    "LLMs are new. `The code` stays.",
    "a line that wraps before the",
    "Word on the next line.",
    "## The heading goes lower",
    "- The list item goes lower",
  ].join("\n");
  const out = lowercaseBody(src, STYLE).text.split("\n");
  assert.equal(out[0], '"The quote stays." [The link](/x/) stays.');
  assert.equal(out[1], "> The block quote stays.");
  assert.equal(out[2], "| The | table |");
  assert.equal(out[5], "<!-- The comment stays. -->");
  assert.equal(out[6], "LLMs are new. `The code` stays.");
  assert.equal(out[8], "Word on the next line.");
  assert.equal(out[9], "## the heading goes lower");
  assert.equal(out[10], "- the list item goes lower");
});

test("style: applies from the cutoff date, and Case: overrides it", () => {
  const p = (text, file) => parsePost(text, file, { style: STYLE });
  assert.equal(p("Title: The old one\n\nThe body.", "23-10-2026-1.txt").title, "The old one");
  const fresh = p("Title: The new one\nDescription: The gist.\n\nThe body. In Bihar.", "24-10-2026-1.txt");
  assert.equal(fresh.title, "the new one");
  assert.equal(fresh.description, "the gist.");
  assert.equal(fresh.content, "<p>the body. in Bihar.</p>");
  assert.equal(p("Title: The new one\nCase: standard\n\nThe body.", "24-10-2026-1.txt").title, "The new one");
  assert.equal(p("Title: The old one\nCase: lower\n\nThe body.", "01-01-2020-1.txt").title, "the old one");
  assert.throws(() => p("Title: x\nCase: upper\n\ny", "24-10-2026-1.txt"), /"Case:" must be/);
  // Without a style config, nothing changes.
  assert.equal(post("Title: The one\n\nThe body.", "24-10-2026-1.txt").title, "The one");
});

test("style: publishing rewrites the draft file itself", async () => {
  const styled = styleSource("Title: The lamp\nCase: lower\n\nThe flame. In Bihar.\n", "2020-01-01", null);
  assert.equal(styled.text, "Title: the lamp\nCase: lower\n\nthe flame. in Bihar.\n");
  assert.equal(styleSource("Title: The lamp\n\nThe flame.\n", "2026-10-23", STYLE).text, "Title: The lamp\n\nThe flame.\n");

  const root = await fixture({ "site.config.json": JSON.stringify({ title: "t", url: "https://t.blog/", author: "A", description: "D", style: STYLE }) });
  await fs.mkdir(path.join(root, "drafts"));
  await fs.writeFile(path.join(root, "drafts/20-10-2026-1.txt"), "Title: The lamp\n\nThe flame flickers. Zorblax.\n");
  let report;
  const dest = await publishDraft(root, "20-10-2026-1", { now: new Date(2026, 9, 25, 9, 0), report: (r) => (report = r) });
  assert.equal(await fs.readFile(dest, "utf8"), "Title: the lamp\n\nthe flame flickers. Zorblax.\n");
  assert.deepEqual(report.unsure, ["Zorblax"]);
});

// ---------------------------------------------------------------- reader paths

test("related essays: listed after the essay, by slug, old slug or id; bad refs fail", async () => {
  const files = {
    "posts_raw/01-01-2026-1.txt": "Title: Lamp\n\nLight.",
    "posts_raw/02-01-2026-1.txt": "Title: Wick\nSlug: wick-new\n\nThread.",
    "posts_raw/03-01-2026-1.txt": "Title: Oil\nRelated: lamp, wick-old, 01-01-2026-1\n\nFuel.",
    "slugs.json": JSON.stringify({ "01-01-2026-1": ["lamp"], "02-01-2026-1": ["wick-new", "wick-old"] }),
  };
  const root = await fixture(files);
  await build({ root, log: () => {} });
  const html = await read(root, "oil/index.html");
  assert.match(html, /<nav class="related" aria-labelledby="related-label"><h2 id="related-label">Read these next<\/h2>/);
  assert.match(html, /href="\/lamp\/">Lamp<\/a>.*href="\/wick-new\/">Wick<\/a>/s);
  const related = html.match(/<nav class="related"[\s\S]*?<\/nav>/)[0];
  assert.equal(related.match(/href="\/lamp\/"/g).length, 1); // listed once even if named twice
  assert.doesNotMatch(await read(root, "lamp/index.html"), /class="related"/);

  for (const [ref, msg] of [["nope", /not a published essay/], ["oil", /itself/]]) {
    const bad = await fixture({ ...files, "posts_raw/03-01-2026-1.txt": `Title: Oil\nRelated: ${ref}\n\nFuel.` });
    await assert.rejects(build({ root: bad, log: () => {} }), msg);
  }
  const draftRef = await fixture({ ...files, "posts_raw/04-01-2026-1.txt": "Title: Soon\nStatus: draft\n\nx", "posts_raw/03-01-2026-1.txt": "Title: Oil\nRelated: 04-01-2026-1\n\nFuel." });
  await assert.rejects(build({ root: draftRef, log: () => {} }), /not a published essay/);
});

test("start here: page, nav link, home pointer and sitemap; only when configured", async () => {
  const cfg = { title: "t.blog", url: "https://t.blog/", author: "A", description: "D", startHere: { intro: "Begin *here*.", essays: ["lamp"] } };
  const root = await fixture({ "site.config.json": JSON.stringify(cfg), "posts_raw/01-01-2026-1.txt": "Title: Lamp\nDescription: About light.\n\nLight." });
  await build({ root, log: () => {} });
  const page = await read(root, "start-here/index.html");
  assert.match(page, /<h1>Start here<\/h1>/);
  assert.match(page, /<em>here<\/em>/);
  assert.match(page, /<a href="\/lamp\/">Lamp<\/a><\/h2>\s*<p class="excerpt">About light.<\/p>/);
  assert.match(page, /href="\/start-here\/" aria-current="page"/);
  assert.match(await read(root, "index.html"), /class="start-pointer">.*href="\/start-here\/"/);
  assert.match(await read(root, "sitemap.xml"), /https:\/\/t.blog\/start-here\//);

  const plain = await fixture({ "posts_raw/01-01-2026-1.txt": "Title: Lamp\n\nLight." });
  await build({ root: plain, log: () => {} });
  assert.equal(await has(plain, "start-here/index.html"), false);
  assert.doesNotMatch(await read(plain, "index.html"), /start-here/);

  const bad = await fixture({ "site.config.json": JSON.stringify({ ...cfg, startHere: { essays: ["gone"] } }), "posts_raw/01-01-2026-1.txt": "Title: Lamp\n\nLight." });
  await assert.rejects(build({ root: bad, log: () => {} }), /startHere.*gone/s);
});

test("the real repository builds", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = await fs.mkdtemp(path.join(root, ".test-dist-"));
  const registry = await fs.readFile(path.join(root, "slugs.json"), "utf8");
  try {
    await build({ root, outDir, log: () => {} });
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
    await fs.writeFile(path.join(root, "slugs.json"), registry); // tests never modify the repo
  }
});
