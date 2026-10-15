// Reads and validates source files in posts_raw/ and pages_raw/.
// Validation is strict on purpose: a build that fails loudly is better than a
// post that silently publishes with a wrong date, a lost paragraph or a typo'd header.

import { promises as fs } from "node:fs";
import path from "node:path";
import { renderBody, MarkupError } from "./markup.mjs";
import { parseIsoDate, SLUG_PATTERN, htmlToText } from "./util.mjs";

export class ContentError extends Error {}

const POST_FILENAME = /^(\d{2})-(\d{2})-(\d{4})-(\d+)\.(txt|md)$/i;
const HEADER_LINE = /^([A-Za-z][A-Za-z-]*)\s*:\s*(.*)$/;
const POST_KEYS = new Set(["title", "date", "slug", "status", "description"]);
const PAGE_KEYS = new Set(["title", "description"]);
const STATUSES = new Set(["published", "draft"]);

// Splits "Key: value" header lines from the body. The header ends at the first
// blank line, or at the first line that is not a "Key: value" pair.
export function splitHeader(text, allowedKeys, file) {
  const lines = String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const header = {};
  let i = 0;

  for (; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line === "") {
      i += 1;
      break;
    }
    const m = HEADER_LINE.exec(line);
    if (!m) break;
    const key = m[1].toLowerCase();
    if (!allowedKeys.has(key)) {
      throw new ContentError(
        `${file}: unknown header "${m[1]}:". Allowed: ${[...allowedKeys].map((k) => k[0].toUpperCase() + k.slice(1)).join(", ")}. ` +
          `(If this line is meant to be body text, put a blank line after the header.)`
      );
    }
    if (key in header) throw new ContentError(`${file}: header "${m[1]}:" appears twice.`);
    header[key] = m[2].trim();
  }

  return { header, body: lines.slice(i).join("\n") };
}

function render(body, file) {
  try {
    return renderBody(body);
  } catch (err) {
    if (err instanceof MarkupError) throw new ContentError(`${file}: ${err.message}`);
    throw err;
  }
}

export function parsePost(text, filename) {
  const m = POST_FILENAME.exec(filename);
  if (!m) {
    throw new ContentError(`${filename}: post filenames must be dd-mm-yyyy-N.txt (e.g. 05-09-2026-1.txt).`);
  }
  const [, dd, mm, yyyy, n] = m;
  const fileDate = `${yyyy}-${mm}-${dd}`;
  if (!parseIsoDate(fileDate)) throw new ContentError(`${filename}: the filename is not a real calendar date.`);

  const { header, body } = splitHeader(text, POST_KEYS, filename);

  if (!header.title) throw new ContentError(`${filename}: missing "Title:" header.`);

  if (header.date !== undefined && header.date !== fileDate) {
    throw new ContentError(
      `${filename}: "Date: ${header.date}" does not match the filename date (${fileDate}). ` +
        `The filename is the source of truth; fix one of them.`
    );
  }

  const status = (header.status || "published").toLowerCase();
  if (!STATUSES.has(status)) throw new ContentError(`${filename}: "Status:" must be "published" or "draft".`);

  if (header.slug !== undefined && !SLUG_PATTERN.test(header.slug)) {
    throw new ContentError(`${filename}: "Slug: ${header.slug}" must be lowercase a-z, 0-9 and single hyphens.`);
  }

  const content = render(body, filename);
  if (!content.trim()) throw new ContentError(`${filename}: the body is empty.`);

  return {
    id: filename.replace(/\.(txt|md)$/i, ""),
    title: header.title,
    date: fileDate,
    seq: Number(n),
    slug: header.slug || null,
    draft: status === "draft",
    description: header.description || null,
    content,
    text: htmlToText(content),
  };
}

export function parsePage(text, filename) {
  const { header, body } = splitHeader(text, PAGE_KEYS, filename);
  if (!header.title) throw new ContentError(`${filename}: missing "Title:" header.`);
  const content = render(body, filename);
  return { title: header.title, description: header.description || null, content, text: htmlToText(content) };
}

async function listSourceFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && /\.(txt|md)$/i.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export async function readPosts(root) {
  const dir = path.join(root, "posts_raw");
  const posts = [];
  const errors = [];
  for (const file of await listSourceFiles(dir)) {
    try {
      posts.push(parsePost(await fs.readFile(path.join(dir, file), "utf8"), file));
    } catch (err) {
      if (err instanceof ContentError) errors.push(err.message);
      else throw err;
    }
  }
  if (errors.length) throw new ContentError(errors.join("\n"));

  // Newest first; for the same day, the higher post number first.
  posts.sort((a, b) => (a.date === b.date ? b.seq - a.seq : a.date < b.date ? 1 : -1));
  return posts;
}

export async function readPages(root) {
  const dir = path.join(root, "pages_raw");
  const pages = {};
  for (const file of await listSourceFiles(dir)) {
    const name = file.replace(/\.(txt|md)$/i, "").toLowerCase();
    pages[name] = parsePage(await fs.readFile(path.join(dir, file), "utf8"), file);
  }
  return pages;
}
