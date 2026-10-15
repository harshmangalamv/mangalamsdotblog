// Creates a new draft in posts_raw/ named with today's date and the next free number.
//
//   npm run new -- "My title"

import { promises as fs } from "node:fs";
import path from "node:path";

const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('Usage: npm run new -- "Post title"');
  process.exit(1);
}

const now = new Date(); // local date of the machine you write on
const pad = (n) => String(n).padStart(2, "0");
const dd = pad(now.getDate());
const mm = pad(now.getMonth() + 1);
const yyyy = now.getFullYear();

const dir = path.resolve("posts_raw");
await fs.mkdir(dir, { recursive: true });
const existing = new Set(await fs.readdir(dir));

let n = 1;
while (existing.has(`${dd}-${mm}-${yyyy}-${n}.txt`) || existing.has(`${dd}-${mm}-${yyyy}-${n}.md`)) n += 1;

const file = path.join(dir, `${dd}-${mm}-${yyyy}-${n}.txt`);
await fs.writeFile(
  file,
  `Title: ${title}\nDate: ${yyyy}-${mm}-${dd}\nStatus: draft\n\nWrite here. Leave a blank line between paragraphs.\n`,
  { flag: "wx" }
);
console.log(`Created ${path.relative(process.cwd(), file)} (Status: draft — delete that line to publish)`);
