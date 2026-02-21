import { resolveRoute } from "./runtime/router.js";

function init() {
  resolveRoute();
}

window.addEventListener("popstate", init);
window.addEventListener("DOMContentLoaded", init);
