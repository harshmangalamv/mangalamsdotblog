// URL registry: slugs.json maps post id -> [currentSlug, ...oldSlugs].
//
// Rules (URLs are forever):
// - A post's slug is decided once, the first time it is built, and recorded.
// - Editing the title later does NOT change the URL.
// - Setting an explicit "Slug:" header changes the URL; the old slug is kept
//   as an alias and gets a redirect page.
// - Slugs are never reused, even if the post is deleted or turned back into a draft.

import { slugify, SLUG_PATTERN } from "./util.mjs";

export class SlugError extends Error {}

export function assignSlugs(posts, registry, reserved) {
  const next = structuredClone(registry || {});
  const owner = new Map(); // slug -> id, across all ids ever registered

  for (const [id, slugs] of Object.entries(next)) {
    if (!Array.isArray(slugs) || slugs.length === 0 || !slugs.every((s) => SLUG_PATTERN.test(s))) {
      throw new SlugError(`slugs.json: entry for "${id}" must be a non-empty array of valid slugs.`);
    }
    for (const s of slugs) {
      if (owner.has(s) && owner.get(s) !== id) {
        throw new SlugError(`slugs.json: slug "${s}" is claimed by both "${owner.get(s)}" and "${id}".`);
      }
      owner.set(s, id);
    }
  }

  const isTaken = (slug, id) => reserved.has(slug) || (owner.has(slug) && owner.get(slug) !== id);

  // Oldest first, so collision suffixes (-2, -3) go to the newer post.
  const ordered = [...posts].sort((a, b) => (a.date === b.date ? a.seq - b.seq : a.date < b.date ? -1 : 1));
  const notes = [];

  for (const post of ordered) {
    const existing = next[post.id];

    if (post.slug) {
      // Explicit slug: must be free; becomes the current URL.
      if (isTaken(post.slug, post.id)) {
        const why = reserved.has(post.slug) ? "is reserved by the site" : `is already used by "${owner.get(post.slug)}"`;
        throw new SlugError(`${post.id}: "Slug: ${post.slug}" ${why}. Pick another.`);
      }
      if (!existing) {
        next[post.id] = [post.slug];
        notes.push(`registered /${post.slug}/ for ${post.id}`);
      } else if (existing[0] !== post.slug) {
        next[post.id] = [post.slug, ...existing.filter((s) => s !== post.slug)];
        notes.push(`moved ${post.id} to /${post.slug}/ (old URL /${existing[0]}/ will redirect)`);
      }
      owner.set(post.slug, post.id);
      continue;
    }

    if (existing) continue; // already registered: keep it forever

    const base = slugify(post.title) || post.id;
    let candidate = base;
    for (let i = 2; isTaken(candidate, post.id); i += 1) candidate = `${base}-${i}`;
    next[post.id] = [candidate];
    owner.set(candidate, post.id);
    notes.push(`registered /${candidate}/ for ${post.id}${base === post.id ? " (title has no ASCII letters; add a Slug: header for a nicer URL)" : ""}`);
  }

  for (const post of posts) {
    [post.slug, ...post.aliases] = next[post.id];
  }

  // Stable key order keeps diffs of slugs.json minimal.
  const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
  return { registry: sorted, notes };
}
