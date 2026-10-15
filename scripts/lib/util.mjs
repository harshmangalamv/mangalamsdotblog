// Small, dependency-free helpers shared by the build, the tests and the tools.

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function decodeBasicEntities(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// ASCII-only on purpose: URLs must stay readable and stable for decades.
// Titles in other scripts (e.g. Hindi) return "" — the caller falls back to
// the post id, or the author sets an explicit `Slug:` header.
export function slugify(title) {
  return String(title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents: café -> cafe
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Dates are plain calendar days (YYYY-MM-DD). Everything is computed in UTC so
// the displayed day never shifts with the reader's or the builder's timezone.
export function parseIsoDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null; // rejects 2026-02-30 etc.
  }
  return date;
}

export function formatDateLong(iso) {
  const date = parseIsoDate(iso);
  if (!date) return String(iso);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function truncateWords(text, max) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : clean.slice(0, max);
  return `${base.replace(/[\s.,;:!?-]+$/, "")}…`;
}

// Block boundaries become spaces; inline tags (<a>, <em>, <code>...) vanish
// without leaving a gap, so "a <a>link</a>, then" stays "a link, then".
export function htmlToText(html) {
  return decodeBasicEntities(
    String(html)
      .replace(/<sup class="fn-ref"[^>]*>.*?<\/sup>/g, "")
      .replace(/<(br|hr)\b[^>]*>|<\/(p|h[1-6]|li|blockquote|figure|figcaption|ul|ol)>/gi, " ")
      .replace(/<[^>]*>/g, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}
