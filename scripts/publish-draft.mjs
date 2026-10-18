// Moves a draft from drafts/ into posts_raw/ so it goes live on the next push.
// The post gets today's date (the day it is published) unless --keep-date is given.
//
//   npm run publish-draft -- 18-10-2026-1
//   npm run publish-draft -- 18-10-2026-1 --keep-date

import path from "node:path";
import { publishDraft } from "./lib/drafts.mjs";

const args = process.argv.slice(2);
const keepDate = args.includes("--keep-date");
const name = args.find((a) => !a.startsWith("--"));
if (!name) {
  console.error("Usage: npm run publish-draft -- <draft name, e.g. 18-10-2026-1> [--keep-date]");
  process.exit(1);
}

try {
  const dest = await publishDraft(process.cwd(), name, { keepDate });
  const rel = path.relative(process.cwd(), dest);
  console.log(`Published to ${rel}
Next: npm run build   (records its permanent URL in slugs.json)
Then: git add ${rel.replace(/\\/g, "/")} slugs.json && git commit -m "New post" && git push`);
} catch (err) {
  console.error(`Not published: ${err.message}`);
  process.exit(1);
}
