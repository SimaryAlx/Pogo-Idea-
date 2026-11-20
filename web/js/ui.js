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
  const daysLeft = (t) => { const d = Math.ceil((t - Date.now()) / 86400000); return d > 0 ? d + ' days left' : 'Ending soon'; };

  const PLATFORM = {
    tiktok: { name: 'TikTok', color: '#25f4ee' }, instagram: { name: 'Reels', color: '#ff5c8a' },
    youtube: { name: 'Shorts', color: '#ff4d4d' }, x: { name: 'X', color: '#e7e7ee' },
  };
  const platformChip = (p) => `<span class="chip"><i style="background:${PLATFORM[p].color}"></i>${PLATFORM[p].name}</span>`;
  const badge = (status) => `<span class="badge b-${esc(status)}">${esc(status)}</span>`;
  const avatar = (u, size) => `<span class="avatar${size ? ' ' + size : ''}" style="background:${esc(u.color || '#7c5cff')}">${esc((u.name || '?').trim().charAt(0).toUpperCase())}</span>`;
  const safeUrl = (u) => (/^https:\/\//i.test(u) ? esc(u) : '#');

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'ok');
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3600);
  }

  function modal(title, body) {
    document.getElementById('modal-root').innerHTML =
      `<div class="overlay" data-act="closeModal"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-act="closeModal" aria-label="Close">✕</button></div>${body}</div></div>`;
    const first = document.querySelector('.modal input, .modal select, .modal textarea');
    if (first) first.focus();
  }
  const closeModal = () => { document.getElementById('modal-root').innerHTML = ''; };

  function barChart(points, fmt) {
    const max = Math.max.apply(null, points.map((p) => p.value).concat([1]));
    return `<div class="chart">${points.map((p) =>
      `<div class="bar-col" title="${esc(p.label)}: ${esc((fmt || money)(p.value))}"><div class="bar" style="height:${Math.max(2, Math.round((p.value / max) * 100))}%"></div><span>${esc(p.label.split('/')[1])}</span></div>`).join('')}</div>`;
  }

  const stat = (label, value, hint) => `<div class="stat"><span>${esc(label)}</span><b>${esc(value)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
  const empty = (title, text, cta) => `<div class="empty"><b>${esc(title)}</b><p>${esc(text)}</p>${cta || ''}</div>`;

  function campaignCard(c) {
    return `<a class="card camp" href="#/campaign/${esc(c.id)}">
      <div class="cover" style="--c:${esc(c.color)}"><span class="emoji">${esc(c.emoji || '🎬')}</span>
        ${c.status !== 'live' ? '<span class="tag ended">Ended</span>' : c.featured ? '<span class="tag">Featured</span>' : ''}
        <span class="rate">${money(c.rate)}<small> / 1K views</small></span></div>
      <div class="camp-body">
        <small class="muted">${esc(c.brandName)} · ${esc(c.category)}</small>
        <h3>${esc(c.title)}</h3>
        <div class="chips">${c.platforms.map(platformChip).join('')}</div>
        <div class="progress"><div style="width:${c.progress}%"></div></div>
        <div class="row between small"><span>${money0(c.spent)} of ${money0(c.budget)} paid</span><span class="muted">${compact(c.views)} views</span></div>
      </div></a>`;
  }

  window.UI = { esc, money, money0, compact, date, ago, daysLeft, PLATFORM, platformChip, badge, avatar, safeUrl, toast, modal, closeModal, barChart, stat, empty, campaignCard };
})();
