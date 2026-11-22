(function () {
  const TB = window.TB, { $, store, jget, openDlg, closeDlg, toast } = TB;

  /* ---------- small / big cards, hide top bar ---------- */
  const MINS = ['clock', 'timer', 'plan'];
  TB.MINS = MINS;

  const NAT = { clock: [.54, .23], timer: [.54, .60], plan: [.40, .84] };
  const cardEl = k => document.querySelector('.card.' + k);
  function layoutGet() {
    try {
      const v = JSON.parse(store.get('layout', 'null'));
      if (v && MINS.every(k => v[k] && [v[k].x, v[k].y, v[k].w, v[k].h].every(n => typeof n === 'number' && isFinite(n)))) return v;
    } catch (e) {}
    return null;
  }
  let layout = layoutGet();

  function clampMainRect(r) {
    const w = Math.max(.1, Math.min(1, r.w));
    const h = Math.max(.08, Math.min(1, r.h));
    const maxX = Math.max(0, 1 - Math.min(w, .25));
    const maxY = Math.max(0, 1 - Math.min(h, .12));
    return { x: Math.max(0, Math.min(maxX, r.x)), y: Math.max(0, Math.min(maxY, r.y)), w, h };
  }

  function applyLayout() {
    const free = !!layout && innerWidth > 820;
    document.body.classList.toggle('free', free);
    MINS.forEach(k => {
      const el = cardEl(k), st = el.style, r = free && layout[k];
      if (!free) { st.left = st.top = st.width = st.height = st.transform = ''; el.style.removeProperty('--inv'); return; }
      const cr = clampMainRect(r);
      st.left = cr.x * innerWidth + 'px';
      st.top = cr.y * innerHeight + 'px';
      if (document.body.classList.contains('min-' + k)) { st.width = st.height = st.transform = ''; el.style.setProperty('--inv', 1); return; }
      const W = cr.w * innerWidth, H = cr.h * innerHeight;
      const sc = Math.min(W / (NAT[k][0] * innerWidth), H / (NAT[k][1] * innerHeight));
      st.width = W / sc + 'px';
      st.height = H / sc + 'px';
      st.transform = 'scale(' + sc + ')';
      el.style.setProperty('--inv', 1 / sc);
    });
    requestAnimationFrame(() => TB.fitPlan());
  }
  TB.applyLayout = applyLayout;

  /* ---------- fill the screen on the fly ---------- */
  let maxEl = null, maxKeep = '';
  TB.getMaxEl = () => maxEl;

  function maxPlace() {
    if (!maxEl) return;
    const el = maxEl;
    el.style.cssText = maxKeep;
    el.style.transform = '';
    el.classList.remove('maxed');
    const w0 = el.offsetWidth || 300, h0 = el.offsetHeight || 200;
    const m = 12, W = innerWidth - 2 * m, H = innerHeight - 2 * m;
    const sc = Math.min(W / w0, H / h0);
    el.classList.add('maxed');
    Object.assign(el.style, { left: m + 'px', top: m + 'px', width: W / sc + 'px', height: H / sc + 'px', transform: 'scale(' + sc + ')' });
    requestAnimationFrame(() => { TB.fitPlan(); TB.pkFit(); });
  }
  function setMax(el) {
    if (maxEl) {
      const old = maxEl;
      old.classList.remove('maxed');
      old.style.cssText = maxKeep;
      maxEl = null;
      document.body.classList.remove('maxon');
      // Re-apply responsive positions after un-maximizing so a resize during max never leaves stale coords
      applyLayout();
      floatPlacers.forEach(fn => fn());
      if (old === el) { requestAnimationFrame(() => { TB.fitPlan(); TB.pkFit(); }); return; }
    }
    if (!el) { requestAnimationFrame(() => { TB.fitPlan(); TB.pkFit(); }); return; }
    maxEl = el;
    maxKeep = el.style.cssText;
    document.body.classList.add('maxon');
    maxPlace();
  }
  TB.setMax = setMax;

  const MAX_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  const BACK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  function maxIcons() {
    document.querySelectorAll('.maxbtn').forEach(b => {
      const on = !!maxEl && b.closest('.card') === maxEl;
      b.innerHTML = on ? BACK_ICON : MAX_ICON;
      b.title = on ? 'Back to normal size' : 'Fill the screen';
      b.setAttribute('aria-label', b.title);
    });
  }
  TB.maxIcons = maxIcons;
  document.querySelectorAll('.maxbtn').forEach(b => b.onclick = e => { e.stopPropagation(); setMax(b.closest('.card')); maxIcons(); });
  maxIcons();
  $('maxBack').onclick = () => { setMax(null); maxIcons(); };
  addEventListener('resize', () => { if (maxEl) maxPlace(); });

  /* ---------- main card handles & arrange ---------- */
  MINS.forEach(k => {
    const el = cardEl(k), grab = document.createElement('div'), rs = document.createElement('div');
    grab.className = 'grab'; rs.className = 'rs'; el.appendChild(grab); el.appendChild(rs);
    const mv = document.createElement('div'), rz = document.createElement('div');
    mv.className = 'mvh'; mv.title = 'Drag to move';
    mv.innerHTML = '<svg viewBox="0 0 24 12" aria-hidden="true"><circle cx="6" cy="3" r="1.6"/><circle cx="12" cy="3" r="1.6"/><circle cx="18" cy="3" r="1.6"/><circle cx="6" cy="9" r="1.6"/><circle cx="12" cy="9" r="1.6"/><circle cx="18" cy="9" r="1.6"/></svg>';
    rz.className = 'rzh'; rz.title = 'Drag to resize';
    el.appendChild(mv); el.appendChild(rz);
    const drag = (handle, resize) => {
      let start = null;
      handle.addEventListener('pointerdown', e => {
        if (!layout && (handle === mv || handle === rz)) layoutStart();
        if (!layout) return;
        e.preventDefault(); e.stopPropagation();
        handle.setPointerCapture(e.pointerId);
        start = { x: e.clientX, y: e.clientY, r: Object.assign({}, layout[k]) };
      });
      handle.addEventListener('pointermove', e => {
        if (!start) return;
        const dx = (e.clientX - start.x) / innerWidth, dy = (e.clientY - start.y) / innerHeight, r = layout[k];
        if (resize) {
          r.w = Math.max(.1, Math.min(1 - r.x, start.r.w + dx));
          r.h = Math.max(.08, Math.min(1 - r.y, start.r.h + dy));
        } else {
          const maxX = Math.max(0, 1 - Math.min(r.w, .25));
          const maxY = Math.max(0, 1 - Math.min(r.h, .12));
          r.x = Math.max(0, Math.min(maxX, start.r.x + dx));
          r.y = Math.max(0, Math.min(maxY, start.r.y + dy));
        }
        applyLayout();
      });
      const end = () => { if (!start) return; start = null; store.set('layout', JSON.stringify(layout)); };
      handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
    };
    drag(grab, false); drag(rs, true); drag(mv, false); drag(rz, true);
  });

  function layoutStart() {
    if (layout || innerWidth <= 820) return;
    if (maxEl) { setMax(null); maxIcons(); }
    layout = {};
    MINS.forEach(k => {
      const b = cardEl(k).getBoundingClientRect(), small = document.body.classList.contains('min-' + k);
      const w = small ? NAT[k][0] * .6 : b.width / innerWidth, h = small ? NAT[k][1] * .6 : b.height / innerHeight;
      layout[k] = { x: Math.max(0, Math.min(1 - w, b.left / innerWidth)), y: Math.max(0, Math.min(1 - h, b.top / innerHeight)), w, h };
    });
    store.set('layout', JSON.stringify(layout));
    applyLayout();
  }
  TB.layoutStart = layoutStart;

  function setArrange(on) {
    if (on && innerWidth <= 820) return;
    if (on && maxEl) { setMax(null); maxIcons(); }
    if (on) {
      TB.setPlanEdit(false);
      TB.setDraw(false);
      layoutStart();
    }
    document.body.classList.toggle('arranging', on);
    $('arrBtn').classList.toggle('on', on);
    applyLayout();
  }
  TB.setArrange = setArrange;

  $('arrBtn').onclick = () => setArrange(!document.body.classList.contains('arranging'));
  $('arrDone').onclick = () => setArrange(false);
  $('arrReset').onclick = () => {
    layout = null;
    store.del('layout');
    resetFloats();
    setArrange(false);
    toast('Layout reset');
  };
  addEventListener('resize', applyLayout);

  function paintMin() {
    let on = []; try { on = JSON.parse(store.get('min', '[]')) || []; } catch (e) {}
    MINS.forEach(k => document.body.classList.toggle('min-' + k, on.includes(k)));
    document.body.classList.toggle('min-pick', on.includes('pick'));
    document.querySelectorAll('.minbtn').forEach(b => {
      const small = on.includes(b.dataset.min), name = { plan: 'This week', pick: 'Picker' }[b.dataset.min] || b.dataset.min;
      b.textContent = small ? '+' : '\u2013';
      b.title = small ? 'Make big' : 'Make small';
      b.setAttribute('aria-label', (small ? 'Make big: ' : 'Make small: ') + name);
    });
    if (on.includes('plan')) TB.setPlanEdit(false); else requestAnimationFrame(() => TB.fitPlan());
    TB.renderTicker();
    applyLayout();
  }
  TB.paintMin = paintMin;

  document.querySelectorAll('.minbtn').forEach(b => b.onclick = () => {
    if (maxEl) { setMax(null); maxIcons(); }
    let on = []; try { on = JSON.parse(store.get('min', '[]')) || []; } catch (e) {}
    const k = b.dataset.min; on = on.includes(k) ? on.filter(x => x !== k) : on.concat(k);
    store.set('min', JSON.stringify(on)); paintMin();
  });

  function setBar(hide) {
    document.body.classList.toggle('nobar', hide);
    store.set('nobar', hide ? 1 : 0);
    $('bgpick').classList.remove('show');
    requestAnimationFrame(() => TB.fitPlan());
  }
  $('barBtn').onclick = () => setBar(true);
  $('menuBtn').onclick = () => setBar(false);
  setBar(store.get('nobar', '0') === '1');
  paintMin();

  /* ---------- floating cards with safe clamping & layout reset ---------- */
  const floatOrder = [];
  const floatResetters = [];
  const floatPlacers = [];

  function clampFloatRect(r, minW, minH) {
    const w = Math.max(minW, Math.min(.96, r.w));
    const h = Math.max(minH, Math.min(.94, r.h));
    // Always keep at least 120px horizontally (including centered drag handle) and 60px vertically inside viewport
    const keepX = Math.min(w, Math.max(.14, 140 / Math.max(320, innerWidth)));
    const keepY = Math.min(h, Math.max(.08, 64 / Math.max(320, innerHeight)));
    const x = Math.max(0, Math.min(1 - keepX, r.x));
    const y = Math.max(0, Math.min(1 - keepY, r.y));
    return { x, y, w, h };
  }

  function floatCard(el, key, def, minW, minH, after) {
    let r = (() => {
      try {
        const v = JSON.parse(store.get(key, 'null'));
        if (v && [v.x, v.y, v.w, v.h].every(n => typeof n === 'number' && isFinite(n))) return clampFloatRect(v, minW, minH);
      } catch (e) {}
      return Object.assign({}, def);
    })();
    const place = () => {
      if (maxEl === el) return;
      r = clampFloatRect(r, minW, minH);
      const st = el.style;
      st.left = r.x * innerWidth + 'px';
      st.top = r.y * innerHeight + 'px';
      st.width = r.w * innerWidth + 'px';
      st.height = r.h * innerHeight + 'px';
    };
    const reset = () => {
      store.del(key);
      r = Object.assign({}, def);
      place();
      if (after) after();
    };
    floatResetters.push(reset);
    floatPlacers.push(place);

    const grab = document.createElement('div'), rs = document.createElement('div');
    grab.className = 'grab'; rs.className = 'rs'; el.appendChild(grab); el.appendChild(rs);
    const mv = document.createElement('div'), rz = document.createElement('div');
    mv.className = 'mvh'; mv.title = 'Drag to move';
    mv.innerHTML = '<svg viewBox="0 0 24 12" aria-hidden="true"><circle cx="6" cy="3" r="1.6"/><circle cx="12" cy="3" r="1.6"/><circle cx="18" cy="3" r="1.6"/><circle cx="6" cy="9" r="1.6"/><circle cx="12" cy="9" r="1.6"/><circle cx="18" cy="9" r="1.6"/></svg>';
    rz.className = 'rzh'; rz.title = 'Drag to resize';
    el.appendChild(mv); el.appendChild(rz);

    const drag = (handle, resize) => {
      let start = null;
      handle.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        handle.setPointerCapture(e.pointerId);
        start = { x: e.clientX, y: e.clientY, r: Object.assign({}, r) };
      });
      handle.addEventListener('pointermove', e => {
        if (!start) return;
        const dx = (e.clientX - start.x) / innerWidth, dy = (e.clientY - start.y) / innerHeight;
        if (resize) {
          r.w = Math.max(minW, Math.min(1 - r.x, start.r.w + dx));
          r.h = Math.max(minH, Math.min(1 - r.y, start.r.h + dy));
        } else {
          r.x = start.r.x + dx;
          r.y = start.r.y + dy;
        }
        r = clampFloatRect(r, minW, minH);
        place(); if (after) after();
      });
      const end = () => { if (!start) return; start = null; store.set(key, JSON.stringify(r)); };
      handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
    };
    drag(grab, false); drag(rs, true); drag(mv, false); drag(rz, true);
    addEventListener('resize', place);
    place();

    floatOrder.push(el);
    el.addEventListener('pointerdown', () => {
      const i = floatOrder.indexOf(el); if (i < 0 || i === floatOrder.length - 1) return;
      floatOrder.splice(i, 1); floatOrder.push(el);
      floatOrder.forEach((c, k) => c.style.zIndex = 3 + k);
    }, true);
    el.style.zIndex = 3 + floatOrder.length - 1;
    return place;
  }
  TB.floatCard = floatCard;

  function resetFloats() {
    floatResetters.forEach(fn => fn());
  }
  TB.resetFloats = resetFloats;

  function makeFloat(id, title, rectKey, def, onClose) {
    const el = document.createElement('section'); el.className = 'card flt'; el.id = id; el.hidden = true; el.setAttribute('aria-label', title);
    el.innerHTML = '<div class="flthead"><b></b><button class="maxbtn" aria-label="Fill the screen" title="Fill the screen"></button><button class="tool fltx">Close</button></div><div class="fltbody"></div>';
    el.querySelector('b').textContent = title;
    document.querySelector('.board').appendChild(el);
    const mb = el.querySelector('.maxbtn'); mb.onclick = e => { e.stopPropagation(); setMax(el); maxIcons(); };
    el.querySelector('.fltx').onclick = () => { if (maxEl === el) setMax(null); onClose(); maxIcons(); };
    const place = floatCard(el, rectKey, def, .16, .18);
    maxIcons();
    return { el, body: el.querySelector('.fltbody'), head: el.querySelector('.flthead'), place, show(on) { el.hidden = !on; if (on) place(); } };
  }
  TB.makeFloat = makeFloat;

  /* ---------- top bar buttons & grouped More menu ---------- */
  // Groups in More menu: 'tools' (daily class tools) and 'setup' (board settings)
  const TB_ITEMS = [
    ['startClass', 'Start class', 'tools'],
    ['pickBtn', 'Picker', 'tools'],
    ['scoreBtn', 'Scores', 'tools'],
    ['attnBtn', 'Attention', 'tools'],
    ['drawBtn', 'Draw', 'tools'],
    ['kbdBtn', 'Keyboard', 'tools'],
    ['muteBtn', 'Sound on / off', 'tools'],
    ['pollBtn', 'Poll', 'tools'],
    ['hpBtn', 'Hall pass', 'tools'],
    ['diceBtn', 'Dice', 'tools'],
    ['qrBtn', 'QR code', 'tools'],
    ['embedBtn', 'Embed a website', 'tools'],
    ['embed2Btn', 'Embed website 2', 'tools'],
    ['imgBtn', 'Add a picture', 'tools'],
    ['noiseBtn', 'Noise meter', 'tools'],
    ['fsBtn', 'Full screen', 'setup'],
    ['arrBtn', 'Arrange', 'setup'],
    ['barBtn', 'Hide top bar', 'setup'],
    ['cwBtn', 'Class flow & clean-up', 'setup'],
    ['schedBtn', 'Schedule', 'setup'],
    ['cdBtn', 'Countdown', 'setup'],
    ['bgBtn', 'Background', 'setup'],
    ['backupBtn', 'Backup and restore', 'setup'],
    ['subBtn', 'Sub mode', 'setup']
  ];
  // Cleaner default top bar with bigger touch targets: daily teaching controls on top, layout/setup in More
  const TB_DEFAULT = {
    order: ['pickBtn', 'scoreBtn', 'attnBtn', 'drawBtn', 'kbdBtn', 'muteBtn', 'startClass',
      'pollBtn', 'hpBtn', 'diceBtn', 'qrBtn', 'embedBtn', 'embed2Btn', 'imgBtn', 'noiseBtn',
      'fsBtn', 'arrBtn', 'barBtn', 'cwBtn', 'schedBtn', 'cdBtn', 'bgBtn', 'backupBtn', 'subBtn'],
    more: ['pollBtn', 'hpBtn', 'diceBtn', 'qrBtn', 'embedBtn', 'embed2Btn', 'imgBtn', 'noiseBtn',
      'fsBtn', 'arrBtn', 'barBtn', 'cwBtn', 'schedBtn', 'cdBtn', 'bgBtn', 'backupBtn', 'subBtn']
  };
  function tbGet() {
    const v = jget('tbcfg', null), ids = TB_ITEMS.map(t => t[0]);
    if (!v || !Array.isArray(v.order) || !Array.isArray(v.more)) return JSON.parse(JSON.stringify(TB_DEFAULT));
    const order = v.order.filter(id => ids.includes(id)), more = v.more.filter(id => ids.includes(id));
    ids.forEach(id => { if (!order.includes(id)) { order.push(id); if (TB_DEFAULT.more.includes(id)) more.push(id); } });
    return { order, more };
  }
  function tbApply() {
    const v = tbGet(), tools = document.querySelector('.tools'), menu = $('moreMenu');
    const hTools = $('moreToolsHead'), hSetup = $('moreSetupHead'), tbBtn = $('tbBtn');
    const badge = $('hpBadge');
    if (badge) tools.appendChild(badge);
    let nTools = 0, nSetup = 0;
    v.order.forEach(id => {
      const b = $(id); if (!b) return;
      const meta = TB_ITEMS.find(t => t[0] === id);
      if (v.more.includes(id)) {
        if (meta && meta[2] === 'tools') { menu.insertBefore(b, hSetup); nTools++; }
        else { menu.insertBefore(b, tbBtn); nSetup++; }
      } else {
        tools.appendChild(b);
      }
    });
    if (hTools) hTools.hidden = nTools === 0;
    if (hSetup) hSetup.hidden = nSetup === 0 && !tbBtn;
    tools.appendChild($('moreBtn'));
    tools.appendChild($('subExit'));
    requestAnimationFrame(() => TB.fitPlan());
  }
  TB.tbApply = tbApply;

  function tbEdit() {
    openDlg('Top bar buttons', body => {
      const draw = () => {
        const v = tbGet();
        body.innerHTML = '<p>Pick where each button lives: in the top bar, or inside the More menu. The arrows change the order. Saved on this board only.</p>';
        v.order.forEach((id, i) => {
          const r = document.createElement('div'); r.className = 'r';
          const inMore = v.more.includes(id);
          r.innerHTML = '<b style="flex:1;min-width:9em"></b><button class="tool"></button><button class="tool" aria-label="Move up">▲</button><button class="tool" aria-label="Move down">▼</button>';
          r.querySelector('b').textContent = TB_ITEMS.find(t => t[0] === id)[1];
          const [place, up, dn] = r.querySelectorAll('button');
          place.textContent = inMore ? 'In More' : 'In top bar'; place.classList.toggle('on', !inMore);
          place.onclick = () => { const w = tbGet(); w.more = inMore ? w.more.filter(x => x !== id) : w.more.concat(id); store.set('tbcfg', JSON.stringify(w)); tbApply(); draw(); };
          const move = d => { const w = tbGet(), j = i + d; if (j < 0 || j >= w.order.length) return; [w.order[i], w.order[j]] = [w.order[j], w.order[i]]; store.set('tbcfg', JSON.stringify(w)); tbApply(); draw(); };
          up.onclick = () => move(-1); dn.onclick = () => move(1); up.disabled = i === 0; dn.disabled = i === v.order.length - 1;
          body.appendChild(r);
        });
        const r = document.createElement('div'); r.className = 'r'; r.innerHTML = '<button class="tool" id="tbReset">Back to how it started</button>'; body.appendChild(r);
        $('tbReset').onclick = () => { store.del('tbcfg'); tbApply(); draw(); };
      };
      draw();
    });
  }
  $('tbBtn').onclick = tbEdit;
  tbApply();

  /* ---------- More menu toggle ---------- */
  $('moreBtn').onclick = e => { e.stopPropagation(); $('moreMenu').classList.toggle('show'); $('moreBtn').classList.toggle('on'); };
  document.addEventListener('click', e => {
    if (!$('moreMenu').contains(e.target) && e.target !== $('moreBtn')) { $('moreMenu').classList.remove('show'); $('moreBtn').classList.remove('on'); }
  });
  $('moreMenu').addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON' && e.target.id !== 'bgBtn') { $('moreMenu').classList.remove('show'); $('moreBtn').classList.remove('on'); }
  });
  $('bgBtn').addEventListener('click', () => { $('moreMenu').classList.remove('show'); $('moreBtn').classList.remove('on'); });

  /* ---------- sub mode (masked passcode dialog, full privacy hiding) ---------- */
  function setSub(on) {
    document.body.classList.toggle('sub', on);
    store.set('sub', on ? 1 : 0);
    if (on) {
      setArrange(false);
      TB.setPlanEdit(false);
      if (maxEl && (maxEl.classList.contains('pick') || maxEl.classList.contains('poll') || (maxEl.classList.contains('flt') && !maxEl.classList.contains('sub-ok')))) {
        setMax(null); maxIcons();
      }
      $('moreMenu').classList.remove('show'); $('moreBtn').classList.remove('on');
      $('bgpick').classList.remove('show'); $('bgBtn').classList.remove('on');
      closeDlg();
    }
    TB.hpPauseForSub(on);
    TB.subHooks.forEach(fn => { try { fn(!!on); } catch (e) {} });
  }
  TB.setSub = setSub;

  $('subBtn').onclick = () => openDlg('Turn on Sub mode', body => {
    body.innerHTML = '<p>Sub mode hides editing buttons, settings, the student picker, and the hall pass. Pick a code to leave sub mode later (or leave it blank for no code). Dots hide the code on the board.</p>' +
      '<div class="r"><input type="password" id="subCodeIn" autocomplete="off" placeholder="Optional code" aria-label="Sub mode code"><button class="tool on" id="subGo">Turn on Sub mode</button></div>';
    const go = () => {
      store.set('subcode', $('subCodeIn').value.trim());
      closeDlg();
      setSub(true);
      toast('Sub mode is on');
    };
    $('subGo').onclick = go;
    $('subCodeIn').onkeydown = e => { if (e.key === 'Enter') go(); };
    setTimeout(() => { const i = $('subCodeIn'); if (i) i.focus(); }, 40);
  });

  $('subExit').onclick = () => {
    const code = store.get('subcode', '');
    if (!code) { setSub(false); toast('Sub mode is off'); return; }
    openDlg('Exit sub mode', body => {
      body.innerHTML = '<p>Type your code to leave sub mode. Dots hide it on the board.</p>' +
        '<div class="r"><input type="password" id="subCheckIn" autocomplete="off" placeholder="Code" aria-label="Sub mode code"><button class="tool on" id="subCheckGo">Unlock</button></div>' +
        '<p class="bad" id="subErr"></p>';
      const go = () => {
        if ($('subCheckIn').value.trim() !== code) {
          $('subErr').textContent = 'That code is not right.';
          $('subCheckIn').select();
          return;
        }
        closeDlg();
        setSub(false);
        toast('Sub mode is off');
      };
      $('subCheckGo').onclick = go;
      $('subCheckIn').onkeydown = e => { if (e.key === 'Enter') go(); };
      setTimeout(() => { const i = $('subCheckIn'); if (i) i.focus(); }, 40);
    });
  };
  if (store.get('sub', '0') === '1') setSub(true);
})();
