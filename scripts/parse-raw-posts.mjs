import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "posts_raw");
const DATA_DIR = path.join(ROOT, "data");

function parseArgs(argv) {
  const args = { all: false, file: null };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--all") {
      args.all = true;
      continue;
    }

    if (token === "--file") {
      args.file = argv[i + 1] || null;
      i += 1;
      continue;
    }
  }

  return args;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeBody(rawBody) {
  const normalized = rawBody.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.replace(/\n+/g, " "))
    .map((chunk) => chunk.replace(/[\t ]+/g, " ").trim())
    .filter(Boolean);

  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}

function parseRawPost(content, filename) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  let title = "";
  let date = "";
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      break;
    }

    if (line.toLowerCase().startsWith("title:")) {
      title = line.slice(6).trim();
    } else if (line.toLowerCase().startsWith("date:")) {
      date = line.slice(5).trim();
    }

    index += 1;
  }

  if (!title) {
    throw new Error(`Missing 'Title:' in ${filename}`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Missing or invalid 'Date:' (YYYY-MM-DD) in ${filename}`);
  }

  const body = lines.slice(index).join("\n");
  const html = normalizeBody(body);

  if (!html) {
    throw new Error(`Body is empty in ${filename}`);
  }

  return { title, date, content: html };
}

async function listRawFiles() {
  const entries = await fs.readdir(RAW_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.txt$|\.md$/i.test(name));
}

function toDataFilename(rawFilename) {
  const base = rawFilename.replace(/\.[^.]+$/, "");
  if (!/^\d{2}-\d{2}-\d{4}-\d+$/.test(base)) {
    throw new Error(`Raw filename must be dd-mm-yyyy-N: ${rawFilename}`);
  }

  return `${base}.json`;
}

async function processRawFile(rawFilename) {
  const rawPath = path.join(RAW_DIR, rawFilename);
  const outFilename = toDataFilename(rawFilename);
  const outPath = path.join(DATA_DIR, outFilename);

  const rawText = await fs.readFile(rawPath, "utf8");
  const parsed = parseRawPost(rawText, rawFilename);

  await fs.writeFile(outPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return outFilename;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.all && !args.file) {
    throw new Error("Use --all or --file <posts_raw\\dd-mm-yyyy-N.txt>");
  }

  const outputs = [];

  if (args.file) {
    const name = path.basename(args.file);
    outputs.push(await processRawFile(name));
  }

  if (args.all) {
    const files = await listRawFiles();
    for (const file of files) {
      outputs.push(await processRawFile(file));
    }
  }

  const unique = Array.from(new Set(outputs));
  console.log(`Generated ${unique.length} post JSON file(s).`);
  unique.forEach((file) => console.log(` - data/${file}`));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
