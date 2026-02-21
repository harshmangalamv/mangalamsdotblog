import { mount } from "../runtime/runtime.js";
import { t_about } from "../templates/t_about.js";
import { t_main } from "../templates/t_main.js";

export function aboutPage() {
  mount(
    t_main({
      title: "mangalams.blog",
      content: t_about()
    })
  );
}
