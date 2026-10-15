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
  assert.match(one, /class="end-mark"><svg class="flame"/);
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
  assert.doesNotMatch(home, /old-one/);
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

test("build fails loudly on a broken post", async () => {
  const root = await fixture({ "posts_raw/01-01-2026-1.txt": "Title: T\nDate: 2026-01-02\n\nB" });
  await assert.rejects(build({ root, log: () => {} }), /does not match the filename/);
});

test("page filenames must be URL-safe", async () => {
  const root = await fixture({ "pages_raw/About Me.txt": "Title: A\n\nB" });
  await assert.rejects(build({ root, log: () => {} }), /page filenames must be lowercase/);
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
