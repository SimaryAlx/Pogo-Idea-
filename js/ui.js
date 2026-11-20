/* Shared UI helpers, formatting and small components. */
(function () {
  'use strict';
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money0 = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('en-US');
  const compact = (n) => {
    n = Number(n || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  };
  const date = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const ago = (t) => {
    const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 30 * 86400) return Math.floor(s / 86400) + 'd ago';
    return date(t);
  };
  const daysLeft = (t) => { const d = Math.ceil((t - Date.now()) / 86400000); return d > 1 ? d + ' days left' : d === 1 ? '1 day left' : 'Ending soon'; };

  const PLATFORM = {
    tiktok: { name: 'TikTok' }, instagram: { name: 'Reels' },
    youtube: { name: 'Shorts' }, x: { name: 'X' },
  };
  const platformList = (list) => (list || []).map((p) => (PLATFORM[p] ? PLATFORM[p].name : p)).join(', ');
  const platformChip = (p) => `<span class="plat">${esc(PLATFORM[p] ? PLATFORM[p].name : p)}</span>`;
  const STATUS = { live: 'Live', pending: 'In review', approved: 'Approved', rejected: 'Rejected', paused: 'Paused', completed: 'Finished', paid: 'Paid', active: 'Active', suspended: 'Suspended', featured: 'Featured' };
  const badge = (status) => `<span class="pill p-${esc(status)}">${esc(STATUS[status] || status)}</span>`;
  const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
  const avatar = (u, size) => `<span class="avatar${size ? ' ' + size : ''}" style="--who:${esc(u.color || '#f9a3c0')}" aria-hidden="true">${esc(initials(u.name))}</span>`;
  const safeUrl = (u) => (/^https:\/\//i.test(u) ? esc(u) : '#');

  /* Sample photographs from open collections, matched to a campaign's world (credits in the footer). */
  const PHOTOS = {
    monitors: { src: 'assets/dual-monitor-setup-in-a-gaming-room.jpg', w: 1920, h: 1282, alt: 'Two monitors and a keyboard on a desk lit green', pos: '40% 50%' },
    mic: { src: 'assets/blue-condenser-microphone-unsplash.jpg', w: 1920, h: 1272, alt: 'A condenser microphone on a stand', pos: '68% 50%' },
    pad: { src: 'assets/video-game-controller.webp', w: 1024, h: 683, alt: 'A video game controller held in two hands', pos: '50% 50%' },
    crowd: { src: 'assets/a-large-crowd-enjoys-a-music-concert.jpg', w: 1920, h: 1280, alt: 'A crowd at a night concert under coloured stage lights', pos: '36% 50%' },
    can: { src: 'assets/soda-can-top-40144477233.jpg', w: 1920, h: 1281, alt: 'The top of an aluminium drink can, close up', pos: '50% 50%' },
    serum: { src: 'assets/dropper-bottle-blank-retro-label.webp', w: 1024, h: 683, alt: 'An amber dropper bottle with a blank label', pos: '50% 50%' },
    skate: { src: 'assets/skateboard-tricks-unsplash.jpg', w: 1920, h: 1280, alt: 'A skater mid-trick over stone steps while a friend films it', pos: '52% 50%' },
    gym: { src: 'assets/strong-woman-lifting-weights-in-a-gym.jpg', w: 1920, h: 2877, alt: 'A woman setting up a barbell in a gym', pos: '50% 40%' },
    desk: { src: 'assets/notebook-cup-coffee-wooden-table.webp', w: 1024, h: 683, alt: 'A notebook and a cup of coffee on a wooden table', pos: '50% 50%' },
  };
  const BY_CATEGORY = { Streamers: 'monitors', Podcasts: 'mic', Gaming: 'pad', Music: 'crowd', Brands: 'can', Sports: 'skate', Education: 'desk' };
  const BY_BRAND = { 'Luma Skin': 'serum', 'Atlas Fit': 'gym' };
  const photoKey = (c) => BY_BRAND[c.brandName] || BY_CATEGORY[c.category] || 'skate';
  const photo = (key, cls, opts) => {
    const p = PHOTOS[key] || PHOTOS.skate, o = opts || {};
    return `<img class="${cls || ''}" src="${p.src}" width="${p.w}" height="${p.h}" alt="${esc(o.alt === undefined ? p.alt : o.alt)}" style="object-position:${p.pos}"${o.eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
  };
  const cover = (c, cls, opts) => photo(photoKey(c), cls, opts);

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'ok');
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3600);
  }

  let lastFocus = null;
  function modal(title, body) {
    lastFocus = document.activeElement;
    document.getElementById('modal-root').innerHTML =
      `<div class="overlay" data-act="closeModal"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="textbtn" data-act="closeModal" type="button">Close</button></div>${body}</div></div>`;
    const first = document.querySelector('.modal input:not([type=hidden]), .modal select, .modal textarea');
    if (first) first.focus();
  }
  const closeModal = () => {
    const root = document.getElementById('modal-root');
    if (!root.innerHTML) return;
    root.innerHTML = '';
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  };

  /* One series, one hue: the current day's bar in full accent, the rest in a softer step. */
  function barChart(points, fmt) {
    const f = fmt || money;
    const max = Math.max.apply(null, points.map((p) => p.value).concat([0]));
    const top = niceMax(max);
    const total = points.reduce((a, p) => a + p.value, 0);
    const ticks = [top, top / 2, 0];
    return `<div class="chart" role="img" aria-label="${esc(points.length + ' days, total ' + f(total))}">
      <div class="chart-y">${ticks.map((t) => `<span>${esc(fmtTick(t, f))}</span>`).join('')}</div>
      <div class="chart-plot">${points.map((p, i) =>
        `<div class="bar-col" title="${esc(p.label)}: ${esc(f(p.value))}"><div class="bar${i === points.length - 1 ? ' now' : ''}" style="height:${top ? Math.max(p.value ? 2 : 0, Math.round((p.value / top) * 100)) : 0}%"></div><span>${i % 2 === 0 || i === points.length - 1 ? esc(String(p.label).split('/')[1] || p.label) : ''}</span></div>`).join('')}</div></div>`;
  }
  function niceMax(v) {
    if (v <= 0) return 0;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  function fmtTick(t, f) { return f === money ? '$' + compact(t) : compact(t); }

  const stat = (label, value, hint) => `<div class="kpi"><span>${esc(label)}</span><b>${esc(value)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
  const empty = (title, text, cta) => `<div class="empty"><b>${esc(title)}</b><p>${esc(text)}</p>${cta || ''}</div>`;
  const bar = (pct) => `<span class="meter" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>`;

  /* A campaign as one row of the rate board. */
  function campaignRow(c) {
    const live = c.status === 'live';
    return `<a class="camp-row${live ? '' : ' done'}" href="#/campaign/${esc(c.id)}" data-reveal>
      <span class="camp-pic">${cover(c, '', { alt: '' })}</span>
      <span class="camp-main"><b class="camp-title">${esc(c.title)}</b>
        <span class="camp-meta">${esc(c.brandName)}, ${esc(c.category)}. ${esc(platformList(c.platforms))}</span>
        <span class="camp-state">${live ? (c.featured ? 'Featured, ' : '') + esc(daysLeft(c.endsAt)) : 'Finished'}</span></span>
      <span class="camp-rate"><b>${money(c.rate)}</b><span>per 1K views</span></span>
      <span class="camp-budget"><span>${money0(c.remaining)} left of ${money0(c.budget)}</span>${bar(c.progress)}<span class="camp-views">${compact(c.views)} views paid</span></span>
    </a>`;
  }

  window.UI = { esc, money, money0, compact, date, ago, daysLeft, PLATFORM, platformList, platformChip, badge, avatar, safeUrl, toast, modal, closeModal, barChart, stat, empty, bar, campaignRow, campaignCard: campaignRow, cover, photo, PHOTOS, photoKey };
})();
