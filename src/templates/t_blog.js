export function t_blog({ title, date, content }) {
  return `
        <div class="container">
            <h1>${title}</h1>
            <p><em>${date}</em></p>
            ${content}
        </div>
    `;
}
