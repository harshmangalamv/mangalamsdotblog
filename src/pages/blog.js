import { mount, loadJSON, formatDateLong } from "../runtime/runtime.js";
import { t_blog } from "../templates/t_blog.js";
import { t_main } from "../templates/t_main.js";

export async function blogPage(slug) {
  try {
    const slugMap = await loadJSON("/data/blogSlugMap.json");
    const id = slugMap[slug];

    if (!id) {
      throw new Error("not found");
    }

    const data = await loadJSON(`/data/${id}.json`);

    mount(
      t_main({
        title: "mangalams.blog",
        content: t_blog({
          title: data.title,
          date: formatDateLong(data.date),
          content: data.content
        })
      })
    );
  } catch {
    mount(
      t_main({
        title: "mangalams.blog",
        content: `<article class="post"><h1 class="post-title">Not Found</h1></article>`
      })
    );
  }
}
