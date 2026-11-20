/* Dashboards for clippers, brands and admins. */
(function () {
  'use strict';
  const { esc, money, money0, compact, date, ago, PLATFORM, platformChip, badge, avatar, safeUrl, toast, modal, closeModal, barChart, stat, empty } = window.UI;
  const V = window.Views, A = window.Actions, F = window.Forms, state = window.State;
  const D = (window.Dash = { clipper: {}, brand: {}, admin: {} });

  window.DashNav = {
    clipper: [['overview', 'Overview'], ['campaigns', 'My campaigns'], ['submissions', 'My clips'], ['wallet', 'Wallet'], ['settings', 'Settings']],
    brand: [['overview', 'Overview'], ['campaigns', 'Campaigns'], ['new', 'New campaign'], ['billing', 'Billing'], ['settings', 'Settings']],
    admin: [['overview', 'Overview'], ['campaigns', 'Campaigns'], ['submissions', 'Clips'], ['payouts', 'Payouts'], ['users', 'Users']],
  };

  const head = (title, sub, cta) => `<div class="row between dash-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}</div>${cta || ''}</div>`;
  const table = (cols, rows) => `<div class="card table-wrap"><table><thead><tr>${cols.map((c) => `<th${c.startsWith('#') ? ' class="num"' : ''}>${esc(c.replace('#', ''))}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const clipLink = (s) => `<a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a>`;
  const TX = { earning: 'Clip earnings', payout: 'Payout request', payout_refund: 'Payout returned', deposit: 'Funds added', campaign_fund: 'Campaign funded', refund: 'Campaign refund' };
  const txTable = (tx) => tx.length ? table(['Date', 'Type', 'Details', '#Amount'], tx.map((t) =>
    `<tr><td>${date(t.at)}</td><td>${esc(TX[t.type] || t.type)}</td><td class="muted">${esc(t.campaignTitle || '—')}</td><td class="num ${t.amount >= 0 ? 'accent' : ''}">${t.amount >= 0 ? '+' : '−'}${money(Math.abs(t.amount))}</td></tr>`)) : empty('No activity yet', 'Transactions will show up here.');

  /* ============================ CLIPPER ============================ */
  D.clipper.overview = async () => {
    const o = await API.call('clipperOverview');
    return head('Hey, ' + state.user.name, 'Here’s how your clips are doing.', `<button class="btn primary" data-act="submitClip">+ Submit a clip</button>`) +
      `<div class="grid g4 stats">${stat('Available balance', money(o.balance), 'Ready to withdraw')}${stat('Lifetime earnings', money(o.lifetime))}${stat('Verified views', compact(o.views))}${stat('Clips', o.clips, o.pending + ' in review')}</div>
      <div class="card"><h3>Earnings, last 14 days</h3>${barChart(o.chart)}</div>
      <h3>Recent clips</h3>${o.recent.length ? subsTable(o.recent) : empty('No clips yet', 'Join a campaign and submit your first clip.', '<a class="btn primary" href="#/campaigns">Browse campaigns</a>')}`;
  };

  function subsTable(rows) {
    return table(['Campaign', 'Platform', 'Clip', '#Views', '#Earned', 'Status'], rows.map((s) =>
      `<tr><td><b>${esc(s.campaignTitle)}</b><br><small class="muted">${ago(s.createdAt)}</small></td><td>${platformChip(s.platform)}</td><td>${clipLink(s)}</td>
       <td class="num">${compact(s.views)}</td><td class="num accent">${money(s.earned)}</td><td>${badge(s.status)}${s.note ? `<br><small class="muted">${esc(s.note)}</small>` : ''}</td></tr>`));
  }

  D.clipper.campaigns = async () => {
    const list = await API.call('myCampaigns');
    return head('My campaigns', 'Campaigns you have joined.', `<a class="btn ghost" href="#/campaigns">Find more</a>`) +
      (list.length ? table(['Campaign', 'Rate', '#My clips', '#My views', '#My earnings', 'Status', ''], list.map((c) =>
        `<tr><td><a href="#/campaign/${esc(c.id)}"><b>${esc(c.title)}</b></a><br><small class="muted">${esc(c.brandName)}</small></td><td>${money(c.rate)} / 1K</td>
         <td class="num">${c.myClips}</td><td class="num">${compact(c.myViews)}</td><td class="num accent">${money(c.myEarned)}</td><td>${badge(c.status)}</td>
         <td>${c.status === 'live' ? `<button class="btn sm primary" data-act="submitClip" data-id="${esc(c.id)}">Submit clip</button>` : ''}</td></tr>`))
        : empty('You haven’t joined a campaign yet', 'Pick one that fits your niche and start posting.', '<a class="btn primary" href="#/campaigns">Browse campaigns</a>'));
  };

  D.clipper.submissions = async () => {
    const list = await API.call('mySubmissions');
    return head('My clips', 'Every clip you submitted and what it earned.', `<button class="btn primary" data-act="submitClip">+ Submit a clip</button>`) +
      (list.length ? subsTable(list) : empty('No clips yet', 'Submitted clips show up here with their review status.'));
  };

  D.clipper.wallet = async () => {
    const w = await API.call('wallet');
    const can = w.balance >= w.minPayout;
    return head('Wallet', 'Withdraw your earnings and see your history.') +
      `<div class="grid g3 stats">${stat('Available balance', money(w.balance))}${stat('Lifetime earnings', money(w.lifetime))}${stat('Minimum payout', money(w.minPayout))}</div>
      <div class="card"><h3>Request a payout</h3>
        <form data-form="payout" class="form inline">
          <label>Amount (USD)<input name="amount" type="number" step="0.01" min="${w.minPayout}" max="${w.balance}" value="${can ? w.balance : ''}" required ${can ? '' : 'disabled'}></label>
          <label>Method<select name="method" ${can ? '' : 'disabled'}>${ClipZCore.PAYOUT_METHODS.map((m) => `<option value="${m}"${w.payout.method === m ? ' selected' : ''}>${m === 'paypal' ? 'PayPal' : m.toUpperCase()}</option>`).join('')}</select></label>
          <label class="grow">PayPal email or wallet address<input name="address" required value="${esc(w.payout.address || '')}" ${can ? '' : 'disabled'}></label>
          <button class="btn primary" ${can ? '' : 'disabled'}>Request payout</button>
        </form>${can ? '' : `<p class="muted small">You need at least ${money(w.minPayout)} to withdraw.</p>`}</div>
      <h3>Payouts</h3>${w.payouts.length ? table(['Requested', 'Method', 'Destination', '#Amount', 'Status'], w.payouts.map((p) =>
        `<tr><td>${date(p.createdAt)}</td><td>${esc(p.method.toUpperCase())}</td><td class="muted">${esc(p.address)}</td><td class="num">${money(p.amount)}</td><td>${badge(p.status)}</td></tr>`)) : empty('No payouts yet', 'Your payout requests will be listed here.')}
      <h3>Activity</h3>${txTable(w.tx)}`;
  };
  F.payout = async (d) => { await API.call('requestPayout', d); toast('Payout requested'); await App.refreshUser(); App.render(); };

  /* ============================ SETTINGS (shared) ============================ */
  const settings = async () => {
    const u = state.user;
    return head('Settings', 'Your profile and connected accounts.') + `<div class="card"><form data-form="profile" class="form narrow">
      <label>${u.role === 'brand' ? 'Brand name' : 'Display name'}<input name="name" value="${esc(u.name)}" required maxlength="40"></label>
      <label>Email<input value="${esc(u.email)}" disabled></label>
      ${u.role === 'clipper' ? `<h3>Social accounts</h3><p class="muted small">Clips must be posted from these handles.</p>
        ${Object.keys(PLATFORM).map((p) => `<label>${PLATFORM[p].name} handle<input name="h_${p}" value="${esc(u.handles[p] || '')}" placeholder="username" maxlength="40"></label>`).join('')}` : ''}
      <button class="btn primary">Save changes</button></form></div>
      ${API.mode === 'demo' ? `<div class="card"><h3>Demo data</h3><p class="muted small">This preview stores everything in your browser. Reset it to start over.</p><button class="btn" data-act="resetDemo">Reset demo data</button></div>` : ''}`;
  };
  D.clipper.settings = D.brand.settings = settings;
  F.profile = async (d) => {
    const handles = {}; Object.keys(PLATFORM).forEach((p) => { if (d['h_' + p] !== undefined) handles[p] = d['h_' + p]; });
    state.user = (await API.call('updateProfile', { name: d.name, handles })).user;
    toast('Saved'); App.render();
  };

  /* ============================ BRAND ============================ */
  D.brand.overview = async () => {
    const o = await API.call('brandOverview');
    return head(state.user.name, 'Campaign performance at a glance.', `<a class="btn primary" href="#/dashboard/new">+ New campaign</a>`) +
      `<div class="grid g4 stats">${stat('Total spend', money(o.spent), 'of ' + money0(o.budget) + ' funded')}${stat('Verified views', compact(o.views))}${stat('Effective CPM', money(o.cpm), 'cost per 1K views')}${stat('Clips', o.clips, o.pending + ' awaiting review')}</div>
      <div class="card"><h3>Spend, last 14 days</h3>${barChart(o.chart)}</div>
      <h3>Your campaigns</h3>${o.campaigns.length ? brandCampTable(o.campaigns) : empty('No campaigns yet', 'Launch your first campaign to start getting clips.', '<a class="btn primary" href="#/dashboard/new">Create campaign</a>')}`;
  };

  function brandCampTable(list) {
    return table(['Campaign', 'Status', '#Views', '#Clips', 'Budget used', ''], list.map((c) =>
      `<tr><td><a href="#/dashboard/campaign/${esc(c.id)}"><b>${esc(c.title)}</b></a><br><small class="muted">${money(c.rate)} / 1K · ${c.clippers} clippers</small></td><td>${badge(c.status)}</td>
       <td class="num">${compact(c.views)}</td><td class="num">${c.clips}${c.pendingClips ? ` <span class="dot" title="${c.pendingClips} to review">${c.pendingClips}</span>` : ''}</td>
       <td><div class="progress sm"><div style="width:${c.progress}%"></div></div><small class="muted">${money0(c.spent)} / ${money0(c.budget)}</small></td>
       <td><a class="btn sm" href="#/dashboard/campaign/${esc(c.id)}">Manage</a></td></tr>`));
  }

  D.brand.campaigns = async () => {
    const list = await API.call('brandCampaigns');
    return head('Campaigns', 'Everything you have launched.', `<a class="btn primary" href="#/dashboard/new">+ New campaign</a>`) +
      (list.length ? brandCampTable(list) : empty('No campaigns yet', 'Launch your first campaign to start getting clips.'));
  };

  D.brand.new = async () => head('New campaign', 'Available funds: ' + money(state.user.balance) + '. New campaigns go live after a quick review.') +
    `<div class="card"><form data-form="createCampaign" class="form narrow">
      <label>Campaign title<input name="title" required maxlength="80" placeholder="e.g. Summer launch highlights"></label>
      <label>Description<textarea name="description" rows="4" required maxlength="1200" placeholder="What should clippers cut, and what makes a great clip?"></textarea></label>
      <div class="grid g2"><label>Category<select name="category">${ClipZCore.CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></label>
        <label>Budget (USD)<input name="budget" type="number" min="50" step="1" required placeholder="1000"></label></div>
      <fieldset><legend>Platforms</legend><div class="row gap fw">${Object.keys(PLATFORM).map((p) => `<label class="check"><input type="checkbox" name="platforms" value="${p}"${p === 'tiktok' ? ' checked' : ''}> ${PLATFORM[p].name}</label>`).join('')}</div></fieldset>
      <div class="grid g3"><label>Rate per 1K views ($)<input name="rate" type="number" min="0.1" max="50" step="0.05" value="1" required></label>
        <label>Min. views per clip<input name="minViews" type="number" min="0" step="1" value="5000" required></label>
        <label>Max payout per clip ($)<input name="maxPayout" type="number" min="0" step="1" value="250"><small class="muted">0 = no cap</small></label></div>
      <label>Rules, one per line<textarea name="requirements" rows="4" placeholder="Clips must be 15–60 seconds&#10;Tag our account in the caption"></textarea></label>
      <label>Source footage link (optional)<input name="assetsUrl" type="url" placeholder="https://drive.google.com/…"></label>
      <button class="btn primary">Submit campaign for review</button></form></div>`;
  F.createCampaign = async (d, form) => {
    d.platforms = Array.from(form.querySelectorAll('[name=platforms]:checked')).map((x) => x.value);
    const c = await API.call('createCampaign', d);
    await App.refreshUser(); toast('Campaign submitted for review'); location.hash = '#/dashboard/campaign/' + c.id;
  };

  D.brand.campaign = async (id) => {
    const { campaign: c, submissions } = await API.call('campaignSubmissions', { id });
    const pend = submissions.filter((s) => s.status === 'pending').length;
    const toggle = c.status === 'live' ? `<button class="btn" data-act="campStatus" data-id="${esc(c.id)}" data-s="paused">Pause</button>`
      : c.status === 'paused' ? `<button class="btn primary" data-act="campStatus" data-id="${esc(c.id)}" data-s="live">Resume</button>` : '';
    return `<a class="back" href="#/dashboard/campaigns">← Campaigns</a>` +
      head(c.title, c.category + ' · ' + money(c.rate) + ' per 1K views', `<div class="row gap-s">${badge(c.status)}${toggle}${c.status !== 'rejected' ? `<button class="btn" data-act="topUp" data-id="${esc(c.id)}">Add budget</button>` : ''}</div>`) +
      (c.status === 'pending' ? `<div class="notice">This campaign is waiting for clipZ review. It goes live as soon as it’s approved.</div>` : '') +
      `<div class="grid g4 stats">${stat('Spent', money(c.spent), money0(c.remaining) + ' left')}${stat('Verified views', compact(c.views))}${stat('Clippers', c.clippers)}${stat('Clips', c.clips, pend + ' awaiting review')}</div>
      <div class="card"><div class="row between small"><span>Budget used</span><span>${c.progress}%</span></div><div class="progress"><div style="width:${c.progress}%"></div></div></div>
      <h3>Submitted clips</h3>${submissions.length ? reviewTable(submissions, 'reviewSubmission') : empty('No clips yet', 'Clips appear here as soon as clippers submit them.')}`;
  };

  function reviewTable(rows, method, showCampaign) {
    return table(['Clipper', showCampaign ? 'Campaign' : 'Platform', 'Clip', '#Views', '#Earned', 'Status', 'Review'], rows.map((s) =>
      `<tr><td><div class="row gap-s">${avatar({ name: s.clipperName, color: s.clipperColor })}<span><b>${esc(s.clipperName)}</b><br><small class="muted">${ago(s.createdAt)}</small></span></div></td>
       <td>${showCampaign ? `${esc(s.campaignTitle)}<br>` : ''}${platformChip(s.platform)}</td><td>${clipLink(s)}</td><td class="num">${compact(s.views)}</td><td class="num accent">${money(s.earned)}</td>
       <td>${badge(s.status)}${s.note ? `<br><small class="muted">${esc(s.note)}</small>` : ''}</td>
       <td>${s.status === 'pending' ? `<div class="row gap-s"><button class="btn sm primary" data-act="review" data-m="${method}" data-id="${esc(s.id)}" data-a="approve">Approve</button><button class="btn sm danger" data-act="rejectClip" data-m="${method}" data-id="${esc(s.id)}">Reject</button></div>` : '<span class="muted small">Done</span>'}</td></tr>`));
  }

  A.review = async (el) => { await API.call(el.dataset.m, { id: el.dataset.id, action: el.dataset.a }); toast('Clip approved'); App.render(); };
  A.rejectClip = (el) => modal('Reject clip', `<form data-form="rejectClip" class="form"><input type="hidden" name="id" value="${esc(el.dataset.id)}"><input type="hidden" name="m" value="${esc(el.dataset.m)}">
    <label>Reason (shown to the clipper)<input name="reason" required maxlength="200" placeholder="e.g. Missing captions"></label><button class="btn danger block">Reject clip</button></form>`);
  F.rejectClip = async (d) => { await API.call(d.m, { id: d.id, action: 'reject', reason: d.reason }); closeModal(); toast('Clip rejected'); App.render(); };
  A.campStatus = async (el) => { await API.call('setCampaignStatus', { id: el.dataset.id, status: el.dataset.s }); toast(el.dataset.s === 'live' ? 'Campaign resumed' : 'Campaign paused'); App.render(); };
  A.topUp = (el) => modal('Add budget', `<form data-form="topUp" class="form"><input type="hidden" name="id" value="${esc(el.dataset.id)}">
    <p class="muted small">Available funds: ${money(state.user.balance)}</p><label>Amount (USD)<input name="amount" type="number" min="10" step="1" required></label><button class="btn primary block">Add to campaign</button></form>`);
  F.topUp = async (d) => { await API.call('fundCampaign', d); await App.refreshUser(); closeModal(); toast('Budget added'); App.render(); };

  D.brand.billing = async () => {
    const w = await API.call('wallet');
    return head('Billing', 'Funds you can assign to campaigns.') +
      `<div class="grid g3 stats">${stat('Available funds', money(w.balance))}</div>
      <div class="card"><h3>Add funds</h3><form data-form="addFunds" class="form inline"><label>Amount (USD)<input name="amount" type="number" min="10" step="1" value="500" required></label><button class="btn primary">Add funds</button></form>
        <p class="muted small">Test mode: no card is charged. Connect a payment provider before going live.</p></div>
      <h3>Activity</h3>${txTable(w.tx)}`;
  };
  F.addFunds = async (d) => { await API.call('addFunds', d); await App.refreshUser(); toast('Funds added'); App.render(); };

  /* ============================ ADMIN ============================ */
  D.admin.overview = async () => {
    const o = await API.call('adminOverview');
    return head('Platform overview', 'Everything happening on clipZ.', `<button class="btn" data-act="syncViews">↻ Run view sync</button>`) +
      `<div class="grid g4 stats">${stat('Users', o.users, o.stats.clippers + ' clippers · ' + o.stats.brands + ' brands')}${stat('Verified views', compact(o.stats.views))}${stat('Paid to clippers', money(o.stats.paid))}${stat('Budget in escrow', money(o.escrow))}</div>
      <div class="grid g3 stats">
        <a class="stat link" href="#/dashboard/campaigns"><span>Campaigns to review</span><b>${o.pendingCampaigns}</b></a>
        <a class="stat link" href="#/dashboard/submissions"><span>Clips in review</span><b>${o.pendingClips}</b></a>
        <a class="stat link" href="#/dashboard/payouts"><span>Payouts waiting</span><b>${o.pendingPayouts}</b><small>${money(o.pendingPayoutTotal)}</small></a></div>
      <div class="card"><h3>Earnings credited, last 14 days</h3>${barChart(o.chart)}</div>`;
  };
  A.syncViews = async () => { const r = await API.call('syncViews'); toast(`Synced ${r.updated} clips · ${money(r.credited)} credited`); App.render(); };

  D.admin.campaigns = async () => {
    const list = await API.call('adminCampaigns');
    const btn = (c, s, label, cls) => `<button class="btn sm ${cls || ''}" data-act="adminCamp" data-id="${esc(c.id)}" data-s="${s}">${label}</button>`;
    return head('Campaigns', 'Approve, feature or stop campaigns.') + table(['Campaign', 'Status', '#Budget', '#Spent', '#Clips', 'Actions'], list.map((c) =>
      `<tr><td><b>${esc(c.title)}</b><br><small class="muted">${esc(c.brandName)} · ${money(c.rate)} / 1K</small></td><td>${badge(c.status)}${c.featured ? ' <span class="badge b-featured">featured</span>' : ''}</td>
       <td class="num">${money0(c.budget)}</td><td class="num">${money0(c.spent)}</td><td class="num">${c.clips}</td>
       <td><div class="row gap-s fw">${c.status === 'pending' ? btn(c, 'live', 'Approve', 'primary') + btn(c, 'rejected', 'Reject', 'danger') : ''}
         ${c.status === 'live' ? btn(c, 'paused', 'Pause') : ''}${c.status === 'paused' ? btn(c, 'live', 'Resume') : ''}
         ${c.status === 'live' ? `<button class="btn sm" data-act="adminFeature" data-id="${esc(c.id)}" data-f="${c.featured ? '' : '1'}">${c.featured ? 'Unfeature' : 'Feature'}</button>` : ''}</div></td></tr>`));
  };
  A.adminCamp = async (el) => { await API.call('adminSetCampaign', { id: el.dataset.id, status: el.dataset.s }); toast('Campaign updated'); App.render(); };
  A.adminFeature = async (el) => { await API.call('adminSetCampaign', { id: el.dataset.id, featured: !!el.dataset.f }); toast('Campaign updated'); App.render(); };

  D.admin.submissions = async () => {
    const list = await API.call('adminSubmissions', {});
    return head('Clips', 'Every submitted clip across the platform.') + (list.length ? reviewTable(list, 'adminReview', true) : empty('No clips', 'Nothing submitted yet.'));
  };

  D.admin.payouts = async () => {
    const list = await API.call('adminPayouts');
    return head('Payouts', 'Send the money, then mark the request as paid.') + (list.length ? table(['Clipper', 'Requested', 'Method', 'Destination', '#Amount', 'Status', ''], list.map((p) =>
      `<tr><td><b>${esc(p.userName)}</b></td><td>${date(p.createdAt)}</td><td>${esc(p.method.toUpperCase())}</td><td class="muted">${esc(p.address)}</td><td class="num">${money(p.amount)}</td><td>${badge(p.status)}</td>
       <td>${p.status === 'pending' ? `<div class="row gap-s"><button class="btn sm primary" data-act="payout" data-id="${esc(p.id)}" data-a="paid">Mark paid</button><button class="btn sm danger" data-act="payout" data-id="${esc(p.id)}" data-a="reject">Reject</button></div>` : ''}</td></tr>`)) : empty('No payouts', 'Payout requests will appear here.'));
  };
  A.payout = async (el) => { await API.call('processPayout', { id: el.dataset.id, action: el.dataset.a }); toast(el.dataset.a === 'paid' ? 'Marked as paid' : 'Payout rejected and refunded'); App.render(); };

  D.admin.users = async () => {
    const list = await API.call('adminUsers');
    return head('Users', list.length + ' accounts') + table(['User', 'Role', 'Joined', '#Balance', '#Activity', 'Status', ''], list.map((u) =>
      `<tr><td><div class="row gap-s">${avatar(u)}<span><b>${esc(u.name)}</b><br><small class="muted">${esc(u.email)}</small></span></div></td><td>${esc(u.role)}</td><td>${date(u.createdAt)}</td>
       <td class="num">${money(u.balance)}</td><td class="num">${u.role === 'brand' ? u.campaigns + ' campaigns' : u.role === 'clipper' ? u.clips + ' clips' : '—'}</td><td>${badge(u.status)}</td>
       <td>${u.role === 'admin' ? '' : `<button class="btn sm ${u.status === 'active' ? 'danger' : ''}" data-act="userStatus" data-id="${esc(u.id)}" data-s="${u.status === 'active' ? 'suspended' : 'active'}">${u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>`}</td></tr>`));
  };
  A.userStatus = async (el) => { await API.call('setUserStatus', { id: el.dataset.id, status: el.dataset.s }); toast('User updated'); App.render(); };

  V.dashboard = async (section, _q, arg) => {
    const role = state.user.role, pages = D[role];
    const fn = pages[section || 'overview'] || pages.overview;
    return fn(arg);
  };
})();
