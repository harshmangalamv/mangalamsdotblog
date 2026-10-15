// Scrambles an email address for site.config.json → "contact", so the address
// never sits in the public repository or the built pages as plain text.
//
//   npm run encode-email -- you@example.com
//
// The matching decoder is src/contact.js (same KEY). This is obfuscation, not
// encryption: it stops harvesters and casual scraping, not a determined person.

export const KEY = "neel";

export function encodeEmail(address) {
  return [...address]
    .map((c, i) => (c.charCodeAt(0) ^ KEY.charCodeAt(i % KEY.length)).toString(16).padStart(2, "0"))
    .reverse()
    .join("");
}

if (process.argv[1]?.endsWith("encode-email.mjs")) {
  const address = process.argv[2];
  if (!address || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    console.error('Usage: npm run encode-email -- you@example.com');
    process.exit(1);
  }
  console.log(`Put this in site.config.json as "contact":\n${encodeEmail(address)}`);
}
