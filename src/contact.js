// Reveals the email address only when a person clicks "Show email address".
// The address is never in the page as text or as a mailto: link, so scrapers,
// harvesters and AI crawlers that read the HTML do not see it. It is stored
// scrambled (scripts/encode-email.mjs) and assembled here, in the browser.

const KEY = "neel";

const decode = (hex) =>
  (hex.match(/../g) || [])
    .reverse()
    .map((h, i) => String.fromCharCode(parseInt(h, 16) ^ KEY.charCodeAt(i % KEY.length)))
    .join("");

for (const holder of document.querySelectorAll(".email[data-x]")) {
  const button = holder.querySelector("button");
  if (!button) continue;
  button.hidden = false;
  button.addEventListener("click", () => {
    const address = decode(holder.dataset.x);
    const link = document.createElement("a");
    link.href = `mailto:${address}`;
    link.textContent = address;
    holder.replaceChildren(link);
    link.focus();
  });
}
