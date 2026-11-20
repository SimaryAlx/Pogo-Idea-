/*
 * clipZ core — all business logic, shared by the Node server and the in-browser demo.
 * It operates on a plain JSON "db" object; persistence is injected by the host.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClipZCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'x'];
  const CATEGORIES = ['Streamers', 'Podcasts', 'Gaming', 'Music', 'Brands', 'Sports', 'Education'];
  const URL_RULES = {
    tiktok: /^https:\/\/([a-z]+\.)?tiktok\.com\/.+/i,
    instagram: /^https:\/\/([a-z]+\.)?instagram\.com\/.+/i,
    youtube: /^https:\/\/(([a-z]+\.)?youtube\.com|youtu\.be)\/.+/i,
    x: /^https:\/\/([a-z]+\.)?(x|twitter)\.com\/.+/i,
  };
  const MIN_PAYOUT = 10;
  const PAYOUT_METHODS = ['paypal', 'usdt', 'usdc'];
  const DAY = 86400000;

  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status || 400; }
  }
  const need = (cond, msg, status) => { if (!cond) throw new ApiError(msg, status); };
  const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 200);
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function emptyDb() {
    return { seq: 1, users: [], campaigns: [], memberships: [], submissions: [], payouts: [], tx: [] };
  }

  function createCore(db, opts) {
    const now = opts.now || (() => Date.now());
    const hash = opts.hash, verify = opts.verify;
    const save = opts.save || (() => {});
    const id = (p) => p + (db.seq++);

    const userById = (uid) => db.users.find((u) => u.id === uid);
    const campById = (cid) => db.campaigns.find((c) => c.id === cid);

    function publicUser(u, full) {
      const o = { id: u.id, name: u.name, role: u.role, color: u.color, handles: u.handles || {}, createdAt: u.createdAt };
      if (full) Object.assign(o, { email: u.email, status: u.status, balance: r2(u.balance), lifetime: r2(u.lifetime), payout: u.payout || {} });
      return o;
    }

    function campaignView(c) {
      const subs = db.submissions.filter((s) => s.campaignId === c.id);
      const approved = subs.filter((s) => s.status === 'approved');
      return Object.assign({}, c, {
        clippers: db.memberships.filter((m) => m.campaignId === c.id).length,
        clips: subs.length,
        pendingClips: subs.filter((s) => s.status === 'pending').length,
        views: approved.reduce((a, s) => a + s.views, 0),
        remaining: r2(c.budget - c.spent),
        progress: c.budget ? Math.min(100, Math.round((c.spent / c.budget) * 100)) : 0,
      });
    }

    function submissionView(s) {
      const c = campById(s.campaignId), u = userById(s.userId);
      return Object.assign({}, s, {
        campaignTitle: c ? c.title : '—', brandName: c ? c.brandName : '—',
        clipperName: u ? u.name : '—', clipperColor: u ? u.color : '#888',
        estimate: c ? targetEarning(s, c) : 0,
      });
    }

    function addTx(userId, type, amount, extra, at) {
      db.tx.push(Object.assign({ id: id('t'), userId, type, amount: r2(amount), at: at || now() }, extra || {}));
    }

    function targetEarning(s, c) {
      if (s.views < c.minViews) return 0;
      const raw = r2((s.views / 1000) * c.rate);
      return c.maxPayout ? Math.min(raw, c.maxPayout) : raw;
    }

    // Credit a clipper for newly verified views, never exceeding the campaign budget.
    function settle(s, at) {
      if (s.status !== 'approved') return 0;
      const c = campById(s.campaignId), u = userById(s.userId);
      if (!c || !u) return 0;
      let delta = r2(targetEarning(s, c) - s.earned);
      delta = Math.min(delta, r2(c.budget - c.spent));
      if (delta <= 0) return 0;
      s.earned = r2(s.earned + delta);
      c.spent = r2(c.spent + delta);
      u.balance = r2(u.balance + delta);
      u.lifetime = r2((u.lifetime || 0) + delta);
      addTx(u.id, 'earning', delta, { campaignId: c.id, submissionId: s.id }, at);
      if (c.budget - c.spent < 0.01 && c.status === 'live') c.status = 'completed';
      return delta;
    }

    function series(filter, days) {
      const end = new Date(now()); end.setHours(23, 59, 59, 999);
      const out = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(end.getTime() - i * DAY);
        out.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), value: 0, from: d.getTime() - DAY, to: d.getTime() });
      }
      db.tx.filter(filter).forEach((t) => {
        const slot = out.find((o) => t.at > o.from && t.at <= o.to);
        if (slot) slot.value = r2(slot.value + t.amount);
      });
      return out.map((o) => ({ label: o.label, value: o.value }));
    }

    function newUser(p, at) {
      const palette = ['#c6ff3d', '#7c5cff', '#ff5c8a', '#3dd6ff', '#ffb53d', '#5cffb0', '#ff7a3d'];
      const u = {
        id: id('u'), name: str(p.name, 40), email: str(p.email, 120).toLowerCase(), pass: hash(String(p.password)),
        role: p.role, status: 'active', balance: r2(p.balance || 0), lifetime: 0, handles: p.handles || {}, payout: {},
        color: palette[db.users.length % palette.length], createdAt: at || now(),
      };
      db.users.push(u);
      return u;
    }

    function validateCampaign(p, partial) {
      const o = {};
      const has = (k) => !partial || p[k] !== undefined;
      if (has('title')) { o.title = str(p.title, 80); need(o.title.length >= 4, 'Title must be at least 4 characters'); }
      if (has('description')) { o.description = str(p.description, 1200); need(o.description.length >= 10, 'Add a longer description'); }
      if (has('category')) { o.category = str(p.category, 30); need(CATEGORIES.includes(o.category), 'Pick a valid category'); }
      if (has('platforms')) {
        o.platforms = (Array.isArray(p.platforms) ? p.platforms : []).filter((x) => PLATFORMS.includes(x));
        need(o.platforms.length > 0, 'Pick at least one platform');
      }
      if (has('rate')) { o.rate = r2(num(p.rate)); need(o.rate >= 0.1 && o.rate <= 50, 'Rate per 1K views must be between $0.10 and $50'); }
      if (has('minViews')) { o.minViews = Math.round(num(p.minViews)); need(o.minViews >= 0 && o.minViews <= 5e6, 'Invalid minimum views'); }
      if (has('maxPayout')) { o.maxPayout = r2(num(p.maxPayout) || 0); need(o.maxPayout >= 0, 'Invalid max payout'); }
      if (has('requirements')) {
        const list = Array.isArray(p.requirements) ? p.requirements : String(p.requirements || '').split('\n');
        o.requirements = list.map((x) => str(x, 160)).filter(Boolean).slice(0, 10);
      }
      if (has('assetsUrl')) {
        o.assetsUrl = str(p.assetsUrl, 300);
        need(!o.assetsUrl || /^https:\/\//i.test(o.assetsUrl), 'Assets link must start with https://');
      }
      return o;
    }

    /* ------------------------------------------------------------------ */
    const M = {};
    const def = (name, role, mutates, fn) => { M[name] = { role, mutates, fn }; };

    // ---- public
    def('stats', null, false, () => {
      const approved = db.submissions.filter((s) => s.status === 'approved');
      return {
        clippers: db.users.filter((u) => u.role === 'clipper').length,
        brands: db.users.filter((u) => u.role === 'brand').length,
        views: approved.reduce((a, s) => a + s.views, 0),
        paid: r2(db.submissions.reduce((a, s) => a + s.earned, 0)),
        liveCampaigns: db.campaigns.filter((c) => c.status === 'live').length,
        clips: db.submissions.length,
      };
    });

    def('listCampaigns', null, false, (actor, p) => {
      let list = db.campaigns.filter((c) => c.status === 'live' || c.status === 'completed').map(campaignView);
      const q = str(p.q, 60).toLowerCase();
      if (q) list = list.filter((c) => (c.title + ' ' + c.brandName + ' ' + c.category).toLowerCase().includes(q));
      if (p.platform && PLATFORMS.includes(p.platform)) list = list.filter((c) => c.platforms.includes(p.platform));
      if (p.category && CATEGORIES.includes(p.category)) list = list.filter((c) => c.category === p.category);
      const live = (c) => (c.status === 'live' ? 1 : 0);
      const sorts = {
        featured: (a, b) => live(b) - live(a) || (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.remaining - a.remaining,
        newest: (a, b) => live(b) - live(a) || b.createdAt - a.createdAt,
        rate: (a, b) => live(b) - live(a) || b.rate - a.rate,
        budget: (a, b) => live(b) - live(a) || b.remaining - a.remaining,
      };
      list.sort(sorts[p.sort] || sorts.featured);
      if (p.limit) list = list.slice(0, Math.min(50, Number(p.limit) || 50));
      return list;
    });

    def('getCampaign', null, false, (actor, p) => {
      const c = campById(p.id);
      need(c, 'Campaign not found', 404);
      const owner = actor && (actor.role === 'admin' || c.brandId === actor.id);
      need(owner || c.status === 'live' || c.status === 'completed', 'Campaign not found', 404);
      const top = db.submissions.filter((s) => s.campaignId === c.id && s.status === 'approved')
        .sort((a, b) => b.views - a.views).slice(0, 10).map(submissionView);
      return {
        campaign: campaignView(c), topClips: top,
        joined: !!(actor && db.memberships.find((m) => m.campaignId === c.id && m.userId === actor.id)),
        mine: actor ? db.submissions.filter((s) => s.campaignId === c.id && s.userId === actor.id).map(submissionView) : [],
      };
    });

    def('leaderboard', null, false, (actor, p) => {
      const days = { week: 7, month: 30 }[p.period];
      const since = days ? now() - days * DAY : 0;
      const map = {};
      db.submissions.filter((s) => s.status === 'approved' && s.createdAt >= since).forEach((s) => {
        const m = map[s.userId] || (map[s.userId] = { views: 0, earned: 0, clips: 0 });
        m.views += s.views; m.earned = r2(m.earned + s.earned); m.clips++;
      });
      return Object.keys(map).map((uid) => Object.assign({ user: publicUser(userById(uid)) }, map[uid]))
        .sort((a, b) => b.views - a.views).slice(0, 25);
    });

    // ---- auth
    def('signup', null, true, (actor, p) => {
      const email = str(p.email, 120).toLowerCase();
      need(str(p.name, 40).length >= 2, 'Enter your name');
      need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email');
      need(String(p.password || '').length >= 8, 'Password must be at least 8 characters');
      need(p.role === 'clipper' || p.role === 'brand', 'Choose an account type');
      need(!db.users.find((u) => u.email === email), 'An account with this email already exists', 409);
      return { user: publicUser(newUser({ name: p.name, email, password: p.password, role: p.role }), true) };
    });

    def('login', null, false, (actor, p) => {
      const u = db.users.find((x) => x.email === str(p.email, 120).toLowerCase());
      need(u && verify(String(p.password || ''), u.pass), 'Wrong email or password', 401);
      need(u.status === 'active', 'This account has been suspended', 403);
      return { user: publicUser(u, true) };
    });

    def('me', 'any', false, (actor) => ({ user: publicUser(actor, true) }));

    def('updateProfile', 'any', true, (actor, p) => {
      if (p.name !== undefined) { const n = str(p.name, 40); need(n.length >= 2, 'Enter your name'); actor.name = n; }
      if (p.handles) PLATFORMS.forEach((k) => { if (p.handles[k] !== undefined) actor.handles[k] = str(p.handles[k], 40).replace(/^@/, ''); });
      if (p.payout) {
        const method = str(p.payout.method, 10);
        need(!method || PAYOUT_METHODS.includes(method), 'Invalid payout method');
        actor.payout = { method, address: str(p.payout.address, 120) };
      }
      if (actor.role === 'brand') db.campaigns.forEach((c) => { if (c.brandId === actor.id) c.brandName = actor.name; });
      return { user: publicUser(actor, true) };
    });

    // ---- clipper
    def('joinCampaign', 'clipper', true, (actor, p) => {
      const c = campById(p.id);
      need(c && c.status === 'live', 'This campaign is not open', 404);
      if (!db.memberships.find((m) => m.campaignId === c.id && m.userId === actor.id))
        db.memberships.push({ campaignId: c.id, userId: actor.id, at: now() });
      return { joined: true };
    });

    def('myCampaigns', 'clipper', false, (actor) =>
      db.memberships.filter((m) => m.userId === actor.id).map((m) => {
        const c = campById(m.campaignId);
        const mine = db.submissions.filter((s) => s.campaignId === c.id && s.userId === actor.id);
        return Object.assign(campaignView(c), {
          joinedAt: m.at, myClips: mine.length,
          myViews: mine.reduce((a, s) => a + s.views, 0), myEarned: r2(mine.reduce((a, s) => a + s.earned, 0)),
        });
      }).sort((a, b) => b.joinedAt - a.joinedAt));

    def('submitClip', 'clipper', true, (actor, p) => {
      const c = campById(p.campaignId);
      need(c && c.status === 'live', 'This campaign is not accepting clips', 404);
      need(db.memberships.find((m) => m.campaignId === c.id && m.userId === actor.id), 'Join the campaign first', 403);
      need(c.platforms.includes(p.platform), 'This campaign does not accept that platform');
      const url = str(p.url, 300);
      need(URL_RULES[p.platform].test(url), 'That link does not look like a valid ' + p.platform + ' post URL');
      need(!db.submissions.find((s) => s.url.toLowerCase() === url.toLowerCase()), 'This clip was already submitted', 409);
      const s = { id: id('s'), campaignId: c.id, userId: actor.id, platform: p.platform, url, views: 0, earned: 0, status: 'pending', note: '', createdAt: now() };
      db.submissions.push(s);
      return submissionView(s);
    });

    def('mySubmissions', 'clipper', false, (actor) =>
      db.submissions.filter((s) => s.userId === actor.id).sort((a, b) => b.createdAt - a.createdAt).map(submissionView));

    def('clipperOverview', 'clipper', false, (actor) => {
      const subs = db.submissions.filter((s) => s.userId === actor.id);
      const pend = subs.filter((s) => s.status === 'pending');
      return {
        balance: r2(actor.balance), lifetime: r2(actor.lifetime),
        views: subs.filter((s) => s.status === 'approved').reduce((a, s) => a + s.views, 0),
        clips: subs.length, approved: subs.filter((s) => s.status === 'approved').length, pending: pend.length,
        campaigns: db.memberships.filter((m) => m.userId === actor.id).length,
        chart: series((t) => t.userId === actor.id && t.type === 'earning', 14),
        recent: subs.sort((a, b) => b.createdAt - a.createdAt).slice(0, 6).map(submissionView),
      };
    });

    def('wallet', 'any', false, (actor) => ({
      balance: r2(actor.balance), lifetime: r2(actor.lifetime), minPayout: MIN_PAYOUT, payout: actor.payout || {},
      payouts: db.payouts.filter((x) => x.userId === actor.id).sort((a, b) => b.createdAt - a.createdAt),
      tx: db.tx.filter((t) => t.userId === actor.id).sort((a, b) => b.at - a.at).slice(0, 40)
        .map((t) => Object.assign({}, t, { campaignTitle: t.campaignId && campById(t.campaignId) ? campById(t.campaignId).title : '' })),
    }));

    def('requestPayout', 'clipper', true, (actor, p) => {
      const amount = r2(num(p.amount));
      need(amount >= MIN_PAYOUT, 'Minimum payout is $' + MIN_PAYOUT);
      need(amount <= actor.balance, 'Amount is higher than your available balance');
      need(PAYOUT_METHODS.includes(p.method), 'Choose a payout method');
      const address = str(p.address, 120);
      need(address.length >= 5, 'Enter your PayPal email or wallet address');
      actor.balance = r2(actor.balance - amount);
      actor.payout = { method: p.method, address };
      const po = { id: id('p'), userId: actor.id, amount, method: p.method, address, status: 'pending', createdAt: now(), processedAt: null };
      db.payouts.push(po);
      addTx(actor.id, 'payout', -amount, { payoutId: po.id });
      return po;
    });

    // ---- brand
    const ownCampaign = (actor, cid) => {
      const c = campById(cid);
      need(c && (c.brandId === actor.id || actor.role === 'admin'), 'Campaign not found', 404);
      return c;
    };

    def('brandOverview', 'brand', false, (actor) => {
      const camps = db.campaigns.filter((c) => c.brandId === actor.id).map(campaignView);
      const ids = camps.map((c) => c.id);
      const spent = r2(camps.reduce((a, c) => a + c.spent, 0)), views = camps.reduce((a, c) => a + c.views, 0);
      return {
        balance: r2(actor.balance), spent, views,
        budget: r2(camps.reduce((a, c) => a + c.budget, 0)),
        clips: camps.reduce((a, c) => a + c.clips, 0), pending: camps.reduce((a, c) => a + c.pendingClips, 0),
        live: camps.filter((c) => c.status === 'live').length,
        cpm: views ? r2((spent / views) * 1000) : 0,
        chart: series((t) => t.type === 'earning' && ids.includes(t.campaignId), 14),
        campaigns: camps.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
      };
    });

    def('brandCampaigns', 'brand', false, (actor) =>
      db.campaigns.filter((c) => c.brandId === actor.id).map(campaignView).sort((a, b) => b.createdAt - a.createdAt));

    def('createCampaign', 'brand', true, (actor, p) => {
      const o = validateCampaign(p, false);
      const budget = r2(num(p.budget));
      need(budget >= 50, 'Minimum campaign budget is $50');
      need(budget <= actor.balance, 'Not enough funds — add funds in Billing first');
      actor.balance = r2(actor.balance - budget);
      const emojis = { Streamers: '🎥', Podcasts: '🎙️', Gaming: '🎮', Music: '🎧', Brands: '⚡', Sports: '🏆', Education: '📚' };
      const c = Object.assign({
        id: id('c'), brandId: actor.id, brandName: actor.name, budget, spent: 0, status: 'pending', featured: false,
        emoji: emojis[o.category], color: actor.color, createdAt: now(), endsAt: now() + 30 * DAY,
      }, o);
      db.campaigns.push(c);
      addTx(actor.id, 'campaign_fund', -budget, { campaignId: c.id });
      return campaignView(c);
    });

    def('updateCampaign', 'brand', true, (actor, p) => {
      const c = ownCampaign(actor, p.id);
      Object.assign(c, validateCampaign(p, true));
      return campaignView(c);
    });

    def('setCampaignStatus', 'brand', true, (actor, p) => {
      const c = ownCampaign(actor, p.id);
      need((c.status === 'live' && p.status === 'paused') || (c.status === 'paused' && p.status === 'live'), 'This campaign cannot be changed right now');
      c.status = p.status;
      return campaignView(c);
    });

    def('fundCampaign', 'brand', true, (actor, p) => {
      const c = ownCampaign(actor, p.id);
      const amount = r2(num(p.amount));
      need(amount >= 10, 'Minimum top-up is $10');
      need(amount <= actor.balance, 'Not enough funds — add funds in Billing first');
      need(c.status !== 'rejected', 'This campaign was rejected');
      actor.balance = r2(actor.balance - amount);
      c.budget = r2(c.budget + amount);
      if (c.status === 'completed') c.status = 'live';
      addTx(actor.id, 'campaign_fund', -amount, { campaignId: c.id });
      return campaignView(c);
    });

    // Simulated deposit. Swap for a real payment provider (Stripe, etc.) in production.
    def('addFunds', 'brand', true, (actor, p) => {
      const amount = r2(num(p.amount));
      need(amount >= 10 && amount <= 100000, 'Enter an amount between $10 and $100,000');
      actor.balance = r2(actor.balance + amount);
      addTx(actor.id, 'deposit', amount);
      return { balance: actor.balance };
    });

    def('campaignSubmissions', 'brand', false, (actor, p) => {
      const c = ownCampaign(actor, p.id);
      return {
        campaign: campaignView(c),
        submissions: db.submissions.filter((s) => s.campaignId === c.id).sort((a, b) => b.createdAt - a.createdAt).map(submissionView),
      };
    });

    function review(actor, p) {
      const s = db.submissions.find((x) => x.id === p.id);
      need(s, 'Submission not found', 404);
      ownCampaign(actor, s.campaignId);
      need(p.action === 'approve' || p.action === 'reject', 'Invalid action');
      need(s.status === 'pending' || (s.status === 'approved' && p.action === 'reject' && s.earned === 0) || (s.status === 'rejected' && p.action === 'approve'),
        'This clip has already been reviewed');
      s.status = p.action === 'approve' ? 'approved' : 'rejected';
      s.note = p.action === 'reject' ? str(p.reason, 200) : '';
      s.reviewedAt = now();
      if (s.status === 'approved') settle(s);
      return submissionView(s);
    }
    def('reviewSubmission', 'brand', true, review);

    // ---- admin
    def('adminOverview', 'admin', false, () => ({
      stats: M.stats.fn(),
      users: db.users.length,
      pendingCampaigns: db.campaigns.filter((c) => c.status === 'pending').length,
      pendingClips: db.submissions.filter((s) => s.status === 'pending').length,
      pendingPayouts: db.payouts.filter((x) => x.status === 'pending').length,
      pendingPayoutTotal: r2(db.payouts.filter((x) => x.status === 'pending').reduce((a, x) => a + x.amount, 0)),
      escrow: r2(db.campaigns.reduce((a, c) => a + (c.budget - c.spent), 0)),
      owed: r2(db.users.filter((u) => u.role === 'clipper').reduce((a, u) => a + u.balance, 0)),
      chart: series((t) => t.type === 'earning', 14),
    }));

    def('adminUsers', 'admin', false, () =>
      db.users.map((u) => Object.assign(publicUser(u, true), {
        clips: db.submissions.filter((s) => s.userId === u.id).length,
        campaigns: db.campaigns.filter((c) => c.brandId === u.id).length,
      })).sort((a, b) => b.createdAt - a.createdAt));

    def('setUserStatus', 'admin', true, (actor, p) => {
      const u = userById(p.id);
      need(u && u.role !== 'admin', 'User not found', 404);
      need(p.status === 'active' || p.status === 'suspended', 'Invalid status');
      u.status = p.status;
      return publicUser(u, true);
    });

    def('adminCampaigns', 'admin', false, () => db.campaigns.map(campaignView).sort((a, b) => b.createdAt - a.createdAt));

    def('adminSetCampaign', 'admin', true, (actor, p) => {
      const c = campById(p.id);
      need(c, 'Campaign not found', 404);
      if (p.featured !== undefined) c.featured = !!p.featured;
      if (p.status) {
        need(['live', 'paused', 'rejected'].includes(p.status), 'Invalid status');
        if (p.status === 'rejected' && c.status !== 'rejected') {
          const refund = r2(c.budget - c.spent), b = userById(c.brandId);
          if (b && refund > 0) { b.balance = r2(b.balance + refund); addTx(b.id, 'refund', refund, { campaignId: c.id }); c.budget = c.spent; }
        }
        c.status = p.status;
      }
      return campaignView(c);
    });

    def('adminSubmissions', 'admin', false, (actor, p) =>
      db.submissions.filter((s) => !p.status || s.status === p.status).sort((a, b) => b.createdAt - a.createdAt).slice(0, 200).map(submissionView));

    def('adminReview', 'admin', true, review);

    def('adminPayouts', 'admin', false, () =>
      db.payouts.slice().sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || b.createdAt - a.createdAt)
        .map((x) => Object.assign({}, x, { userName: (userById(x.userId) || {}).name || '—' })));

    def('processPayout', 'admin', true, (actor, p) => {
      const po = db.payouts.find((x) => x.id === p.id);
      need(po && po.status === 'pending', 'Payout not found or already processed', 404);
      need(p.action === 'paid' || p.action === 'reject', 'Invalid action');
      po.status = p.action === 'paid' ? 'paid' : 'rejected';
      po.processedAt = now();
      if (po.status === 'rejected') {
        const u = userById(po.userId);
        u.balance = r2(u.balance + po.amount);
        addTx(u.id, 'payout_refund', po.amount, { payoutId: po.id });
      }
      return po;
    });

    // Simulated view tracker. In production, replace with real platform API / scraping providers.
    function syncViews(rand) {
      rand = rand || Math.random;
      let updated = 0, credited = 0;
      db.submissions.forEach((s) => {
        const c = campById(s.campaignId);
        if (!c || s.status === 'rejected' || now() - s.createdAt > 30 * DAY) return;
        if (c.status !== 'live') return;
        s.views += Math.floor(s.views * rand() * 0.08 + rand() * rand() * 4000);
        updated++;
        credited = r2(credited + settle(s));
      });
      return { updated, credited };
    }
    def('syncViews', 'admin', true, () => syncViews());

    /* ------------------------------------------------------------------ */
    function call(name, actorId, params) {
      const m = M[name];
      need(m, 'Unknown method', 404);
      let actor = actorId ? userById(actorId) : null;
      if (actor && actor.status !== 'active') actor = null;
      if (m.role) {
        need(actor, 'Please log in', 401);
        need(m.role === 'any' || actor.role === m.role || (actor.role === 'admin' && m.role === 'brand'), 'You do not have access to this', 403);
      }
      const out = m.fn(actor, params || {});
      if (m.mutates) save();
      return out;
    }

    /* ------------------------------ demo data ------------------------------ */
    function seed() {
      if (db.users.length) return false;
      const rnd = mulberry32(20261120), T = now();
      const pick = (a) => a[Math.floor(rnd() * a.length)];
      const pw = 'demo1234';
      newUser({ name: 'clipZ Admin', email: 'admin@clipz.demo', password: pw, role: 'admin' }, T - 200 * DAY);
      const demoBrand = newUser({ name: 'Nova Energy', email: 'brand@clipz.demo', password: pw, role: 'brand', balance: 5000 }, T - 120 * DAY);
      const brands = [demoBrand].concat(['Pixel Forge Games', 'The Late Shift Podcast', 'Kairo Live', 'Luma Skin', 'Drift FM Records', 'StackUp', 'Atlas Fit'].map((n, i) =>
        newUser({ name: n, email: 'brand' + (i + 2) + '@clipz.demo', password: pw, role: 'brand', balance: 1500 }, T - (100 - i * 9) * DAY)));
      const names = ['Zane Cuts', 'Maya Reels', 'KutFast', 'Omar Edits', 'ClipNinja', 'Lina Loops', 'ShortsByTariq', 'Vera Viral', 'FrameJunkie', 'Nour Clips',
        'HookMaster', 'Sami Snips', 'EditWithJo', 'ReelRaider', 'Yara Cuts', 'ViralVault'];
      const clippers = names.map((n, i) => {
        const h = n.toLowerCase().replace(/[^a-z]/g, '');
        return newUser({ name: n, email: (i === 0 ? 'clipper' : 'clipper' + (i + 1)) + '@clipz.demo', password: pw, role: 'clipper', handles: { tiktok: h, instagram: h, youtube: h } }, T - (90 - i * 4) * DAY);
      });
      const C = [
        [0, 'Nova Zero Sugar Launch', 'Brands', ['tiktok', 'instagram', 'youtube'], 1.5, 12000, 5000, 250, true, 'Clip our launch-event footage and creator reactions for the new Zero Sugar line. High-energy hooks perform best.'],
        [3, 'Kairo 24h Subathon Highlights', 'Streamers', ['tiktok', 'youtube', 'x'], 0.8, 8000, 10000, 150, true, 'Best moments from the 24-hour subathon. Funny fails, clutch plays and chat chaos — keep it under 45 seconds.'],
        [2, 'Late Shift — Season 4 Clips', 'Podcasts', ['tiktok', 'instagram', 'youtube'], 1.0, 6000, 5000, 200, true, 'Pull the sharpest 20–60 second takes from our new season. Burned-in captions are required.'],
        [1, 'Emberfall Open Beta', 'Gaming', ['tiktok', 'youtube', 'x'], 2.0, 15000, 20000, 400, true, 'Show off Emberfall gameplay: boss fights, builds and wild physics moments from the open beta.'],
        [5, 'Drift FM — “Midnight Tape” Release', 'Music', ['tiktok', 'instagram'], 0.6, 4000, 2000, 100, false, 'Use the official audio from “Midnight Tape” in edits, lyric videos and aesthetic montages.'],
        [4, 'Luma Glow Serum Reviews', 'Brands', ['tiktok', 'instagram'], 2.5, 5000, 10000, 300, false, 'Cut our UGC and dermatologist interviews into short, honest-feeling review clips.'],
        [6, 'StackUp Money Myths', 'Education', ['tiktok', 'instagram', 'youtube', 'x'], 3.0, 9000, 25000, 500, false, 'Bite-size finance explainers from our video library. Must include the on-screen disclaimer.'],
        [7, 'Atlas Fit 30-Day Challenge', 'Sports', ['tiktok', 'instagram', 'youtube'], 1.2, 3500, 5000, 150, false, 'Transformation moments and coach tips from the 30-day challenge series.'],
        [0, 'Nova x Skate Tour Recap', 'Sports', ['tiktok', 'instagram'], 1.0, 3000, 5000, 120, false, 'Recap edits from the Nova skate tour. Fast cuts, big tricks, good music.'],
        [0, 'Nova Creator Collab — Round 1', 'Brands', ['tiktok', 'youtube'], 1.8, 2500, 5000, 200, false, 'Our first creator collab drop. This round is finished — watch for round 2.'],
      ];
      const emojis = { Streamers: '🎥', Podcasts: '🎙️', Gaming: '🎮', Music: '🎧', Brands: '⚡', Sports: '🏆', Education: '📚' };
      const reqs = ['Clips must be 15–60 seconds, vertical 9:16', 'Tag the official account in the caption', 'No reposts of other clippers’ edits', 'Views must be organic — botted views are disqualified'];
      const camps = C.map((r, i) => {
        const b = brands[r[0]];
        const c = {
          id: id('c'), brandId: b.id, brandName: b.name, title: r[1], category: r[2], platforms: r[3], rate: r[4], budget: r[5], spent: 0,
          minViews: r[6], maxPayout: r[7], featured: r[8], description: r[9], requirements: reqs.slice(0, 3 + (i % 2)), assetsUrl: '',
          status: 'live', emoji: emojis[r[2]], color: b.color, createdAt: T - (40 - i * 3) * DAY, endsAt: T + (10 + i * 2) * DAY,
        };
        db.campaigns.push(c);
        return c;
      });
      const hosts = { tiktok: 'https://www.tiktok.com/@H/video/7', instagram: 'https://www.instagram.com/reel/C', youtube: 'https://www.youtube.com/shorts/', x: 'https://x.com/H/status/18' };
      camps.forEach((c, ci) => {
        const count = ci === 9 ? 9 : 4 + Math.floor(rnd() * 6);
        for (let k = 0; k < count; k++) {
          const u = k === 0 && ci < 4 ? clippers[0] : pick(clippers);
          if (!db.memberships.find((m) => m.campaignId === c.id && m.userId === u.id)) db.memberships.push({ campaignId: c.id, userId: u.id, at: c.createdAt + DAY });
          const platform = pick(c.platforms), handle = (u.handles.tiktok || 'clipper');
          const at = Math.min(T - 3600000, c.createdAt + DAY + Math.floor(rnd() * (T - c.createdAt - DAY)));
          const roll = rnd();
          const s = {
            id: id('s'), campaignId: c.id, userId: u.id, platform,
            url: hosts[platform].replace('H', handle) + Math.floor(rnd() * 9e9 + 1e9),
            views: Math.floor(Math.pow(rnd(), 2.4) * 900000 * (ci === 9 ? 3 : 1)) + 800, earned: 0,
            status: roll < 0.74 ? 'approved' : roll < 0.9 ? 'pending' : 'rejected',
            note: '', createdAt: at,
          };
          if (s.status === 'rejected') s.note = pick(['Missing captions', 'Clip is longer than 60 seconds', 'Account tag missing in caption']);
          if (s.status === 'pending') s.views = Math.floor(s.views / 6);
          db.submissions.push(s);
          settle(s, Math.min(T - 60000, at + Math.floor(rnd() * 6 * DAY)));
        }
      });
      camps[9].status = 'completed'; camps[9].budget = Math.max(camps[9].spent, 1); camps[9].spent = camps[9].budget;
      // a pending campaign awaiting admin review, and some payout history
      db.campaigns.push({
        id: id('c'), brandId: brands[1].id, brandName: brands[1].name, title: 'Pixel Forge Dev Diaries', category: 'Gaming', platforms: ['youtube', 'tiktok'],
        rate: 1.4, budget: 2000, spent: 0, minViews: 5000, maxPayout: 200, featured: false, description: 'Behind-the-scenes dev diary moments, cut for shorts.',
        requirements: reqs.slice(0, 3), assetsUrl: '', status: 'pending', emoji: '🎮', color: brands[1].color, createdAt: T - DAY, endsAt: T + 30 * DAY,
      });
      clippers.forEach((u, i) => {
        if (u.balance < 60 || i % 3 === 2) return;
        const amount = r2(Math.floor(u.balance * (0.4 + rnd() * 0.3)));
        const method = pick(PAYOUT_METHODS), address = method === 'paypal' ? u.email : '0x' + Math.floor(rnd() * 1e15).toString(16) + '…';
        const at = T - Math.floor((2 + rnd() * 9) * DAY);
        const po = { id: id('p'), userId: u.id, amount, method, address, status: i % 4 === 1 ? 'pending' : 'paid', createdAt: at, processedAt: i % 4 === 1 ? null : at + DAY };
        u.balance = r2(u.balance - amount); u.payout = { method, address };
        db.payouts.push(po);
        addTx(u.id, 'payout', -amount, { payoutId: po.id }, at);
      });
      save();
      return true;
    }

    return { call, seed, syncViews, methods: Object.keys(M) };
  }

  return { createCore, emptyDb, ApiError, PLATFORMS, CATEGORIES, PAYOUT_METHODS, MIN_PAYOUT };
});
