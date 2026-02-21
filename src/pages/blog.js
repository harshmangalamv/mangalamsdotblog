import { mount, loadJSON, makeSlug } from "../runtime/runtime.js";
import { t_blog } from "../templates/t_blog.js";

export async function blogPage(slug) {

  try {

    const index = await loadJSON("/data/blogIndex.json");

    // Resolve slug from the same index used on home page.
    const match = index.find((post) => makeSlug(post.title) === slug);

    if (!match) {
      throw new Error("not found");
    }

    const data = await loadJSON(`/data/${match.id}.json`);

    mount(
      t_blog({
        title: data.title,
        date: data.date,
        content: data.content
      })
    );

  } catch {

    mount(`<div class="content"><h1>Not Found</h1></div>`);
  }
}


