import { homePage } from "../pages/importantBlogs.js";
import { aboutPage } from "../pages/about.js";
import { blogPage } from "../pages/blog.js";
import { getPath } from "./runtime.js";

export function resolveRoute() {

  const path = getPath();

  if (path === "/about") {
    aboutPage();
    return;
  }

  if (path === "/") {
    homePage();
    return;
  }

  // CLEAN BLOG URL MODE
  // anything else = blog slug
  const slug = path.replace("/", "");

  blogPage(slug);
}
