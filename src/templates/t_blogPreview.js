export function t_blogPreview({ id, slug, title, date, content }) {

  // limit preview length
  const preview = content.substring(0, 280) + "...";

  return `
        <article class="blog-preview">
            <h2>
                <a href="/${slug}" class="blogLink" data-id="${id}" data-slug="${slug}">
                    ${title}
                </a>
            </h2>

            <p class="blog-date">${date}</p>

            <p>${preview}</p>
        </article>
    `;
}
