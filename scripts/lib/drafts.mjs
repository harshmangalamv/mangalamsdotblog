// Drafts live in drafts/ (gitignored, local only). Publishing moves a draft into
// posts_raw/ (tracked), renamed to the publish date unless keepDate is set.

import { promises as fs } from "node:fs";
import path from "node:path";
import { parsePost } from "./content.mjs";

const pad = (n) => String(n).padStart(2, "0");

// Local calendar date of the machine you write on.
export function localDate(now = new Date()) {
  return { dd: pad(now.getDate()), mm: pad(now.getMonth() + 1), yyyy: String(now.getFullYear()) };
}

async function names(dir) {
  try {
    return new Set(await fs.readdir(dir));
  } catch (err) {
    if (err.code === "ENOENT") return new Set();
    throw err;
  }
}

// Next free dd-mm-yyyy-N base name across the given folders.
async function nextFree(dirs, { dd, mm, yyyy }) {
  const taken = new Set();
  for (const dir of dirs) for (const n of await names(dir)) taken.add(n.replace(/\.(txt|md)$/i, ""));
  let n = 1;
  while (taken.has(`${dd}-${mm}-${yyyy}-${n}`)) n += 1;
  return `${dd}-${mm}-${yyyy}-${n}`;
}

export async function createDraft(root, title, now = new Date()) {
  const draftsDir = path.join(root, "drafts");
  await fs.mkdir(draftsDir, { recursive: true });
  const d = localDate(now);
  const base = await nextFree([draftsDir, path.join(root, "posts_raw")], d);
  const file = path.join(draftsDir, `${base}.txt`);
  await fs.writeFile(file, `Title: ${title}\n\nWrite here. Leave a blank line between paragraphs.\n`, { flag: "wx" });
  return file;
}

function resolveDraft(root, name) {
  const base = path.basename(String(name)).replace(/\.(txt|md)$/i, "");
  return { base, candidates: [`${base}.txt`, `${base}.md`].map((f) => path.join(root, "drafts", f)) };
}

// Rewrites the header for publishing: drops "Status:", sets "Date:" if present.
function publishHeader(text, isoDate) {
  const lines = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let inHeader = true;
  for (const line of lines) {
    if (inHeader && line.trim() === "") inHeader = false;
    if (inHeader && /^status\s*:/i.test(line.trim())) continue;
    if (inHeader && /^date\s*:/i.test(line.trim())) {
      out.push(`Date: ${isoDate}`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

export async function publishDraft(root, name, { now = new Date(), keepDate = false } = {}) {
  const { base, candidates } = resolveDraft(root, name);
  let source = null;
  for (const c of candidates) {
    if (await fs.access(c).then(() => true, () => false)) source = c;
  }
  if (!source) throw new Error(`No draft named ${base} in drafts/.`);

  const text = await fs.readFile(source, "utf8");
  parsePost(text, path.basename(source)); // fails loudly on a broken draft

  const postsDir = path.join(root, "posts_raw");
  await fs.mkdir(postsDir, { recursive: true });
  let target;
  if (keepDate) {
    target = base;
    if ((await names(postsDir)).has(`${base}.txt`) || (await names(postsDir)).has(`${base}.md`)) {
      throw new Error(`posts_raw/ already has ${base}. Publish without --keep-date to use today's date.`);
    }
  } else {
    target = await nextFree([postsDir], localDate(now));
  }
  const [dd, mm, yyyy] = target.split("-");
  const published = publishHeader(text, `${yyyy}-${mm}-${dd}`);
  parsePost(published, `${target}.txt`); // the published file must be valid too

  const dest = path.join(postsDir, `${target}.txt`);
  await fs.writeFile(dest, published, { flag: "wx" });
  await fs.rm(source);
  return dest;
}
