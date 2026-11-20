/* Dashboards for clippers, brands and admins. */
(function () {
  'use strict';
  const { esc, money, money0, compact, date, ago, PLATFORM, platformList, badge, avatar, safeUrl, toast, modal, closeModal, barChart, stat, empty, bar } = window.UI;
  const V = window.Views, A = window.Actions, F = window.Forms, state = window.State;
  const D = (window.Dash = { clipper: {}, brand: {}, admin: {} });

  window.DashNav = {
    clipper: [['overview', 'Overview'], ['campaigns', 'My campaigns'], ['submissions', 'My clips'], ['wallet', 'Wallet'], ['settings', 'Settings']],
    brand: [['overview', 'Overview'], ['campaigns', 'Campaigns'], ['new', 'New campaign'], ['billing', 'Billing'], ['settings', 'Settings']],
    admin: [['overview', 'Overview'], ['campaigns', 'Campaigns'], ['submissions', 'Clips'], ['payouts', 'Payouts'], ['users', 'Users']],
  };

  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
  const head = (title, sub, cta) => `<div class="title-row"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${cta ? `<div class="title-act">${cta}</div>` : ''}</div>`;
  const kpis = (cells) => `<div class="kpis" style="--n:${cells.length}">${cells.join('')}</div>`;
  const panel = (title, body, extra) => `<section class="panel">${title ? `<div class="panel-head"><h2>${esc(title)}</h2>${extra || ''}</div>` : ''}${body}</section>`;
  const table = (cols, rows) => `<div class="tbl"><table><thead><tr>${cols.map((c) => `<th scope="col"${c.startsWith('#') ? ' class="num"' : ''}>${esc(c.replace('#', ''))}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const clipLink = (s) => `<a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">Open clip</a>`;
  const plat = (p) => esc(PLATFORM[p] ? PLATFORM[p].name : p);
  const sum = (pts) => pts.reduce((a, p) => a + p.value, 0);
  const TX = { earning: 'Clip earnings', payout: 'Payout request', payout_refund: 'Payout returned', deposit: 'Funds added', campaign_fund: 'Campaign funded', refund: 'Campaign refund' };
  const txTable = (tx) => tx.length ? table(['Date', 'Type', 'Details', '#Amount'], tx.map((t) =>
    `<tr><td>${date(t.at)}</td><td>${esc(TX[t.type] || t.type)}</td><td class="soft">${esc(t.campaignTitle || '—')}</td><td class="num${t.amount >= 0 ? ' up' : ''}">${t.amount >= 0 ? '+' : '−'}${money(Math.abs(t.amount))}</td></tr>`)) : empty('No activity yet', 'Transactions will show up here.');
  const rail = (title, rows, more) => `<section class="rail-block"><h2>${esc(title)}</h2><div class="panel list">${rows || '<p class="soft pad">Nothing here yet.</p>'}${more ? `<a class="btn sm outline block" href="${more[0]}">${esc(more[1])}</a>` : ''}</div></section>`;

  /* ============================ CLIPPER ============================ */
  D.clipper.overview = async () => {
    const o = await API.call('clipperOverview');
    const name = state.user.name;
    const greet = o.balance >= 10 ? `${name}, ${money(o.balance)} is ready to withdraw.` : o.pending ? `${name}, ${plural(o.pending, 'clip')} in review.` : `${name}, pick a campaign and post your first clip.`;
    const recent = o.recent.slice(0, 5).map((s) => `<a class="li" href="#/dashboard/submissions"><span><b>${esc(s.campaignTitle)}</b><small>${plat(s.platform)}, ${ago(s.createdAt)}</small></span><span class="li-end"><b class="num">${money(s.earned)}</b>${badge(s.status)}</span></a>`).join('');
    return head(greet, `${plural(o.campaigns, 'campaign')} joined, ${plural(o.approved, 'clip')} approved.`, `<button class="btn primary" data-act="submitClip">Submit a clip</button>`) +
      `<div class="ov"><div class="ov-main">
        ${kpis([stat('Available balance', money(o.balance), o.balance >= 10 ? 'Ready to withdraw' : 'Withdraw from $10'), stat('Lifetime earnings', money(o.lifetime), 'All approved clips'), stat('Verified views', compact(o.views), 'On approved clips'), stat('Clips', String(o.clips), o.pending + ' in review')])}
        ${panel('Earnings, last 14 days', barChart(o.chart), `<span class="panel-note">${money(sum(o.chart))} in 14 days</span>`)}
      </div>
      <div class="ov-rail">${rail('Recent clips', recent, ['#/dashboard/submissions', 'View all clips'])}</div></div>`;
  };

  function subsTable(rows) {
    return table(['Campaign', 'Platform', 'Clip', '#Views', '#Earned', 'Status'], rows.map((s) =>
      `<tr><td><b>${esc(s.campaignTitle)}</b><small>${ago(s.createdAt)}</small></td><td>${plat(s.platform)}</td><td>${clipLink(s)}</td>
       <td class="num">${compact(s.views)}</td><td class="num">${money(s.earned)}</td><td>${badge(s.status)}${s.note ? `<small>${esc(s.note)}</small>` : ''}</td></tr>`));
  }

  D.clipper.campaigns = async () => {
    const list = await API.call('myCampaigns');
    return head('My campaigns', `${plural(list.length, 'campaign')} joined.`, `<a class="btn outline" href="#/campaigns">Find more campaigns</a>`) +
      (list.length ? table(['Campaign', 'Rate', '#My clips', '#My views', '#My earnings', 'Status', ''], list.map((c) =>
        `<tr><td><a href="#/campaign/${esc(c.id)}"><b>${esc(c.title)}</b></a><small>${esc(c.brandName)}</small></td><td class="nowrap">${money(c.rate)} per 1K</td>
         <td class="num">${c.myClips}</td><td class="num">${compact(c.myViews)}</td><td class="num">${money(c.myEarned)}</td><td>${badge(c.status)}</td>
         <td class="act">${c.status === 'live' ? `<button class="btn sm primary" data-act="submitClip" data-id="${esc(c.id)}">Submit clip</button>` : ''}</td></tr>`))
        : empty('You haven’t joined a campaign yet', 'Pick one that fits your niche and start posting.', '<a class="btn primary" href="#/campaigns">Browse campaigns</a>'));
  };

  D.clipper.submissions = async () => {
    const list = await API.call('mySubmissions');
    const pend = list.filter((s) => s.status === 'pending').length;
    return head('My clips', `${plural(list.length, 'clip')} submitted, ${pend} in review.`, `<button class="btn primary" data-act="submitClip">Submit a clip</button>`) +
      (list.length ? subsTable(list) : empty('No clips yet', 'Submitted clips show up here with their review status.'));
  };

  D.clipper.wallet = async () => {
    const w = await API.call('wallet');
    const can = w.balance >= w.minPayout;
    return head('Wallet', 'Withdraw your earnings and see every payout.') +
      kpis([stat('Available balance', money(w.balance), can ? 'Ready to withdraw' : 'Below the minimum'), stat('Lifetime earnings', money(w.lifetime)), stat('Minimum payout', money(w.minPayout), 'PayPal, USDT or USDC')]) +
      panel('Request a payout', `<form data-form="payout" class="form inline">
          <label>Amount (USD)<input name="amount" type="number" step="0.01" min="${w.minPayout}" max="${w.balance}" value="${can ? w.balance : ''}" required ${can ? '' : 'disabled'}></label>
          <label>Method<select name="method" ${can ? '' : 'disabled'}>${ClipZCore.PAYOUT_METHODS.map((m) => `<option value="${m}"${w.payout.method === m ? ' selected' : ''}>${m === 'paypal' ? 'PayPal' : m.toUpperCase()}</option>`).join('')}</select></label>
          <label class="grow">PayPal email or wallet address<input name="address" required value="${esc(w.payout.address || '')}" ${can ? '' : 'disabled'}></label>
          <button class="btn primary" ${can ? '' : 'disabled'}>Request payout</button>
        </form>${can ? '' : `<p class="soft">You need at least ${money(w.minPayout)} to withdraw.</p>`}`) +
      `<h2 class="sub-h">Payouts</h2>${w.payouts.length ? table(['Requested', 'Method', 'Destination', '#Amount', 'Status'], w.payouts.map((p) =>
        `<tr><td>${date(p.createdAt)}</td><td>${esc(p.method === 'paypal' ? 'PayPal' : p.method.toUpperCase())}</td><td class="soft">${esc(p.address)}</td><td class="num">${money(p.amount)}</td><td>${badge(p.status)}</td></tr>`)) : empty('No payouts yet', 'Your payout requests will be listed here.')}
      <h2 class="sub-h">Activity</h2>${txTable(w.tx)}`;
  };
  F.payout = async (d) => { await API.call('requestPayout', d); toast('Payout requested'); await App.refreshUser(); App.render(); };

  /* ============================ SETTINGS (shared) ============================ */
  const settings = async () => {
    const u = state.user;
    return head('Settings', 'Your profile and connected accounts.') + `<div class="settings">
      <div class="set-label"><h2>Profile</h2><p>${u.role === 'clipper' ? 'Clips must be posted from the handles you list here.' : 'Your brand name shows on every campaign.'}</p></div>
      ${panel('', `<form data-form="profile" class="form narrow">
      <label>${u.role === 'brand' ? 'Brand name' : 'Display name'}<input name="name" value="${esc(u.name)}" required maxlength="40"></label>
      <label>Email<input value="${esc(u.email)}" disabled></label>
      ${u.role === 'clipper' ? Object.keys(PLATFORM).map((p) => `<label>${PLATFORM[p].name} handle<input name="h_${p}" value="${esc(u.handles[p] || '')}" placeholder="username" maxlength="40"></label>`).join('') : ''}
      <div><button class="btn primary">Save changes</button></div></form>`)}
      ${API.mode === 'demo' ? `<div class="set-label"><h2>Demo data</h2><p>This preview keeps everything in your browser.</p></div>${panel('', `<p class="soft">Reset to bring back the sample campaigns, clips and accounts.</p><button class="btn outline" data-act="resetDemo">Reset demo data</button>`)}` : ''}
      </div>`;
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
    const name = state.user.name;
    const greet = o.pending ? `${name}, ${plural(o.pending, 'clip is', 'clips are')} waiting for review.` : o.campaigns.length ? `${name}, every clip is reviewed.` : `${name}, launch your first campaign.`;
    const camps = o.campaigns.map((c) => `<a class="li" href="#/dashboard/campaign/${esc(c.id)}"><span><b>${esc(c.title)}</b><small>${money0(c.spent)} of ${money0(c.budget)} spent</small>${bar(c.progress)}</span><span class="li-end">${c.pendingClips ? `<span class="pill p-pending">${c.pendingClips} to review</span>` : badge(c.status)}</span></a>`).join('');
    return head(greet, `${plural(o.live, 'live campaign')}, ${money(o.balance)} in unassigned funds.`, `<a class="btn primary" href="#/dashboard/new">New campaign</a>`) +
      `<div class="ov"><div class="ov-main">
        ${kpis([stat('Total spend', money(o.spent), 'of ' + money0(o.budget) + ' funded'), stat('Verified views', compact(o.views), 'On approved clips'), stat('Cost per 1K views', money(o.cpm), 'Spend over views'), stat('Clips', String(o.clips), o.pending + ' awaiting review')])}
        ${panel('Spend, last 14 days', barChart(o.chart), `<span class="panel-note">${money(sum(o.chart))} in 14 days</span>`)}
      </div>
      <div class="ov-rail">${rail('Your campaigns', camps, ['#/dashboard/campaigns', 'View all campaigns'])}</div></div>`;
  };

  function brandCampTable(list) {
    return table(['Campaign', 'Status', '#Views', '#Clips', 'Budget used', ''], list.map((c) =>
      `<tr><td><a href="#/dashboard/campaign/${esc(c.id)}"><b>${esc(c.title)}</b></a><small>${money(c.rate)} per 1K, ${plural(c.clippers, 'clipper')}</small></td><td>${badge(c.status)}</td>
       <td class="num">${compact(c.views)}</td><td class="num">${c.clips}${c.pendingClips ? `<small>${c.pendingClips} to review</small>` : ''}</td>
       <td class="budget">${bar(c.progress)}<small>${money0(c.spent)} of ${money0(c.budget)}</small></td>
       <td class="act"><a class="btn sm outline" href="#/dashboard/campaign/${esc(c.id)}">Manage</a></td></tr>`));
  }

  D.brand.campaigns = async () => {
    const list = await API.call('brandCampaigns');
    return head('Campaigns', `${plural(list.length, 'campaign')} launched.`, `<a class="btn primary" href="#/dashboard/new">New campaign</a>`) +
      (list.length ? brandCampTable(list) : empty('No campaigns yet', 'Launch your first campaign to start getting clips.'));
  };

  D.brand.new = async () => head('New campaign', 'Available funds: ' + money(state.user.balance) + '. New campaigns go live after a quick review.') +
    panel('', `<form data-form="createCampaign" class="form narrow">
      <label>Campaign title<input name="title" required maxlength="80" placeholder="Summer launch highlights"></label>
      <label>Description<textarea name="description" rows="4" required maxlength="1200" placeholder="What should clippers cut, and what makes a great clip?"></textarea></label>
      <div class="form-2"><label>Category<select name="category">${ClipZCore.CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></label>
        <label>Budget (USD)<input name="budget" type="number" min="50" step="1" required placeholder="1000"></label></div>
      <fieldset><legend>Platforms</legend><div class="checks">${Object.keys(PLATFORM).map((p) => `<label class="check"><input type="checkbox" name="platforms" value="${p}"${p === 'tiktok' ? ' checked' : ''}> ${PLATFORM[p].name}</label>`).join('')}</div></fieldset>
      <div class="form-3"><label>Rate per 1K views ($)<input name="rate" type="number" min="0.1" max="50" step="0.05" value="1" required></label>
        <label>Views a clip needs<input name="minViews" type="number" min="0" step="1" value="5000" required></label>
        <label>Most per clip ($)<input name="maxPayout" type="number" min="0" step="1" value="250"><small>0 means no cap</small></label></div>
      <label>Rules, one per line<textarea name="requirements" rows="4" placeholder="Clips must be 15–60 seconds&#10;Tag our account in the caption"></textarea></label>
      <label>Source footage link (optional)<input name="assetsUrl" type="url" placeholder="https://drive.google.com/…"></label>
      <div><button class="btn primary">Submit campaign for review</button></div></form>`);
  F.createCampaign = async (d, form) => {
    d.platforms = Array.from(form.querySelectorAll('[name=platforms]:checked')).map((x) => x.value);
    const c = await API.call('createCampaign', d);
    await App.refreshUser(); toast('Campaign submitted for review'); location.hash = '#/dashboard/campaign/' + c.id;
  };

  D.brand.campaign = async (id) => {
    const { campaign: c, submissions } = await API.call('campaignSubmissions', { id });
    const pend = submissions.filter((s) => s.status === 'pending').length;
    const toggle = c.status === 'live' ? `<button class="btn outline" data-act="campStatus" data-id="${esc(c.id)}" data-s="paused">Pause</button>`
      : c.status === 'paused' ? `<button class="btn primary" data-act="campStatus" data-id="${esc(c.id)}" data-s="live">Resume</button>` : '';
    return `<a class="back" href="#/dashboard/campaigns">Back to campaigns</a>` +
      head(c.title, c.category + ', ' + money(c.rate) + ' per 1K views, ' + platformList(c.platforms) + '.', `${badge(c.status)}${toggle}${c.status !== 'rejected' ? `<button class="btn outline" data-act="topUp" data-id="${esc(c.id)}">Add budget</button>` : ''}`) +
      (c.status === 'pending' ? `<p class="notice">This campaign is waiting for clipZ review. It goes live as soon as it’s approved.</p>` : '') +
      kpis([stat('Spent', money(c.spent), money0(c.remaining) + ' left of ' + money0(c.budget)), stat('Verified views', compact(c.views)), stat('Clippers', String(c.clippers)), stat('Clips', String(c.clips), pend + ' awaiting review')]) +
      panel('Budget used', `${bar(c.progress)}<p class="soft">${c.progress}% of ${money0(c.budget)}. Clips stop earning when the budget runs out.</p>`) +
      `<h2 class="sub-h">Submitted clips</h2>${submissions.length ? reviewTable(submissions, 'reviewSubmission') : empty('No clips yet', 'Clips appear here as soon as clippers submit them.')}`;
  };

  function reviewTable(rows, method, showCampaign) {
    return table(['Clipper', showCampaign ? 'Campaign' : 'Platform', 'Clip', '#Views', '#Earned', 'Status', 'Review'], rows.map((s) =>
      `<tr><td><span class="who-cell">${avatar({ name: s.clipperName, color: s.clipperColor })}<span><b>${esc(s.clipperName)}</b><small>${ago(s.createdAt)}</small></span></span></td>
       <td>${showCampaign ? `${esc(s.campaignTitle)}<small>${plat(s.platform)}</small>` : plat(s.platform)}</td><td>${clipLink(s)}</td><td class="num">${compact(s.views)}</td><td class="num">${money(s.earned)}</td>
       <td>${badge(s.status)}${s.note ? `<small>${esc(s.note)}</small>` : ''}</td>
       <td class="act">${s.status === 'pending' ? `<button class="btn sm primary" data-act="review" data-m="${method}" data-id="${esc(s.id)}" data-a="approve">Approve</button><button class="btn sm outline" data-act="rejectClip" data-m="${method}" data-id="${esc(s.id)}">Reject</button>` : '<span class="soft">Reviewed</span>'}</td></tr>`));
  }

  A.review = async (el) => { await API.call(el.dataset.m, { id: el.dataset.id, action: el.dataset.a }); toast('Clip approved'); App.render(); };
  A.rejectClip = (el) => modal('Reject clip', `<form data-form="rejectClip" class="form"><input type="hidden" name="id" value="${esc(el.dataset.id)}"><input type="hidden" name="m" value="${esc(el.dataset.m)}">
    <label>Reason (shown to the clipper)<input name="reason" required maxlength="200" placeholder="Missing captions"></label><button class="btn danger block">Reject clip</button></form>`);
  F.rejectClip = async (d) => { await API.call(d.m, { id: d.id, action: 'reject', reason: d.reason }); closeModal(); toast('Clip rejected'); App.render(); };
  A.campStatus = async (el) => { await API.call('setCampaignStatus', { id: el.dataset.id, status: el.dataset.s }); toast(el.dataset.s === 'live' ? 'Campaign resumed' : 'Campaign paused'); App.render(); };
  A.topUp = (el) => modal('Add budget', `<form data-form="topUp" class="form"><input type="hidden" name="id" value="${esc(el.dataset.id)}">
    <p class="soft">Available funds: ${money(state.user.balance)}</p><label>Amount (USD)<input name="amount" type="number" min="10" step="1" required></label><button class="btn primary block">Add to campaign</button></form>`);
  F.topUp = async (d) => { await API.call('fundCampaign', d); await App.refreshUser(); closeModal(); toast('Budget added'); App.render(); };

  D.brand.billing = async () => {
    const w = await API.call('wallet');
    return head('Billing', 'Funds you can assign to campaigns.') +
      kpis([stat('Available funds', money(w.balance), 'Not yet assigned to a campaign')]) +
      panel('Add funds', `<form data-form="addFunds" class="form inline"><label>Amount (USD)<input name="amount" type="number" min="10" step="1" value="500" required></label><button class="btn primary">Add funds</button></form>
        <p class="soft">Test mode: no card is charged. Connect a payment provider before going live.</p>`) +
      `<h2 class="sub-h">Activity</h2>${txTable(w.tx)}`;
  };
  F.addFunds = async (d) => { await API.call('addFunds', d); await App.refreshUser(); toast('Funds added'); App.render(); };

  /* ============================ ADMIN ============================ */
  D.admin.overview = async () => {
    const o = await API.call('adminOverview');
    const open = o.pendingCampaigns + o.pendingClips + o.pendingPayouts;
    const queue = [
      ['#/dashboard/campaigns', 'Campaigns to review', o.pendingCampaigns, ''],
      ['#/dashboard/submissions', 'Clips in review', o.pendingClips, ''],
      ['#/dashboard/payouts', 'Payouts waiting', o.pendingPayouts, money(o.pendingPayoutTotal)],
    ].map((q) => `<a class="li" href="${q[0]}"><span><b>${q[1]}</b>${q[3] ? `<small>${q[3]} requested</small>` : ''}</span><span class="li-end"><b class="num">${q[2]}</b></span></a>`).join('');
    return head(open ? `${plural(open, 'item needs', 'items need')} a decision.` : 'Nothing is waiting for a decision.', 'Everything happening on clipZ.', `<button class="btn outline" data-act="syncViews">Run view sync</button>`) +
      `<div class="ov"><div class="ov-main">
        ${kpis([stat('Users', String(o.users), o.stats.clippers + ' clippers, ' + o.stats.brands + ' brands'), stat('Verified views', compact(o.stats.views)), stat('Paid to clippers', money(o.stats.paid)), stat('Budget held', money(o.escrow), 'Funded, not yet spent')])}
        ${panel('Earnings credited, last 14 days', barChart(o.chart), `<span class="panel-note">${money(sum(o.chart))} in 14 days</span>`)}
      </div>
      <div class="ov-rail">${rail('Review queues', queue)}</div></div>`;
  };
  A.syncViews = async () => { const r = await API.call('syncViews'); toast(`Synced ${r.updated} clips, ${money(r.credited)} credited`); App.render(); };

  D.admin.campaigns = async () => {
    const list = await API.call('adminCampaigns');
    const pend = list.filter((c) => c.status === 'pending').length;
    const btn = (c, s, label, cls) => `<button class="btn sm ${cls || 'outline'}" data-act="adminCamp" data-id="${esc(c.id)}" data-s="${s}">${label}</button>`;
    return head('Campaigns', `${plural(list.length, 'campaign')}, ${pend} waiting for review.`) + table(['Campaign', 'Status', '#Budget', '#Spent', '#Clips', 'Actions'], list.map((c) =>
      `<tr><td><b>${esc(c.title)}</b><small>${esc(c.brandName)}, ${money(c.rate)} per 1K</small></td><td>${badge(c.status)}${c.featured ? ' ' + badge('featured') : ''}</td>
       <td class="num">${money0(c.budget)}</td><td class="num">${money0(c.spent)}</td><td class="num">${c.clips}</td>
       <td class="act">${c.status === 'pending' ? btn(c, 'live', 'Approve', 'primary') + btn(c, 'rejected', 'Reject') : ''}${c.status === 'live' ? btn(c, 'paused', 'Pause') : ''}${c.status === 'paused' ? btn(c, 'live', 'Resume') : ''}${c.status === 'live' ? `<button class="btn sm outline" data-act="adminFeature" data-id="${esc(c.id)}" data-f="${c.featured ? '' : '1'}">${c.featured ? 'Unfeature' : 'Feature'}</button>` : ''}</td></tr>`));
  };
  A.adminCamp = async (el) => { await API.call('adminSetCampaign', { id: el.dataset.id, status: el.dataset.s }); toast('Campaign updated'); App.render(); };
  A.adminFeature = async (el) => { await API.call('adminSetCampaign', { id: el.dataset.id, featured: !!el.dataset.f }); toast('Campaign updated'); App.render(); };

  D.admin.submissions = async () => {
    const list = await API.call('adminSubmissions', {});
    const pend = list.filter((s) => s.status === 'pending').length;
    return head('Clips', `${plural(list.length, 'clip')} across the platform, ${pend} in review.`) + (list.length ? reviewTable(list, 'adminReview', true) : empty('No clips', 'Nothing submitted yet.'));
  };

  D.admin.payouts = async () => {
    const list = await API.call('adminPayouts');
    const pend = list.filter((p) => p.status === 'pending');
    return head('Payouts', pend.length ? `${plural(pend.length, 'request')} waiting, ${money(pend.reduce((a, p) => a + p.amount, 0))} in total. Send the money, then mark it paid.` : 'Send the money, then mark the request as paid.') + (list.length ? table(['Clipper', 'Requested', 'Method', 'Destination', '#Amount', 'Status', ''], list.map((p) =>
      `<tr><td><b>${esc(p.userName)}</b></td><td>${date(p.createdAt)}</td><td>${esc(p.method === 'paypal' ? 'PayPal' : p.method.toUpperCase())}</td><td class="soft">${esc(p.address)}</td><td class="num">${money(p.amount)}</td><td>${badge(p.status)}</td>
       <td class="act">${p.status === 'pending' ? `<button class="btn sm primary" data-act="payout" data-id="${esc(p.id)}" data-a="paid">Mark paid</button><button class="btn sm outline" data-act="payout" data-id="${esc(p.id)}" data-a="reject">Reject</button>` : ''}</td></tr>`)) : empty('No payouts', 'Payout requests will appear here.'));
  };
  A.payout = async (el) => { await API.call('processPayout', { id: el.dataset.id, action: el.dataset.a }); toast(el.dataset.a === 'paid' ? 'Marked as paid' : 'Payout rejected and refunded'); App.render(); };

  D.admin.users = async () => {
    const list = await API.call('adminUsers');
    const role = { clipper: 'Clipper', brand: 'Brand', admin: 'Admin' };
    return head('Users', `${plural(list.length, 'account')}.`) + table(['User', 'Role', 'Joined', '#Balance', '#Activity', 'Status', ''], list.map((u) =>
      `<tr><td><span class="who-cell">${avatar(u)}<span><b>${esc(u.name)}</b><small>${esc(u.email)}</small></span></span></td><td>${esc(role[u.role] || u.role)}</td><td class="nowrap">${date(u.createdAt)}</td>
       <td class="num">${money(u.balance)}</td><td class="num">${u.role === 'brand' ? plural(u.campaigns, 'campaign') : u.role === 'clipper' ? plural(u.clips, 'clip') : '—'}</td><td>${badge(u.status)}</td>
       <td class="act">${u.role === 'admin' ? '' : `<button class="btn sm ${u.status === 'active' ? 'outline' : 'primary'}" data-act="userStatus" data-id="${esc(u.id)}" data-s="${u.status === 'active' ? 'suspended' : 'active'}">${u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>`}</td></tr>`));
  };
  A.userStatus = async (el) => { await API.call('setUserStatus', { id: el.dataset.id, status: el.dataset.s }); toast('User updated'); App.render(); };

  V.dashboard = async (section, _q, arg) => {
    const role = state.user.role, pages = D[role];
    const fn = pages[section || 'overview'] || pages.overview;
    return `<div class="col">${await fn(arg)}</div>`;
  };
})();
