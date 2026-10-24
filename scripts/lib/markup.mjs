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
//   | a | b |              -> <table> (2nd line |---|--:| sets alignment)
//   |---|--:|
//   [^id]: note text      -> footnote definition, listed under "Notes" at the end
//   <!-- anything -->     -> comment, removed from the page (multi-line allowed)
// Inline:
//   [text](https://...)  **bold**  *italic*  `code`  \* (literal star)
//   [^id]                 -> numbered footnote reference

import { escapeHtml, slugify, htmlToText } from "./util.mjs";

export class MarkupError extends Error {}

const SAFE_URL = /^(https?:\/\/|mailto:|\/|#|\.{1,2}\/)/i;

// One level of nested parentheses is allowed so Wikipedia-style URLs work:
// [Bihar](https://en.wikipedia.org/wiki/Bihar_(disambiguation))
const URL_PART = String.raw`((?:[^()\s]|\([^()\s]*\))+)`;

const INLINE_RULES = [
  { type: "escape", re: /\\([\\`*_\[\]()!#>+.-])/y },
  { type: "code", re: /`([^`\n]+)`/y },
  { type: "fnref", re: /\[\^([A-Za-z0-9_-]+)\]/y },
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

// Footnote state for the post currently being rendered (null outside renderBody).
let notes = null;

function createNotes(defs) {
  const order = []; // ids in order of first reference
  const refCount = new Map();
  return {
    defs,
    order,
    ref(id) {
      if (!defs.has(id)) throw new MarkupError(`Footnote [^${id}] is used but never defined. Add a line "[^${id}]: ..." to the post.`);
      if (!refCount.has(id)) order.push(id);
      const count = (refCount.get(id) || 0) + 1;
      refCount.set(id, count);
      const n = order.indexOf(id) + 1;
      const refId = count === 1 ? `fnref-${id}` : `fnref-${id}-${count}`;
      return `<sup class="fn-ref" id="${refId}"><a href="#fn-${id}" aria-describedby="footnotes-label">${n}</a></sup>`;
    },
  };
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
          case "fnref":
            out += notes ? notes.ref(m[1]) : escapeHtml(m[0]);
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

const TABLE_SEP = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

function splitRow(line) {
  // Split on | that is not escaped as \|
  const cells = [];
  let cur = "";
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === "\\" && line[i + 1] === "|") {
      cur += "|";
      i += 1;
    } else if (line[i] === "|") {
      cells.push(cur);
      cur = "";
    } else cur += line[i];
  }
  cells.push(cur);
  if (line.startsWith("|")) cells.shift();
  if (line.trimEnd().endsWith("|") && !line.trimEnd().endsWith("\\|")) cells.pop();
  return cells.map((c) => c.trim());
}

function renderTable(lines) {
  const head = splitRow(lines[0]);
  const align = splitRow(lines[1]).map((c) => (c.endsWith(":") ? (c.startsWith(":") ? "center" : "right") : null));
  if (align.length !== head.length) {
    throw new MarkupError(`Table separator row has ${align.length} columns but the header has ${head.length}: "${lines[0]}"`);
  }
  const cell = (tag, text, i) => {
    const a = align[i] ? ` class="align-${align[i]}"` : "";
    const scope = tag === "th" ? ' scope="col"' : "";
    return `<${tag}${scope}${a}>${renderInline(text)}</${tag}>`;
  };
  const rows = lines.slice(2).map((line, r) => {
    const cells = splitRow(line);
    if (cells.length !== head.length) {
      throw new MarkupError(`Table row ${r + 1} has ${cells.length} cells but the header has ${head.length}: "${line}"`);
    }
    return `<tr>${cells.map((c, i) => cell("td", c, i)).join("")}</tr>`;
  });
  return `<div class="table-wrap"><table><thead><tr>${head.map((h, i) => cell("th", h, i)).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
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
      throw new MarkupError(`Headings cannot contain links, images or footnotes: "${first}". Put them in the paragraph below.`);
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

  if (lines.length >= 2 && lines.every((l) => l.startsWith("|")) && TABLE_SEP.test(lines[1])) {
    return renderTable(lines);
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
  let source = String(raw).replace(/\r\n?/g, "\n");
  // <!-- comments --> are notes to yourself; they never reach the page.
  if (/<!--/.test(source)) {
    const open = (source.match(/<!--/g) || []).length;
    const close = (source.match(/-->/g) || []).length;
    if (open !== close) throw new MarkupError(`A comment is not closed: every "<!--" needs a matching "-->".`);
    source = source.replace(/<!--[\s\S]*?-->/g, "");
  }
  const lines = source.split("\n");
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

  // Footnote definitions: blocks of lines starting "[^id]: ". A line that does
  // not start a new definition continues the previous one.
  const defs = new Map();
  const content = blocks.filter((block) => {
    if (!FN_DEF.test(block[0])) return true;
    let id = null;
    for (const line of block) {
      const m = FN_DEF.exec(line);
      if (m) {
        id = m[1];
        if (defs.has(id)) throw new MarkupError(`Footnote [^${id}] is defined twice.`);
        defs.set(id, [m[2]]);
      } else defs.get(id).push(line);
    }
    return false;
  });

  // Heading ids are unique within a post and never clash with ids the page itself uses.
  const ids = new Set(["main", "notes", "footnotes-label", "series", "series-label", "toc-label", "side-hi", "side-reading", "side-archive", "related-label"]);
  const previous = notes;
  notes = createNotes(defs);
  try {
    let html = content.map((b) => renderBlock(b, ids)).join("\n");
    const unused = [...defs.keys()].filter((id) => !notes.order.includes(id));
    if (unused.length) {
      throw new MarkupError(`Footnote${unused.length > 1 ? "s" : ""} ${unused.map((id) => `[^${id}]`).join(", ")} defined but never used in the text.`);
    }
    if (notes.order.length) {
      const state = notes;
      notes = null; // no footnotes inside footnotes
      const items = state.order
        .map((id) => `<li id="fn-${id}">${joinLines(state.defs.get(id))} <a class="fn-back" href="#fnref-${id}" aria-label="Back to the text">\u21A9\uFE0E</a></li>`)
        .join("\n");
      html += `\n<section class="footnotes" aria-labelledby="footnotes-label"><h2 id="notes"><span id="footnotes-label">Notes</span></h2><ol>\n${items}\n</ol></section>`;
    }
    return html;
  } finally {
    notes = previous;
  }
}

const FN_DEF = /^\[\^([A-Za-z0-9_-]+)\]:\s*(.*)$/;
