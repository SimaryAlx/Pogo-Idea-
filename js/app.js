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

  const wordmark = `<a class="wordmark" href="#/">clipZ</a>`;

  function nav(active) {
    const u = state.user;
    const link = (href, label, key) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
    return `<header class="top">${wordmark}
      <button class="textbtn menu-btn" type="button" data-act="menu" data-keep aria-expanded="false" aria-controls="top-links">Menu</button>
      <nav class="top-links" id="top-links" aria-label="Main">
        ${link('#/campaigns', 'Campaigns', 'campaigns')}${link('#/leaderboard', 'Leaderboard', 'leaderboard')}${link('#/creators', 'Clippers', 'creators')}${link('#/brands', 'Brands', 'brands')}
        <span class="top-act">${u
          ? `<a class="btn primary sm" href="#/dashboard">Dashboard</a><button class="textbtn" type="button" data-act="logout">Log out</button>`
          : `<a href="#/login"${active === 'login' ? ' aria-current="page"' : ''}>Log in</a><a class="btn primary sm" href="#/signup">Sign up</a>`}</span>
      </nav></header>`;
  }

  function credits() {
    const BY = 'https://creativecommons.org/licenses/by/2.0', CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
    const list = [
      ['Skateboard Tricks', 'Hector Bermudez, via Wikimedia Commons', 'CC0', CC0, 'https://commons.wikimedia.org/w/index.php?curid=61877917'],
      ['A large crowd enjoys a music concert', 'Shixart1985, via Wikimedia Commons', 'CC BY 2.0', BY, 'https://commons.wikimedia.org/wiki/File:A_large_crowd_enjoys_a_music_concert_illuminated_by_colorful_lights_and_a_stunning_stage_display.jpg'],
      ['Dual monitor setup in a gaming room', 'Shixart1985, via Wikimedia Commons', 'CC BY 2.0', BY, 'https://commons.wikimedia.org/wiki/File:Dual_monitor_setup_in_a_gaming_room_with_keyboard_and_mouse_in_focus.jpg'],
      ['Strong woman lifting weights in a gym', 'Shixart1985, via Wikimedia Commons', 'CC BY 2.0', BY, 'https://commons.wikimedia.org/w/index.php?curid=193581638'],
      ['Soda Can Top', 'Tony Webster, via Wikimedia Commons', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 'https://commons.wikimedia.org/wiki/File:Soda_Can_Top_(40144477233).jpg'],
      ['Blue condenser microphone', 'Kelly Sikkema, via Wikimedia Commons', 'CC0', CC0, 'https://commons.wikimedia.org/w/index.php?curid=61688654'],
      ['Notebook cup coffee wooden table', 'Markus Spiske, via rawpixel', 'CC0', CC0, 'https://www.rawpixel.com/image/432045/notebook-and-cup-coffee'],
      ['Video game controller', 'via rawpixel', 'CC0', CC0, 'https://www.rawpixel.com/image/6026166/photo-image-public-domain-technology-free'],
      ['Dropper bottle, blank retro label', 'via rawpixel', 'CC0', CC0, 'https://www.rawpixel.com/image/11515770/dropper-bottle-blank-retro-label'],
      ['Louis Sarowsky performing at Gowanus E-Waste recycling center (video)', 'Wil540, via Wikimedia Commons', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Louis_Sarowsky_performing_at_Gowanus_E-Waste_recycling_center.webm'],
    ];
    const out = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    return `<details class="credits"><summary>Photo and video credits</summary><p>Sample pictures from open collections, standing in until brands upload their own footage. ${list.map((c) =>
      `${out(c[4], '“' + esc(c[0]) + '”')} by ${esc(c[1])}, ${out(c[3], esc(c[2]))}`).join('; ')}.</p></details>`;
  }

  const footer = () => `<footer class="foot">
    <div class="foot-top">
      <div class="foot-ask"><h2>Find a campaign<br>worth clipping</h2><a class="btn ink" href="#/campaigns">Browse campaigns</a></div>
      <nav class="foot-links" aria-label="Footer"><a href="#/campaigns">Campaigns</a><a href="#/leaderboard">Leaderboard</a><a href="#/creators">For clippers</a><a href="#/brands">For brands</a><a href="#/login">Log in</a></nav>
    </div>
    <div class="foot-legal"><span>© ${new Date().getFullYear()} clipZ. Brands fund it, clippers post it, views get paid.${API.mode === 'demo' ? ' Demo preview: data lives in your browser. <button class="textbtn" type="button" data-act="resetDemo">Reset demo</button>' : ''}</span>${credits()}</div>
    <div class="foot-name" aria-hidden="true">clipZ</div>
  </footer>`;

  function dashLayout(section, body) {
    const u = state.user, items = window.DashNav[u.role];
    const cur = items.find((i) => i[0] === section) ? section : (section === 'campaign' ? 'campaigns' : 'overview');
    const curLabel = (items.find((i) => i[0] === cur) || items[0])[1];
    const roleName = { clipper: 'Clipper account', brand: 'Brand account', admin: 'Admin' }[u.role];
    return `<div class="shell">
      <div class="shell-bar">${wordmark}<span>${esc(curLabel)}</span><button class="textbtn" type="button" data-act="menu" data-keep aria-expanded="false" aria-controls="side">Menu</button></div>
      <aside class="side" id="side">
        <div class="side-head">${wordmark}<span>${esc(roleName)}</span></div>
        <nav class="side-nav" aria-label="Dashboard">${items.map((i) => `<a href="#/dashboard/${i[0]}"${cur === i[0] ? ' aria-current="page"' : ''}>${i[1]}</a>`).join('')}</nav>
        <div class="side-group"><span class="side-label">Marketplace</span><a href="#/campaigns">Browse campaigns</a><a href="#/leaderboard">Leaderboard</a></div>
        <div class="side-foot"><div class="who">${avatar(u)}<span><b>${esc(u.name)}</b><small>${u.role === 'admin' ? 'Admin' : money(u.balance) + (u.role === 'brand' ? ' in funds' : ' balance')}</small></span></div>
          <button class="textbtn" type="button" data-act="logout">Log out</button></div>
      </aside><main class="canvas" id="main">${body}</main></div>`;
  }

  /* After every render: entrances, the shutter, and each page's live parts. */
  let io = null;
  function enhance() {
    if (io) io.disconnect();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = root.querySelectorAll('[data-reveal], .shutter');
    if (reduce || !('IntersectionObserver' in window)) els.forEach((el) => el.classList.add('is-in'));
    else {
      // A clipped shutter reports no intersection, so its parent is watched instead.
      const marks = new Map();
      io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { (marks.get(e.target) || []).forEach((m) => m.classList.add('is-in')); io.unobserve(e.target); }
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
      els.forEach((el) => {
        const t = el.classList.contains('shutter') ? el.parentElement : el;
        if (!marks.has(t)) marks.set(t, []);
        marks.get(t).push(el);
        io.observe(t);
      });
    }
    root.querySelectorAll('video[data-loop]').forEach((v) => { if (reduce) { v.removeAttribute('autoplay'); v.pause(); } else { v.play().catch(() => {}); } });
    root.querySelectorAll('.tbl table').forEach((t) => {
      const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
      t.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => { if (heads[i]) td.setAttribute('data-label', heads[i]); }));
    });
    if (window.PageInit) window.PageInit.forEach((fn) => { try { fn(root); } catch (e) { console.error(e); } });
  }

  async function render() {
    const seq = ++renderSeq;
    const { parts, query } = parse();
    const page = parts[0] || 'home';
    document.body.classList.remove('menu-open');
    try {
      let html, isDash = false;
      if (page === 'dashboard') {
        if (!state.user) { location.hash = '#/login'; return; }
        html = dashLayout(parts[1] || 'overview', await V.dashboard(parts[1], query, parts[2]));
        isDash = true;
      } else {
        if ((page === 'login' || page === 'signup') && state.user) { location.hash = '#/dashboard'; return; }
        const view = V[page] || V.notFound;
        html = nav(page === 'campaign' ? 'campaigns' : page) + `<main class="page page-${esc(V[page] ? page : 'missing')}" id="main">${await view(parts[1], query)}</main>` + footer();
      }
      if (seq !== renderSeq) return;
      document.body.classList.toggle('in-dash', isDash);
      root.innerHTML = html;
      enhance();
    } catch (e) {
      if (seq !== renderSeq) return;
      if (e.status === 401) { API.logout(); state.user = null; location.hash = '#/login'; return; }
      document.body.classList.remove('in-dash');
      root.innerHTML = nav('') + `<main class="page" id="main"><section class="missing"><h1>${e.status === 404 ? 'Not found' : 'Something went wrong'}</h1><p class="lead">${esc(e.message)}</p><a class="btn primary" href="#/">Go to the home page</a></section></main>` + footer();
      enhance();
    }
  }

  async function refreshUser() {
    try { state.user = (await API.call('me')).user; } catch (e) { state.user = null; API.logout(); }
  }

  async function run(fn, args, btn) {
    if (btn) btn.disabled = true;
    try { await fn.apply(null, args); } catch (e) { toast(e.message || 'Something went wrong', 'err'); } finally { if (btn && btn.isConnected) btn.disabled = false; }
  }

  A.menu = (el) => {
    const open = document.body.classList.toggle('menu-open');
    document.querySelectorAll('[data-act="menu"]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
    el.textContent = open ? 'Close' : 'Menu';
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !A[el.dataset.act]) return;
    if (el.tagName === 'BUTTON') e.preventDefault();
    run(A[el.dataset.act], [el, e], el.tagName === 'BUTTON' && el.dataset.keep === undefined ? el : null);
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
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && A[el.dataset.input]) A[el.dataset.input](el, e);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { window.UI.closeModal(); if (document.body.classList.contains('menu-open')) { const b = document.querySelector('[data-act="menu"]'); if (b) A.menu(b); } } });
  window.addEventListener('hashchange', () => { window.UI.closeModal(); window.scrollTo(0, 0); render(); });

  window.App = { render, refreshUser };
  (async () => { if (API.hasSession()) await refreshUser(); render(); })();
})();
