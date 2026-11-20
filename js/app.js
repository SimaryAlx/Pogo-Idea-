/* Router, layout and event wiring. */
(function () {
  'use strict';
  const { esc, money, avatar, toast } = window.UI;
  const V = window.Views, A = window.Actions, F = window.Forms, state = window.State;
  const root = document.getElementById('app');
  let renderSeq = 0;

  function parse() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [p, qs] = raw.split('?');
    const parts = p.split('/').filter(Boolean).map(decodeURIComponent);
    const query = {};
    new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
    return { parts, query };
  }

  const logo = `<a class="logo" href="#/"><span class="mark">Z</span><span>clip<b>Z</b></span></a>`;

  function nav(active) {
    const u = state.user;
    const link = (href, label, key) => `<a href="${href}" class="${active === key ? 'on' : ''}">${label}</a>`;
    return `<header class="nav"><div class="wrap row between">
      <div class="row gap">${logo}<nav class="links">${link('#/campaigns', 'Campaigns', 'campaigns')}${link('#/leaderboard', 'Leaderboard', 'leaderboard')}${link('#/creators', 'For clippers', 'creators')}${link('#/brands', 'For brands', 'brands')}</nav></div>
      <div class="row gap-s">${u
        ? `<a class="btn primary sm" href="#/dashboard">Dashboard</a><button class="btn ghost sm" data-act="logout">Log out</button>`
        : `<a class="btn ghost sm" href="#/login">Log in</a><a class="btn primary sm" href="#/signup">Sign up</a>`}</div>
    </div></header>`;
  }

  const footer = () => `<footer class="footer"><div class="wrap row between wrap-m">
    <div>${logo}<p class="muted small">The clipping marketplace. Brands fund it, clippers post it, views get paid.</p></div>
    <div class="row gap fw"><a href="#/campaigns">Campaigns</a><a href="#/leaderboard">Leaderboard</a><a href="#/creators">For clippers</a><a href="#/brands">For brands</a><a href="#/login">Log in</a></div>
    </div><div class="wrap muted small">© ${new Date().getFullYear()} clipZ${API.mode === 'demo' ? ' · Demo preview: data lives in your browser. <button class="linklike" data-act="resetDemo">Reset demo</button>' : ''}</div></footer>`;

  function dashLayout(section, body) {
    const u = state.user, items = window.DashNav[u.role];
    const cur = items.find((i) => i[0] === section) ? section : (section === 'campaign' ? 'campaigns' : 'overview');
    return `<div class="dash"><aside class="side">${logo}
      <nav>${items.map((i) => `<a href="#/dashboard/${i[0]}" class="${cur === i[0] ? 'on' : ''}">${i[1]}</a>`).join('')}</nav>
      <div class="side-foot"><div class="row gap-s">${avatar(u)}<span><b>${esc(u.name)}</b><br><small class="muted">${esc(u.role)} · ${money(u.balance)}</small></span></div>
        <a class="btn ghost sm block" href="#/campaigns">Browse campaigns</a><button class="btn ghost sm block" data-act="logout">Log out</button></div>
    </aside><main class="dash-main">${body}</main></div>`;
  }

  async function render() {
    const seq = ++renderSeq;
    const { parts, query } = parse();
    const page = parts[0] || 'home';
    try {
      let html;
      if (page === 'dashboard') {
        if (!state.user) { location.hash = '#/login'; return; }
        html = dashLayout(parts[1] || 'overview', await V.dashboard(parts[1], query, parts[2]));
      } else {
        if ((page === 'login' || page === 'signup') && state.user) { location.hash = '#/dashboard'; return; }
        const view = V[page] || (async () => `<div class="empty"><b>Page not found</b><p>That page doesn’t exist.</p><a class="btn primary" href="#/">Go home</a></div>`);
        html = nav(page === 'campaign' ? 'campaigns' : page) + `<main class="wrap page">${await view(parts[1], query)}</main>` + footer();
      }
      if (seq !== renderSeq) return;
      root.innerHTML = html;
    } catch (e) {
      if (seq !== renderSeq) return;
      if (e.status === 401) { API.logout(); state.user = null; location.hash = '#/login'; return; }
      root.innerHTML = nav('') + `<main class="wrap page"><div class="empty"><b>${e.status === 404 ? 'Not found' : 'Something went wrong'}</b><p>${esc(e.message)}</p><a class="btn primary" href="#/">Go home</a></div></main>`;
    }
  }

  async function refreshUser() {
    try { state.user = (await API.call('me')).user; } catch (e) { state.user = null; API.logout(); }
  }

  async function run(fn, args, btn) {
    if (btn) btn.disabled = true;
    try { await fn.apply(null, args); } catch (e) { toast(e.message || 'Something went wrong', 'err'); } finally { if (btn && btn.isConnected) btn.disabled = false; }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !A[el.dataset.act]) return;
    if (el.tagName === 'BUTTON') e.preventDefault();
    run(A[el.dataset.act], [el, e], el.tagName === 'BUTTON' ? el : null);
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form || !F[form.dataset.form]) return;
    e.preventDefault();
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    run(F[form.dataset.form], [data, form], form.querySelector('button:not([type=button])'));
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    if (el.dataset.change === 'filter') el.form.requestSubmit();
    else if (A[el.dataset.change]) A[el.dataset.change](el, e);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.UI.closeModal(); });
  window.addEventListener('hashchange', () => { window.UI.closeModal(); window.scrollTo(0, 0); render(); });

  window.App = { render, refreshUser };
  (async () => { if (API.hasSession()) await refreshUser(); render(); })();
})();
