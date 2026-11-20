/* Public pages: home, campaigns, campaign detail, leaderboard, clippers, brands, auth. */
(function () {
  'use strict';
  const { esc, money, money0, compact, daysLeft, PLATFORM, platformList, badge, avatar, safeUrl, toast, modal, closeModal, empty, bar, campaignRow, cover, photo, photoKey } = window.UI;
  const V = (window.Views = {}), A = (window.Actions = {}), F = (window.Forms = {});
  const state = (window.State = { user: null, filters: { q: '', platform: '', category: '', sort: 'featured' }, period: 'all' });
  const init = (window.PageInit = []);
  const num = (n) => Number(n || 0).toLocaleString('en-US');

  /* ---------------- shared pieces ---------------- */

  // The idea: the editor's own output, a run of vertical clips, stands in a word's place in the sentence.
  const STRIP = ['skate', 'crowd', 'mic', 'video', 'pad', 'gym', 'monitors', 'can'];
  function strip(order) {
    return `<span class="strip shutter" aria-hidden="true">${(order || STRIP).map((k) => k === 'video'
      ? `<span class="fr"><video data-loop autoplay muted loop playsinline preload="metadata" poster="assets/louis-sarowsky-performing-at-gowanus-e-waste-poster.jpg" width="608" height="1080" tabindex="-1"><source src="assets/louis-sarowsky-performing-at-gowanus-e-waste.webm" type="video/webm"></video></span>`
      : `<span class="fr">${photo(k, '', { alt: '', eager: true })}</span>`).join('')}</span>`;
  }
  const sentence = (a, hidden, b, order) =>
    `<h1 class="sentence"><span class="w">${a}</span>${strip(order)}<span class="sr"> ${hidden} </span><span class="w">${b}</span></h1>`;

  function hero(o) {
    return `<section class="hero">
      ${sentence(o.a, o.hidden, o.b, o.order)}
      <div class="hero-foot">
        <p class="lead" data-reveal style="--d:120ms">${o.lead}</p>
        <div class="hero-act" data-reveal style="--d:200ms">${o.actions}</div>
      </div>
    </section>`;
  }

  function ask(l1, l2, actions, note) {
    return `<section class="ask">
      <h2 class="ask-q"><span>${l1}</span><span>${l2}</span></h2>
      <div class="ask-mid" data-reveal>${actions}${note ? `<p>${note}</p>` : ''}</div>
    </section>`;
  }

  const faq = (list) => list.map((q) => `<details data-reveal><summary>${q[0]}</summary><p>${q[1]}</p></details>`).join('');

  function boardRows(rows) {
    if (!rows.length) return empty('No clips yet', 'The leaderboard fills up as clips get approved.');
    return `<table class="board-table"><caption class="sr">Clippers ranked by verified views</caption>
      <thead class="sr"><tr><th scope="col">Clipper</th><th scope="col">Clips</th><th scope="col">Views</th><th scope="col">Earned</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr class="${i && i % 4 === 0 ? 'gap' : ''}"><td><span class="rank">${i + 1}.</span> ${esc(r.user.name)}</td><td class="soft">${r.clips} clip${r.clips === 1 ? '' : 's'}</td><td class="num">${compact(r.views)} views</td><td class="num">${money(r.earned)}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------------- home ---------------- */

  const FIND_EXAMPLES = ['podcast', 'gaming', 'skate', 'music'];

  function findAnswer(list, q) {
    const rows = list.filter((c) => c.status === 'live').slice(0, 3);
    if (!rows.length) {
      return { rows: `<p class="find-none">No live campaign matches “${esc(q)}”. Try ${FIND_EXAMPLES.map((x) => `<button class="textbtn" type="button" data-act="findTry" data-q="${x}">${x}</button>`).join(', ')}.</p>`, pic: null };
    }
    const c = rows[0];
    const at = 100000;
    let line;
    if (c.minViews > at) line = `This campaign pays from ${compact(c.minViews)} views per clip.`;
    else {
      const raw = (at / 1000) * c.rate, capped = c.maxPayout && raw > c.maxPayout;
      line = `A clip with 100K views earns ${money(capped ? c.maxPayout : raw)} here${capped ? ', the most one clip can earn' : ''}.`;
    }
    return {
      rows: rows.map((r, i) => `<a class="res" href="#/campaign/${esc(r.id)}">
        <span class="res-pic">${cover(r, '', { alt: '' })}</span>
        <span class="res-main"><b>${esc(r.title)}</b><span>${esc(r.brandName)}, ${esc(r.category)}. ${esc(platformList(r.platforms))}</span>${i === 0 ? `<span class="res-calc">${line}</span>` : ''}</span>
        <span class="res-num"><b>${money(r.rate)}</b><span>per 1K views</span><span>${money0(r.remaining)} left</span></span></a>`).join(''),
      pic: c,
    };
  }
  const findPic = (c) => c ? `<figure class="find-pic">${cover(c, '', {})}<figcaption>${esc(c.title)}</figcaption></figure>` : `<figure class="find-pic">${photo('skate')}<figcaption>Every live campaign is listed here</figcaption></figure>`;

  let findSeq = 0, findTimer = null;
  const sizeFind = (el) => {
    const m = el.parentElement.querySelector('.find-measure');
    if (!m) return;
    m.textContent = el.value || ' ';
    el.style.width = Math.ceil(m.getBoundingClientRect().width) + 4 + 'px';
  };
  window.addEventListener('resize', () => { const el = document.getElementById('find-q'); if (el) sizeFind(el); });
  A.find = (el) => {
    sizeFind(el);
    clearTimeout(findTimer);
    findTimer = setTimeout(async () => {
      const q = el.value.trim(), seq = ++findSeq;
      const list = await API.call('listCampaigns', { q });
      if (seq !== findSeq) return;
      const out = findAnswer(list, q || 'that');
      const box = document.getElementById('find-results'), pic = document.getElementById('find-pic');
      if (box) box.innerHTML = out.rows;
      if (pic) pic.innerHTML = findPic(out.pic);
    }, 140);
  };
  A.findTry = (el) => {
    const input = document.getElementById('find-q');
    if (!input) return;
    input.value = el.dataset.q;
    input.focus();
    A.find(input);
  };

  function rulesBands(list) {
    const by = (t) => list.find((c) => c.title.indexOf(t) === 0);
    const capC = by('Nova Zero Sugar') || list[0], floorC = by('Emberfall') || list[1] || list[0];
    const bands = [
      ['Approve every clip before it earns', 'Clips wait in your review queue. A rejected clip earns $0 and costs you nothing.', true],
      ['Cap what one clip can earn', capC ? `${esc(capC.title)} caps each clip at ${money0(capC.maxPayout)}, so one viral post can’t drain its ${money0(capC.budget)} budget.` : 'Set the most any single clip can earn.', true],
      ['Pay only past a view floor', floorC ? `${esc(floorC.title)} pays from ${num(floorC.minViews)} views. Below that, a clip earns nothing.` : 'Set the views a clip needs before it earns.', false],
      ['Pause the spending at any time', 'A paused campaign stops paying out at once. Unspent budget stays in your account.', false],
    ];
    return bands.map((b, i) => `<div class="band${b[2] ? ' on' : ''}" style="--fill:var(--fill-${i + 1});--fill-ink:var(--fill-ink-${i + 1})">
        <h3>${b[0]}</h3>
        <button class="switch" type="button" role="switch" aria-checked="${b[2]}" data-act="band" data-keep data-ui><span class="sr">${b[0]}</span><i></i></button>
        <p class="band-more">${b[1]}</p></div>`).join('');
  }
  A.band = (el) => {
    const on = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', String(on));
    el.closest('.band').classList.toggle('on', on);
  };

  function howStages(c) {
    const rate = c ? c.rate : 2, cap = c ? c.maxPayout : 400, views = 120000;
    const earned = Math.min((views / 1000) * rate, cap || Infinity);
    const title = c ? esc(c.title) : 'Emberfall Open Beta';
    return [
      ['Join', 'Join a campaign that fits your page', `<div class="ui-card" data-ui>
          <div class="ui-cover">${c ? cover(c, '', { alt: '' }) : photo('pad', '', { alt: '' })}</div>
          <div class="ui-body"><span class="ui-meta">${c ? esc(c.brandName) + ', ' + esc(c.category) : 'Pixel Forge Games, Gaming'}</span><b class="ui-title">${title}</b>
            <dl class="ui-facts"><div><dt>Rate</dt><dd>${money(rate)} per 1K views</dd></div><div><dt>Pays from</dt><dd>${num(c ? c.minViews : 20000)} views</dd></div>
              <div><dt>Most per clip</dt><dd>${money0(cap)}</dd></div><div><dt>Budget left</dt><dd>${money0(c ? c.remaining : 9000)}</dd></div></dl>
            <span class="ui-btn is-done">Joined</span></div></div>`],
      ['Cut and post', 'Cut the best moment, post it vertical', `<div class="ui-clip" data-ui>
          <div class="ui-frame">${c ? cover(c, '', { alt: '' }) : photo('pad', '', { alt: '' })}<span class="ui-time">0:38</span></div>
          <dl class="ui-facts"><div><dt>Length</dt><dd>0:38, inside 15–60 s</dd></div><div><dt>Format</dt><dd>Vertical 9:16</dd></div><div><dt>Caption</dt><dd>Tags the official account</dd></div><div><dt>Posted on</dt><dd>TikTok, your own page</dd></div></dl></div>`],
      ['Submit the link', 'Paste the link, the brand reviews it', `<div class="ui-form" data-ui>
          <b class="ui-title">Submit a clip</b>
          <span class="ui-field"><small>Campaign</small><span>${title}</span></span>
          <span class="ui-field"><small>Platform</small><span>TikTok</span></span>
          <span class="ui-field is-focus"><small>Post URL</small><span>https://www.tiktok.com/@zanecuts/video/7391…</span></span>
          <span class="ui-row"><span class="ui-btn">Submit for review</span><span class="pill p-pending">In review</span></span></div>`],
      ['Get paid', 'Verified views land in your balance', `<div class="ui-wallet" data-ui>
          <span class="ui-meta">Available balance</span><b class="ui-big">${money(earned)}</b>
          <ul class="ui-tx"><li><span>${title}<small>${compact(views)} verified views at ${money(rate)} per 1K</small></span><b>+${money(earned)}</b></li>
            <li><span>Minimum payout<small>PayPal, USDT or USDC</small></span><b>$10.00</b></li></ul>
          <span class="ui-btn">Request payout</span></div>`],
    ];
  }
  function how(c) {
    const st = howStages(c);
    return `<section class="how" data-how>
      <div class="how-clause"><h2 aria-live="polite">${st.map((s, i) => `<span class="how-c${i === 0 ? ' on' : ''}">${s[1]}</span>`).join('')}</h2></div>
      <div class="how-frag">${st.map((s, i) => `<div class="how-f${i === 0 ? ' on' : ''}">${s[2]}</div>`).join('')}</div>
      <div class="how-rail" data-ui>
        <label class="sr" for="how-range">Stage</label>
        <div class="range"><i class="range-fill" style="width:0%"></i><input id="how-range" type="range" min="0" max="3" step="1" value="0" data-input="how" aria-valuetext="${st[0][0]}"></div>
        <div class="how-names">${st.map((s, i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-act="howGo" data-i="${i}" data-keep>${s[0]}</button>`).join('')}</div>
      </div>
    </section>`;
  }
  function howSet(sec, i) {
    sec.querySelectorAll('.how-c').forEach((el, k) => el.classList.toggle('on', k === i));
    sec.querySelectorAll('.how-f').forEach((el, k) => el.classList.toggle('on', k === i));
    sec.querySelectorAll('.how-names button').forEach((el, k) => el.classList.toggle('on', k === i));
    const r = sec.querySelector('input[type=range]');
    r.value = i;
    r.setAttribute('aria-valuetext', sec.querySelectorAll('.how-names button')[i].textContent);
    sec.querySelector('.range-fill').style.width = (i / 3) * 100 + '%';
  }
  A.how = (el) => howSet(el.closest('[data-how]'), Number(el.value));
  A.howGo = (el) => howSet(el.closest('[data-how]'), Number(el.dataset.i));

  V.home = async () => {
    const [stats, all, top, found] = await Promise.all([API.call('stats'), API.call('listCampaigns', {}), API.call('leaderboard', {}), API.call('listCampaigns', { q: 'nova' })]);
    const live = all.filter((c) => c.status === 'live');
    const feat = all.find((c) => c.title.indexOf('Emberfall') === 0) || live[0];
    const ans = findAnswer(found, 'nova');
    return hero({
      a: 'Every', hidden: 'clip', b: 'pays',
      lead: `clipZ is a marketplace for clippers. Brands fund campaigns; you post vertical clips on TikTok, Reels, Shorts or X and earn per 1,000 verified views.`,
      actions: `<a class="btn primary lg" href="#/signup?role=clipper">Start clipping</a><a class="link" href="#/brands">Launch a campaign</a><span class="hero-note">${stats.liveCampaigns} campaigns are paying right now.</span>`,
    }) + `
    <section class="find" aria-labelledby="find-h">
      <h2 id="find-h" data-reveal><label for="find-q">What do you want to clip?</label></h2>
      <div class="find-line" data-ui data-reveal style="--d:80ms"><input id="find-q" class="find-input" type="search" value="nova" autocomplete="off" spellcheck="false" data-input="find" aria-describedby="find-help"><i class="caret" aria-hidden="true"></i><span class="find-measure" aria-hidden="true"></span></div>
      <div class="find-body">
        <div class="find-left">
          <div class="find-results" id="find-results" data-ui aria-live="polite">${ans.rows}</div>
          <p class="find-try" id="find-help">Try ${FIND_EXAMPLES.map((x) => `<button class="textbtn" type="button" data-act="findTry" data-q="${x}">${x}</button>`).join(' ')} or <a href="#/campaigns">see all ${live.length} live campaigns</a>.</p>
        </div>
        <div class="find-right" id="find-pic" data-reveal style="--d:160ms">${findPic(ans.pic)}</div>
      </div>
    </section>
    <section class="rules" aria-labelledby="rules-h">
      <h2 id="rules-h" class="rules-h" data-reveal>Brands set the rules,<br>clippers see them first</h2>
      ${rulesBands(all)}
    </section>
    ${how(feat)}
    <section class="board" aria-labelledby="board-h">
      <h2 id="board-h" data-reveal><span class="indent">The clippers pulling</span><br>the most views</h2>
      <div class="board-grid">
        <figure class="board-pic" data-reveal>${photo('skate', '', { alt: 'A skater mid-trick over stone steps while a friend films it' })}<figcaption>Every top clip starts with someone filming.</figcaption></figure>
        <span class="board-word">All time</span>
        <div class="board-list" data-reveal style="--d:120ms">${boardRows(top.slice(0, 8))}<a class="link" href="#/leaderboard">See the full leaderboard</a></div>
      </div>
    </section>
    <section class="faq" aria-labelledby="faq-h">
      <h2 id="faq-h" data-reveal>Questions before<br>your first clip</h2>
      <div class="faq-list">${faq([
        ['Do I need a big following to earn?', 'No. Campaigns pay on the views your clips get, not on your follower count. A brand-new account can earn from its first clip that takes off.'],
        ['How are views counted?', 'After a brand approves your clip, clipZ tracks its public view count and credits your balance as it grows, at the campaign’s rate per 1,000 views.'],
        ['Which platforms count?', 'TikTok, Instagram Reels, YouTube Shorts and X. Each campaign lists the ones it pays for, and the clip must be posted from your own account.'],
        ['When can I withdraw?', 'Any time your available balance is $10 or more. Choose PayPal, USDT or USDC and the team sends it.'],
        ['What does it cost a brand?', 'You fund a campaign budget and only that budget is spent, on approved clips, at the rate you set. Unspent budget stays yours.'],
        ['What stops fake views?', 'Every clip is reviewed before it earns, each campaign sets a view floor and a cap per clip, and accounts with botted views are suspended.'],
      ])}</div>
    </section>
    ${ask('Clip it', 'or fund it?', `<div class="ask-row"><a class="btn primary lg" href="#/signup?role=clipper">Start clipping</a><span class="or">or</span><a class="btn lg" href="#/signup?role=brand">Launch a campaign</a></div>`, 'Both accounts are free. Brands pay only for approved, verified views.')}`;
  };

  /* ---------------- campaigns ---------------- */

  V.campaigns = async () => {
    const f = state.filters;
    const [list, all] = await Promise.all([API.call('listCampaigns', f), API.call('listCampaigns', {})]);
    boardList = list;
    const live = all.filter((c) => c.status === 'live');
    const best = live.slice().sort((a, b) => b.rate - a.rate)[0];
    const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
    return `<section class="page-head">
        <div class="ph-main"><h1 data-reveal>Campaigns</h1>
          <p class="lead" data-reveal style="--d:80ms">${live.length} live right now. Each one shows its rate, the budget left and its rules before you join.</p></div>
        ${best ? `<a class="ph-fig" href="#/campaign/${esc(best.id)}" data-reveal style="--d:160ms"><b>${money(best.rate)}</b><span>per 1K views, the best rate today, on ${esc(best.title)}</span></a>` : ''}
      </section>
      <form class="filters" data-form="filter" role="search">
        <label class="f-q"><span class="sr">Search</span><input name="q" type="search" placeholder="Search campaigns or brands" value="${esc(f.q)}"></label>
        <label><span class="sr">Platform</span><select name="platform" data-change="filter">${opt('', 'All platforms', f.platform)}${Object.keys(PLATFORM).map((p) => opt(p, PLATFORM[p].name, f.platform)).join('')}</select></label>
        <label><span class="sr">Category</span><select name="category" data-change="filter">${opt('', 'All categories', f.category)}${ClipZCore.CATEGORIES.map((c) => opt(c, c, f.category)).join('')}</select></label>
        <label><span class="sr">Sort</span><select name="sort" data-change="filter">${opt('featured', 'Featured first', f.sort)}${opt('rate', 'Highest rate', f.sort)}${opt('budget', 'Most budget left', f.sort)}${opt('newest', 'Newest', f.sort)}</select></label>
        <button class="btn primary">Search</button>
      </form>
      ${list.length ? `<section class="board-split" aria-label="Campaign list" data-board>
        <div class="camp-list">${list.map(campaignRow).join('')}</div>
        <figure class="preview" aria-hidden="true">${previewOf(list[0])}</figure>
      </section>` : `<section class="board-split"><div class="camp-list">${empty('No campaigns match', 'Clear a filter or search for something else.')}</div></section>`}`;
  };
  const previewOf = (c) => `<div class="preview-pic">${cover(c, '', { alt: '' })}</div><figcaption><b>${esc(c.title)}</b><span>${money(c.rate)} per 1K views</span></figcaption>`;
  let boardList = [];
  function boardHover(e) {
    const row = e.target.closest('.camp-row');
    const board = e.currentTarget;
    if (!row || row.classList.contains('is-active')) return;
    const id = (row.getAttribute('href') || '').split('/').pop();
    const c = boardList.find((x) => x.id === id);
    if (!c) return;
    board.querySelectorAll('.camp-row.is-active').forEach((r) => r.classList.remove('is-active'));
    row.classList.add('is-active');
    board.querySelector('.preview').innerHTML = previewOf(c);
  }
  F.filter = (d) => { Object.assign(state.filters, { q: d.q || '', platform: d.platform || '', category: d.category || '', sort: d.sort || 'featured' }); App.render(); };

  V.campaign = async (id) => {
    const { campaign: c, topClips, joined, mine } = await API.call('getCampaign', { id });
    const u = state.user, live = c.status === 'live';
    let cta;
    if (!live) cta = `<span class="btn block is-off" aria-disabled="true">Campaign ${c.status === 'completed' ? 'finished' : esc(c.status)}</span>`;
    else if (!u) cta = `<a class="btn primary lg block" href="#/signup?role=clipper">Sign up to join</a>`;
    else if (u.role !== 'clipper') cta = `<p class="soft">Log in with a clipper account to join campaigns.</p>`;
    else if (!joined) cta = `<button class="btn primary lg block" data-act="join" data-id="${esc(c.id)}">Join campaign</button>`;
    else cta = `<button class="btn primary lg block" data-act="submitClip" data-id="${esc(c.id)}">Submit a clip</button><p class="soft">You’re in. ${mine.length} clip${mine.length === 1 ? '' : 's'} submitted.</p>`;
    const others = (await API.call('listCampaigns', {})).filter((x) => x.id !== c.id && x.status === 'live').slice(0, 3);
    return `<a class="back" href="#/campaigns">Back to campaigns</a>
    <section class="detail-top">
      <div class="dt-text">
        <h1 data-reveal>${esc(c.title)}</h1>
        <p class="detail-meta" data-reveal style="--d:60ms">${esc(c.brandName)}, ${esc(c.category)}. ${live ? esc(daysLeft(c.endsAt)) : 'Finished'}.</p>
        <p class="lead" data-reveal style="--d:120ms">${esc(c.description)}</p>
        <p class="dt-rate" data-reveal style="--d:180ms"><b>${money(c.rate)}</b> per 1,000 verified views, up to ${c.maxPayout ? money0(c.maxPayout) : 'any amount'} per clip.</p>
        <div class="dt-act" data-reveal style="--d:240ms">${cta.replace(/ block/g, '').replace(/<p class="soft">/, '<p class="soft">')}</div>
      </div>
      <figure class="dt-pic shutter">${cover(c, '', { eager: true })}</figure>
    </section>
    <div class="detail">
      <div class="detail-main">
        <h2>Rules</h2>
        <ul class="rules-list">${(c.requirements || []).map((r) => `<li>${esc(r)}</li>`).join('') || '<li>No special rules.</li>'}
          <li>Posted on ${esc(platformList(c.platforms))}.</li></ul>
        ${c.assetsUrl ? `<a class="btn" href="${safeUrl(c.assetsUrl)}" target="_blank" rel="noopener noreferrer">Download the source footage</a>` : ''}
        ${mine.length ? `<h2>Your clips</h2>${clipsTable(mine, false)}` : ''}
        <h2>Top clips</h2>
        ${topClips.length ? clipsTable(topClips, true) : empty('No approved clips yet', 'Be the first on the board.')}
      </div>
      <aside class="rate-box" aria-label="Pay and budget">
        <b class="rate-big">${money(c.rate)}</b><span class="rate-unit">per 1,000 verified views</span>
        ${bar(c.progress)}
        <p class="rate-split"><span>${money0(c.spent)} paid out</span><span>${money0(c.remaining)} left</span></p>
        <dl class="facts">
          <div><dt>Total budget</dt><dd>${money0(c.budget)}</dd></div>
          <div><dt>Pays from</dt><dd>${num(c.minViews)} views</dd></div>
          <div><dt>Most per clip</dt><dd>${c.maxPayout ? money0(c.maxPayout) : 'No cap'}</dd></div>
          <div><dt>Clippers</dt><dd>${c.clippers}</dd></div>
          <div><dt>Clips</dt><dd>${c.clips}</dd></div>
          <div><dt>Views paid</dt><dd>${compact(c.views)}</dd></div>
        </dl>${cta}
      </aside>
    </div>
    ${others.length ? `<section class="more" aria-labelledby="more-h"><h2 id="more-h">More campaigns paying now</h2><div class="camp-list">${others.map(campaignRow).join('')}</div></section>` : ''}`;
  };

  function clipsTable(rows, showClipper) {
    return `<div class="tbl"><table><thead><tr>${showClipper ? '<th scope="col">Clipper</th>' : ''}<th scope="col">Platform</th><th scope="col">Clip</th><th scope="col" class="num">Views</th><th scope="col" class="num">Earned</th>${showClipper ? '' : '<th scope="col">Status</th>'}</tr></thead><tbody>
      ${rows.map((s) => `<tr>${showClipper ? `<td><span class="who-cell">${avatar({ name: s.clipperName, color: s.clipperColor })}${esc(s.clipperName)}</span></td>` : ''}
        <td>${esc(PLATFORM[s.platform] ? PLATFORM[s.platform].name : s.platform)}</td><td><a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">Open clip</a> <span class="soft">${window.UI.ago(s.createdAt)}</span></td>
        <td class="num">${compact(s.views)}</td><td class="num">${money(s.earned)}</td>${showClipper ? '' : `<td>${badge(s.status)}</td>`}</tr>`).join('')}</tbody></table></div>`;
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
      <p class="soft">Paste the public link to your post. It must be on your own account and follow the campaign rules.</p>
      <button class="btn primary block">Submit for review</button></form>`);
    window._clipCamps = open;
  };
  A.clipCampaign = (el) => {
    const c = (window._clipCamps || []).find((x) => x.id === el.value);
    if (c) document.getElementById('clip-platform').innerHTML = c.platforms.map((p) => `<option value="${p}">${PLATFORM[p].name}</option>`).join('');
  };
  F.submitClip = async (d) => { await API.call('submitClip', d); closeModal(); toast('Clip submitted for review'); App.render(); };

  /* ---------------- leaderboard ---------------- */

  V.leaderboard = async () => {
    const [rows, camps] = await Promise.all([API.call('leaderboard', { period: state.period }), API.call('listCampaigns', { sort: 'featured' })]);
    const byViews = camps.filter((c) => c.status === 'live').sort((a, b) => b.views - a.views).slice(0, 4);
    const tab = (k, label) => `<button type="button" class="tab" aria-pressed="${state.period === k}" data-act="period" data-p="${k}">${label}</button>`;
    const lead = rows[0];
    return `<section class="page-head">
        <div class="ph-main"><h1 data-reveal>Leaderboard</h1>
          <p class="lead" data-reveal style="--d:80ms">Clippers ranked by verified views on approved clips.</p>
          <div data-reveal style="--d:120ms"><a class="btn primary" href="${state.user ? '#/campaigns' : '#/signup?role=clipper'}">${state.user ? 'Find a campaign' : 'Start clipping'}</a></div></div>
        ${lead ? `<div class="ph-fig" data-reveal style="--d:160ms"><b>${compact(lead.views)}</b><span>views for ${esc(lead.user.name)}, first place</span></div>` : ''}
      </section>
      <div class="tabs" role="group" aria-label="Period">${tab('week', 'This week')}${tab('month', 'This month')}${tab('all', 'All time')}</div>
      <section class="board board-page" aria-label="Rankings">
        <div class="board-grid">
          <figure class="board-pic" data-reveal>${photo('gym', '', { alt: 'A woman setting up a barbell in a gym' })}<figcaption>Fitness, gaming, music and podcasts all pay per view.</figcaption></figure>
          <div class="board-list wide" data-reveal style="--d:120ms">${rows.length ? `<table class="lb"><thead><tr><th scope="col">Clipper</th><th scope="col" class="num">Views</th><th scope="col" class="num">Clips</th><th scope="col" class="num">Earned</th></tr></thead><tbody>
            ${rows.map((r, i) => `<tr class="${i < 3 ? 'podium' : ''}${i && i % 4 === 0 ? ' gap' : ''}"><td><span class="rank">${i + 1}.</span> ${esc(r.user.name)}</td><td class="num">${compact(r.views)}</td><td class="num">${r.clips}</td><td class="num">${money(r.earned)}</td></tr>`).join('')}</tbody></table>` : empty('No clips in this period', 'Approved clips will rank here.')}</div>
        </div>
      </section>
      ${byViews.length ? `<section class="more" aria-labelledby="more-h"><h2 id="more-h">Campaigns with the most views paid</h2><div class="camp-list">${byViews.map(campaignRow).join('')}</div></section>` : ''}`;
  };
  A.period = (el) => { state.period = el.dataset.p; App.render(); };

  /* ---------------- for clippers ---------------- */

  const CALC_MAX = Math.log10(2000000), CALC_MIN = 3;
  const viewsAt = (v) => {
    const raw = Math.pow(10, CALC_MIN + (v / 100) * (CALC_MAX - CALC_MIN));
    const step = raw < 10000 ? 100 : raw < 100000 ? 1000 : 5000;
    return Math.round(raw / step) * step;
  };
  const sliderAt = (views) => Math.round(((Math.log10(views) - CALC_MIN) / (CALC_MAX - CALC_MIN)) * 100);
  function calcOut(c, views) {
    if (!c) return { fig: '$0.00', line: 'No live campaign to price right now.' };
    if (views < c.minViews) return { fig: '$0.00', line: `${esc(c.title)} pays from ${num(c.minViews)} views. Below that a clip earns nothing.` };
    const raw = (views / 1000) * c.rate;
    const capped = c.maxPayout && raw > c.maxPayout;
    const pay = Math.min(capped ? c.maxPayout : raw, c.remaining);
    return { fig: money(pay), line: `${num(views)} views at ${money(c.rate)} per 1K is ${money(raw)}.${capped ? ` This campaign pays at most ${money0(c.maxPayout)} per clip.` : ''}` };
  }
  let calcList = [];
  function calcUpdate(box) {
    const c = calcList.find((x) => x.id === box.querySelector('[name=calcCampaign]').value) || calcList[0];
    const views = viewsAt(Number(box.querySelector('[name=calcViews]').value));
    const out = calcOut(c, views);
    box.querySelector('.calc-views').textContent = num(views) + ' views';
    box.querySelector('.calc-fig').textContent = out.fig;
    box.querySelector('.calc-line').innerHTML = out.line;
    box.querySelector('[name=calcViews]').setAttribute('aria-valuetext', num(views) + ' views');
  }
  A.calc = (el) => calcUpdate(el.closest('[data-calc]'));

  V.creators = async () => {
    const all = await API.call('listCampaigns', {});
    calcList = all.filter((c) => c.status === 'live');
    const first = calcList[0], views0 = 150000, out = calcOut(first, views0);
    return hero({
      a: 'Your', hidden: 'clips', b: 'pay', order: ['crowd', 'pad', 'video', 'skate', 'mic', 'can', 'gym', 'monitors'],
      lead: 'Brands put real budgets behind their content. Cut the best moments, post them on your own pages and earn for every 1,000 verified views.',
      actions: `<a class="btn primary lg" href="#/signup?role=clipper">Create a clipper account</a><a class="link" href="#/campaigns">Browse campaigns</a>`,
    }) + `
    <section class="calc" data-calc aria-labelledby="calc-h">
      <h2 id="calc-h" data-reveal>What would one<br>clip earn you?</h2>
      <div class="calc-grid" data-ui>
        <div class="calc-in">
          <label class="calc-field"><span>Campaign</span><select name="calcCampaign" data-change="calc">${calcList.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}, ${money(c.rate)} per 1K</option>`).join('')}</select></label>
          <label class="calc-field"><span>Views on your clip: <b class="calc-views">${num(views0)} views</b></span>
            <input name="calcViews" type="range" min="0" max="100" step="1" value="${sliderAt(views0)}" data-input="calc" aria-valuetext="${num(views0)} views"></label>
          <p class="calc-note">Earnings follow each campaign’s view floor, its cap per clip and the budget it has left.</p>
        </div>
        <div class="calc-out" aria-live="polite"><b class="calc-fig">${out.fig}</b><p class="calc-line">${out.line}</p></div>
      </div>
    </section>
    <section class="gets" aria-labelledby="gets-h">
      <h2 id="gets-h" data-reveal>What you get<br>on clipZ</h2>
      <div class="gets-grid">
        <figure class="gets-pic" data-reveal>${photo('crowd', '', {})}<figcaption>Music campaigns pay for edits, lyric clips and montages.</figcaption></figure>
        <dl class="gets-list">
          <div data-reveal><dt>Clear rates</dt><dd>Every campaign lists its pay per 1,000 views, the views a clip needs and the most one clip can earn.</dd></div>
          <div data-reveal><dt>No follower minimum</dt><dd>You earn on the views your clip gets, not on how many people follow you.</dd></div>
          <div data-reveal><dt>One dashboard</dt><dd>Every clip, its review status, its views and what it has earned so far.</dd></div>
          <div data-reveal><dt>Withdrawals from $10</dt><dd>Cash out with PayPal, USDT or USDC once your balance passes $10.</dd></div>
        </dl>
      </div>
    </section>
    <section class="more" aria-labelledby="more-h"><h2 id="more-h">Paying right now</h2><div class="camp-list">${calcList.slice(0, 4).map(campaignRow).join('')}</div></section>
    ${ask('Pick your', 'campaign', `<div class="ask-row"><a class="btn primary lg" href="#/campaigns">Browse campaigns</a><span class="or">or</span><a class="btn lg" href="#/signup?role=clipper">Create an account</a></div>`, 'Free to join. No follower minimum.')}`;
  };

  /* ---------------- for brands ---------------- */

  V.brands = async () => {
    const all = await API.call('listCampaigns', {});
    return hero({
      a: 'Pay', hidden: 'only', b: 'per view', order: ['mic', 'video', 'can', 'crowd', 'serum', 'skate', 'pad', 'gym'],
      lead: 'Turn your streams, podcasts, launches and UGC into a run of short-form posts. You pay only for verified views on clips you approved.',
      actions: `<a class="btn primary lg" href="#/signup?role=brand">Launch a campaign</a><a class="link" href="#/campaigns">See live campaigns</a>`,
    }) + `
    <section class="rules" aria-labelledby="rules-h">
      <h2 id="rules-h" class="rules-h" data-reveal>Every campaign runs<br>on your terms</h2>
      ${rulesBands(all)}
    </section>
    <section class="gets" aria-labelledby="run-h">
      <h2 id="run-h" data-reveal>How a campaign<br>runs</h2>
      <div class="gets-grid">
        <figure class="gets-pic" data-reveal>${photo('mic', '', {})}<figcaption>A podcast season becomes hundreds of clips.</figcaption></figure>
        <dl class="gets-list">
          <div data-reveal><dt>Set the terms</dt><dd>Budget, rate per 1,000 views, platforms, the views a clip needs and your content rules.</dd></div>
          <div data-reveal><dt>Fund it once</dt><dd>The budget is held for the campaign. Spend can never pass what you funded.</dd></div>
          <div data-reveal><dt>Review the clips</dt><dd>Clippers submit their posts. Approve the ones that fit, reject the ones that don’t.</dd></div>
          <div data-reveal><dt>Watch it scale</dt><dd>Views, spend and cost per 1,000 views update in your dashboard. Top up or pause any time.</dd></div>
        </dl>
      </div>
    </section>
    <section class="more" aria-labelledby="more-h"><h2 id="more-h">Campaigns running this way</h2><div class="camp-list">${all.filter((c) => c.status === 'live').slice(0, 4).map(campaignRow).join('')}</div></section>
    ${ask('Ready to', 'launch?', `<div class="ask-row"><a class="btn primary lg" href="#/signup?role=brand">Create a brand account</a><span class="or">or</span><a class="btn lg" href="#/campaigns">See live campaigns</a></div>`, 'New campaigns go live after a quick review.')}`;
  };

  /* ---------------- auth ---------------- */

  const demoButtons = () => `<div class="demo"><span>Try a demo account:</span>
      <button class="textbtn" type="button" data-act="demoLogin" data-email="clipper@clipz.demo">Clipper</button>
      <button class="textbtn" type="button" data-act="demoLogin" data-email="brand@clipz.demo">Brand</button>
      <button class="textbtn" type="button" data-act="demoLogin" data-email="admin@clipz.demo">Admin</button></div>`;

  const authShell = (keys, form) => `<section class="auth">
      <div class="auth-col">${form}</div>
      <div class="auth-wall shutter" aria-hidden="true">${keys.map((k) => `<span class="fr">${photo(k, '', { alt: '', eager: true })}</span>`).join('')}</div>
    </section>`;

  V.login = async () => authShell(['skate', 'mic', 'crowd', 'pad'], `<h1>Log in</h1><p class="lead">Log in to clipZ, where clippers earn per 1,000 verified views and brands run campaigns.</p>
    <form data-form="login" class="form">
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="btn primary lg block">Log in</button></form>
    ${demoButtons()}<p class="soft">New here? <a href="#/signup">Create an account</a></p>`);

  V.signup = async (_, q) => {
    const role = q.role === 'brand' ? 'brand' : 'clipper';
    return authShell(role === 'brand' ? ['mic', 'can', 'serum', 'crowd'] : ['crowd', 'skate', 'gym', 'monitors'], `<h1>Sign up</h1><p class="lead">Create a free clipZ account: post clips and earn per view, or fund a campaign for your brand.</p>
    <form data-form="signup" class="form">
      <fieldset class="seg"><legend class="sr">Account type</legend><label><input type="radio" name="role" value="clipper"${role === 'clipper' ? ' checked' : ''}><span>I’m a clipper</span></label>
        <label><input type="radio" name="role" value="brand"${role === 'brand' ? ' checked' : ''}><span>I’m a brand</span></label></fieldset>
      <label>Name or brand name<input name="name" required maxlength="40" autocomplete="name"></label>
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Password<input name="password" type="password" required minlength="8" autocomplete="new-password"><small>At least 8 characters</small></label>
      <button class="btn primary lg block">Create account</button></form>
    ${demoButtons()}<p class="soft">Already have an account? <a href="#/login">Log in</a></p>`);
  };

  V.notFound = async () => {
    const live = (await API.call('listCampaigns', {})).filter((c) => c.status === 'live').slice(0, 4);
    return `<section class="missing"><h1 data-reveal>Page not found</h1><p class="lead" data-reveal style="--d:80ms">That page doesn’t exist on clipZ, or it moved. These campaigns are paying right now.</p><a class="btn primary" href="#/" data-reveal style="--d:140ms">Go to the home page</a></section>
    <section class="more" aria-labelledby="more-h"><h2 id="more-h" data-reveal>Live campaigns</h2><div class="camp-list">${live.map(campaignRow).join('')}</div></section>`;
  };

  const signedIn = (out, msg) => { state.user = out.user; toast(msg); location.hash = '#/dashboard'; };
  F.login = async (d) => signedIn(await API.call('login', d), 'Logged in');
  F.signup = async (d) => signedIn(await API.call('signup', d), 'Account created');
  A.demoLogin = async (el) => signedIn(await API.call('login', { email: el.dataset.email, password: 'demo1234' }), 'Logged in to the demo account');
  A.logout = () => { API.logout(); state.user = null; toast('Logged out'); location.hash = '#/'; App.render(); };
  A.closeModal = (el, e) => { if (e.target === el) closeModal(); };
  A.resetDemo = () => { API.reset(); state.user = null; toast('Demo data reset'); location.hash = '#/'; App.render(); };

  /* Page parts that need the live DOM. */
  init.push((root) => {
    const sec = root.querySelector('[data-how]');
    if (sec) howSet(sec, 0);
    const fq = root.querySelector('#find-q');
    if (fq) { sizeFind(fq); if (document.fonts) document.fonts.ready.then(() => fq.isConnected && sizeFind(fq)); }
    const board = root.querySelector('[data-board]');
    if (board) { board.addEventListener('mouseover', boardHover); board.addEventListener('focusin', boardHover); const r0 = board.querySelector('.camp-row'); if (r0) r0.classList.add('is-active'); }
    const box = root.querySelector('[data-calc]');
    if (box) calcUpdate(box);
  });
})();
