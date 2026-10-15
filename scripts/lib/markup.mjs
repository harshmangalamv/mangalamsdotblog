// A deliberately small, dependency-free subset of Markdown for post bodies.
// Everything not listed here is plain text and is always HTML-escaped.
//
// Blocks (separated by one or more blank lines):
//   plain lines           -> <p> (single line breaks become spaces)
//   line ending in "\"    -> hard line break inside a paragraph (poetry)
//   # / ## Heading        -> <h2>      ### Heading -> <h3>
//                            (each heading gets an id and links to itself, so
//                             readers can share a link to one section)
//   > quoted lines        -> <blockquote>
//   - item / * item       -> <ul>      1. item -> <ol>
//   ---                   -> <hr>
//   ![alt](/assets/x.jpg) -> <figure><img></figure> (alone in its block)
// Inline:
//   [text](https://...)  **bold**  *italic*  `code`  \* (literal star)

import { escapeHtml, slugify, htmlToText } from "./util.mjs";

export class MarkupError extends Error {}

const SAFE_URL = /^(https?:\/\/|mailto:|\/|#|\.{1,2}\/)/i;

// One level of nested parentheses is allowed so Wikipedia-style URLs work:
// [Bihar](https://en.wikipedia.org/wiki/Bihar_(disambiguation))
const URL_PART = String.raw`((?:[^()\s]|\([^()\s]*\))+)`;

const INLINE_RULES = [
  { type: "escape", re: /\\([\\`*_\[\]()!#>+.-])/y },
  { type: "code", re: /`([^`\n]+)`/y },
  { type: "image", re: new RegExp(String.raw`!\[([^\]]*)\]\(` + URL_PART + String.raw`\)`, "y") },
  { type: "link", re: new RegExp(String.raw`\[([^\]]+)\]\(` + URL_PART + String.raw`\)`, "y") },
  { type: "strong", re: /\*\*(?=\S)([\s\S]*?\S)\*\*/y },
  { type: "em", re: /\*(?=[^\s*])([^*]*?[^\s*])\*/y },
];

function checkUrl(url, context) {
  if (!SAFE_URL.test(url)) {
    throw new MarkupError(
      `Unsupported link target "${url}" in "${context}". Use a full https:// URL or a /site-path.`
    );
  }
  return escapeHtml(url);
}

export function renderInline(raw, { allowLinks = true } = {}) {
  const text = String(raw);
  let out = "";
  let plain = "";
  let i = 0;

  outer: while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" || ch === "`" || ch === "!" || ch === "[" || ch === "*") {
      for (const rule of INLINE_RULES) {
        if (!allowLinks && (rule.type === "link" || rule.type === "image")) continue;
        rule.re.lastIndex = i;
        const m = rule.re.exec(text);
        if (!m) continue;

        out += escapeHtml(plain);
        plain = "";
        switch (rule.type) {
          case "escape":
            out += escapeHtml(m[1]);
            break;
          case "code":
            out += `<code>${escapeHtml(m[1])}</code>`;
            break;
          case "image":
            out += `<img src="${checkUrl(m[2], m[0])}" alt="${escapeHtml(m[1])}" loading="lazy">`;
            break;
          case "link": {
            const href = checkUrl(m[2], m[0]);
            const external = /^https?:\/\//i.test(m[2]);
            const rel = external ? ' rel="noopener"' : "";
            out += `<a href="${href}"${rel}>${renderInline(m[1], { allowLinks: false })}</a>`;
            break;
          }
          case "strong":
            out += `<strong>${renderInline(m[1], { allowLinks })}</strong>`;
            break;
          case "em":
            out += `<em>${renderInline(m[1], { allowLinks })}</em>`;
            break;
        }
        i += m[0].length;
        continue outer;
      }
    }
    plain += ch;
    i += 1;
  }

  return out + escapeHtml(plain);
}

// Joins the lines of one block: "\" at line end = hard break, else a space.
function joinLines(lines, inline = {}) {
  let html = "";
  lines.forEach((line, idx) => {
    const isLast = idx === lines.length - 1;
    const hardBreak = !isLast && /\\\s*$/.test(line);
    const content = hardBreak ? line.replace(/\\\s*$/, "") : line;
    html += renderInline(content.replace(/[\t ]+/g, " ").trim(), inline);
    if (!isLast) html += hardBreak ? "<br>\n" : " ";
  });
  return html;
}

const UL_ITEM = /^[-*]\s+/;
const OL_ITEM = /^\d+[.)]\s+/;

function renderList(lines, marker, tag) {
  const items = [];
  for (const line of lines) {
    if (marker.test(line)) items.push([line.replace(marker, "")]);
    else items[items.length - 1].push(line); // continuation of the previous item
  }
  return `<${tag}>${items.map((it) => `<li>${joinLines(it)}</li>`).join("")}</${tag}>`;
}

function renderBlock(lines, ids) {
  const first = lines[0];

  if (lines.length === 1 && /^(-{3,}|\*{3,})$/.test(first)) return "<hr>";

  const heading = /^(#{1,3})\s+(.*)$/.exec(first);
  if (heading) {
    const tag = heading[1].length === 3 ? "h3" : "h2";
    const rest = [heading[2], ...lines.slice(1)];
    // The heading itself is the link to its section, so it cannot hold other links.
    const inner = joinLines(rest);
    if (/<a |<img /.test(inner)) {
      throw new MarkupError(`Headings cannot contain links or images: "${first}". Put the link in the paragraph below.`);
    }
    const base = slugify(htmlToText(inner)) || "section";
    let id = base;
    for (let n = 2; ids.has(id); n += 1) id = `${base}-${n}`;
    ids.add(id);
    return `<${tag} id="${id}"><a class="anchor" href="#${id}">${inner}</a></${tag}>`;
  }

  if (lines.every((l) => /^>/.test(l))) {
    const inner = lines.map((l) => l.replace(/^>\s?/, ""));
    // Blank ">" lines split the quote into paragraphs.
    const paras = [];
    let cur = [];
    for (const l of inner) {
      if (l.trim() === "") {
        if (cur.length) paras.push(cur);
        cur = [];
      } else cur.push(l);
    }
    if (cur.length) paras.push(cur);
    return `<blockquote>${paras.map((p) => `<p>${joinLines(p)}</p>`).join("")}</blockquote>`;
  }

  if (UL_ITEM.test(first)) return renderList(lines, UL_ITEM, "ul");
  if (OL_ITEM.test(first)) return renderList(lines, OL_ITEM, "ol");

  if (lines.length === 1) {
    const img = new RegExp(String.raw`^!\[([^\]]*)\]\(` + URL_PART + String.raw`\)$`).exec(first);
    if (img) {
      const caption = img[1] ? `<figcaption>${renderInline(img[1], { allowLinks: false })}</figcaption>` : "";
      return `<figure><img src="${checkUrl(img[2], first)}" alt="${escapeHtml(img[1])}" loading="lazy">${caption}</figure>`;
    }
  }

  return `<p>${joinLines(lines)}</p>`;
}

export function renderBody(raw) {
  const lines = String(raw).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let cur = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (cur.length) blocks.push(cur);
      cur = [];
    } else {
      cur.push(line.trim()); // indentation carries no meaning in this format
    }
  }
  if (cur.length) blocks.push(cur);
  const ids = new Set(); // heading ids are unique within one post
  return blocks.map((b) => renderBlock(b, ids)).join("\n");
}
