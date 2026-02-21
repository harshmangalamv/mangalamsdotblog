import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const PAGE_SIZE = 10;
const PAGE_FILE_PREFIX = "blogFeed";

function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toExcerpt(html, max = 280) {
  const text = stripHtml(html);
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function parseDate(value) {
  if (!value) return null;

  const iso = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
  const dmy = /^([0-9]{2})-([0-9]{2})-([0-9]{4})$/;

  let y;
  let m;
  let d;

  const isoMatch = String(value).match(iso);
  if (isoMatch) {
    y = Number(isoMatch[1]);
    m = Number(isoMatch[2]);
    d = Number(isoMatch[3]);
  }

  const dmyMatch = String(value).match(dmy);
  if (dmyMatch) {
    d = Number(dmyMatch[1]);
    m = Number(dmyMatch[2]);
    y = Number(dmyMatch[3]);
  }

  if (!y || !m || !d) return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function dateFromFilename(id) {
  // New convention: dd-mm-yyyy-N
  const newFormat = id.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4})-[0-9]+$/);
  if (newFormat) {
    return `${newFormat[3]}-${newFormat[2]}-${newFormat[1]}`;
  }

  // Backward compatibility: yyyy-mm-dd-...
  const legacyFormat = id.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})-/);
  if (legacyFormat) {
    return `${legacyFormat[1]}-${legacyFormat[2]}-${legacyFormat[3]}`;
  }

  return null;
}

async function readPosts() {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .filter((name) => !/^blogIndex\.page\.[0-9]+\.json$/.test(name))
    .filter((name) => !/^blogFeed\.page\.[0-9]+\.json$/.test(name))
    .filter((name) => !/^blogFeed\..+\.page\.[0-9]+\.json$/.test(name))
    .filter((name) => !["blogIndex.json", "blogIndex.meta.json", "blogSlugMap.json"].includes(name));

  const posts = [];

  for (const file of files) {
    const id = file.replace(/\.json$/, "");
    const filePath = path.join(DATA_DIR, file);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed.title || !parsed.content) {
      throw new Error(`Post file missing required fields (title/content): ${file}`);
    }

    const normalizedDate = parsed.date || dateFromFilename(id);
    if (!normalizedDate) {
      throw new Error(`Post date missing or invalid, and filename is not in supported format: ${file}`);
    }

    posts.push({
      id,
      title: parsed.title,
      date: normalizedDate,
      content: parsed.content,
    });
  }

  return posts;
}

async function writeGenerated(posts) {
  const sorted = [...posts].sort((a, b) => {
    const aTime = parseDate(a.date)?.getTime() || 0;
    const bTime = parseDate(b.date)?.getTime() || 0;

    if (aTime !== bTime) return bTime - aTime;
    return b.id.localeCompare(a.id);
  });

  const usedSlugs = new Set();
  const slugMap = {};

  const enriched = sorted.map((post) => {
    const baseSlug = slugify(post.title);
    let slug = baseSlug || post.id;
    let i = 2;

    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${i}`;
      i += 1;
    }

    usedSlugs.add(slug);
    slugMap[slug] = post.id;

    return {
      id: post.id,
      title: post.title,
      date: post.date,
      slug,
      excerpt: toExcerpt(post.content),
    };
  });

  const blogIndex = sorted.map((post) => ({
    id: post.id,
    title: post.title,
    date: post.date,
  }));

  const totalItems = enriched.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const hash = createHash("sha1")
    .update(JSON.stringify(blogIndex))
    .digest("hex")
    .slice(0, 10);
  const pageFilePrefix = `${PAGE_FILE_PREFIX}.${hash}.page`;

  for (let page = 1; page <= totalPages; page += 1) {
    const start = (page - 1) * PAGE_SIZE;
    const slice = enriched.slice(start, start + PAGE_SIZE);
    const pagePath = path.join(DATA_DIR, `${pageFilePrefix}.${page}.json`);
    await fs.writeFile(pagePath, `${JSON.stringify(slice, null, 2)}\n`, "utf8");
  }

  const meta = {
    pageSize: PAGE_SIZE,
    totalItems,
    totalPages,
    pageFilePrefix,
  };

  await fs.writeFile(path.join(DATA_DIR, "blogIndex.json"), `${JSON.stringify(blogIndex, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(DATA_DIR, "blogIndex.meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(DATA_DIR, "blogSlugMap.json"), `${JSON.stringify(slugMap, null, 2)}\n`, "utf8");

  console.log(`Generated index for ${totalItems} posts across ${totalPages} page(s).`);
}

const posts = await readPosts();
await writeGenerated(posts);

