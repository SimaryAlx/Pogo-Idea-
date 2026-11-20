/* API adapter: real backend over HTTP when CLIPZ_API_URL is set, otherwise an in-browser demo store. */
(function () {
  'use strict';
  const url = (window.CLIPZ_API_URL || '').replace(/\/$/, '');
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
  };

  function httpApi() {
    return {
      mode: 'live',
      async call(name, params) {
        const token = ls.get('clipz_token');
        let res;
        try {
          res = await fetch(url + '/' + name, {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
            body: JSON.stringify(params || {}),
          });
        } catch (e) { throw new Error('Cannot reach the server. Check your connection.'); }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { const err = new Error(data.error || 'Request failed'); err.status = res.status; throw err; }
        if (data.token) ls.set('clipz_token', data.token);
        return data;
      },
      logout() { ls.del('clipz_token'); },
      hasSession() { return !!ls.get('clipz_token'); },
    };
  }

  function demoApi() {
    const KEY = 'clipz_demo_db_v1';
    let db, core, mem = null;
    // Demo-only hashing: this store never leaves the visitor's browser.
    const hash = (pw) => { let h = 5381; for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) | 0; return 'demo$' + (h >>> 0).toString(36); };
    function boot(fresh) {
      const raw = fresh ? null : ls.get(KEY);
      try { db = raw ? JSON.parse(raw) : window.ClipZCore.emptyDb(); } catch (e) { db = window.ClipZCore.emptyDb(); }
      core = window.ClipZCore.createCore(db, { hash, verify: (pw, h) => hash(pw) === h, save: () => ls.set(KEY, JSON.stringify(db)) });
      core.seed();
    }
    boot(false);
    const session = () => ls.get('clipz_session') || mem;
    return {
      mode: 'demo',
      call(name, params) {
        return new Promise((resolve, reject) => setTimeout(() => {
          try {
            const out = JSON.parse(JSON.stringify(core.call(name, session(), params || {})));
            if (name === 'login' || name === 'signup') { mem = out.user.id; ls.set('clipz_session', mem); }
            resolve(out);
          } catch (e) {
            if (e.status) { const err = new Error(e.message); err.status = e.status; reject(err); } else { console.error(e); reject(new Error('Something went wrong')); }
          }
        }, 120));
      },
      logout() { mem = null; ls.del('clipz_session'); },
      hasSession() { return !!session(); },
      reset() { mem = null; ls.del('clipz_session'); boot(true); },
    };
  }

  window.API = url ? httpApi() : demoApi();
})();
