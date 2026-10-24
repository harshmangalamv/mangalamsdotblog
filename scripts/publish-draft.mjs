// Moves a draft from drafts/ into posts_raw/ so it goes live on the next push.
// The post gets today's date (the day it is published) unless --keep-date is given.
// It also applies the house style (sentences start in lowercase, names keep their
// capitals) to the file itself; add "Case: standard" to a post to opt out.
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
  let style = { changes: [], unsure: [] };
  const dest = await publishDraft(process.cwd(), name, { keepDate, report: (r) => (style = r) });
  if (style.changes.length) console.log(`House style: lowercased ${style.changes.length} sentence start(s): ${style.changes.join(", ")}`);
  if (style.unsure.length) {
    console.log(`Kept capitalized (names?): ${style.unsure.join(", ")}
  If one of these is an ordinary word, lowercase it by hand. If it is a name, add it to
  site.config.json -> style.keepCapitalized so it is not reported again.`);
  }
  const rel = path.relative(process.cwd(), dest);
  console.log(`Published to ${rel}
Next: npm run build   (records its permanent URL in slugs.json)
Then: git add ${rel.replace(/\\/g, "/")} slugs.json && git commit -m "New post" && git push`);
} catch (err) {
  console.error(`Not published: ${err.message}`);
  process.exit(1);
}
