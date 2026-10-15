// Structured data (schema.org JSON-LD) so search engines understand who writes
// this site and what each page is. Google uses it to connect the site to the
// author's name and profiles, and to show posts with dates and authorship.
// Validate with https://search.google.com/test/rich-results after changes.

const personId = (site) => `${site.url}/#person`;
const websiteId = (site) => `${site.url}/#website`;

export function person(site) {
  return {
    "@type": "Person",
    "@id": personId(site),
    name: site.author,
    url: site.aboutUrl || `${site.url}/`,
    ...(site.profiles?.length ? { sameAs: site.profiles } : {}),
  };
}

// A short reference to the author, with the name inline (Google prefers both).
const authorRef = (site) => ({ "@type": "Person", "@id": personId(site), name: site.author, url: site.aboutUrl || `${site.url}/` });

export function website(site) {
  return {
    "@type": "WebSite",
    "@id": websiteId(site),
    url: `${site.url}/`,
    name: site.title,
    description: site.description,
    inLanguage: site.language,
    author: authorRef(site),
    publisher: authorRef(site),
  };
}

export function blogPosting(site, post) {
  const url = `${site.url}/${post.slug}/`;
  return {
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.excerpt,
    url,
    mainEntityOfPage: url,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: site.language,
    author: authorRef(site),
    publisher: authorRef(site),
    isPartOf: { "@id": websiteId(site) },
    wordCount: post.text.split(/\s+/).filter(Boolean).length,
  };
}

export function profilePage(site, path) {
  return {
    "@type": "ProfilePage",
    url: site.url + path,
    mainEntity: person(site),
    isPartOf: { "@id": websiteId(site) },
  };
}

// One <script> per page; "<" is escaped so the JSON can never close the tag.
export function jsonLd(items) {
  if (!items?.length) return "";
  const graph = { "@context": "https://schema.org", "@graph": items };
  return `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, "\\u003c")}</script>`;
}
