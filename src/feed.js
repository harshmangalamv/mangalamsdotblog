// Home page enhancement (the page works fully without it):
// - loads older posts as the reader approaches the end of the list;
// - on Back from a post, reloads the same pages and restores the scroll position.
// Pages are pre-rendered, escaped HTML produced by scripts/build.mjs.

const feed = document.getElementById("feed");
const end = document.querySelector(".feed-end");

if (feed && end && feed.dataset.pages) {
  const total = Number(feed.dataset.pages);
  const prefix = feed.dataset.prefix;
  const key = feed.dataset.key;
  const STATE_KEY = "mangalams:feed";
  const MARGIN = 600; // px before the end at which the next page is fetched

  let loaded = 1;
  let busy = false;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  const loadPage = async (n) => {
    const res = await fetch(`${prefix}${n}.json`);
    if (!res.ok) throw new Error(`feed page ${n}: HTTP ${res.status}`);
    const { items } = await res.json();
    feed.insertAdjacentHTML("beforeend", items.join("\n"));
    loaded = n;
  };

  const nearEnd = () => end.getBoundingClientRect().top < window.innerHeight + MARGIN;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((en) => en.isIntersecting)) loadNext();
    },
    { rootMargin: `0px 0px ${MARGIN}px 0px` }
  );

  async function loadNext() {
    if (busy || loaded >= total) return;
    busy = true;
    try {
      await loadPage(loaded + 1);
    } catch {
      // A deploy may have replaced the feed files; the "All posts" link still works.
      observer.disconnect();
      return;
    } finally {
      busy = false;
    }
    if (loaded >= total) observer.disconnect();
    else if (nearEnd()) loadNext(); // screen still not full
  }

  const readState = () => {
    try {
      return JSON.parse(sessionStorage.getItem(STATE_KEY) || "null");
    } catch {
      return null;
    }
  };

  window.addEventListener("pagehide", () => {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ key, loaded, y: window.scrollY }));
    } catch {
      // storage may be unavailable (private mode); nothing to restore then
    }
  });

  (async () => {
    const nav = performance.getEntriesByType("navigation")[0];
    const state = readState();
    if (nav && nav.type === "back_forward" && state && state.key === key) {
      const target = Math.min(state.loaded, total);
      try {
        for (let n = 2; n <= target; n += 1) await loadPage(n);
      } catch {
        // fall through with whatever loaded
      }
      window.scrollTo(0, state.y);
    }
    if (loaded < total) observer.observe(end);
  })();
}
