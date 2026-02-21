import { mount, loadJSON, navigate, makeSlug } from "../runtime/runtime.js";
import { t_main } from "../templates/t_main.js";
import { t_blogPreview } from "../templates/t_blogPreview.js";

let allPosts = [];
let currentIndex = 0;
const batchSize = 3;
let loading = false;

let feedCache = [];

const FEED_CACHE_KEY = "feed_cache_v2";
const FEED_INDEX_KEY = "feed_index_v2";
const FEED_SCROLL_KEY = "feed_scroll_v2";

export async function homePage() {

  const rawPosts = await loadJSON("/data/blogIndex.json");

  // Remove duplicate IDs so redundant entries do not repeat in the feed.
  const deduped = new Map();
  for (const post of rawPosts) {
    deduped.set(post.id, post);
  }

  allPosts = Array.from(deduped.values());
  allPosts.sort((a, b) => b.date.localeCompare(a.date));

  mount(
    t_main({
      title: "mangalams.blog",
      content: `<div id="feed"></div>`
    })
  );

  const savedCache = sessionStorage.getItem(FEED_CACHE_KEY);
  const savedIndex = sessionStorage.getItem(FEED_INDEX_KEY);
  const savedScroll = sessionStorage.getItem(FEED_SCROLL_KEY);

  if (savedCache) {

    feedCache = JSON.parse(savedCache);
    currentIndex = parseInt(savedIndex || 0);

    document.getElementById("feed").innerHTML = feedCache.join("");

    attachLinks();

    setTimeout(() => {
      window.scrollTo(0, parseInt(savedScroll || 0));
    }, 10);

  } else {
    await loadNextBatch();
  }

  window.onscroll = handleScroll;
}

async function loadNextBatch() {

  if (loading) return;
  loading = true;

  const feed = document.getElementById("feed");
  const slice = allPosts.slice(currentIndex, currentIndex + batchSize);

  for (const p of slice) {

    try {
      const data = await loadJSON(`/data/${p.id}.json`);

      const slug = makeSlug(data.title);

      const html = t_blogPreview({
        id: p.id,
        slug,
        title: data.title,
        date: data.date,
        content: data.content.replace(/<[^>]*>/g, "")
      });

      feedCache.push(html);
      feed.innerHTML += html;
    } catch {
      // Skip invalid/missing post files instead of breaking the feed.
    }
  }

  currentIndex += batchSize;

  sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(feedCache));
  sessionStorage.setItem(FEED_INDEX_KEY, currentIndex);

  attachLinks();

  loading = false;
}

function handleScroll() {

  sessionStorage.setItem(FEED_SCROLL_KEY, window.scrollY);

  const scrollPos = window.innerHeight + window.scrollY;
  const threshold = document.body.offsetHeight - 200;

  if (scrollPos >= threshold) {
    loadNextBatch();
  }
}

function attachLinks() {
  document.querySelectorAll(".blogLink").forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      navigate(`/${el.dataset.slug}`);
    };
  });
}


