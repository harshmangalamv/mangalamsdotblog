export function getAppRoot() {
  return document.getElementById("app");
}

export function mount(html) {
  const root = getAppRoot();
  root.innerHTML = html;
}

export function getPath() {
  return window.location.pathname;
}

export function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("popstate"));
}

export async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error("Failed to load JSON: " + path);
  }
  return await res.json();
}

export function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

export function append(html) {
  const root = getAppRoot();
  root.innerHTML += html;
}

export function makeSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function formatDateLong(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}
