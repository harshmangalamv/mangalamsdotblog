import { mount, loadJSON, navigate } from "../runtime/runtime.js";
import { t_main } from "../templates/t_main.js";
import { t_blogPreview } from "../templates/t_blogPreview.js";

let currentPage = 1;
let totalPages = 1;
let loading = false;
let contentScroller = null;
let pageFilePrefix = "blogFeed.page";

let feedCache = [];

const FEED_CACHE_KEY = "feed_cache_v3";
const FEED_PAGE_KEY = "feed_page_v3";
const FEED_SCROLL_KEY = "feed_scroll_v3";
const FEED_TOTAL_ITEMS_KEY = "feed_total_items_v3";

export async function homePage() {
  const meta = await loadJSON("/data/blogIndex.meta.json");
  totalPages = meta.totalPages || 1;
  pageFilePrefix = meta.pageFilePrefix || "blogFeed.page";

  mount(
    t_main({
      title: "mangalams.blog",
      content: `<div id="feed"></div>`
    })
  );

  contentScroller = document.getElementById("contentPane");

  const savedTotalItems = parseInt(sessionStorage.getItem(FEED_TOTAL_ITEMS_KEY) || "0", 10);
  const savedCache = sessionStorage.getItem(FEED_CACHE_KEY);

  if (savedCache && savedTotalItems === meta.totalItems) {
    feedCache = JSON.parse(savedCache);
    currentPage = parseInt(sessionStorage.getItem(FEED_PAGE_KEY) || "1", 10);

    document.getElementById("feed").innerHTML = feedCache.join("");
    attachLinks();

    setTimeout(() => {
      contentScroller.scrollTop = parseInt(sessionStorage.getItem(FEED_SCROLL_KEY) || "0", 10);
    }, 10);
  } else {
    sessionStorage.removeItem(FEED_CACHE_KEY);
    sessionStorage.removeItem(FEED_PAGE_KEY);
    sessionStorage.removeItem(FEED_SCROLL_KEY);

    feedCache = [];
    currentPage = 1;
    await loadNextPage();
  }

  sessionStorage.setItem(FEED_TOTAL_ITEMS_KEY, String(meta.totalItems));
  contentScroller.addEventListener("scroll", handleScroll, { passive: true });
}

async function loadNextPage() {
  if (loading) return;
  if (currentPage > totalPages) return;

  loading = true;

  const feed = document.getElementById("feed");

  try {
    const pagePosts = await loadJSON(`/data/${pageFilePrefix}.${currentPage}.json`);

    for (const post of pagePosts) {
      const html = t_blogPreview({
        id: post.id,
        slug: post.slug,
        title: post.title,
        date: post.date,
        content: post.excerpt
      });

      feedCache.push(html);
      feed.innerHTML += html;
    }

    currentPage += 1;

    sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(feedCache));
    sessionStorage.setItem(FEED_PAGE_KEY, String(currentPage));

    attachLinks();
  } catch {
    // Keep current content if the next page cannot be loaded.
  }

  loading = false;
}

function handleScroll() {
  if (!contentScroller) return;

  sessionStorage.setItem(FEED_SCROLL_KEY, String(contentScroller.scrollTop));

  const scrollPos = contentScroller.clientHeight + contentScroller.scrollTop;
  const threshold = contentScroller.scrollHeight - 200;

  if (scrollPos >= threshold) {
    loadNextPage();
  }
}

function attachLinks() {
  document.querySelectorAll(".blogLink").forEach((el) => {
    el.onclick = (e) => {
      e.preventDefault();

      // Persist exact position right before route change.
      sessionStorage.setItem(FEED_SCROLL_KEY, String(contentScroller ? contentScroller.scrollTop : 0));

      navigate(`/${el.dataset.slug}`);
    };
  });
}
