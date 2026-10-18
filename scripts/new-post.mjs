// Creates a new draft in drafts/ (local only, never committed), named with
// today's date and the next free number.
//
//   npm run new -- "My title"

import path from "node:path";
import { createDraft } from "./lib/drafts.mjs";

const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('Usage: npm run new -- "Post title"');
  process.exit(1);
}

const file = await createDraft(process.cwd(), title);
console.log(`Created ${path.relative(process.cwd(), file)}
Preview it with: npm run dev
Publish it with: npm run publish-draft -- ${path.basename(file, ".txt")}`);
