(function () {
  const TB = window.TB;
  const { $, store, jget, toast, qrSvg } = TB;

  const PL_TYPES = {
    smile: { name: 'Smileys', opts: [['😀', 'Good'], ['😐', 'Okay'], ['🙁', 'Not good']] },
    thumbs: { name: 'Thumbs', opts: [['👍', 'Yes'], ['👎', 'No']] },
    mc: { name: 'Multiple choice' },
    text: { name: 'Short answer', opts: [] }
  };
  TB.PL_TYPES = PL_TYPES;
  const PL_COLORS = ['#22d3ee', '#7be0a2', '#f6c026', '#ff8a80', '#b48cff', '#ffb74d'];
  const plGet = () => { const v = jget('poll', null); return v && v.type ? v : null; };
  const plSet = v => store.set('poll', JSON.stringify(v));
  let plUndo = [];
  // Short-answer moderation: dismissed answers (deviceId -> dismissed text) and one-by-one reveal count
  let plDismissed = {};
  let plRevealN = 0;

  const PL_RELAY = 'https://ntfy.sh/', PL_PREFIX = 'jre-tb-';
  const plTopic = (code, k) => PL_RELAY + PL_PREFIX + code + '-' + k;
  const plNonce = () => Math.random().toString(36).slice(2, 9);
  let plES = null, plDev = {}, plNet = '';

  function plDevCounts(v) {
    const c = v.opts.map(() => 0);
    Object.keys(plDev).forEach(k => { const a = plDev[k]; if (a >= 0 && a < c.length) c[a]++; });
    return c;
  }
  function plTextEntries() {
    return Object.keys(plDev)
      .map(k => ({ id: k, text: typeof plDev[k] === 'string' ? plDev[k].trim() : '' }))
      .filter(x => x.text && plDismissed[x.id] !== x.text);
  }
  function plPublish(v) {
    if (!v || !v.code) return;
    const body = v.live ? JSON.stringify({ n: v.nonce, type: v.type, q: v.q, opts: v.opts }) : JSON.stringify({ closed: true });
    fetch(plTopic(v.code, 'q'), { method: 'POST', body }).then(r => { if (!r.ok) throw 0; plNet = 'ok'; plNetPaint(); }).catch(() => { plNet = 'down'; plNetPaint(); });
  }
  function plListen(v) {
    if (plES) { plES.close(); plES = null; }
    plDev = {}; plDismissed = {}; plRevealN = 0;
    if (!v || !v.live || !v.code || typeof EventSource === 'undefined') return;
    const es = new EventSource(plTopic(v.code, 'v') + '/sse?since=all'); plES = es;
    es.onopen = () => { plNet = 'ok'; plNetPaint(); };
    es.onerror = () => { plNet = 'down'; plNetPaint(); };
    es.onmessage = e => {
      let m, d; try { m = JSON.parse(e.data); if (m.event && m.event !== 'message') return; d = JSON.parse(m.message); } catch (x) { return; }
      const w = plGet(); if (!w || !d || d.n !== w.nonce || typeof d.d !== 'string') return;
      if (w.type === 'text') {
        if (typeof d.t !== 'string') return;
        const txt = d.t.slice(0, 200);
        if (plDismissed[d.d] && plDismissed[d.d] !== txt.trim()) delete plDismissed[d.d];
        plDev[d.d] = txt;
      } else {
        if (!(d.a >= 0 && d.a < w.opts.length)) return;
        plDev[d.d] = d.a;
      }
      plNet = 'ok';
      if (document.body.classList.contains('pollon')) plShow();
    };
  }
  function plVoteUrl(code) { return location.origin + location.pathname.replace(/[^\/]*$/, '') + 'vote.html?c=' + code; }
  function plNetPaint() {
    const el = $('plNet'); if (!el) return;
    const n = Object.keys(plDev).length;
    el.textContent = plNet === 'down' ? 'Cannot reach the vote service. The school filter may block it.' : n + (n === 1 ? ' device answered' : ' devices answered');
    el.classList.toggle('bad', plNet === 'down');
  }
  function plJoinPaint(v) {
    const box = $('plJoin'); if (!box) return;
    box.style.display = v.live ? '' : 'none'; if (!v.live) return;
    const url = plVoteUrl(v.code);
    box.innerHTML = '<div class="qr"></div><div><div class="where"></div><div class="cd"></div><div class="st" id="plNet"></div></div>';
    try { box.querySelector('.qr').innerHTML = qrSvg(url); } catch (e) {}
    box.querySelector('.where').textContent = 'Go to ' + url.replace(/^https?:\/\//, '').replace(/\?c=\d+$/, '');
    box.querySelector('.cd').textContent = 'Code ' + v.code;
    plNetPaint();
  }
  function plLiveSet(on) {
    const w = plGet(); if (!w) return;
    if (on) { if (!w.code) w.code = String(1000 + Math.floor(Math.random() * 9000)); if (!w.nonce) w.nonce = plNonce(); }
    w.live = on; plSet(w); plNet = '';
    plPublish(w); plListen(w); plShow();
  }

  function plShow() {
    const v = plGet(); if (!v) { plSetup(); return; }
    const card = $('pollCard'), body = $('plBody'), mc = v.type === 'mc';
    card.classList.toggle('hideres', !!v.hide);
    const dc = plDevCounts(v), cnt = v.votes.map((x, i) => x + dc[i]);
    const texts = v.type === 'text' ? plTextEntries() : [];
    const total = v.type === 'text' ? texts.length : cnt.reduce((a, b) => a + b, 0), top = Math.max(1, ...cnt);
    body.innerHTML = '<div class="pljoin" id="plJoin"></div><div class="plq" id="plQ"></div><div class="plopts' + (mc ? ' mc' : '') + '" id="plOpts"></div>' +
      '<div class="plrow"><span class="plleft" id="plTot"></span><button class="chip" id="plLive"></button>' +
      (v.type === 'text' ? '<button class="chip" id="plRevOne">Reveal 1</button>' : '') +
      '<button class="chip" id="plHide"></button><button class="chip" id="plUndo">Undo</button>' +
      '<button class="chip" id="plReset">Clear votes</button><button class="chip" id="plNew">New poll</button></div>';
    plJoinPaint(v);
    $('plQ').textContent = v.q || '';
    v.opts.forEach((o, i) => {
      const b = document.createElement('button'); b.className = 'plopt';
      b.setAttribute('aria-label', (mc ? String.fromCharCode(65 + i) + ', ' : '') + o[1] + (v.hide ? '' : ', ' + cnt[i] + ' votes'));
      const fill = document.createElement('i'); fill.className = 'fill'; fill.style.background = mc ? PL_COLORS[i % 6] : 'var(--accent)';
      if (mc) fill.style.width = (cnt[i] / top * 100) + '%'; else fill.style.height = (cnt[i] / top * 100) + '%';
      b.appendChild(fill);
      if (mc) { const l = document.createElement('span'); l.className = 'let'; l.style.background = PL_COLORS[i % 6]; l.textContent = String.fromCharCode(65 + i); b.appendChild(l); }
      else { const e = document.createElement('span'); e.className = 'em'; e.textContent = o[0]; b.appendChild(e); }
      const t = document.createElement('span'); t.className = 'tx'; t.textContent = o[1]; b.appendChild(t);
      const n = document.createElement('b'); n.className = 'n'; n.textContent = cnt[i]; b.appendChild(n);
      b.onclick = () => { const w = plGet(); w.votes[i]++; plSet(w); plUndo.push(i); plShow(); };
      $('plOpts').appendChild(b);
    });
    if (v.type === 'text') {
      $('plOpts').className = 'plopts pltexts';
      const shownList = v.hide ? texts.slice(0, plRevealN) : texts;
      shownList.forEach(item => {
        const d = document.createElement('div'); d.className = 'pltext';
        const span = document.createElement('span'); span.textContent = item.text; d.appendChild(span);
        const x = document.createElement('button'); x.className = 'plx'; x.textContent = '×';
        x.title = 'Hide this answer'; x.setAttribute('aria-label', 'Hide this answer');
        x.onclick = () => { plDismissed[item.id] = item.text; if (plRevealN > 0) plRevealN--; plShow(); };
        d.appendChild(x);
        $('plOpts').appendChild(d);
      });
      if (v.hide && shownList.length < texts.length) {
        const rem = texts.length - shownList.length;
        const m = document.createElement('div'); m.className = 'plhidden';
        m.textContent = shownList.length
          ? shownList.length + ' of ' + texts.length + ' shown (' + rem + ' hidden). Tap Reveal 1 or Show all.'
          : total + (total === 1 ? ' answer' : ' answers') + ' so far. Tap Reveal 1 or Show all to see them.';
        $('plOpts').appendChild(m);
      } else if (v.hide && !texts.length) {
        const m = document.createElement('div'); m.className = 'plhidden';
        m.textContent = '0 answers so far. Tap Reveal 1 or Show all when students respond.';
        $('plOpts').appendChild(m);
      }
      if (!v.live) {
        const m = document.createElement('div'); m.className = 'plhidden';
        m.textContent = 'Turn on Student devices so students can type their answers.';
        $('plOpts').appendChild(m);
      }
      const revBtn = $('plRevOne');
      if (revBtn) {
        revBtn.style.display = v.hide && plRevealN < texts.length ? '' : 'none';
        revBtn.onclick = () => { plRevealN = Math.min(texts.length, plRevealN + 1); plShow(); };
      }
    }
    $('plTot').textContent = total + (v.type === 'text' ? (total === 1 ? ' answer' : ' answers') : (total === 1 ? ' vote' : ' votes'));
    $('plHide').textContent = v.type === 'text' ? (v.hide ? 'Show all' : 'Hide answers') : (v.hide ? 'Show results' : 'Hide results');
    if (v.type === 'text') { $('plUndo').remove(); $('plReset').textContent = 'Clear answers'; }
    $('plHide').onclick = () => {
      const w = plGet(); w.hide = !w.hide; plSet(w);
      if (w.hide) plRevealN = 0;
      plShow();
    };
    if ($('plUndo')) $('plUndo').style.display = plUndo.length ? '' : 'none';
    if ($('plUndo')) $('plUndo').onclick = () => { const i = plUndo.pop(); const w = plGet(); if (i !== undefined && w.votes[i] > 0) w.votes[i]--; plSet(w); plShow(); };
    $('plReset').onclick = () => {
      if (!confirm('Clear all the ' + (v.type === 'text' ? 'answers' : 'votes') + '?')) return;
      const w = plGet(); w.votes = w.votes.map(() => 0); w.nonce = plNonce(); plSet(w);
      plUndo = []; plDev = {}; plDismissed = {}; plRevealN = 0;
      if (w.live) plPublish(w);
      plShow();
    };
    $('plLive').textContent = v.live ? 'Student devices: On' : 'Student devices: Off';
    $('plLive').classList.toggle('on', !!v.live);
    $('plLive').onclick = () => plLiveSet(!plGet().live);
    $('plNew').onclick = () => plSetup(v);
  }
  TB.plShow = plShow;

  function plSetup(prev) {
    let type = (prev && prev.type) || 'smile';
    let mcOpts = prev && prev.type === 'mc' ? prev.opts.map(o => o[1]) : ['', '', ''];
    const body = $('plBody'); $('pollCard').classList.remove('hideres');
    const draw = () => {
      if ($('plQIn')) prev = Object.assign({}, prev || {}, { q: $('plQIn').value, hide: $('plHideIn').checked });
      body.innerHTML = '<div class="plset"><div class="types" id="plTypes"></div>' +
        '<div class="r"><input type="text" id="plQIn" maxlength="120" placeholder="Your question (optional)" aria-label="Your question"></div><div id="plMc"></div>' +
        '<div class="r"><label><input type="checkbox" id="plHideIn"> Hide results while voting</label></div>' +
        '<div class="plrow"><button class="chip main" id="plGo">Start poll</button><button class="chip" id="plSlip">Save as exit slip</button>' + (plGet() ? '<button class="chip" id="plCancel">Cancel</button>' : '') + '</div></div>';
      $('plQIn').value = prev && prev.q || ''; $('plHideIn').checked = !!(prev && prev.hide);
      Object.keys(PL_TYPES).forEach(k => {
        const b = document.createElement('button'); b.className = 'chip' + (k === type ? ' on' : ''); b.textContent = PL_TYPES[k].name + (k === 'smile' ? ' 😀😐🙁' : k === 'thumbs' ? ' 👍👎' : k === 'text' ? ' ✏️' : ' A B C');
        b.onclick = () => { prev = Object.assign({}, prev || {}, { q: $('plQIn').value, hide: $('plHideIn').checked }); type = k; draw(); if (k === 'text') $('plHideIn').checked = true; };
        $('plTypes').appendChild(b);
      });
      if (type === 'mc') {
        mcOpts.forEach((o, i) => {
          const r = document.createElement('div'); r.className = 'r';
          r.innerHTML = '<b style="width:1.4em;text-align:center"></b><input type="text" maxlength="60"><button class="chip">Remove</button>';
          r.querySelector('b').textContent = String.fromCharCode(65 + i);
          const inp = r.querySelector('input'); inp.value = o; inp.placeholder = 'Answer ' + String.fromCharCode(65 + i); inp.setAttribute('aria-label', 'Answer ' + String.fromCharCode(65 + i));
          inp.oninput = () => mcOpts[i] = inp.value;
          r.querySelector('button').onclick = () => { if (mcOpts.length > 2) { mcOpts.splice(i, 1); draw(); } };
          $('plMc').appendChild(r);
        });
        if (mcOpts.length < 6) { const a = document.createElement('button'); a.className = 'chip'; a.textContent = '+ Add answer'; a.onclick = () => { mcOpts.push(''); draw(); }; $('plMc').appendChild(a); }
      }
      const optsNow = () => type === 'mc' ? mcOpts.map((t, i) => ['', t.trim() || ('Answer ' + String.fromCharCode(65 + i))]) : PL_TYPES[type].opts;
      $('plSlip').onclick = () => {
        store.set('exitslip_' + TB.grade, JSON.stringify({ type, q: $('plQIn').value.trim(), opts: optsNow(), on: true }));
        toast('Saved as the ' + TB.gradeWord() + ' exit slip. It shows at the clean-up warning.');
      };
      $('plGo').onclick = () => {
        const opts = optsNow();
        const old = plGet() || {};
        const w = { type, q: $('plQIn').value.trim(), opts, votes: opts.map(() => 0), hide: $('plHideIn').checked, code: old.code, live: !!old.live, nonce: plNonce() };
        plSet(w); plUndo = []; plDev = {}; plDismissed = {}; plRevealN = 0;
        if (w.live) { plPublish(w); plListen(w); }
        plShow();
      };
      if ($('plCancel')) $('plCancel').onclick = plShow;
    };
    draw();
  }

  function setPoll(on) {
    document.body.classList.toggle('pollon', on); store.set('pollon', on ? 1 : 0); $('pollBtn').textContent = on ? 'Poll: On' : 'Poll';
    if (on) { plPlace(); const w = plGet(); if (w && w.live) { plPublish(w); plListen(w); } plShow(); }
    else { const w = plGet(); if (w && w.live) { w.live = false; plSet(w); plPublish(w); } if (plES) { plES.close(); plES = null; } }
  }
  TB.setPoll = setPoll;

  const plPlace = TB.floatCard($('pollCard'), 'pollrect', { x: .28, y: .16, w: .44, h: .62 }, .26, .3);
  $('pollBtn').onclick = () => setPoll(!document.body.classList.contains('pollon'));
  $('plClose').onclick = () => { if (TB.getMaxEl() === $('pollCard')) { TB.setMax(null); TB.maxIcons(); } setPoll(false); };
  setPoll(store.get('pollon', '0') === '1');

  /* ---------- exit slip ---------- */
  function exitSlipGet(g) { const v = jget('exitslip_' + (g || TB.grade), null); return v && v.type && Array.isArray(v.opts) ? v : null; }
  TB.exitSlipGet = exitSlipGet;

  function exitSlipLaunch(force) {
    const es = exitSlipGet(); if (!es || (!force && es.on === false)) return false;
    // Close any full-screen overlay (Teacher Clarity, Must Do, Guides, Video) so the exit slip is never hidden behind it
    TB.closeSteps();
    TB.closeDlg();
    if (document.body.classList.contains('arranging')) TB.setArrange(false);
    const old = plGet() || {};
    const w = {
      type: es.type, q: es.q || 'Exit slip', opts: es.opts, votes: es.opts.map(() => 0), hide: es.type === 'text',
      code: old.code || String(1000 + Math.floor(Math.random() * 9000)), live: true, nonce: plNonce()
    };
    plSet(w); plUndo = []; plDev = {}; plDismissed = {}; plRevealN = 0;
    setPoll(true);
    if (TB.getMaxEl() !== $('pollCard')) { TB.setMax($('pollCard')); TB.maxIcons(); }
    return true;
  }
  TB.exitSlipLaunch = exitSlipLaunch;
})();
