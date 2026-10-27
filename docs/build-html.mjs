#!/usr/bin/env node
/**
 * Génère docs/index.html : toute la documentation (Markdown + schémas Mermaid) dans une seule page.
 * Aucune dépendance à installer : `node docs/build-html.mjs`, puis ouvrir docs/index.html dans un navigateur
 * (double-clic suffisant). La mise en forme (marked, mermaid, github-markdown-css) vient d'un CDN,
 * avec empreintes SRI : le navigateur refuse un fichier modifié.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = dirname(fileURLToPath(import.meta.url));

const CDN = {
  marked: {
    src: 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
    integrity: 'sha384-/TQbtLCAerC3jgaim+N78RZSDYV7ryeoBCVqTuzRrFec2akfBkHS7ACQ3PQhvMVi',
  },
  mermaid: {
    src: 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js',
    integrity: 'sha384-WmdflGW9aGfoBdHc4rRyWzYuAjEmDwMdGdiPNacbwfGKxBW/SO6guzuQ76qjnSlr',
  },
  css: {
    href: 'https://cdn.jsdelivr.net/npm/github-markdown-css@5.5.1/github-markdown.css',
    integrity: 'sha384-7WyDX3uRE8+dAXm4PO35UI0q85UY56wyx6YE+xzsnAQhJFESmh1cD2eg2ngcV1bY',
  },
};

const SECTIONS = [
  { title: 'Accueil', dir: '', files: ['README.md'] },
  { title: 'Fonctionnel', dir: 'fonctionnel' },
  { title: 'Technique', dir: 'technique' },
];

const pages = [];
for (const section of SECTIONS) {
  const files = section.files ?? readdirSync(join(DOCS, section.dir)).filter((f) => f.endsWith('.md')).sort();
  for (const file of files) {
    const path = section.dir ? `${section.dir}/${file}` : file;
    const markdown = readFileSync(join(DOCS, path), 'utf8');
    const title = (markdown.match(/^# (.+)$/m)?.[1] ?? file).trim();
    pages.push({ id: path.replace(/\.md$/, ''), path, section: section.title, title, markdown });
  }
}

// Le JSON est placé dans une balise <script> : « </ » ne doit pas pouvoir la refermer.
const data = JSON.stringify(pages).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Garage · Documentation</title>
<link rel="stylesheet" href="${CDN.css.href}" integrity="${CDN.css.integrity}" crossorigin="anonymous">
<style>
  :root { --bg: #ffffff; --side: #f6f8fa; --border: #d0d7de; --text: #1f2328; --muted: #59636e; --accent: #e8590c; --active: #fff1e6; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0d1117; --side: #010409; --border: #30363d; --text: #e6edf3; --muted: #9198a1; --accent: #ff8a3d; --active: #2a1a10; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; }
  .layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 100vh; }
  aside { position: sticky; top: 0; height: 100vh; overflow-y: auto; background: var(--side); border-right: 1px solid var(--border); padding: 20px 14px 40px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.15rem; margin: 0 6px 16px; }
  .brand span { color: var(--accent); }
  #search { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font: inherit; margin-bottom: 12px; }
  nav h3 { font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 18px 6px 6px; }
  nav a { display: block; padding: 6px 8px; border-radius: 6px; color: var(--text); text-decoration: none; font-size: .9rem; line-height: 1.3; }
  nav a:hover { background: var(--active); }
  nav a.on { background: var(--active); color: var(--accent); font-weight: 600; }
  main { min-width: 0; padding: 32px clamp(16px, 4vw, 56px) 80px; }
  .markdown-body table, .markdown-body pre { max-width: 100%; overflow-x: auto; }
  .markdown-body { max-width: 980px; margin: 0 auto; background: transparent; }
  .markdown-body pre.mermaid { background: transparent; text-align: center; overflow-x: auto; }
  .pager { max-width: 980px; margin: 48px auto 0; display: flex; justify-content: space-between; gap: 12px; }
  .pager a { flex: 1; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; color: var(--text); text-decoration: none; font-size: .9rem; }
  .pager a small { display: block; color: var(--muted); }
  .pager a.next { text-align: right; }
  .offline { max-width: 980px; margin: 0 auto 16px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--accent); display: none; }
  .markdown-body pre.mermaid svg { cursor: zoom-in; }
  #zoom { position: fixed; inset: 0; z-index: 50; display: none; overflow: auto; background: var(--bg); padding: 24px; cursor: zoom-out; }
  #zoom.on { display: block; }
  #zoom svg { max-width: none !important; height: auto; display: block; margin: 0 auto; }
  #menu { display: none; }
  @media (max-width: 860px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    aside { position: fixed; z-index: 10; width: min(86vw, 320px); transform: translateX(-100%); transition: transform .2s; }
    aside.open { transform: none; box-shadow: 0 0 40px rgba(0, 0, 0, .4); }
    #menu { display: inline-flex; position: sticky; top: 8px; z-index: 5; margin: 8px 16px 0; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--side); color: var(--text); font: inherit; }
    main { padding-top: 12px; }
  }
</style>
</head>
<body>
<button id="menu" aria-label="Menu">☰ Sommaire</button>
<div class="layout">
  <aside id="side">
    <div class="brand">🏁 <div>Garage <span>· doc</span></div></div>
    <input id="search" type="search" placeholder="Rechercher…" aria-label="Rechercher dans la documentation">
    <nav id="nav"></nav>
  </aside>
  <main>
    <p class="offline" id="offline">La mise en forme n'a pas pu être chargée (pas d'accès au CDN) : affichage du texte brut.</p>
    <article class="markdown-body" id="content"></article>
    <div class="pager" id="pager"></div>
  </main>
</div>
<div id="zoom" title="Cliquer pour fermer"></div>
<script id="pages" type="application/json">${data}</script>
<script src="${CDN.marked.src}" integrity="${CDN.marked.integrity}" crossorigin="anonymous"></script>
<script src="${CDN.mermaid.src}" integrity="${CDN.mermaid.integrity}" crossorigin="anonymous"></script>
<script>
(() => {
  const pages = JSON.parse(document.getElementById('pages').textContent);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const hasMarked = typeof window.marked !== 'undefined';
  const hasMermaid = typeof window.mermaid !== 'undefined';
  if (hasMermaid) mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'strict' });

  // Ancres façon GitHub, pour que les liens « page.md#titre » fonctionnent comme sur GitHub.
  const slug = (text) => text.toLowerCase().trim().replace(/<[^>]+>/g, '').replace(/[^\\p{L}\\p{N}\\- _]/gu, '').replace(/ /g, '-');
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  if (hasMarked) {
    marked.use({
      gfm: true,
      renderer: {
        heading(text, level, raw) {
          return '<h' + level + ' id="' + slug(raw) + '">' + text + '</h' + level + '>';
        },
        code(code, lang) {
          if (lang === 'mermaid') return '<pre class="mermaid">' + escapeHtml(code) + '</pre>';
          return '<pre><code>' + escapeHtml(code) + '</code></pre>';
        },
      },
    });
  } else {
    document.getElementById('offline').style.display = 'block';
  }

  // Résout un lien relatif « ../technique/x.md#ancre » depuis la page courante.
  function resolve(fromId, href) {
    const [path, anchor = ''] = href.split('#');
    if (!path) return { id: fromId, anchor };
    const parts = fromId.split('/').slice(0, -1);
    for (const seg of path.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    return { id: parts.join('/').replace(/\\.md$/, ''), anchor };
  }

  const nav = document.getElementById('nav');
  function renderNav(filter = '') {
    const q = filter.toLowerCase();
    let html = '';
    let section = '';
    for (const p of pages) {
      if (q && !(p.title + ' ' + p.markdown).toLowerCase().includes(q)) continue;
      if (p.section !== section) {
        section = p.section;
        html += '<h3>' + section + '</h3>';
      }
      html += '<a href="#/' + p.id + '" data-id="' + p.id + '">' + escapeHtml(p.title) + '</a>';
    }
    nav.innerHTML = html || '<p style="color:var(--muted);padding:0 8px">Aucun résultat</p>';
    markActive();
  }
  function markActive() {
    const current = location.hash.slice(2).split('::')[0] || pages[0].id;
    nav.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.id === current));
  }

  async function show() {
    const [rawId, anchor] = decodeURIComponent(location.hash.slice(2)).split('::');
    const page = byId.get(rawId) ?? pages[0];
    const content = document.getElementById('content');
    content.innerHTML = hasMarked ? marked.parse(page.markdown) : '<pre>' + escapeHtml(page.markdown) + '</pre>';
    content.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (/^(https?:|mailto:)/.test(href)) {
        a.target = '_blank';
        a.rel = 'noopener';
      } else if (href.startsWith('#')) {
        a.href = '#/' + page.id + '::' + href.slice(1);
      } else if (href.includes('.md')) {
        const t = resolve(page.id, href);
        if (byId.has(t.id)) a.href = '#/' + t.id + (t.anchor ? '::' + t.anchor : '');
      }
    });
    const i = pages.indexOf(page);
    const prev = pages[i - 1];
    const next = pages[i + 1];
    document.getElementById('pager').innerHTML =
      (prev ? '<a href="#/' + prev.id + '"><small>← Précédent</small>' + escapeHtml(prev.title) + '</a>' : '<span></span>') +
      (next ? '<a class="next" href="#/' + next.id + '"><small>Suivant →</small>' + escapeHtml(next.title) + '</a>' : '');
    document.title = page.title + ' · Garage';
    markActive();
    document.getElementById('side').classList.remove('open');
    if (hasMermaid) {
      try {
        await mermaid.run({ nodes: content.querySelectorAll('pre.mermaid') });
      } catch (e) {
        console.error(e);
      }
    }
    const target = anchor && document.getElementById(anchor);
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }

  // Schéma agrandi : taille réelle, défilable ; clic ou Échap pour fermer.
  const zoom = document.getElementById('zoom');
  document.getElementById('content').addEventListener('click', (e) => {
    const svg = e.target.closest('pre.mermaid svg');
    if (!svg) return;
    const copy = svg.cloneNode(true);
    const width = svg.viewBox?.baseVal?.width || svg.getBoundingClientRect().width;
    copy.style.width = Math.max(width * 1.2, innerWidth - 48) + 'px';
    copy.removeAttribute('height');
    zoom.replaceChildren(copy);
    zoom.classList.add('on');
  });
  zoom.addEventListener('click', () => zoom.classList.remove('on'));
  addEventListener('keydown', (e) => e.key === 'Escape' && zoom.classList.remove('on'));

  document.getElementById('search').addEventListener('input', (e) => renderNav(e.target.value));
  document.getElementById('menu').addEventListener('click', () => document.getElementById('side').classList.toggle('open'));
  addEventListener('hashchange', show);
  renderNav();
  show();
})();
</script>
</body>
</html>
`;

writeFileSync(join(DOCS, 'index.html'), html);
console.log(`docs/index.html : ${pages.length} pages`);
