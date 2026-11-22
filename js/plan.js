(function () {
  const TB = window.TB;
  const { $, store, imgStore, openDlg, closeDlg, toast, dayKey, qrSvg, goFull } = TB;

  /* ---------- plan ---------- */
  function rebuildWeekPicker() {
    const tk = TB.todayKey();
    const sel = $('planPick');
    sel.innerHTML = '';
    TB.plans.forEach((p, i) => {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = TB.weekLabel(p).replace('Week of ', '') + (i === TB.curIdx ? ' (now)' : (p.week > tk ? ' (next)' : ''));
      sel.appendChild(o);
    });
    sel.style.display = TB.plans.length > 1 ? '' : 'none';
    sel.value = TB.shownIdx;
  }
  rebuildWeekPicker();

  function presentUrl(url) {
    const m = url.match(/^https:\/\/docs\.google\.com\/presentation\/d\/([^\/]+)\/(edit|view|present)/);
    if (!m) return url;
    const s = url.match(/slide=(id\.[\w.]+)/);
    return 'https://docs.google.com/presentation/d/' + m[1] + '/present' + (s ? '?slide=' + s[1] : '');
  }
  TB.presentUrl = presentUrl;

  function wireItem(el, it, has) {
    if (!has) return;
    if (it.type === 'guide') el.onclick = () => openGuide(it.guide);
    else if (it.type === 'steps') el.onclick = () => openSteps(it.url);
    else if (it.emb) el.onclick = () => openEmbed(it);
    else if (el.tagName === 'A') { el.href = presentUrl(it.url); el.target = '_blank'; el.rel = 'noopener'; }
    else el.onclick = () => window.open(presentUrl(it.url), '_blank', 'noopener');
  }

  function gradeData(p) { return (p && p.grades && p.grades[TB.grade]) || {}; }
  TB.gradeData = gradeData;
  function planItems(p) { const g = gradeData(p); return Array.isArray(g.items) ? g.items : ((p && p.items) || []); }
  function allItems(p) {
    let a = (p.items || []).slice();
    Object.keys(p.grades || {}).forEach(k => { const g = p.grades[k]; if (g && Array.isArray(g.items)) a = a.concat(g.items); });
    return a;
  }

  const hiddenBy = {};
  (function () {
    const read = k => { try { const v = JSON.parse(store.get(k, 'null')); return Array.isArray(v) ? v : null; } catch (e) { return null; } };
    const old = read('archhide') || [];
    TB.GRADES.forEach(([g]) => hiddenBy[g] = new Set(read('hide_' + g) || old));
  })();
  let hidden = hiddenBy[TB.grade];
  function saveHidden(g) { g = g || TB.grade; store.set('hide_' + g, JSON.stringify([...hiddenBy[g]])); }
  function hideAll(k, on) { TB.GRADES.forEach(([g]) => { if (on) hiddenBy[g].add(k); else hiddenBy[g].delete(k); saveHidden(g); }); }
  function hiddenEverywhere(k) { return TB.GRADES.every(([g]) => hiddenBy[g].has(k)); }
  function itemKey(it) { return it.emb ? (it.emb === 'yt' ? 'video|yt' : 'embed|' + it.emb) : it.type === 'guide' ? 'guide|' + it.guide : it.type + '|' + ((it.url && it.url.trim()) || it.label); }

  const svgIcon = body => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#fff"/>' + body + '</svg>');
  function ytParse(url) {
    const m = String(url).trim().match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    if (!m) return null;
    const t = String(url).match(/[?&#](?:t|start)=(?:(\d+)h)?(?:(\d+)m)?(\d+)?s?/);
    const start = t ? (Number(t[1] || 0) * 3600 + Number(t[2] || 0) * 60 + Number(t[3] || 0)) : 0;
    return { id: m[1], start };
  }
  const EMB = {
    yt: {
      title: 'YouTube video', def: 'Video', ph: 'Paste a YouTube link', bad: 'That does not look like a YouTube video link.', good: 'Link looks good.',
      icon: svgIcon('<rect x="8" y="16" width="48" height="32" rx="10" fill="#e62117"/><path d="M27 24v16l14-8z" fill="#fff"/>'),
      resolve(url) {
        const v = ytParse(url); if (!v) return null;
        return {
          src: 'https://www.youtube-nocookie.com/embed/' + v.id + '?rel=0&autoplay=1' + (v.start ? '&start=' + v.start : ''),
          tab: 'https://www.youtube.com/watch?v=' + v.id + (v.start ? '&t=' + v.start + 's' : '')
        };
      }
    },
    sl: {
      title: 'Slides or Canva', def: 'Slides', ph: 'Paste a Google Slides or Canva link', bad: 'That does not look like a link.',
      good: 'Link looks good. Share it so anyone with the link can view, or it may ask for a login.',
      icon: svgIcon('<rect x="8" y="12" width="48" height="40" rx="6" fill="#f4b400"/><rect x="16" y="22" width="32" height="20" rx="2" fill="#fff"/>'),
      resolve(url) {
        url = String(url).trim();
        const g = url.match(/^https:\/\/docs\.google\.com\/presentation\/d\/(e\/)?([\w-]+)/);
        if (g) {
          const sl = url.match(/slide=(id\.[\w.]+)/);
          return { src: 'https://docs.google.com/presentation/d/' + (g[1] || '') + g[2] + '/embed?start=false&loop=false&rm=minimal' + (sl ? '&slide=' + sl[1] : ''), tab: presentUrl(url) };
        }
        const c = url.match(/^https:\/\/(?:www\.)?canva\.com\/design\/([\w-]+)\/(?:([\w-]+)\/)?(?:view|watch|edit)/);
        if (c) return { src: 'https://www.canva.com/design/' + c[1] + '/' + (c[2] ? c[2] + '/' : '') + 'view?embed', tab: url };
        return /^https:\/\/[^\s.]+\.\S+$/.test(url) ? { tab: url } : null;
      }
    }
  };
  TB.EMB = EMB;
  const EMB_KEYS = Object.keys(EMB);
  function embGet(k) { try { const v = JSON.parse(store.get(k + '_' + TB.grade, 'null')); if (v && typeof v === 'object') return { on: !!v.on, url: String(v.url || ''), label: String(v.label || '') }; } catch (e) {} return { on: false, url: '', label: '' }; }
  function embSet(k, v) { store.set(k + '_' + TB.grade, JSON.stringify(v)); }
  function embItems() {
    return EMB_KEYS.map(k => { const y = embGet(k); return y.on ? { label: y.label.trim() || EMB[k].def, type: 'embed', emb: k, url: y.url, icon: EMB[k].icon } : null; }).filter(Boolean);
  }
  EMB_KEYS.forEach(k => {
    const d = document.createElement('div'); d.className = 'ytedit';
    d.innerHTML = '<div class="r"><b></b><button class="tool onoff" id="' + k + 'On">Off</button></div>' +
      '<div class="r"><input type="text" id="' + k + 'Url"><input type="text" class="nm" id="' + k + 'Name" placeholder="Button name" aria-label="Button name" maxlength="24"></div>' +
      '<p class="hint" id="' + k + 'Hint"></p>';
    d.querySelector('b').textContent = EMB[k].title;
    const u = d.querySelector('#' + k + 'Url'); u.placeholder = EMB[k].ph; u.setAttribute('aria-label', EMB[k].title + ' link');
    $('embEdit').appendChild(d);
    const change = fn => () => { const y = embGet(k); fn(y); embSet(k, y); renderPlan(TB.shownIdx); };
    $(k + 'On').onclick = change(y => y.on = !y.on);
    u.oninput = change(y => y.url = u.value);
    $(k + 'Name').oninput = change(y => y.label = $(k + 'Name').value);
  });
  function paintEmb() {
    $('embEdit').classList.toggle('show', planEditing);
    if (!planEditing) return;
    EMB_KEYS.forEach(k => {
      const y = embGet(k), r = EMB[k].resolve(y.url);
      $(k + 'On').textContent = y.on ? 'On' : 'Off'; $(k + 'On').classList.toggle('on', y.on);
      if (document.activeElement !== $(k + 'Url')) $(k + 'Url').value = y.url;
      if (document.activeElement !== $(k + 'Name')) $(k + 'Name').value = y.label;
      $(k + 'Hint').textContent = !y.url.trim() ? 'Paste the link, then turn it On. For ' + TB.gradeWord() + ', on this board only.'
        : !r ? EMB[k].bad : r.src ? EMB[k].good : 'This link will open in a new tab.';
    });
  }
  function orderKey() { const p = TB.plans[TB.shownIdx] || {}; return 'order_' + (p.week || 'plan') + '_' + TB.grade; }
  function orderedItems(p) {
    let ord = []; try { ord = JSON.parse(store.get(orderKey(), '[]')) || []; } catch (e) {}
    const pos = k => { const i = ord.indexOf(k); return i < 0 ? 1e6 : i; };
    return planItems(p).concat(embItems()).map((it, i) => [it, i]).sort((x, y) => (pos(itemKey(x[0])) - pos(itemKey(y[0]))) || (x[1] - y[1])).map(x => x[0]);
  }
  let planEditing = false;
  function setPlanEdit(on) {
    planEditing = !!on;
    $('planEdit').textContent = planEditing ? 'Done' : 'Edit'; $('planEdit').classList.toggle('editon', planEditing);
    renderPlan(TB.shownIdx);
  }
  TB.setPlanEdit = setPlanEdit;

  function renderPlan(i) {
    const p = TB.plans[i] || TB.plans[0];
    TB.shownIdx = TB.plans[i] ? i : 0;
    $('planTitle').textContent = TB.shownIdx === TB.curIdx ? 'This week' : TB.weekLabel(p);
    const ol = $('items'); ol.innerHTML = '';
    ol.classList.toggle('editing', planEditing);
    const all = orderedItems(p), list = planEditing ? all : all.filter(it => !hidden.has(itemKey(it)));
    if (!list.length) {
      const li = document.createElement('li'); li.className = 'empty';
      li.textContent = all.length ? 'Everything is hidden. Tap Edit to bring things back.' : 'Nothing here yet.'; ol.appendChild(li);
    }
    let num = 0;
    list.forEach((it, n) => {
      const li = document.createElement('li');
      const isGuide = it.type === 'guide';
      const has = isGuide ? !!TB.findGuide(it.guide) : it.emb ? !!EMB[it.emb].resolve(it.url) : !!(it.url && it.url.trim());
      const hid = hidden.has(itemKey(it));
      const el = document.createElement(planEditing ? 'div' : (has && it.type === 'link' ? 'a' : 'button'));
      el.className = 'item' + (has ? '' : ' missing') + (planEditing ? ' edit' : '') + (hid ? ' hid' : '');
      el.innerHTML = '<span class="n"></span><span class="lbl"></span><span class="kind"></span>';
      el.querySelector('.n').textContent = hid ? '×' : ++num;
      if (it.icon) { const ic = document.createElement('img'); ic.className = 'ic'; ic.src = it.icon; ic.alt = ''; el.querySelector('.n').replaceWith(ic); }
      el.querySelector('.lbl').textContent = it.label;
      el.querySelector('.kind').textContent = !has ? (isGuide ? 'Guide missing' : 'Link needed') : '';
      if (planEditing) {
        el.querySelector('.kind').remove();
        const ctl = document.createElement('span'); ctl.className = 'pctl';
        const btn = (txt, label, fn, off) => {
          const x = document.createElement('button'); x.textContent = txt; x.setAttribute('aria-label', label + ' ' + it.label); x.disabled = !!off;
          x.onclick = fn; ctl.appendChild(x); return x;
        };
        const move = d => {
          const keys = all.map(itemKey), j = n + d; [keys[n], keys[j]] = [keys[j], keys[n]];
          store.set(orderKey(), JSON.stringify(keys)); renderPlan(TB.shownIdx);
        };
        btn('▲', 'Move up', () => move(-1), n === 0);
        btn('▼', 'Move down', () => move(1), n === all.length - 1);
        if (it.emb) btn('Off', 'Turn off', () => { const y = embGet(it.emb); y.on = false; embSet(it.emb, y); renderPlan(TB.shownIdx); });
        else {
          btn(hid ? 'Show' : 'Hide', hid ? 'Show' : 'Hide', () => {
            const k = itemKey(it); if (hidden.has(k)) hidden.delete(k); else hidden.add(k);
            saveHidden(); renderPlan(TB.shownIdx);
          }).classList.toggle('showbtn', hid);
          const k = itemKey(it), everywhere = hiddenEverywhere(k);
          btn(everywhere ? 'Show all' : 'Hide all', (everywhere ? 'Show in all grades' : 'Hide in all grades'), () => {
            hideAll(k, !everywhere); renderPlan(TB.shownIdx);
          }).classList.toggle('showbtn', everywhere);
        }
        el.appendChild(ctl);
      } else wireItem(el, it, has);
      li.appendChild(el); ol.appendChild(li);
    });
    paintEmb();
    requestAnimationFrame(fitPlan);
    if (document.fonts) document.fonts.ready.then(fitPlan);
  }
  TB.renderPlan = renderPlan;

  function fitPlan() {
    const ol = $('items'); ol.style.fontSize = '';
    const items = ol.querySelectorAll('.item'); items.forEach(x => { x.style.fontSize = ''; x.style.paddingBlock = ''; });
    if (!items.length || innerWidth <= 820 || document.body.classList.contains('min-plan')) return;
    if (planEditing) { items.forEach(x => x.style.fontSize = 'min(3vh, 24px)'); return; }
    let size = parseFloat(getComputedStyle(items[0]).fontSize);
    while (ol.scrollHeight > ol.clientHeight + 1 && size > 16) {
      size -= 1; items.forEach(x => { x.style.fontSize = size + 'px'; x.style.paddingBlock = (size * .32) + 'px'; });
    }
  }
  TB.fitPlan = fitPlan;
  addEventListener('resize', fitPlan);
  $('planEdit').onclick = () => setPlanEdit(!planEditing);

  function setGrade(g) {
    TB.grade = g; store.set('grade', g); hidden = hiddenBy[g];
    document.querySelectorAll('.gtab[data-grade]').forEach(b => { const on = b.dataset.grade === g; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    renderPlan(TB.shownIdx);
    TB.gradeHooks.forEach(f => f());
  }
  TB.setGrade = setGrade;

  TB.GRADES.forEach(([id, name]) => {
    const b = document.createElement('button');
    b.className = 'tool gtab'; b.dataset.grade = id; b.textContent = name; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', /^\d/.test(name) ? name + ' grade' : name);
    b.onclick = () => setGrade(id);
    $('grades').insertBefore(b, $('clarBtn'));
  });
  $('planPick').onchange = e => renderPlan(Number(e.target.value));
  setGrade(TB.grade);

  // Overnight / Monday rollover: switch to the new current week automatically
  TB.dayChangeHooks.push(() => {
    const wasOnCurrent = TB.shownIdx === TB.curIdx;
    TB.curIdx = TB.computeCurIdx();
    if (wasOnCurrent) TB.shownIdx = TB.curIdx;
    rebuildWeekPicker();
    renderPlan(TB.shownIdx);
    renderTicker();
  });

  /* ---------- event countdown ---------- */
  function cdDefault() {
    const c = (typeof COUNTDOWN !== 'undefined' && COUNTDOWN) || {};
    return {
      on: c.on !== false,
      events: (c.events || []).map(e => ({ name: e.name || '', date: e.date || '' })),
      off: (c.noSchool || []).map(r => [r[0] || '', r[1] || r[0] || ''])
    };
  }
  let cd = cdDefault();
  try { const v = JSON.parse(store.get('countdown', 'null')); if (v && Array.isArray(v.events) && Array.isArray(v.off)) cd = v; } catch (e) {}
  function cdSave() { store.set('countdown', JSON.stringify(cd)); renderTicker(); }

  function schoolDays(date) {
    const end = new Date(date + 'T12:00'), d = new Date(); d.setHours(12, 0, 0, 0);
    if (isNaN(end) || end < d) return -1;
    let n = 0, guard = 0;
    while (dayKey(d) < date && guard++ < 800) {
      const k = dayKey(d), wd = d.getDay();
      if (wd !== 0 && wd !== 6 && !cd.off.some(r => r[0] && k >= r[0] && k <= (r[1] || r[0]))) n++;
      d.setDate(d.getDate() + 1);
    }
    return n;
  }
  function evText(e) {
    const n = schoolDays(e.date);
    if (n < 0) return null;
    return n === 0 ? ['Today', e.name + '!'] : [String(n), (n === 1 ? 'school day' : 'school days') + ' until ' + e.name];
  }
  function renderTicker() {
    const box = $('ticker'), track = $('track');
    const list = cd.events.filter(e => e.name.trim() && e.date).sort((a, b) => a.date.localeCompare(b.date)).map(evText).filter(Boolean);
    $('cdBtn').classList.toggle('on', cd.on && list.length > 0);
    track.innerHTML = '';
    box.classList.toggle('show', cd.on && list.length > 0);
    if (!cd.on || !list.length) { requestAnimationFrame(fitPlan); return; }
    const group = () => list.forEach(([n, t]) => {
      const s = document.createElement('span'); s.className = 'ev'; s.innerHTML = '<b></b><span></span>';
      s.querySelector('b').textContent = n; s.querySelector('span').textContent = t; track.appendChild(s);
    });
    group();
    const one = track.scrollWidth || 1, reps = Math.min(40, Math.ceil(box.clientWidth / one) + 1);
    for (let i = 1; i < reps * 2; i++) group();
    track.style.animationDuration = Math.max(12, (one * reps) / 70) + 's';
    requestAnimationFrame(fitPlan);
  }
  TB.renderTicker = renderTicker;

  function cdRow(parent, fields, onRemove, extra) {
    const r = document.createElement('div'); r.className = 'r';
    fields.forEach(([type, val, label, set]) => {
      const i = document.createElement('input'); i.type = type; i.value = val; i.setAttribute('aria-label', label);
      if (type === 'text') { i.placeholder = label; i.maxLength = 40; }
      i.oninput = () => { set(i.value); cdSave(); if (extra) extra(r); };
      r.appendChild(i);
    });
    const note = document.createElement('span'); note.className = 'left'; r.appendChild(note);
    const x = document.createElement('button'); x.className = 'tool'; x.textContent = 'Remove'; x.onclick = onRemove; r.appendChild(x);
    if (extra) extra(r);
    parent.appendChild(r);
  }
  function renderCd() {
    $('cdOn').textContent = cd.on ? 'On' : 'Off'; $('cdOn').classList.toggle('on', cd.on);
    const ev = $('cdEvents'), off = $('cdOff'); ev.innerHTML = ''; off.innerHTML = '';
    cd.events.forEach((e, i) => cdRow(ev, [['text', e.name, 'Event name', v => e.name = v], ['date', e.date, 'Event date', v => e.date = v]],
      () => { cd.events.splice(i, 1); cdSave(); renderCd(); },
      r => { const n = e.date ? schoolDays(e.date) : null; r.querySelector('.left').textContent = n === null ? '' : n < 0 ? 'Past' : n === 0 ? 'Today' : n + (n === 1 ? ' school day' : ' school days'); }));
    cd.off.forEach((o, i) => cdRow(off, [['date', o[0], 'First day off', v => { o[0] = v; if (!o[1] || o[1] < v) o[1] = v; }], ['date', o[1], 'Last day off', v => o[1] = v]],
      () => { cd.off.splice(i, 1); cdSave(); renderCd(); }));
  }
  function cdOpen(on) { if (on) renderCd(); $('cdBox').classList.toggle('show', on); }
  TB.cdOpen = cdOpen;
  $('cdBtn').onclick = () => cdOpen(true);
  $('ticker').onclick = () => cdOpen(true);
  $('cdClose').onclick = () => cdOpen(false);
  $('cdBox').onclick = e => { if (e.target === $('cdBox')) cdOpen(false); };
  $('cdOn').onclick = () => { cd.on = !cd.on; cdSave(); renderCd(); };
  $('cdAdd').onclick = () => { cd.events.push({ name: '', date: '' }); renderCd(); const a = $('cdEvents').querySelectorAll('input[type=text]'); a[a.length - 1].focus(); };
  $('cdAddOff').onclick = () => { cd.off.push(['', '']); renderCd(); };
  $('cdReset').onclick = () => { store.del('countdown'); cd = cdDefault(); renderTicker(); renderCd(); };
  renderTicker();
  addEventListener('resize', renderTicker);

  /* ---------- steps viewer & full-screen overlays ---------- */
  const viewer = $('viewer'), frame = $('frame');
  let pracGuide = null, embedTab = '';
  function openSteps(url) {
    TB.clearInk();
    viewer.classList.remove('video'); document.body.classList.remove('embedmode');
    pracGuide = TB.guides.find(g => g.practice === url) || null;
    document.body.classList.toggle('pracmode', !!pracGuide);
    viewer.classList.toggle('over', $('guide').classList.contains('show'));
    frame.src = url; viewer.classList.add('show'); document.body.classList.add('viewing');
    frame.onload = () => { try { frame.contentWindow.focus(); } catch (e) {} };
    goFull();
  }
  TB.openSteps = openSteps;

  function openEmbed(it) {
    const r = EMB[it.emb].resolve(it.url); if (!r) return;
    if (!r.src) { window.open(r.tab, '_blank', 'noopener'); return; }
    TB.clearInk(); pracGuide = null; document.body.classList.remove('pracmode');
    viewer.classList.remove('over'); viewer.classList.add('video');
    embedTab = r.tab; document.body.classList.add('embedmode');
    frame.src = r.src;
    frame.onload = () => { try { frame.focus(); } catch (e) {} };
    viewer.classList.add('show'); document.body.classList.add('viewing');
    goFull();
  }
  TB.openEmbed = openEmbed;
  $('openTab').onclick = () => { if (embedTab) window.open(embedTab, '_blank', 'noopener'); };

  function backToSteps() {
    const g = pracGuide;
    viewer.classList.remove('show', 'over'); document.body.classList.remove('pracmode'); frame.src = 'about:blank';
    TB.clearInk(); TB.setDraw(false);
    if (!$('guide').classList.contains('show') && g) openGuide(g.id);
  }
  TB.backToSteps = backToSteps;
  $('toSteps').onclick = backToSteps;

  function closeSteps() {
    if ($('kbd').classList.contains('show')) setKbd(false);
    document.body.classList.remove('pracmode', 'embedmode'); viewer.classList.remove('over', 'video');
    viewer.classList.remove('show'); $('guide').classList.remove('show'); document.body.classList.remove('viewing'); frame.src = 'about:blank';
    if ($('clarity').classList.contains('editing')) clarEdit(false);
    $('clarity').classList.remove('show');
    if ($('todo').classList.contains('editing')) todoEdit(false);
    $('todo').classList.remove('show'); $('score').classList.remove('show'); $('qrPage').classList.remove('show');
    TB.clearInk(); TB.setDraw(false);
  }
  TB.closeSteps = closeSteps;
  $('closeView').onclick = closeSteps;

  /* ---------- teacher clarity ---------- */
  const CL = [['will', 'cWill'], ['so', 'cSo'], ['know', 'cKnow']];
  function clarKey() { const p = TB.plans[TB.shownIdx] || {}; return 'clar_' + (p.week || 'plan') + '_' + TB.grade; }
  function clarDev() { try { const v = JSON.parse(store.get(clarKey(), 'null')); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  function clarPaint() {
    const dev = clarDev(), cur = dev || gradeData(TB.plans[TB.shownIdx]).clarity || {};
    const editing = $('clarity').classList.contains('editing');
    CL.forEach(([k, id]) => {
      const el = $(id), t = String(cur[k] || '').trim();
      el.contentEditable = editing ? 'true' : 'false';
      el.classList.toggle('blank', !t && !editing);
      el.textContent = t || (editing ? '' : 'Tap Edit to type this.');
    });
    $('cEdit').textContent = editing ? 'Done' : 'Edit';
    $('cEdit').classList.toggle('editon', editing);
    $('cReset').style.display = dev && !editing ? '' : 'none';
  }
  function clarEdit(on) {
    const box = $('clarity');
    if (!on && box.classList.contains('editing')) {
      const v = {}; CL.forEach(([k, id]) => v[k] = $(id).innerText.replace(/\u00a0/g, ' ').trim());
      const pub = gradeData(TB.plans[TB.shownIdx]).clarity || {};
      if (CL.every(([k]) => v[k] === String(pub[k] || '').trim())) store.del(clarKey());
      else store.set(clarKey(), JSON.stringify(v));
    }
    box.classList.toggle('editing', on);
    clarPaint();
    if (on) { TB.setDraw(false); $('cWill').focus(); }
  }
  TB.clarEdit = clarEdit;
  function openClarity() {
    const p = TB.plans[TB.shownIdx] || {};
    TB.clearInk();
    $('clarity').classList.remove('editing');
    $('cTitle').textContent = TB.gradeTitle() + (TB.shownIdx === TB.curIdx ? '' : ', ' + TB.weekLabel(p));
    clarPaint();
    $('clarity').classList.add('show'); document.body.classList.add('viewing');
    goFull();
  }
  TB.openClarity = openClarity;
  $('clarBtn').onclick = openClarity;
  $('cEdit').onclick = () => clarEdit(!$('clarity').classList.contains('editing'));
  $('cReset').onclick = () => { store.del(clarKey()); clarPaint(); };

  /* ---------- must do / may do ---------- */
  const TL = [['must', 'tMust', 'mustDo'], ['may', 'tMay', 'mayDo']];
  function todoDev() { try { const v = JSON.parse(store.get('todo_' + TB.grade, 'null')); return v && Array.isArray(v.must) && Array.isArray(v.may) ? v : null; } catch (e) { return null; } }
  function todoLists() {
    const d = todoDev(); if (d) return d;
    const g = gradeData(TB.plans[TB.shownIdx]);
    return { must: (g.mustDo || []).map(String), may: (g.mayDo || []).map(String) };
  }
  function todoChecks() { try { return new Set(JSON.parse(store.get('todock_' + TB.grade, '[]'))); } catch (e) { return new Set(); } }
  let todoDraft = null;
  function todoPaint() {
    const editing = $('todo').classList.contains('editing'), lists = editing ? todoDraft : todoLists(), checks = todoChecks();
    TL.forEach(([k, id]) => {
      const ul = $(id); ul.innerHTML = '';
      if (!lists[k].length && !editing) { const li = document.createElement('li'); li.className = 'none'; li.textContent = 'Nothing yet. Tap Edit to add.'; ul.appendChild(li); }
      lists[k].forEach((t, i) => {
        const li = document.createElement('li');
        if (editing) {
          const inp = document.createElement('input'); inp.type = 'text'; inp.value = t; inp.maxLength = 80; inp.placeholder = 'Type a job'; inp.setAttribute('aria-label', (k === 'must' ? 'Must Do ' : 'May Do ') + (i + 1));
          inp.oninput = () => todoDraft[k][i] = inp.value;
          const x = document.createElement('button'); x.className = 'tool'; x.textContent = 'Remove'; x.onclick = () => { todoDraft[k].splice(i, 1); todoPaint(); };
          li.appendChild(inp); li.appendChild(x);
        } else {
          const b = document.createElement('button'); b.className = 'titem' + (checks.has(k + '|' + t) ? ' done' : '');
          b.innerHTML = '<span class="box"></span><span class="txt"></span>'; b.querySelector('.txt').textContent = t;
          b.setAttribute('aria-pressed', checks.has(k + '|' + t));
          b.onclick = () => { const c = todoChecks(), key = k + '|' + t; if (c.has(key)) c.delete(key); else c.add(key); store.set('todock_' + TB.grade, JSON.stringify([...c])); todoPaint(); };
          li.appendChild(b);
        }
        ul.appendChild(li);
      });
    });
    $('tEdit').textContent = editing ? 'Done' : 'Edit'; $('tEdit').classList.toggle('editon', editing);
    $('tReset').style.display = todoDev() && !editing ? '' : 'none';
    $('tClear').style.display = checks.size && !editing ? '' : 'none';
  }
  function todoEdit(on) {
    const box = $('todo');
    if (on) { const l = todoLists(); todoDraft = { must: l.must.slice(), may: l.may.slice() }; TB.setDraw(false); }
    else if (box.classList.contains('editing')) {
      const v = { must: todoDraft.must.map(t => t.trim()).filter(Boolean), may: todoDraft.may.map(t => t.trim()).filter(Boolean) };
      store.set('todo_' + TB.grade, JSON.stringify(v));
    }
    box.classList.toggle('editing', on);
    todoPaint();
  }
  TB.todoEdit = todoEdit;
  function todoAdd(k, id) { todoDraft[k].push(''); todoPaint(); const a = $(id).querySelectorAll('input'); a[a.length - 1].focus(); }
  TB.todoAdd = todoAdd;
  function openTodo() {
    TB.clearInk(); $('todo').classList.remove('editing');
    $('tTitle').textContent = TB.gradeTitle();
    todoPaint();
    $('todo').classList.add('show'); document.body.classList.add('viewing');
    goFull();
  }
  TB.openTodo = openTodo;
  $('todoBtn').onclick = openTodo;
  $('tEdit').onclick = () => todoEdit(!$('todo').classList.contains('editing'));
  $('tReset').onclick = () => { store.del('todo_' + TB.grade); todoPaint(); };
  $('tClear').onclick = () => { store.del('todock_' + TB.grade); todoPaint(); };
  $('tAddMust').onclick = () => todoAdd('must', 'tMust');
  $('tAddMay').onclick = () => todoAdd('may', 'tMay');

  /* ---------- guides ---------- */
  const gWall = $('gWall'); let gCur = 0, gSteps = [], gAllSteps = [], gId = '', gHidden = new Set();
  function gLoadHidden(id) { try { return new Set(JSON.parse(store.get('ghide_' + id, '[]'))); } catch (e) { return new Set(); } }
  function gApplyHidden() {
    gAllSteps.forEach(d => d.classList.toggle('hid', gHidden.has(d.dataset.key)));
    gSteps = gAllSteps.filter(d => !d.classList.contains('hid'));
    gSteps.forEach((d, i) => d.querySelector('.gnum').textContent = i + 1);
    gAllSteps.filter(d => d.classList.contains('hid')).forEach(d => d.querySelector('.gnum').textContent = '\u00d7');
    const editing = gWall.classList.contains('editing');
    gWall.classList.toggle('many', (editing ? gAllSteps : gSteps).length > 8);
    $('gEdit').textContent = editing ? 'Done' : 'Edit';
    $('gEdit').classList.toggle('editon', editing);
  }
  function gSetEdit(on) {
    if (on) gWall.classList.remove('big', 'focus');
    gWall.classList.toggle('editing', on); $('guide').classList.toggle('editing', on);
    gApplyHidden();
    if (!on) { gCur = 0; gWall.classList.add('focus'); $('gAll').textContent = 'Show all'; gSetBig(store.get('gbig', '0') === '1'); gShow(); }
  }
  function gToggleHide(d) {
    const k = d.dataset.key;
    if (gHidden.has(k)) gHidden.delete(k);
    else if (gAllSteps.length - gHidden.size > 1) gHidden.add(k);
    store.set('ghide_' + gId, JSON.stringify([...gHidden]));
    gApplyHidden();
  }
  function gShow() { gSteps.forEach((s, i) => { s.classList.toggle('on', i === gCur); s.classList.toggle('done', i < gCur); }); }
  function gGo(i) {
    gCur = Math.max(0, Math.min(gSteps.length - 1, i));
    if (!gWall.classList.contains('focus')) { gWall.classList.add('focus'); $('gAll').textContent = 'Show all'; }
    gShow();
  }
  TB.gStep = d => gGo(gCur + d);
  function gSetBig(on) {
    gWall.classList.toggle('big', on); $('gBig').textContent = on ? 'Wall' : 'Big'; store.set('gbig', on ? 1 : 0);
    if (on) { gWall.classList.add('focus'); $('gAll').textContent = 'Show all'; }
  }
  function openGuide(id) {
    const g = TB.findGuide(id); if (!g) return;
    $('archive').classList.remove('show');
    TB.clearInk();
    $('gTitle').textContent = g.title || 'Steps';
    $('gPrac').style.display = g.practice ? '' : 'none';
    $('gPrac').onclick = () => openSteps(g.practice);
    gWall.innerHTML = ''; gWall.classList.remove('editing'); $('guide').classList.remove('editing');
    gId = id; gHidden = gLoadHidden(id);
    (g.steps || []).forEach((st, i) => {
      const d = document.createElement('div'); d.className = 'gstep'; d.tabIndex = 0;
      d.innerHTML = '<div class="gnum"></div><div class="gpic"><img alt=""></div><div class="gsay"></div>';
      d.querySelector('.gnum').textContent = i + 1;
      d.querySelector('img').src = st.img; d.querySelector('img').alt = st.say || '';
      d.querySelector('.gsay').textContent = st.say || '';
      d.dataset.key = st.img || String(i);
      d.onclick = () => gWall.classList.contains('editing') ? gToggleHide(d) : gGo(gSteps.indexOf(d));
      gWall.appendChild(d);
    });
    gAllSteps = Array.from(gWall.children); gCur = 0;
    gApplyHidden();
    gWall.classList.add('focus'); $('gAll').textContent = 'Show all';
    gSetBig(store.get('gbig', '0') === '1');
    gShow();
    $('guide').classList.add('show'); document.body.classList.add('viewing');
    goFull();
  }
  TB.openGuide = openGuide;
  $('gNext').onclick = () => gGo(gCur + 1);
  $('gBack').onclick = () => gGo(gCur - 1);
  $('gAll').onclick = () => {
    if (gWall.classList.contains('big')) gSetBig(false);
    const f = gWall.classList.toggle('focus'); $('gAll').textContent = f ? 'Show all' : 'One at a time';
  };
  $('gBig').onclick = () => gSetBig(!gWall.classList.contains('big'));
  $('gEdit').onclick = () => gSetEdit(!gWall.classList.contains('editing'));

  /* ---------- archive ---------- */
  function archSetEdit(on) {
    $('archive').classList.toggle('editing', on);
    $('archEdit').textContent = on ? 'Done' : 'Edit'; $('archEdit').classList.toggle('editon', on);
    renderArchive();
  }
  function renderArchive() {
    const ul = $('archList'); ul.innerHTML = '';
    const editing = $('archive').classList.contains('editing');
    $('archHint').textContent = 'Tap a row to hide it for ' + TB.gradeWord() + '. Tap again to bring it back.';
    const head = t => { const li = document.createElement('li'); li.className = 'ahead'; li.textContent = t; ul.appendChild(li); return li; };
    const row = (key, label, note, wire) => {
      const li = document.createElement('li'); const b = document.createElement('button');
      const hid = hidden.has(key);
      li.classList.toggle('hid', hid);
      b.innerHTML = '<span></span><small></small>';
      b.querySelector('span').textContent = label;
      b.querySelector('small').textContent = editing && hid ? 'Hidden' : note;
      if (editing) b.onclick = () => {
        if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
        saveHidden(); renderArchive(); renderPlan(TB.shownIdx);
      };
      else wire(b);
      li.appendChild(b); ul.appendChild(li);
      return !hid;
    };
    const list = TB.guides.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const gHead = head('Guides'); let shown = 0;
    list.forEach(g => {
      if (row('guide|' + g.id, g.title || g.id,
        g.date ? new Date(g.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
        b => b.onclick = () => openGuide(g.id))) shown++;
    });
    if (!list.length) head('None yet');
    else if (!shown && !editing) gHead.style.display = 'none';
    const seen = new Set(), others = [];
    TB.plans.forEach(p => allItems(p).forEach(it => {
      if (it.type === 'guide' || !(it.url && it.url.trim())) return;
      const k = it.type + '|' + it.url; if (seen.has(k)) return; seen.add(k); others.push(it);
    }));
    if (others.length) {
      const oHead = head('Pages and links'); shown = 0;
      others.forEach(it => {
        if (row(itemKey(it), it.label, it.type === 'link' ? 'Opens tab' : 'Steps', b => {
          wireItem(b, it, true);
          b.addEventListener('click', () => $('archive').classList.remove('show'));
        })) shown++;
      });
      if (!shown && !editing) oHead.style.display = 'none';
    }
  }
  function archClose() { $('archive').classList.remove('show'); if ($('archive').classList.contains('editing')) archSetEdit(false); }
  TB.archClose = archClose;
  $('archEdit').onclick = () => archSetEdit(!$('archive').classList.contains('editing'));
  $('pastBtn').onclick = () => { renderArchive(); $('archive').classList.add('show'); };
  $('archClose').onclick = archClose;
  $('archive').onclick = e => { if (e.target === $('archive')) archClose(); };
  $('fsBtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : goFull();
  document.addEventListener('fullscreenchange', () => { $('fsBtn').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; });

  /* ---------- backgrounds (saved in IndexedDB so localStorage stays lean) ---------- */
  const BGS = [
    ['Sky', 'linear-gradient(160deg, #bfe3fa, #e6f5fe)'],
    ['Sunrise', 'linear-gradient(160deg, #ffd3a5, #fd9fb0)'],
    ['Mint', 'linear-gradient(160deg, #c7f0db, #eafaf1)'],
    ['Grape', 'linear-gradient(160deg, #8e6cc4, #c9b6ea)'],
    ['Ocean', 'linear-gradient(160deg, #2d6cdf, #6fc3f7)'],
    ['Night', 'linear-gradient(160deg, #1b2440, #3a4a7a)'],
    ['Sunny', 'linear-gradient(160deg, #ffe57a, #fff6c9)'],
    ['Chalk', 'linear-gradient(160deg, #2f5d46, #3f7a5c)'],
    ['Black', 'linear-gradient(#0b0b0b, #0b0b0b)', 'dark'],
    ['Green', 'linear-gradient(#19e35a, #19e35a)'],
    ['Black + purple', 'linear-gradient(#0b0b0b, #0b0b0b)', 'dark purple', 'linear-gradient(135deg, #0b0b0b 55%, #391273 55%)']
  ];
  const bgGet = (k, d) => store.get(k + '_' + TB.grade, store.get(k, d));
  let bgCur = 0, bgImg = '', bgPicOn = false, bgLoadSeq = 0;

  function setBg(i) {
    const mode = BGS[i][2] || '';
    document.body.classList.toggle('dark', mode.includes('dark'));
    document.body.classList.toggle('purple', mode.includes('purple'));
    store.set('bg2_' + TB.grade, i); bgCur = i;
    paintBg();
  }
  function paintBg() {
    if (bgPicOn && bgImg) document.documentElement.style.setProperty('--bg', 'url("' + bgImg + '") center / cover no-repeat');
    else document.documentElement.style.setProperty('--bg', BGS[bgCur][1]);
    document.querySelectorAll('.swatch:not(.pic)').forEach((s, j) => s.classList.toggle('on', !bgPicOn && j === bgCur));
    const pic = $('bgPicSw'); if (!pic) return;
    pic.style.display = bgImg ? '' : 'none'; pic.style.backgroundImage = bgImg ? 'url("' + bgImg + '")' : '';
    pic.classList.toggle('on', bgPicOn);
    $('bgRemove').style.display = bgImg ? '' : 'none';
  }
  function setPic(on) { bgPicOn = on && !!bgImg; store.set('bgpic_' + TB.grade, bgPicOn ? 1 : 0); paintBg(); }
  function loadPic(file) {
    if (!file) return;
    const note = $('bgNote'), url = URL.createObjectURL(file), im = new Image(), g = TB.grade;
    im.onerror = () => { URL.revokeObjectURL(url); note.textContent = 'That file did not open as a picture. Try a JPG or PNG.'; };
    im.onload = async () => {
      const k = Math.min(1, 1920 / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const data = c.toDataURL('image/jpeg', .82);
      const ok = await imgStore.set('bgimg_' + g, data);
      if (g === TB.grade) {
        note.textContent = ok ? 'Picture saved for ' + TB.gradeWord() + ', on this board only.' : 'Picture is on, but could not be saved.';
        bgImg = data; setPic(true);
      }
    };
    im.src = url;
  }
  BGS.forEach(([name, css, mode, swatch], i) => {
    const b = document.createElement('button');
    b.className = 'swatch'; b.style.background = swatch || css; b.title = name; b.setAttribute('aria-label', name);
    b.onclick = () => { bgPicOn = false; store.set('bgpic_' + TB.grade, 0); setBg(i); };
    $('bgpick').appendChild(b);
  });
  (function () {
    const pick = $('bgpick');
    const sw = document.createElement('button'); sw.className = 'swatch pic'; sw.id = 'bgPicSw'; sw.title = 'My picture'; sw.setAttribute('aria-label', 'My picture');
    sw.onclick = () => setPic(true); pick.appendChild(sw);
    const row = document.createElement('div'); row.className = 'wide';
    row.innerHTML = '<button class="tool" id="bgUpload">Upload picture</button><button class="tool" id="bgRemove">Remove picture</button><input type="file" id="bgFile" accept="image/*" hidden>';
    pick.appendChild(row);
    const note = document.createElement('p'); note.className = 'note'; note.id = 'bgNote'; pick.appendChild(note);
    $('bgUpload').onclick = () => $('bgFile').click();
    $('bgFile').onchange = e => { loadPic(e.target.files[0]); e.target.value = ''; };
    $('bgRemove').onclick = async () => { bgImg = ''; await imgStore.del('bgimg_' + TB.grade); $('bgNote').textContent = ''; setPic(false); };
  })();
  const BG_DEFAULT = BGS.findIndex(b => b[0] === 'Black + purple');
  async function loadBg() {
    const seq = ++bgLoadSeq, g = TB.grade;
    const i = Number(bgGet('bg2', BG_DEFAULT));
    $('bgNote').textContent = '';
    bgImg = ''; bgPicOn = false;
    setBg(i >= 0 && i < BGS.length ? i : BG_DEFAULT);
    const data = (await imgStore.get('bgimg_' + g)) || (await imgStore.get('bgimg'));
    if (seq !== bgLoadSeq) return;
    bgImg = data || '';
    bgPicOn = bgGet('bgpic', '0') === '1' && !!bgImg;
    paintBg();
  }
  TB.gradeHooks.push(loadBg);
  loadBg();
  $('bgBtn').onclick = e => { e.stopPropagation(); $('bgpick').classList.toggle('show'); $('bgBtn').classList.toggle('on'); };
  document.addEventListener('click', e => {
    if (!$('bgpick').contains(e.target) && e.target !== $('bgBtn')) { $('bgpick').classList.remove('show'); $('bgBtn').classList.remove('on'); }
  });

  /* ---------- keyboard overlay ---------- */
  function setKbd(on) {
    const f = $('kbdFrame');
    if (on && !f.src) f.src = 'keyboard.html';
    TB.clearInk(); TB.setDraw(false);
    $('kbd').classList.toggle('show', on); document.body.classList.toggle('kbdopen', on);
    if (on) { try { f.contentWindow.focus(); } catch (e) {} f.onload = () => { try { f.contentWindow.focus(); } catch (e) {} }; }
  }
  TB.setKbd = setKbd;
  $('kbdBtn').onclick = () => setKbd(true);
  $('kbdBtn2').onclick = () => setKbd(true);
  $('kbdClose').onclick = () => setKbd(false);

  /* ---------- QR code ---------- */
  function qrGet() { const v = TB.jget('qr_' + TB.grade, null); return v && v.url ? v : null; }
  function qrSetup() {
    const v = qrGet() || { url: '', label: '' };
    openDlg('QR code', body => {
      body.innerHTML = '<p>Paste a link. The board shows it as a giant QR code for students to scan. Saved for ' + TB.gradeWord() + ' on this board only.</p>' +
        '<div class="r"><input type="text" id="qrIn" placeholder="https://..." aria-label="Link"></div>' +
        '<div class="r"><input type="text" id="qrLab" maxlength="40" placeholder="Words at the top (optional)" aria-label="Words at the top"></div>' +
        '<p id="qrMsg"></p><div class="r"><button class="tool" id="qrGo">Show QR code</button></div>';
      $('qrIn').value = v.url; $('qrLab').value = v.label || '';
      const go = () => {
        let u = $('qrIn').value.trim();
        if (u && !/^[a-z]+:/i.test(u)) u = 'https://' + u;
        if (!/^https?:\/\/\S+\.\S+/i.test(u)) { $('qrMsg').textContent = 'That does not look like a link.'; return; }
        if (u.length > 1200) { $('qrMsg').textContent = 'That link is too long for a QR code. Try a shorter link.'; return; }
        store.set('qr_' + TB.grade, JSON.stringify({ url: u, label: $('qrLab').value.trim() })); closeDlg(); qrOpen();
      };
      $('qrGo').onclick = go; $('qrIn').onkeydown = e => { if (e.key === 'Enter') go(); };
      setTimeout(() => { const i = $('qrIn'); if (i) i.focus(); }, 50);
    });
  }
  function qrOpen() {
    const v = qrGet(); if (!v) { qrSetup(); return; }
    TB.clearInk();
    $('qrTitle').textContent = v.label || 'Scan me';
    try { $('qrBox').innerHTML = qrSvg(v.url); } catch (e) { $('qrBox').textContent = 'Could not make a QR code for that link.'; }
    $('qrUrl').textContent = v.url.replace(/^https?:\/\//, '');
    $('qrPage').classList.add('show'); document.body.classList.add('viewing');
    goFull();
  }
  $('qrBtn').onclick = qrOpen;
  $('qrChange').onclick = qrSetup;

  /* ---------- attention getter ---------- */
  let attnT = null;
  function attnShow(on) {
    clearTimeout(attnT);
    $('attn').classList.toggle('show', on);
    if (on) {
      $('attnWord').textContent = store.get('attnwords', 'Eyes on me!');
      TB.audio.attnChime();
      attnT = setTimeout(() => attnShow(false), 15000);
    }
  }
  TB.attnShow = attnShow;
  $('attnBtn').onclick = () => attnShow(true);
  $('attn').onclick = e => { if (e.target !== $('attnEdit')) attnShow(false); };
  $('attnEdit').onclick = e => {
    e.stopPropagation();
    attnShow(false);
    openDlg('Attention words', body => {
      body.innerHTML = '<p>Words shown when you tap Attention.</p>' +
        '<div class="r"><input type="text" id="attnIn" maxlength="40" aria-label="Attention words"><button class="tool on" id="attnSave">Save</button></div>';
      $('attnIn').value = store.get('attnwords', 'Eyes on me!');
      const go = () => {
        const v = $('attnIn').value.trim().slice(0, 40);
        if (!v) return;
        store.set('attnwords', v);
        closeDlg();
        toast('Attention words saved');
      };
      $('attnSave').onclick = go;
      $('attnIn').onkeydown = ev => { if (ev.key === 'Enter') go(); };
      setTimeout(() => { const i = $('attnIn'); if (i) { i.focus(); i.select(); } }, 40);
    });
  };
})();
