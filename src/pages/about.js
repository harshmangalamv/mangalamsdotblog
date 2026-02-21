import { mount } from "../runtime/runtime.js";
import { t_about } from "../templates/t_about.js";

export function aboutPage() {
  mount(t_about());
}
