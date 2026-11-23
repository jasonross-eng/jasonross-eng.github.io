(function () {
  const TB = window.TB;
  const { $, store, jget, openDlg, toast, dayKey } = TB;

  const HP_RELAY = 'https://ntfy.sh/';
  const hpKey = () => {
    let k = store.get('hpkey', '');
    if (!k) {
      k = Array.from({ length: 16 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
      store.set('hpkey', k);
    }
    return k;
  };
  const hpTopic = () => HP_RELAY + 'jre-hp-' + hpKey();
  const hpLimit = () => Math.max(1, Number(store.get('hplimit', '8')) || 8);
  const hpVer = names => { let h = 0; names.join('\n').split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) | 0; }); return String(h >>> 0); };

  let hpES = null, hpNet = '', hpSeen = new Set(), hpSentCls = '', hpAlerted = '', hpSig = null;

  const hp = TB.makeFloat('hpCard', 'Hall pass', 'hprect', { x: .62, y: .5, w: .34, h: .44 }, () => setHallCard(false));
  hp.body.innerHTML = '<div class="hpbox" id="hpBox"></div>' +
    '<div class="plrow"><span class="plleft" id="hpSt"></span><button class="chip" id="hpConnBtn"></button><button class="chip" id="hpSndBtn"></button><button class="chip" id="hpLogBtn">Log</button><button class="chip" id="hpSetBtn">Kiosk setup</button></div>';

  function hpList() {
    let v = jget('hplist', null);
    if (!Array.isArray(v)) {
      const o = jget('hpout', null);
      v = o && o.t ? [{ c: o.c, i: o.i, dest: o.dest, t: o.t, back: 0 }] : [];
      store.del('hpout');
    }
    return v.filter(x => x && x.t);
  }
  function hpSaveList(v) { store.set('hplist', JSON.stringify(v)); }

  // Clear returned rows from previous days automatically so yesterday's passes do not linger
  function hpPruneOldReturned() {
    const today = dayKey(new Date());
    const v = hpList();
    const kept = v.filter(x => !x.back || dayKey(new Date(x.t)) === today);
    if (kept.length !== v.length) { hpSaveList(kept); hpSig = null; }
  }
  hpPruneOldReturned();
  TB.dayChangeHooks.push(() => { hpPruneOldReturned(); hpPaint(); hpBadgePaint(); });

  function hpSoundOn() { return store.get('hpsound', '1') === '1'; }
  const hpOut = () => hpList().find(x => !x.back) || null;
  function hpNameOf(c, i) {
    for (const [g] of TB.GRADES) {
      const k = TB.pkClasses(g).find(x => x.id === c);
      if (k) return { name: k.n[i] || 'Someone', cls: k };
    }
    return { name: 'Someone', cls: null };
  }
  function hpPost(m) {
    fetch(hpTopic(), { method: 'POST', body: JSON.stringify(m) })
      .then(r => { if (!r.ok) throw 0; hpNet = 'ok'; })
      .catch(() => { hpNet = 'down'; })
      .finally(hpPaint);
  }
  function hpCurClass() { const k = TB.pkCur(TB.pkClasses(TB.grade), TB.grade); return { g: TB.grade, c: k ? k.id : 'none' }; }
  function hpSendClass(force) {
    const c = hpCurClass(), key = c.g + '|' + c.c;
    if (!force && key === hpSentCls) return;
    hpSentCls = key;
    hpPost({ k: 'class', g: c.g, c: c.c });
  }
  function hpLog(fn) {
    const l = jget('hplog', []); const v = Array.isArray(l) ? l : [];
    fn(v); store.set('hplog', JSON.stringify(v.slice(-500)));
  }

  function hpHandle(m, live) {
    const inSub = document.body.classList.contains('sub');
    if (m.k === 'hello') { hpSendClass(true); return; }
    if (m.k === 'out') {
      if (!m.t || dayKey(new Date(m.t)) !== dayKey(new Date())) return;
      const who = hpNameOf(m.c, m.i);
      const known = (jget('hplog', []) || []).some(x => x.t === m.t && x.c === m.c && x.i === m.i);
      if (!known) { const v = hpList(); v.push({ c: m.c, i: m.i, dest: m.dest, t: m.t, back: 0 }); hpSaveList(v); }
      hpLog(l => { if (!known) l.push({ c: m.c, i: m.i, name: who.name, cls: who.cls ? who.cls.t : '', dest: m.dest, t: m.t, back: 0 }); });
      if (live && !inSub) {
        toast(who.name + ' went to the ' + String(m.dest).toLowerCase());
        if (hpSoundOn()) TB.audio.hallPing(false);
        if (who.cls && m.v && who.cls.n && hpVer(who.cls.n) !== m.v) {
          setTimeout(() => toast('The kiosk has an old class list. Download a new kiosk file.'), 4200);
        }
      }
    }
    if (m.k === 'in') {
      const v = hpList(), o = v.slice().reverse().find(x => x.c === m.c && x.i === m.i && !x.back);
      if (o) { o.back = m.t || Date.now(); hpSaveList(v); }
      hpLog(l => { const e = l.slice().reverse().find(x => x.c === m.c && x.i === m.i && !x.back); if (e) e.back = m.t || Date.now(); });
      if (live && !inSub) { toast(hpNameOf(m.c, m.i).name + ' is back'); if (hpSoundOn()) TB.audio.hallPing(true); }
      setTimeout(gfPump, 500);
    }
    hpPaint();
    hpBadgePaint();
  }

  function hpListen(on) {
    if (hpES) { hpES.close(); hpES = null; }
    if (!on || typeof EventSource === 'undefined') return;
    const since = store.get('hplastid', '') || Math.floor(Date.now() / 1000);
    const es = new EventSource(hpTopic() + '/sse?since=' + since); hpES = es;
    es.onopen = () => { hpNet = 'ok'; hpPaint(); hpSendClass(true); };
    es.onerror = () => { hpNet = 'down'; hpPaint(); };
    es.onmessage = e => {
      let m, d; try { m = JSON.parse(e.data); if (m.event && m.event !== 'message') return; d = JSON.parse(m.message); } catch (x) { return; }
      if (hpSeen.has(m.id)) return; hpSeen.add(m.id); store.set('hplastid', m.id);
      hpNet = 'ok'; hpHandle(d, !m.time || Date.now() / 1000 - m.time < 60);
    };
  }

  const hpClock = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

  function hpClear(t) {
    const v = hpList(), e = v.find(x => x.t === t); if (!e) return;
    if (!e.back) {
      const now = Date.now();
      hpLog(l => { const x = l.slice().reverse().find(y => y.c === e.c && y.i === e.i && !y.back); if (x) x.back = now; });
      hpPost({ k: 'in', c: e.c, i: e.i, t: now });
      setTimeout(gfPump, 500);
    }
    hpSaveList(v.filter(x => x.t !== t)); hpSig = null; hpPaint(); hpBadgePaint();
  }

  /* ---------- compact top-bar badge so kiosk works even when card is closed ---------- */
  function hpBadgePaint() {
    const badge = $('hpBadge'); if (!badge) return;
    const inSub = document.body.classList.contains('sub');
    const v = hpList();
    if (inSub || !v.length) {
      badge.classList.remove('show', 'long', 'back');
      return;
    }
    const out = v.find(x => !x.back) || v[v.length - 1];
    const who = hpNameOf(out.c, out.i).name;
    const now = Date.now(), gone = (out.back || now) - out.t;
    const isLong = !out.back && gone >= hpLimit() * 60000;
    badge.classList.add('show');
    badge.classList.toggle('long', isLong);
    badge.classList.toggle('back', !!out.back);
    badge.textContent = out.back
      ? '🚪 ' + who + ' Back!'
      : '🚪 ' + who + ' ' + hpClock(gone) + (v.length > 1 ? ' (+' + (v.length - 1) + ')' : '');
    badge.title = 'Tap to open Hall pass';
  }
  if ($('hpBadge')) $('hpBadge').onclick = () => setHallCard(hp.el.hidden);

  function hpPaint() {
    const conn = isHpConn();
    if ($('hpConnBtn')) {
      $('hpConnBtn').textContent = conn ? 'Kiosk: Connected' : 'Kiosk: Off';
      $('hpConnBtn').classList.toggle('on', conn);
    }
    if (hp.el.hidden) return;
    const v = hpList(), box = $('hpBox'), lim = hpLimit() * 60000, now = Date.now();
    const sig = v.map(x => x.t + ':' + x.back).join('|');
    if (sig !== hpSig || box.children.length !== Math.max(1, v.length)) {
      hpSig = sig; box.innerHTML = '';
      if (!v.length) box.innerHTML = '<div class="none">Nobody is out</div>';
      // students still out on top (longest gone first), then the green "back" rows
      v.slice().sort((a, b) => (!!a.back - !!b.back) || (a.t - b.t)).forEach(x => {
        const r = document.createElement('button'); r.className = 'hprow'; r.dataset.t = x.t;
        r.innerHTML = '<span class="who"></span><span class="tm"></span><span class="where"></span>';
        r.querySelector('.who').textContent = hpNameOf(x.c, x.i).name;
        r.onclick = () => hpClear(x.t);
        box.appendChild(r);
      });
    }
    box.querySelectorAll('.hprow').forEach(r => {
      const x = v.find(y => String(y.t) === r.dataset.t); if (!x) return;
      const gone = (x.back || now) - x.t, long = !x.back && gone >= lim;
      r.classList.toggle('back', !!x.back); r.classList.toggle('long', long);
      r.querySelector('.tm').textContent = hpClock(gone);
      r.querySelector('.where').textContent = x.back ? 'Back! Tap to clear' : x.dest + (long ? ' \u2022 out a long time' : '');
      r.setAttribute('aria-label', r.querySelector('.who').textContent + (x.back ? ', back, gone ' : ', out ') + hpClock(gone) + '. Tap to clear.');
    });
    const today = dayKey(new Date()), n = (jget('hplog', []) || []).filter(x => dayKey(new Date(x.t)) === today).length;
    $('hpSt').textContent = (conn && hpNet === 'down' ? 'Cannot reach kiosk service. ' : '') + n + (n === 1 ? ' pass today' : ' passes today');
  }

  // Keep tracking passes & sending class updates whenever kiosk connection is on (even if card is closed)
  setInterval(() => {
    if (!isHpConn() || document.body.classList.contains('sub')) return;
    hpSendClass(false);
    // every student who is out gets their own one-time long-absence warning (several can be out at once)
    const o = hpList().find(x => !x.back && (Date.now() - x.t) >= hpLimit() * 60000 && !String(hpAlerted).split('|').includes(String(x.t)));
    if (o) {
      hpAlerted = String(hpAlerted).split('|').slice(-20).concat(String(o.t)).join('|'); const who = hpNameOf(o.c, o.i).name;
      toast(who + ' has been out ' + hpLimit() + ' minutes');
      TB.audio.nzPlay('bell');
      if (hp.el.hidden) setHallCard(true);
    }
    hpPaint();
    hpBadgePaint();
  }, 1000);

  function hpLogDlg() {
    openDlg('Hall pass log', body => {
      const l = (jget('hplog', []) || []).slice().reverse(), fmtT = t => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      body.innerHTML = '<div class="r"><button class="tool" id="hpCsv">Download log</button><button class="tool" id="hpClr">Clear log</button><button class="tool" id="hpGf">Google Form</button></div><p>Newest first. Saved on this board only. It has student names, so keep the download private.</p>';
      const tb = document.createElement('table'); tb.className = 'hplog';
      tb.innerHTML = '<tr><th>Day</th><th>Name</th><th>Class</th><th>Place</th><th>Out</th><th>Back</th><th>Minutes</th></tr>';
      l.slice(0, 200).forEach(x => {
        const tr = document.createElement('tr'), mins = x.back ? Math.round((x.back - x.t) / 60000) : '';
        [new Date(x.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), x.name, x.cls, x.dest, fmtT(x.t), x.back ? fmtT(x.back) : 'still out', mins].forEach((v, i) => {
          const td = document.createElement('td'); td.textContent = v; if (i === 6 && v !== '' && v >= hpLimit()) td.className = 'late'; tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      body.appendChild(tb);
      $('hpCsv').onclick = () => {
        const cell = v => { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
        const rows = [['Day', 'Name', 'Class', 'Place', 'Out', 'Back', 'Minutes']].concat((jget('hplog', []) || []).map(x => [dayKey(new Date(x.t)), x.name, x.cls, x.dest, fmtT(x.t), x.back ? fmtT(x.back) : '', x.back ? Math.round((x.back - x.t) / 60000) : '']));
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' }));
        a.download = 'hall-pass-log-' + dayKey(new Date()) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      };
      $('hpClr').onclick = () => { if (confirm('Clear the whole hall pass log on this board?')) { store.del('hplog'); hpLogDlg(); hpPaint(); } };
      $('hpGf').onclick = gfDlg;
    });
  }

  /* ---------- Google Form sync ---------- */
  const GF_WORDS = ['name', 'class', 'place', 'date', 'out', 'back', 'minutes'];
  function gfParse(u) {
    let url; try { url = new URL(String(u).trim()); } catch (e) { return { err: 'That does not look like a link.' }; }
    if (url.hostname === 'forms.gle') return { err: 'That is the short link. Use the pre-filled link instead (steps above).' };
    const m = url.pathname.match(/^\/forms\/(?:u\/\d+\/)?d\/(e\/)?([\w-]+)\//);
    if (url.hostname !== 'docs.google.com' || !m) return { err: 'That is not a Google Form link.' };
    const map = {};
    url.searchParams.forEach((v, k) => { const w = v.trim().toLowerCase(); if (/^entry\.\d+$/.test(k) && GF_WORDS.includes(w)) map[w] = k; });
    if (!map.name) return { err: 'The link has no NAME in it. Type NAME in the name question when you make the pre-filled link.' };
    return { post: 'https://docs.google.com/forms/d/' + (m[1] || '') + m[2] + '/formResponse', map };
  }
  let gfBusy = false;
  function gfPump() {
    const cfg = gfParse(store.get('gfurl', '')); if (!cfg.post || gfBusy) return;
    const since = Number(store.get('gfsince', '0')) || 0;
    const e = (jget('hplog', []) || []).find(x => x.back && !x.gs && x.t >= since); if (!e) return;
    const fmtT = t => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const vals = { name: e.name, class: e.cls, place: e.dest, date: dayKey(new Date(e.t)), out: fmtT(e.t), back: fmtT(e.back), minutes: String(Math.round((e.back - e.t) / 60000)) };
    const body = new URLSearchParams(); Object.keys(cfg.map).forEach(w => body.append(cfg.map[w], vals[w]));
    gfBusy = true;
    fetch(cfg.post, { method: 'POST', mode: 'no-cors', body }).then(() => {
      hpLog(l => { const x = l.find(y => y.t === e.t && y.c === e.c && y.i === e.i); if (x) x.gs = 1; });
      store.set('gferr', ''); gfBusy = false; gfPump();
    }).catch(() => { store.set('gferr', '1'); gfBusy = false; });
  }
  setInterval(gfPump, 15000);
  // New class: take the students who are back off the card. Their passes stay in the log, and any not yet sent to
  // the Google Form are sent first. Students still out stay on the card until they come back.
  TB.hpNewClass = function () {
    const v = hpList(), back = v.filter(x => x.back); if (!back.length) return;
    hpLog(l => back.forEach(r => { const x = l.find(y => y.t === r.t && y.c === r.c && y.i === r.i); if (x && !x.back) x.back = r.back; }));
    hpSaveList(v.filter(x => !x.back)); hpSig = null; hpPaint(); hpBadgePaint();
    gfPump();
  };

  function gfDlg() {
    openDlg('Send passes to a Google Form', body => {
      const cur = store.get('gfurl', ''), cfg = gfParse(cur), since = Number(store.get('gfsince', '0')) || 0;
      const l = jget('hplog', []) || [], sent = l.filter(x => x.gs).length, wait = l.filter(x => x.back && !x.gs && x.t >= since).length, old = l.filter(x => x.back && !x.gs && x.t < since).length;
      body.innerHTML = '<p>Each pass goes to your own Google Form when the student is back. Turn on Link to Sheets in the form to get a Google Sheet. The link stays on this board only, never on the website.</p>' +
        '<p><b>Make the form (one time)</b></p><ol>' +
        '<li>Make a Google Form with 7 Short answer questions: Name, Class, Place, Date, Out, Back, Minutes.</li>' +
        '<li>Settings, Responses: turn off Restrict to users in your school and Collect email addresses. Otherwise the board cannot send.</li>' +
        '<li>Three dots at the top right, Get pre-filled link. Type these words in the questions: NAME, CLASS, PLACE, DATE, OUT, BACK, MINUTES.</li>' +
        '<li>Get link, then Copy link. Paste it below.</li></ol>' +
        '<div class="r"><input type="text" id="gfIn" placeholder="https://docs.google.com/forms/..." aria-label="Pre-filled form link"></div>' +
        '<p id="gfMsg"></p><div class="r"><button class="tool" id="gfSave">Save link</button><button class="tool" id="gfOff">Stop sending</button><button class="tool" id="gfOld">Send older passes too</button></div>';
      $('gfIn').value = cur;
      $('gfMsg').textContent = !cur ? 'Not set up yet.' : cfg.err ? cfg.err :
        'On. Sending ' + GF_WORDS.filter(w => cfg.map[w]).join(', ') + '. ' + sent + ' sent' + (wait ? ', ' + wait + ' waiting' : '') + '.' + (store.get('gferr', '') ? ' The last try did not go through; it will try again.' : '');
      $('gfOff').hidden = !cur; $('gfOld').hidden = !cur || !old; $('gfOld').textContent = 'Send ' + old + ' older ' + (old === 1 ? 'pass' : 'passes') + ' too';
      $('gfSave').onclick = () => {
        const v = $('gfIn').value.trim(), c = gfParse(v);
        if (c.err) { $('gfMsg').textContent = c.err; return; }
        if (v !== cur) { store.set('gfurl', v); store.set('gfsince', Date.now()); }
        toast('Google Form saved'); gfDlg(); gfPump();
      };
      $('gfOff').onclick = () => { if (confirm('Stop sending passes to the Google Form?')) { store.del('gfurl'); store.del('gfsince'); gfDlg(); } };
      $('gfOld').onclick = () => { store.set('gfsince', '0'); gfDlg(); gfPump(); };
    });
  }

  function hpSetupDlg() {
    openDlg('Door kiosk setup', body => {
      const url = location.origin + location.pathname.replace(/[^\/]*$/, '') + 'kiosk.html';
      body.innerHTML = '<p>1. Tap Download kiosk file. It has your class lists, so keep it private.</p>' +
        '<div class="r"><button class="tool" id="hpFile">Download kiosk file</button></div>' +
        '<p id="hpUrl"></p>' +
        '<p>3. Tap Pick the kiosk file there and choose the file (from Google Drive, email or a flash drive).</p>' +
        '<p>The kiosk stays connected in the background even when you close the Hall pass card. A live badge shows in the top bar whenever a student is out.</p>' +
        '<div class="r"><span>Flag a pass after</span><input type="number" id="hpLim" min="1" max="60" aria-label="Minutes before a pass is flagged"><span>minutes</span></div>' +
        '<p>To hide the setup on the kiosk from students, it only opens when you hold the title at the top for 3 seconds.</p>';
      $('hpUrl').textContent = '2. On the door Chromebook or iPad, open ' + url.replace(/^https?:\/\//, '');
      $('hpLim').value = hpLimit();
      $('hpLim').onchange = () => { store.set('hplimit', Math.max(1, Math.min(60, Math.round(Number($('hpLim').value) || 8)))); hpPaint(); hpBadgePaint(); };
      $('hpFile').onclick = () => {
        const classes = {}; TB.GRADES.forEach(([g]) => { classes[g] = TB.pkClasses(g).map(k => ({ id: k.id, t: k.t, n: k.n, v: hpVer(k.n) })); });
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'hallpass', version: 1, key: hpKey(), classes })], { type: 'application/json' }));
        a.download = 'hall-pass-kiosk.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        setHallConn(true);
        toast('Kiosk file saved to Downloads');
      };
    });
  }

  const isHpConn = () => store.get('hpconn', store.get('hpon', '0')) === '1';
  function setHallConn(on) {
    store.set('hpconn', on ? 1 : 0);
    hpListen(on && !document.body.classList.contains('sub'));
    if (on) hpSentCls = '';
    updateHpBtnLabel();
    hpPaint();
    hpBadgePaint();
  }
  function updateHpBtnLabel() {
    const visible = !hp.el.hidden, conn = isHpConn();
    $('hpBtn').textContent = visible ? 'Hall pass: Open' : conn ? 'Hall pass (Live)' : 'Hall pass';
    $('hpBtn').classList.toggle('on', visible);
  }
  function setHallCard(on) {
    hp.show(on);
    store.set('hpon', on ? 1 : 0);
    if (on && !isHpConn()) setHallConn(true);
    updateHpBtnLabel();
    if (on) { hpSig = null; hpPaint(); }
    hpBadgePaint();
  }

  TB.hpPauseForSub = function (inSub) {
    if (inSub) {
      hpListen(false);
    } else if (isHpConn()) {
      hpListen(true);
    }
    hpBadgePaint();
  };

  $('hpConnBtn').onclick = () => {
    const next = !isHpConn();
    setHallConn(next);
    toast(next ? 'Door kiosk listening' : 'Door kiosk disconnected');
  };
  // Out / back sound: on by default, one setting for this board (hpsound). The Mute button in the top bar still silences it.
  function hpSoundPaint() { const on = hpSoundOn(); $('hpSndBtn').textContent = on ? 'Sound: On' : 'Sound: Off'; $('hpSndBtn').classList.toggle('on', on); }
  $('hpSndBtn').onclick = () => { store.set('hpsound', hpSoundOn() ? 0 : 1); hpSoundPaint(); if (hpSoundOn()) TB.audio.hallPing(true); toast(hpSoundOn() ? 'Hall pass sound on' : 'Hall pass sound off'); };
  hpSoundPaint();
  $('hpLogBtn').onclick = hpLogDlg;
  $('hpSetBtn').onclick = hpSetupDlg;
  $('hpBtn').onclick = () => setHallCard(hp.el.hidden);

  // Boot state: restore background listening independently of whether card is open
  if (isHpConn() && !document.body.classList.contains('sub')) hpListen(true);
  setHallCard(store.get('hpon', '0') === '1');
  hpBadgePaint();
})();
