(function () {
  const TB = window.TB = window.TB || {};
  const $ = id => document.getElementById(id);
  TB.$ = $;

  // Safe default stubs so modules can reference each other cleanly during boot
  TB.clearInk = () => {};
  TB.setDraw = () => {};
  TB.fitPlan = () => {};
  TB.pkFit = () => {};
  TB.applyLayout = () => {};
  TB.renderTicker = () => {};
  TB.closeSteps = () => {};
  TB.setArrange = () => {};
  TB.setPlanEdit = () => {};
  TB.resetNoiseCount = () => {};
  TB.hpPauseForSub = () => {};
  TB.setSub = () => {};

  /* ---------- toast & dialogs ---------- */
  let toastT = null;
  function toast(msg, ms) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), ms || 4000);
  }
  TB.toast = toast;

  function openDlg(title, fill) {
    $('dlgTitle').textContent = title;
    $('dlgBody').innerHTML = '';
    fill($('dlgBody'));
    $('dlg').classList.add('show');
  }
  function closeDlg() {
    $('dlg').classList.remove('show');
    $('dlgBody').innerHTML = '';
  }
  TB.openDlg = openDlg;
  TB.closeDlg = closeDlg;

  $('dlgClose').onclick = closeDlg;
  $('dlg').onclick = e => { if (e.target === $('dlg')) closeDlg(); };

  /* ---------- localStorage wrapper with visible quota warning ---------- */
  let lastQuotaWarn = 0;
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('cb_' + k); return v === null ? d : v; }
      catch (e) { return d; }
    },
    set(k, v) {
      try {
        localStorage.setItem('cb_' + k, v);
        return true;
      } catch (e) {
        const now = Date.now();
        if (now - lastQuotaWarn > 8000) {
          lastQuotaWarn = now;
          toast('Storage is full on this browser. Remove old pictures or save a backup.', 6000);
        }
        return false;
      }
    },
    del(k) {
      try { localStorage.removeItem('cb_' + k); } catch (e) {}
    }
  };
  TB.store = store;
  TB.jget = (k, d) => {
    try { const v = JSON.parse(store.get(k, 'null')); return v === null ? d : v; }
    catch (e) { return d; }
  };

  /* ---------- IndexedDB store for images (backgrounds & picture widgets) ---------- */
  // Keeps large base64 images out of the 5 MB localStorage quota.
  // Automatically migrates older localStorage images on first read.
  const imgStore = (() => {
    const DB_NAME = 'techboard_media', STORE = 'images';
    let dbP = null;
    function open() {
      if (dbP) return dbP;
      if (typeof indexedDB === 'undefined') return Promise.resolve(null);
      dbP = new Promise(resolve => {
        try {
          const req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      });
      return dbP;
    }
    async function get(key) {
      const db = await open();
      if (db) {
        const val = await new Promise(resolve => {
          try {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(key);
            req.onsuccess = () => resolve(req.result || '');
            req.onerror = () => resolve('');
          } catch (e) { resolve(''); }
        });
        if (val) return val;
      }
      // Migrate legacy image from localStorage if present
      const legacy = store.get(key, '');
      if (legacy) {
        if (db) { await set(key, legacy); store.del(key); }
        return legacy;
      }
      return '';
    }
    async function set(key, val) {
      const db = await open();
      if (db) {
        const ok = await new Promise(resolve => {
          try {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(val, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } catch (e) { resolve(false); }
        });
        if (ok) { store.del(key); return true; }
      }
      // Fallback to localStorage only if IndexedDB is unavailable
      return store.set(key, val);
    }
    async function del(key) {
      store.del(key);
      const db = await open();
      if (!db) return;
      await new Promise(resolve => {
        try {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch (e) { resolve(); }
      });
    }
    async function getAll() {
      const out = {};
      const db = await open();
      if (db) {
        await new Promise(resolve => {
          try {
            const tx = db.transaction(STORE, 'readonly');
            const st = tx.objectStore(STORE);
            const req = st.openCursor();
            req.onsuccess = () => {
              const cur = req.result;
              if (cur) { out[String(cur.key)] = String(cur.value || ''); cur.continue(); }
              else resolve();
            };
            req.onerror = () => resolve();
          } catch (e) { resolve(); }
        });
      }
      return out;
    }
    async function clearAll() {
      const db = await open();
      if (!db) return;
      await new Promise(resolve => {
        try {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch (e) { resolve(); }
      });
    }
    // Background migration of any legacy localStorage images so localStorage stays lean
    (async () => {
      const db = await open();
      if (!db) return;
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.indexOf('cb_bgimg') === 0 || k.indexOf('cb_imgdata_') === 0)) keys.push(k);
        }
        for (const fullKey of keys) {
          const shortKey = fullKey.slice(3);
          const val = localStorage.getItem(fullKey);
          if (val) {
            const ok = await set(shortKey, val);
            if (ok) localStorage.removeItem(fullKey);
          } else {
            localStorage.removeItem(fullKey);
          }
        }
      } catch (e) {}
    })();
    return { get, set, del, getAll, clearAll };
  })();
  TB.imgStore = imgStore;

  /* ---------- shared audio engine + global mute ---------- */
  // Reuses a single AudioContext across all chimes/tones so Chrome never hits the context limit.
  const audio = (() => {
    let ctx = null;
    function getCtx() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx || ctx.state === 'closed') ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    // Unlock audio on the first user gesture
    const unlock = () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);

    const isMuted = () => store.get('muted', '0') === '1';
    function paintMute() {
      const m = isMuted(), b = $('muteBtn');
      if (!b) return;
      b.textContent = m ? 'Muted' : 'Sound: On';
      b.classList.toggle('muted', m);
      b.setAttribute('aria-pressed', m);
      b.title = m ? 'All board sounds are muted. Tap to unmute.' : 'Tap to mute all board sounds';
    }
    function setMuted(on) {
      store.set('muted', on ? 1 : 0);
      if (on && 'speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch (e) {} }
      paintMute();
      toast(on ? 'All board sounds muted' : 'Board sounds on');
    }
    if ($('muteBtn')) $('muteBtn').onclick = () => setMuted(!isMuted());
    paintMute();

    function tone(c, t0, f, t, len, type, vol) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + t);
      g.gain.linearRampToValueAtTime(vol || .3, t0 + t + .02);
      g.gain.exponentialRampToValueAtTime(.001, t0 + t + len);
      o.connect(g).connect(c.destination);
      o.start(t0 + t);
      o.stop(t0 + t + len + .05);
    }

    function chime() {
      if (isMuted()) return;
      try {
        const c = getCtx(); if (!c) return;
        const t0 = c.currentTime + .02;
        [660, 784, 988].forEach((f, i) => tone(c, t0, f, i * .35, .6, 'sine', .35));
      } catch (e) {}
    }
    function attnChime() {
      if (isMuted()) return;
      try {
        const c = getCtx(); if (!c) return;
        const t0 = c.currentTime + .02;
        [[784, 0], [988, .18], [1175, .36], [1568, .6]].forEach(([f, t]) => tone(c, t0, f, t, .5, 'triangle', .3));
      } catch (e) {}
    }
    function warnSound() {
      if (isMuted()) return;
      try {
        const c = getCtx(); if (!c) return;
        const t0 = c.currentTime + .02;
        [0, .9].forEach(base => [[659, 0], [880, .18], [1047, .36]].forEach(([f, t]) => tone(c, t0, f, base + t, .45, 'triangle', .35)));
      } catch (e) {}
    }
    function diceTick() {
      if (isMuted()) return;
      try {
        const c = getCtx(); if (!c) return;
        const t0 = c.currentTime;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'square';
        o.frequency.value = 300 + Math.random() * 500;
        g.gain.setValueAtTime(.06, t0);
        g.gain.exponentialRampToValueAtTime(.001, t0 + .05);
        o.connect(g).connect(c.destination);
        o.start(t0);
        o.stop(t0 + .06);
      } catch (e) {}
    }
    function nzPlay(kind, force) {
      if (isMuted() && !force) return;
      kind = kind || store.get('noisesound', 'chime');
      if (kind === 'off') return;
      try {
        const c = getCtx(); if (!c) return;
        const t0 = c.currentTime + .02;
        if (kind === 'chime') { tone(c, t0, 988, 0, .5); tone(c, t0, 784, .3, .5); tone(c, t0, 659, .6, .9); }
        else if (kind === 'bell') { tone(c, t0, 880, 0, 1.8, 'sine', .35); tone(c, t0, 1760, 0, 1.2, 'sine', .12); tone(c, t0, 2640, 0, .7, 'sine', .06); }
        else if (kind === 'beep') { tone(c, t0, 620, 0, .18, 'square', .12); tone(c, t0, 620, .28, .18, 'square', .12); }
        else if (kind === 'shh') {
          const len = 1.4, buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
          src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 3500; f.Q.value = .8;
          g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.5, t0 + .25); g.gain.linearRampToValueAtTime(.4, t0 + 1); g.gain.linearRampToValueAtTime(0, t0 + len);
          src.connect(f).connect(g).connect(c.destination); src.start(t0); src.stop(t0 + len);
        }
      } catch (e) {}
    }
    return { isMuted, setMuted, paintMute, chime, attnChime, warnSound, diceTick, nzPlay };
  })();
  TB.audio = audio;

  /* ---------- date & time helpers ---------- */
  TB.dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  TB.shortDay = k => new Date(k + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  TB.clockTime = ms => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  TB.hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

  /* ---------- QR SVG helper ---------- */
  TB.qrSvg = function (text) {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), m = 2; let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" shape-rendering="crispEdges" role="img" aria-label="QR code"><path d="' + d + '" fill="#000"/></svg>';
  };

  /* ---------- full screen helper ---------- */
  TB.goFull = function () {
    const d = document.documentElement;
    if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {});
  };

  /* ---------- grades & plans shared state ---------- */
  TB.GRADES = [['1', '1st'], ['2', '2nd'], ['3', '3rd'], ['4', '4th'], ['sp', 'Specials']];
  TB.grade = store.get('grade', '1');
  if (!TB.GRADES.some(g => g[0] === TB.grade)) TB.grade = '1';
  TB.gradeTitle = () => { const n = TB.GRADES.find(g => g[0] === TB.grade)[1]; return /^\d/.test(n) ? n + ' Grade' : n; };
  TB.gradeWord = () => { const n = TB.GRADES.find(g => g[0] === TB.grade)[1]; return /^\d/.test(n) ? n + ' grade' : n; };
  TB.gradeHooks = [];
  TB.dayChangeHooks = [];

  TB.plans = ((typeof PLANS !== 'undefined' && PLANS.length) ? PLANS : [{ week: '', items: [] }])
    .slice().sort((a, b) => String(b.week || '').localeCompare(String(a.week || '')));
  TB.guides = (typeof GUIDES !== 'undefined' && Array.isArray(GUIDES)) ? GUIDES : [];
  TB.findGuide = id => TB.guides.find(g => g.id === id);
  TB.weekLabel = p => p.week ? 'Week of ' + new Date(p.week + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (p.name || 'Plan');

  let lastKnownDay = TB.dayKey(new Date());
  TB.todayKey = () => TB.dayKey(new Date());
  TB.computeCurIdx = () => {
    const tk = TB.todayKey();
    const idx = TB.plans.findIndex(p => !p.week || p.week <= tk);
    return idx < 0 ? TB.plans.length - 1 : idx;
  };
  TB.curIdx = TB.computeCurIdx();
  TB.shownIdx = TB.curIdx;

  // Overnight / weekend rollover check so leaving the board open always switches weeks and refreshes daily state
  function checkNewDay() {
    const nowDay = TB.dayKey(new Date());
    if (nowDay === lastKnownDay) return;
    lastKnownDay = nowDay;
    TB.dayChangeHooks.forEach(fn => { try { fn(nowDay); } catch (e) {} });
  }
  setInterval(checkNewDay, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });
})();
