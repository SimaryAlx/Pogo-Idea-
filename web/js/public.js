/* Public pages: landing, discover, campaign detail, leaderboard, auth. */
(function () {
  'use strict';
  const { esc, money, money0, compact, ago, daysLeft, PLATFORM, platformChip, badge, avatar, safeUrl, toast, modal, closeModal, empty, campaignCard } = window.UI;
  const V = (window.Views = {}), A = (window.Actions = {}), F = (window.Forms = {});
  const state = (window.State = { user: null, filters: { q: '', platform: '', category: '', sort: 'featured' }, period: 'all' });

  const steps = (list) => `<div class="grid g3">${list.map((s, i) => `<div class="card step"><span class="num">${i + 1}</span><h3>${s[0]}</h3><p class="muted">${s[1]}</p></div>`).join('')}</div>`;
  const faq = (list) => `<div class="faq">${list.map((q) => `<details><summary>${q[0]}</summary><p class="muted">${q[1]}</p></details>`).join('')}</div>`;

  V.home = async () => {
    const [stats, camps, top] = await Promise.all([API.call('stats'), API.call('listCampaigns', { limit: 6 }), API.call('leaderboard', {})]);
    return `
    <section class="hero">
      <span class="pill">⚡ ${stats.liveCampaigns} campaigns live right now</span>
      <h1>Post clips.<br><em>Get paid for every view.</em></h1>
      <p class="lead">clipZ connects brands, streamers and podcasts with an army of short-form editors. Pick a campaign, post your clips on TikTok, Reels, Shorts or X, and earn on every verified view.</p>
      <div class="row center gap">
        <a class="btn primary lg" href="#/signup?role=clipper">Start clipping</a>
        <a class="btn ghost lg" href="#/brands">Launch a campaign</a>
      </div>
      <div class="hero-stats">
        <div><b>${compact(stats.views)}</b><span>verified views</span></div>
        <div><b>${money0(stats.paid)}</b><span>paid to clippers</span></div>
        <div><b>${compact(stats.clippers)}</b><span>active clippers</span></div>
        <div><b>${compact(stats.clips)}</b><span>clips submitted</span></div>
      </div>
    </section>
    <section>
      <div class="row between end"><div><h2>Trending campaigns</h2><p class="muted">Budgets are funded up front, so every approved view gets paid.</p></div><a class="btn ghost" href="#/campaigns">View all →</a></div>
      <div class="grid g3">${camps.map(campaignCard).join('')}</div>
    </section>
    <section>
      <h2>How clipZ works</h2><p class="muted">From sign-up to payout in four moves.</p>
      <div class="grid g4">
        ${[['Join a campaign', 'Browse live campaigns and pick the ones that fit your niche. No follower minimum.'],
          ['Cut & post', 'Grab the source footage, make your edit and post it on your own accounts.'],
          ['Submit the link', 'Paste your post URL into clipZ. The brand reviews it and view tracking starts.'],
          ['Get paid', 'Earnings land in your balance as views are verified. Withdraw by PayPal or USDT/USDC.']]
          .map((s, i) => `<div class="card step"><span class="num">${i + 1}</span><h3>${s[0]}</h3><p class="muted">${s[1]}</p></div>`).join('')}
      </div>
    </section>
    <section class="split">
      <div class="card feature"><span class="pill">For clippers</span><h2>Turn editing skills into income</h2>
        <ul class="ticks"><li>Transparent rate per 1,000 views on every campaign</li><li>Live dashboard for views, clips and earnings</li><li>Leaderboards with bragging rights</li><li>Payouts from just $10</li></ul>
        <a class="btn primary" href="#/creators">Learn more</a></div>
      <div class="card feature alt"><span class="pill violet">For brands</span><h2>Pay for views, not promises</h2>
        <ul class="ticks"><li>Set a budget, a rate and your content rules</li><li>Approve or reject every clip before it earns</li><li>Real-time spend, views and effective CPM</li><li>Pause, top up or end a campaign any time</li></ul>
        <a class="btn violet" href="#/brands">Learn more</a></div>
    </section>
    <section>
      <div class="row between end"><div><h2>Top clippers</h2><p class="muted">The editors pulling the most views on clipZ.</p></div><a class="btn ghost" href="#/leaderboard">Full leaderboard →</a></div>
      <div class="card table-wrap">${boardTable(top.slice(0, 5))}</div>
    </section>
    <section><h2>Questions, answered</h2>
      ${faq([['Do I need a big following to earn?', 'No. Campaigns pay on the views your clips get, not on your follower count. A brand-new account can earn from its first viral clip.'],
        ['How are views counted?', 'After a clip is approved, clipZ tracks its public view count and credits your balance as it grows, at the campaign’s rate per 1,000 views.'],
        ['When can I withdraw?', 'Any time your available balance is $10 or more. Choose PayPal, USDT or USDC and the team processes the request.'],
        ['What does it cost a brand?', 'You fund a campaign budget and only that budget is spent, on approved clips, at the rate you set. Unspent budget stays yours.'],
        ['What stops fake views?', 'Every clip is reviewed before it earns, each campaign sets a minimum view threshold and a per-clip cap, and suspicious accounts are suspended.']])}
    </section>
    <section class="cta card"><h2>Ready to make your first clip pay?</h2><p class="muted">Create a free account in under a minute.</p>
      <a class="btn primary lg" href="#/signup">Create account</a></section>`;
  };

  function boardTable(rows) {
    if (!rows.length) return empty('No clips yet', 'The leaderboard fills up as clips get approved.');
    return `<table><thead><tr><th>#</th><th>Clipper</th><th class="num">Views</th><th class="num">Clips</th><th class="num">Earned</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td><span class="rank r${i + 1}">${i + 1}</span></td><td><div class="row gap-s">${avatar(r.user)}<b>${esc(r.user.name)}</b></div></td>
        <td class="num">${compact(r.views)}</td><td class="num">${r.clips}</td><td class="num accent">${money(r.earned)}</td></tr>`).join('')}</tbody></table>`;
  }

  V.campaigns = async () => {
    const f = state.filters;
    const list = await API.call('listCampaigns', f);
    const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
    return `<section class="page-head"><h1>Discover campaigns</h1><p class="muted">Every campaign shows its rate, remaining budget and rules up front.</p></section>
      <form class="filters card" data-form="filter">
        <input name="q" type="search" placeholder="Search campaigns or brands" value="${esc(f.q)}" aria-label="Search">
        <select name="platform" aria-label="Platform" data-change="filter">${opt('', 'All platforms', f.platform)}${Object.keys(PLATFORM).map((p) => opt(p, PLATFORM[p].name, f.platform)).join('')}</select>
        <select name="category" aria-label="Category" data-change="filter">${opt('', 'All categories', f.category)}${ClipZCore.CATEGORIES.map((c) => opt(c, c, f.category)).join('')}</select>
        <select name="sort" aria-label="Sort" data-change="filter">${opt('featured', 'Featured', f.sort)}${opt('rate', 'Highest rate', f.sort)}${opt('budget', 'Biggest budget left', f.sort)}${opt('newest', 'Newest', f.sort)}</select>
        <button class="btn primary">Search</button>
      </form>
      ${list.length ? `<div class="grid g3">${list.map(campaignCard).join('')}</div>` : empty('No campaigns match', 'Try clearing a filter or searching for something else.')}`;
  };
  F.filter = (d) => { Object.assign(state.filters, { q: d.q || '', platform: d.platform || '', category: d.category || '', sort: d.sort || 'featured' }); App.render(); };

  V.campaign = async (id) => {
    const { campaign: c, topClips, joined, mine } = await API.call('getCampaign', { id });
    const u = state.user, live = c.status === 'live';
    let cta;
    if (!live) cta = `<button class="btn" disabled>Campaign ${esc(c.status)}</button>`;
    else if (!u) cta = `<a class="btn primary lg block" href="#/signup?role=clipper">Sign up to join</a>`;
    else if (u.role !== 'clipper') cta = `<p class="muted small">Log in with a clipper account to join campaigns.</p>`;
    else if (!joined) cta = `<button class="btn primary lg block" data-act="join" data-id="${esc(c.id)}">Join campaign</button>`;
    else cta = `<button class="btn primary lg block" data-act="submitClip" data-id="${esc(c.id)}">Submit a clip</button><p class="muted small center-t">You’re in. ${mine.length} clip${mine.length === 1 ? '' : 's'} submitted.</p>`;
    return `<a class="back" href="#/campaigns">← All campaigns</a>
    <div class="detail">
      <div>
        <div class="cover big" style="--c:${esc(c.color)}"><span class="emoji">${esc(c.emoji || '🎬')}</span></div>
        <small class="muted">${esc(c.brandName)} · ${esc(c.category)} · ${live ? daysLeft(c.endsAt) : 'ended'}</small>
        <h1>${esc(c.title)}</h1>
        <div class="chips">${c.platforms.map(platformChip).join('')} ${badge(c.status)}</div>
        <p class="lead-s">${esc(c.description)}</p>
        <h3>Rules</h3>
        <ul class="ticks">${(c.requirements || []).map((r) => `<li>${esc(r)}</li>`).join('') || '<li>No special rules</li>'}</ul>
        ${c.assetsUrl ? `<a class="btn ghost" href="${safeUrl(c.assetsUrl)}" target="_blank" rel="noopener noreferrer">Download source footage ↗</a>` : ''}
        ${mine.length ? `<h3>Your clips</h3><div class="card table-wrap">${clipsTable(mine, false)}</div>` : ''}
        <h3>Top clips</h3>
        <div class="card table-wrap">${topClips.length ? clipsTable(topClips, true) : empty('No approved clips yet', 'Be the first on the board.')}</div>
      </div>
      <aside class="card sticky">
        <div class="big-rate">${money(c.rate)}<small> per 1,000 views</small></div>
        <div class="progress"><div style="width:${c.progress}%"></div></div>
        <div class="row between small"><span>${money0(c.spent)} paid out</span><span>${money0(c.remaining)} left</span></div>
        <dl class="facts">
          <div><dt>Total budget</dt><dd>${money0(c.budget)}</dd></div>
          <div><dt>Min. views per clip</dt><dd>${compact(c.minViews)}</dd></div>
          <div><dt>Max payout per clip</dt><dd>${c.maxPayout ? money0(c.maxPayout) : 'No cap'}</dd></div>
          <div><dt>Clippers</dt><dd>${c.clippers}</dd></div>
          <div><dt>Clips</dt><dd>${c.clips}</dd></div>
          <div><dt>Views</dt><dd>${compact(c.views)}</dd></div>
        </dl>${cta}
      </aside>
    </div>`;
  };

  function clipsTable(rows, showClipper) {
    return `<table><thead><tr>${showClipper ? '<th>Clipper</th>' : ''}<th>Platform</th><th>Clip</th><th class="num">Views</th><th class="num">Earned</th>${showClipper ? '' : '<th>Status</th>'}</tr></thead><tbody>
      ${rows.map((s) => `<tr>${showClipper ? `<td><div class="row gap-s">${avatar({ name: s.clipperName, color: s.clipperColor })}<b>${esc(s.clipperName)}</b></div></td>` : ''}
        <td>${platformChip(s.platform)}</td><td><a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a> <span class="muted small">${ago(s.createdAt)}</span></td>
        <td class="num">${compact(s.views)}</td><td class="num accent">${money(s.earned)}</td>${showClipper ? '' : `<td>${badge(s.status)}</td>`}</tr>`).join('')}</tbody></table>`;
  }
  window.clipsTable = clipsTable;

  A.join = async (el) => { await API.call('joinCampaign', { id: el.dataset.id }); toast('You joined the campaign'); App.render(); };

  A.submitClip = async (el) => {
    const list = await API.call('myCampaigns');
    const open = list.filter((c) => c.status === 'live');
    if (!open.length) return toast('Join a live campaign first', 'err');
    const cur = open.find((c) => c.id === el.dataset.id) || open[0];
    modal('Submit a clip', `<form data-form="submitClip" class="form">
      <label>Campaign<select name="campaignId" data-change="clipCampaign">${open.map((c) => `<option value="${esc(c.id)}"${c.id === cur.id ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select></label>
      <label>Platform<select name="platform" id="clip-platform">${cur.platforms.map((p) => `<option value="${p}">${PLATFORM[p].name}</option>`).join('')}</select></label>
      <label>Post URL<input name="url" type="url" required placeholder="https://www.tiktok.com/@you/video/…"></label>
      <p class="muted small">Paste the public link to your post. It must be on your own account and follow the campaign rules.</p>
      <button class="btn primary block">Submit for review</button></form>`);
    window._clipCamps = open;
  };
  A.clipCampaign = (el) => {
    const c = (window._clipCamps || []).find((x) => x.id === el.value);
    if (c) document.getElementById('clip-platform').innerHTML = c.platforms.map((p) => `<option value="${p}">${PLATFORM[p].name}</option>`).join('');
  };
  F.submitClip = async (d) => { await API.call('submitClip', d); closeModal(); toast('Clip submitted for review'); App.render(); };

  V.leaderboard = async () => {
    const rows = await API.call('leaderboard', { period: state.period });
    const tab = (k, label) => `<button class="tab${state.period === k ? ' on' : ''}" data-act="period" data-p="${k}">${label}</button>`;
    return `<section class="page-head"><h1>Leaderboard</h1><p class="muted">Ranked by verified views on approved clips.</p></section>
      <div class="tabs">${tab('week', 'This week')}${tab('month', 'This month')}${tab('all', 'All time')}</div>
      ${rows.length >= 3 ? `<div class="podium">${[1, 0, 2].map((i) => `<div class="card pod p${i + 1}">${avatar(rows[i].user, 'xl')}<b>${esc(rows[i].user.name)}</b><span class="accent">${compact(rows[i].views)} views</span><small class="muted">${money(rows[i].earned)} earned</small><span class="rank r${i + 1}">${i + 1}</span></div>`).join('')}</div>` : ''}
      <div class="card table-wrap">${boardTable(rows)}</div>`;
  };
  A.period = (el) => { state.period = el.dataset.p; App.render(); };

  V.creators = async () => `<section class="hero small"><span class="pill">For clippers</span><h1>Your edits. <em>Your payday.</em></h1>
      <p class="lead">Brands put real budgets behind their content. You cut the best moments, post them on your pages and earn for every 1,000 views.</p>
      <a class="btn primary lg" href="#/signup?role=clipper">Create a clipper account</a></section>
    <section><h2>What you get</h2>${steps([['Clear rates', 'Every campaign lists its pay per 1,000 views, the minimum views to qualify and the cap per clip.'],
      ['One dashboard', 'Track every clip, its status, its views and what it has earned so far.'],
      ['Fast withdrawals', 'Cash out from $10 with PayPal, USDT or USDC.']])}</section>
    <section><h2>Earnings example</h2><div class="card calc"><p>A clip with <b>250,000 views</b> on a <b>$1.50 / 1K</b> campaign earns</p><div class="big-rate">$375.00</div><p class="muted small">Subject to each campaign’s per-clip cap and remaining budget.</p></div></section>
    <section class="cta card"><h2>Find your first campaign</h2><a class="btn primary lg" href="#/campaigns">Browse campaigns</a></section>`;

  V.brands = async () => `<section class="hero small"><span class="pill violet">For brands</span><h1>Thousands of clips. <em>One budget.</em></h1>
      <p class="lead">Turn your streams, podcasts, launches and UGC into a flood of short-form posts. You only pay for verified views on clips you approved.</p>
      <a class="btn violet lg" href="#/signup?role=brand">Launch a campaign</a></section>
    <section><h2>How a campaign runs</h2>${steps([['Set the terms', 'Budget, rate per 1,000 views, platforms, minimum views and your content rules.'],
      ['Review clips', 'Clippers submit their posts. Approve the ones that fit, reject the ones that don’t.'],
      ['Watch it scale', 'Views, spend and effective CPM update in your dashboard. Top up or pause any time.']])}</section>
    <section><h2>Built-in control</h2><div class="grid g4">${[['Escrowed budget', 'Spend can never exceed what you funded.'], ['Per-clip caps', 'Limit what any single clip can earn.'], ['Approval queue', 'Nothing earns until you approve it.'], ['Live reporting', 'Views, clips and CPM in real time.']]
      .map((s) => `<div class="card step"><h3>${s[0]}</h3><p class="muted">${s[1]}</p></div>`).join('')}</div></section>
    <section class="cta card"><h2>Ready when you are</h2><a class="btn violet lg" href="#/signup?role=brand">Create a brand account</a></section>`;

  /* ---------------- auth ---------------- */
  const demoBox = () => demoButtons();
  function demoButtons() {
    return `<div class="demo-box"><b>Try a demo account</b><div class="row gap-s fw">
      <button class="btn sm" data-act="demoLogin" data-email="clipper@clipz.demo">Clipper</button>
      <button class="btn sm" data-act="demoLogin" data-email="brand@clipz.demo">Brand</button>
      <button class="btn sm" data-act="demoLogin" data-email="admin@clipz.demo">Admin</button></div></div>`;
  }

  V.login = async () => `<div class="auth card"><h1>Welcome back</h1><p class="muted">Log in to your clipZ account.</p>
    <form data-form="login" class="form">
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="btn primary block">Log in</button></form>
    ${demoBox()}<p class="muted small center-t">New here? <a href="#/signup">Create an account</a></p></div>`;

  V.signup = async (_, q) => {
    const role = q.role === 'brand' ? 'brand' : 'clipper';
    return `<div class="auth card"><h1>Create your account</h1><p class="muted">Free to join. Takes under a minute.</p>
    <form data-form="signup" class="form">
      <div class="seg"><label><input type="radio" name="role" value="clipper"${role === 'clipper' ? ' checked' : ''}><span>I’m a clipper</span></label>
        <label><input type="radio" name="role" value="brand"${role === 'brand' ? ' checked' : ''}><span>I’m a brand</span></label></div>
      <label>Name or brand name<input name="name" required maxlength="40" autocomplete="name"></label>
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Password<input name="password" type="password" required minlength="8" autocomplete="new-password"><small class="muted">At least 8 characters</small></label>
      <button class="btn primary block">Create account</button></form>
    ${demoBox()}<p class="muted small center-t">Already have an account? <a href="#/login">Log in</a></p></div>`;
  };

  const signedIn = (out, msg) => { state.user = out.user; toast(msg); location.hash = '#/dashboard'; };
  F.login = async (d) => signedIn(await API.call('login', d), 'Logged in');
  F.signup = async (d) => signedIn(await API.call('signup', d), 'Account created');
  A.demoLogin = async (el) => signedIn(await API.call('login', { email: el.dataset.email, password: 'demo1234' }), 'Logged in to the demo account');
  A.logout = () => { API.logout(); state.user = null; toast('Logged out'); location.hash = '#/'; App.render(); };
  A.closeModal = (el, e) => { if (e.target === el) closeModal(); };
  A.resetDemo = () => { API.reset(); state.user = null; toast('Demo data reset'); location.hash = '#/'; App.render(); };
})();
