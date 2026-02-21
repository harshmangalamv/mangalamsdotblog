export function t_main({ title, content }) {
  return `
        <div class="layout">

            <aside class="sidebar">
                <h1 class="site-title">mangalams.blog</h1>

                <nav class="menu">
                    <p><a href="/">Home</a></p>
                    <p><a href="/about">About</a></p>
                </nav>
            </aside>

            <main id="contentPane" class="content-pane">
                <div class="content">
                    ${content}
                </div>
            </main>

        </div>
    `;
}
