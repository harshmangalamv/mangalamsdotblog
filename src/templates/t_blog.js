export function t_blog({ title, date, content }) {
  return `
        <article class="post">
            <h1 class="post-title">${title}</h1>
            <p class="post-meta">${date}</p>
            <div class="post-body">
                ${content}
            </div>
        </article>
    `;
}
