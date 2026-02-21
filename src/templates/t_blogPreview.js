export function t_blogPreview({ id, slug, title, date, content }) {

  const preview = content.length > 280
    ? content.substring(0, 280) + "..."
    : content;

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
