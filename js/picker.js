(function () {
  const TB = window.TB;
  const { $, store, jget, toast, dayKey, shortDay, goFull } = TB;

  /* ---------- team scoreboard & class race ---------- */
  function scoreGet() {
    let v = null; try { v = JSON.parse(store.get('score_' + TB.grade, 'null')); } catch (e) {}
    const n = v && v.n >= 1 && v.n <= 10 ? v.n : 4;
    const teams = (v && Array.isArray(v.teams) ? v.teams : []).map(t => ({ name: String(t.name || ''), score: Math.max(0, Number(t.score) || 0) }));
    while (teams.length < n) teams.push({ name: 'Team ' + (teams.length + 1), score: 0 });
    return { n, teams };
  }
  function scoreSet(v) { store.set('score_' + TB.grade, JSON.stringify(v)); }
  // In sub mode always show generic teams so homeroom teacher names are not displayed
  const scMode = () => document.body.classList.contains('sub') ? 'teams' : store.get('scmode_' + TB.grade, 'teams');

  function scorePaint() {
    const race = scMode() === 'race', box = $('sRows');
    $('sMode').textContent = race ? 'Use teams' : 'Class race'; $('sCount').style.display = race ? 'none' : '';
    $('sZero').textContent = race ? 'New round' : 'Reset scores';
    $('sTitle').textContent = TB.gradeTitle() + (race ? ' Class Race' : ' Scores');
    let rows;
    if (race) {
      rows = pkClasses().map(c => ({ name: c.t, score: c.pts, id: c.id }));
      if (!rows.length) { box.style.setProperty('--n', 2); box.innerHTML = '<div class="srow"><span style="font-size:.7em">Add your ' + TB.gradeWord() + ' classes in the Picker first (+ Add class). Each class becomes a racer here.</span></div>'; return; }
    } else { const v = scoreGet(); rows = v.teams.slice(0, v.n); $('sN').textContent = v.n; }
    const top = Math.max(...rows.map(t => t.score)), goal = Math.max(10, Math.ceil(top / 5) * 5);
    box.style.setProperty('--n', Math.max(2, rows.length)); box.innerHTML = '';
    rows.forEach((t, i) => {
      const r = document.createElement('div'); r.className = 'srow' + (top > 0 && t.score === top ? ' lead' : '');
      r.innerHTML = '<input type="text" maxlength="18"><button class="pm" aria-label="Take 1 away">-</button><button class="pm plus" aria-label="Add 1">+</button>' +
        '<div class="strack"><i></i><span>🚀</span></div><div class="pts"></div>';
      const inp = r.querySelector('input'); inp.value = t.name; inp.setAttribute('aria-label', (race ? 'Class ' : 'Team ') + (i + 1) + ' name');
      if (race || document.body.classList.contains('sub')) inp.readOnly = true;
      else inp.oninput = () => { const w = scoreGet(); w.teams[i].name = inp.value; scoreSet(w); };
      const bump = d => () => {
        if (race) { const l = pkClasses(), k = l.find(x => x.id === t.id); if (k) { k.pts = Math.max(0, k.pts + d); pkSaveClasses(l); } }
        else { const w = scoreGet(); w.teams[i].score = Math.max(0, w.teams[i].score + d); scoreSet(w); }
        scorePaint();
      };
      const pm = r.querySelectorAll('.pm'); pm[0].onclick = bump(-1); pm[1].onclick = bump(1);
      const pct = Math.min(100, t.score / goal * 100) + '%';
      r.querySelector('.strack i').style.width = pct; r.querySelector('.strack span').style.left = pct;
      r.querySelector('.pts').textContent = t.score;
      box.appendChild(r);
    });
  }
  $('sMode').onclick = () => { store.set('scmode_' + TB.grade, scMode() === 'race' ? 'teams' : 'race'); scorePaint(); };
  function scoreTeams(d) { const v = scoreGet(); v.n = Math.max(1, Math.min(10, v.n + d)); while (v.teams.length < v.n) v.teams.push({ name: 'Team ' + (v.teams.length + 1), score: 0 }); scoreSet(v); scorePaint(); }
  function openScore() {
    TB.clearInk();
    scorePaint();
    $('score').classList.add('show'); document.body.classList.add('viewing');
    goFull();
  }
  TB.openScore = openScore;
  $('scoreBtn').onclick = openScore;
  $('sLess').onclick = () => scoreTeams(-1);
  $('sMore').onclick = () => scoreTeams(1);
  $('sZero').onclick = () => {
    if (scMode() === 'race') { if (!confirm('Start a new round? Every class goes back to 0.')) return; const l = pkClasses(); l.forEach(k => k.pts = 0); pkSaveClasses(l); }
    else { const v = scoreGet(); v.teams.forEach(t => t.score = 0); scoreSet(v); }
    scorePaint();
  };

  /* ---------- random student picker ---------- */
  function pkGet() { return store.get('picker_' + TB.grade, ''); }
  function pkParse(url) {
    url = String(url).trim();
    const pub = url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/([\w-]+)/);
    const g = url.match(/[#&?]gid=(\d+)/), gid = g ? g[1] : '';
    if (pub) return { src: 'https://docs.google.com/spreadsheets/d/e/' + pub[1] + '/pubhtml?widget=true&headers=false' + (gid ? '&gid=' + gid : ''), tab: url };
    const m = url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
    if (m) return {
      src: 'https://docs.google.com/spreadsheets/d/' + m[1] + '/edit?rm=minimal' + (gid ? '#gid=' + gid : ''),
      tab: 'https://docs.google.com/spreadsheets/d/' + m[1] + '/edit' + (gid ? '#gid=' + gid : '')
    };
    return null;
  }
  function pkSetup(msg) {
    const w = $('pkWrap'); w.innerHTML = '';
    const box = document.createElement('div'); box.className = 'pkset';
    box.innerHTML = '<h2>Add your picker</h2><p>Open your Google Sheet, copy the link from the address bar, and paste it here.</p>' +
      '<input type="text" id="pkUrl" placeholder="https://docs.google.com/spreadsheets/d/..." aria-label="Google Sheet link">' +
      '<p class="bad" id="pkMsg"></p><div class="r"><button class="tool" id="pkSave">Save</button></div>' +
      '<p id="pkFor"></p>';
    w.appendChild(box);
    $('pkFor').textContent = 'Saved for ' + TB.gradeWord() + ' on this board only. It is never put on your public site.';
    $('pkUrl').value = pkGet(); $('pkMsg').textContent = msg || '';
    const save = () => {
      const v = $('pkUrl').value.trim();
      if (!pkParse(v)) { $('pkMsg').textContent = 'That does not look like a Google Sheet link.'; return; }
      store.set('picker_' + TB.grade, v); pkShow();
    };
    $('pkSave').onclick = save;
    $('pkUrl').onkeydown = e => { if (e.key === 'Enter') save(); };
    $('pkTab').style.display = 'none'; $('pkChange').style.display = 'none';
  }
  const pkMode = () => store.get('pkmode_' + TB.grade, 'list');
  function pkShow() {
    $('pkWrap').innerHTML = '';
    if (!document.body.classList.contains('pickon')) return;
    $('pkTitle').textContent = TB.gradeTitle() + ' Picker';
    const sheet = pkMode() === 'sheet';
    $('pkMode').textContent = sheet ? 'Use list' : 'Use Sheet';
    $('pkTab').style.display = 'none'; $('pkChange').style.display = 'none';
    if (!sheet) { listShow(); return; }
    const r = pkParse(pkGet());
    if (!r) { pkSetup(); return; }
    const f = document.createElement('iframe'); f.title = 'Random student picker'; f.src = r.src; $('pkWrap').appendChild(f);
    $('pkTab').style.display = ''; $('pkChange').style.display = '';
    $('pkTab').onclick = () => window.open(r.tab, '_blank', 'noopener');
  }
  $('pkMode').onclick = () => { store.set('pkmode_' + TB.grade, pkMode() === 'sheet' ? 'list' : 'sheet'); pkShow(); };

  function pkClasses(g) {
    g = g || TB.grade;
    let v = jget('pkclasses_' + g, null);
    if (!Array.isArray(v)) {
      const old = jget('pknames_' + g, []);
      v = Array.isArray(old) && old.length ? [{ id: 'c' + Date.now(), t: 'My class', n: old.map(String), used: [], last: '' }] : [];
    }
    return v.filter(c => c && Array.isArray(c.n)).map(c => ({
      id: String(c.id || Math.random()), t: String(c.t || 'Class'), n: c.n.map(String).filter(Boolean),
      used: Array.isArray(c.used) ? c.used : [], last: String(c.last || ''),
      sat: Array.isArray(c.sat) ? c.sat : [], seat: Array.isArray(c.seat) ? c.seat : [],
      notes: String(c.notes || ''), nd: String(c.nd || ''), pts: Math.max(0, Number(c.pts) || 0),
      groups: Array.isArray(c.groups) ? c.groups.filter(Array.isArray) : [], gby: c.gby === 'count' ? 'count' : 'size', gnum: Math.max(2, Math.min(10, Number(c.gnum) || 3)),
      checks: c.checks && typeof c.checks === 'object' ? c.checks : {}
    }));
  }
  function pkSaveClasses(list) { store.set('pkclasses_' + TB.grade, JSON.stringify(list)); store.del('pknames_' + TB.grade); }
  function pkCur(list, g) { const id = store.get('pkcls_' + (g || TB.grade), ''); return list.find(c => c.id === id) || list[0] || null; }
  TB.pkClasses = pkClasses;
  TB.pkSaveClasses = pkSaveClasses;
  TB.pkCur = pkCur;

  const pkNoRep = () => store.get('pkrep', '1') === '1';
  let pkTimer = null;
  function pkFit() {
    document.querySelectorAll('#pkWrap .pkname').forEach(el => {
      if (!el.clientWidth) return;
      let size = Math.min(el.clientHeight * .8, 260); el.style.fontSize = size + 'px';
      while (size > 12 && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) { size -= 2; el.style.fontSize = size + 'px'; }
    });
  }
  TB.pkFit = pkFit;

  const pkTab = () => store.get('pktab_' + TB.grade, 'call');
  const pkSeats = () => store.get('pkseats', '2') === '1' ? 1 : 2;
  let pkChecklist = false;
  function listShow() {
    clearInterval(pkTimer);
    const list = pkClasses(), c = pkCur(list);
    if (!c) { listEdit(null); return; }
    const w = $('pkWrap'); w.innerHTML = '';
    const box = document.createElement('div'); box.className = 'pklist';
    box.innerHTML = '<div class="pkrow pkcls" id="pkCls"></div><div class="pkrow pkcls pktabs" id="pkTabs"></div><div class="pkbody" id="pkBody"></div>';
    w.appendChild(box);
    list.forEach(k => {
      const b = document.createElement('button'); b.className = 'chip' + (k.id === c.id ? ' on' : ''); b.textContent = k.t;
      b.setAttribute('aria-pressed', k.id === c.id);
      b.onclick = () => { store.set('pkcls_' + TB.grade, k.id); pkChecklist = false; listShow(); };
      $('pkCls').appendChild(b);
    });
    const add = document.createElement('button'); add.className = 'chip'; add.textContent = '+ Add class'; add.onclick = () => listEdit(null);
    $('pkCls').appendChild(add);
    [['call', 'Cold call'], ['seat', 'Special seats'], ['groups', 'Groups'], ['notes', 'Notes'], ['check', 'Exit check']].forEach(([k, label]) => {
      const b = document.createElement('button'); b.className = 'chip' + (pkTab() === k ? ' on' : ''); b.textContent = label;
      b.setAttribute('aria-pressed', pkTab() === k);
      b.onclick = () => { store.set('pktab_' + TB.grade, k); pkChecklist = false; listShow(); };
      $('pkTabs').appendChild(b);
    });
    ({ seat: seatBody, groups: groupsBody, notes: notesBody, check: checkBody }[pkTab()] || callBody)(c);
    requestAnimationFrame(pkFit);
  }
  const smRow = inner => '<div class="pkrow pksm">' + inner + '<button class="chip pkspk" id="pkSpeak"></button></div>';
  const pkSpeakOn = () => store.get('pkspeak', '1') === '1';
  function pkSay(text) {
    if (TB.audio.isMuted() || !pkSpeakOn() || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.rate = .9; u.lang = 'en-US';
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function pkSpeakBtn() {
    const b = $('pkSpeak'); if (!b) return;
    if (!('speechSynthesis' in window)) { b.style.display = 'none'; return; }
    b.textContent = 'Read aloud: ' + (pkSpeakOn() ? 'On' : 'Off'); b.setAttribute('aria-pressed', pkSpeakOn());
    b.onclick = () => { store.set('pkspeak', pkSpeakOn() ? 0 : 1); if (!pkSpeakOn()) try { speechSynthesis.cancel(); } catch (e) {} pkSpeakBtn(); };
  }
  function callBody(c) {
    $('pkBody').innerHTML = '<div class="pkname" id="pkName" aria-live="polite"></div>' +
      '<div class="pkrow"><button class="chip main" id="pkPick">Pick</button></div>' +
      smRow('<span class="pkleft" id="pkLeft"></span><button class="chip" id="pkRep"></button><button class="chip" id="pkReset">Start over</button><button class="chip" id="pkEdit">Edit class</button>');
    const has = c.last && c.n.includes(c.last);
    $('pkName').textContent = has ? c.last : 'Tap Pick';
    $('pkName').classList.toggle('wait', !has);
    $('pkPick').onclick = pkPick;
    pkSpeakBtn();
    $('pkRep').onclick = () => { store.set('pkrep', pkNoRep() ? 0 : 1); pkCount(); };
    $('pkReset').onclick = () => { const l = pkClasses(), k = pkCur(l); k.used = []; k.last = ''; pkSaveClasses(l); listShow(); };
    $('pkEdit').onclick = () => listEdit(c.id);
    pkCount();
  }
  function pkCount() {
    const c = pkCur(pkClasses()); if (!c || !$('pkRep')) return;
    const n = c.n.length, used = c.used.filter(i => i < n).length;
    $('pkRep').textContent = 'No repeats: ' + (pkNoRep() ? 'On' : 'Off');
    $('pkLeft').textContent = !pkNoRep() ? n + ' names' : used >= n ? 'Everyone has been called' : (n - used) + ' of ' + n + ' not called yet';
    $('pkReset').style.display = pkNoRep() ? '' : 'none';
  }
  function pkSpin(els, finals, names, after) {
    const btn = $('pkPick'); if (btn) btn.disabled = true;
    els.forEach(el => el.classList.remove('wait', 'land'));
    let steps = matchMedia('(prefers-reduced-motion: reduce)').matches || names.length < 2 ? 0 : 14;
    clearInterval(pkTimer);
    const done = () => {
      els.forEach((el, i) => { el.textContent = finals[i]; void el.offsetWidth; el.classList.add('land'); });
      pkFit(); if (btn) btn.disabled = false; after();
    };
    if (!steps) { done(); return; }
    pkTimer = setInterval(() => {
      els.forEach(el => el.textContent = names[Math.floor(Math.random() * names.length)]); pkFit();
      if (--steps <= 0) { clearInterval(pkTimer); done(); }
    }, 70);
  }
  function pkPick() {
    const list = pkClasses(), c = pkCur(list); if (!c || !c.n.length) return;
    const names = c.n;
    let used = c.used.filter(i => i < names.length);
    if (pkNoRep() && used.length >= names.length) used = [];
    const pool = names.map((_, i) => i).filter(i => !pkNoRep() || !used.includes(i));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pkNoRep()) used.push(pick);
    c.used = used; c.last = names[pick]; pkSaveClasses(list);
    pkSpin([$('pkName')], [names[pick]], names, () => { pkCount(); pkSay(names[pick]); });
  }
  function seatBody(c) {
    const n = c.n.length, sat = c.sat.filter(i => i < n);
    if (pkChecklist) {
      $('pkBody').innerHTML = '<div class="pkgrid" id="pkGrid"></div>' + smRow('<span class="pkleft">Tap a name to check or uncheck it.</span><button class="chip" id="pkBack">Done</button>');
      c.n.forEach((name, i) => {
        const b = document.createElement('button'); b.className = 'titem' + (sat.includes(i) ? ' done' : '');
        b.innerHTML = '<span class="box"></span><span class="txt"></span>'; b.querySelector('.txt').textContent = name;
        b.setAttribute('aria-pressed', sat.includes(i));
        b.onclick = () => { seatToggle(i); seatBody(pkCur(pkClasses())); };
        $('pkGrid').appendChild(b);
      });
      $('pkBack').onclick = () => { pkChecklist = false; listShow(); };
      pkSpeakBtn();
      return;
    }
    const k = pkSeats(), shown = c.seat.filter(i => i < n).slice(0, k);
    let html = '<div class="pkseats">';
    for (let s = 0; s < k; s++) html += '<div class="pkslot"><div class="lab">Seat ' + (s + 1) + '</div><div class="pkname"></div><button class="chip pkchk"></button></div>';
    $('pkBody').innerHTML = html + '</div><div class="pkrow"><button class="chip main" id="pkPick">Pick</button></div>' +
      smRow('<span class="pkleft" id="pkLeft"></span><button class="chip" id="pkNSeats"></button><button class="chip" id="pkList">Checklist</button><button class="chip" id="pkReset">Start over</button><button class="chip" id="pkEdit">Edit class</button>');
    document.querySelectorAll('#pkBody .pkslot').forEach((slot, s) => {
      const i = shown[s], nm = slot.querySelector('.pkname'), chk = slot.querySelector('.pkchk');
      nm.textContent = i === undefined ? 'Tap Pick' : c.n[i]; nm.classList.toggle('wait', i === undefined);
      chk.style.visibility = i === undefined ? 'hidden' : '';
      const on = i !== undefined && sat.includes(i);
      chk.textContent = on ? '✓ Sat' : 'Mark sat'; chk.classList.toggle('on', on); chk.setAttribute('aria-pressed', on);
      chk.onclick = () => { seatToggle(i); seatBody(pkCur(pkClasses())); requestAnimationFrame(pkFit); };
    });
    $('pkLeft').textContent = sat.length >= n ? 'Everyone has sat' : sat.length + ' of ' + n + ' have sat';
    $('pkNSeats').textContent = k === 1 ? '1 seat' : '2 seats';
    $('pkNSeats').onclick = () => { store.set('pkseats', k === 1 ? 2 : 1); listShow(); };
    $('pkList').onclick = () => { pkChecklist = true; seatBody(pkCur(pkClasses())); };
    $('pkReset').onclick = () => { if (!confirm('Uncheck everyone so the seats start a new round?')) return; const l = pkClasses(), x = pkCur(l); x.sat = []; x.seat = []; pkSaveClasses(l); listShow(); };
    $('pkEdit').onclick = () => listEdit(c.id);
    $('pkPick').onclick = seatPick;
    pkSpeakBtn();
    requestAnimationFrame(pkFit);
  }
  function notesBody(c) {
    $('pkBody').innerHTML = '<textarea class="pknotes" id="pkNotes" aria-label="Notes for this class" placeholder="Where this class left off, what to start with next time..."></textarea>' +
      '<div class="pkrow pksm"><span class="pkleft" id="pkNd"></span><button class="chip" id="pkEdit">Edit class</button></div>';
    $('pkNotes').value = c.notes;
    const paintNd = d => $('pkNd').textContent = d ? 'Last changed ' + shortDay(d) + '. Students can see this.' : 'Students can see this, so keep it to lesson notes.';
    paintNd(c.nd);
    $('pkNotes').oninput = () => { const l = pkClasses(), k = pkCur(l); k.notes = $('pkNotes').value; k.nd = dayKey(new Date()); pkSaveClasses(l); paintNd(k.nd); };
    $('pkEdit').onclick = () => listEdit(c.id);
  }
  const FACES = [['👍', 'Got it'], ['👌', 'Almost'], ['👎', 'Not yet']];
  let checkUndo = [];
  function checkBody(c) {
    const today = dayKey(new Date()), t = (c.checks[today] || [0, 0, 0]).slice(0, 3);
    let html = '<div class="pkfaces">';
    FACES.forEach(([f, w], i) => html += '<button class="pkface" data-i="' + i + '" aria-label="' + w + '"><span class="em">' + f + '</span><span class="w">' + w + '</span><b>' + (t[i] || 0) + '</b></button>');
    $('pkBody').innerHTML = html + '</div><div class="pkpast" id="pkPast"></div>' +
      '<div class="pkrow pksm"><span class="pkleft" id="pkTot"></span><button class="chip" id="pkUndo">Undo</button><button class="chip" id="pkClr">Clear today</button></div>';
    const total = t.reduce((a, b) => a + (b || 0), 0);
    $('pkTot').textContent = 'Today, ' + shortDay(today) + ': ' + total + (total === 1 ? ' answer' : ' answers');
    document.querySelectorAll('#pkBody .pkface').forEach(b => b.onclick = () => {
      const l = pkClasses(), k = pkCur(l), arr = (k.checks[today] || [0, 0, 0]).slice(0, 3);
      arr[b.dataset.i] = (arr[b.dataset.i] || 0) + 1; k.checks[today] = arr; pkSaveClasses(l);
      checkUndo.push([k.id, today, Number(b.dataset.i)]); checkBody(k);
    });
    $('pkUndo').style.display = checkUndo.some(u => u[0] === c.id && u[1] === today) ? '' : 'none';
    $('pkUndo').onclick = () => {
      const l = pkClasses(), k = pkCur(l), i = checkUndo.map(u => u[0] === k.id && u[1] === today).lastIndexOf(true); if (i < 0) return;
      const [, , f] = checkUndo.splice(i, 1)[0], arr = (k.checks[today] || [0, 0, 0]).slice(0, 3); arr[f] = Math.max(0, (arr[f] || 0) - 1); k.checks[today] = arr; pkSaveClasses(l); checkBody(k);
    };
    $('pkClr').style.display = total ? '' : 'none';
    $('pkClr').onclick = () => { if (!confirm('Clear today\'s answers for this class?')) return; const l = pkClasses(), k = pkCur(l); delete k.checks[today]; pkSaveClasses(l); checkUndo = []; checkBody(k); };
    const past = Object.keys(c.checks).filter(d => d !== today).sort().reverse().slice(0, 4);
    $('pkPast').innerHTML = '';
    past.forEach(d => {
      const v = c.checks[d] || [], line = document.createElement('div');
      line.textContent = shortDay(d) + ':  ' + FACES.map(([f], i) => f + ' ' + (v[i] || 0)).join('   '); $('pkPast').appendChild(line);
    });
  }
  let grpSel = null;
  function groupsMake(c) {
    const idx = c.n.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const count = c.gby === 'count' ? Math.min(c.gnum, idx.length) : Math.max(1, Math.round(idx.length / c.gnum));
    const out = Array.from({ length: count }, () => []);
    idx.forEach((v, i) => out[i % count].push(v));
    return out;
  }
  function groupsBody(c) {
    const ok = c.groups.length && c.groups.flat().every(i => i < c.n.length) && c.groups.flat().length === c.n.length;
    const ctl = '<div class="pkgset"><button class="chip" id="gBy"></button><button class="chip" id="gLess">-</button><b id="gNum"></b><button class="chip" id="gMore">+</button>' +
      '<button class="chip main" id="gMake"></button></div>';
    if (!ok) {
      $('pkBody').innerHTML = '<div class="pkname wait" style="font-size:22px">Make groups for this class</div>' + ctl;
    } else {
      $('pkBody').innerHTML = '<div class="pkgroups" id="gList"></div>' + ctl +
        '<div class="pkrow pksm"><span class="pkleft">Tap a name, then another name to swap them. Or tap a group to move them there.</span><button class="chip" id="gSave">Download</button></div>';
      c.groups.forEach((g, gi) => {
        const box = document.createElement('div'); box.className = 'pkgrp' + (grpSel && grpSel[0] !== gi ? ' target' : '');
        const h = document.createElement('h4'); h.textContent = 'Group ' + (gi + 1); box.appendChild(h);
        g.forEach((ni, pi) => {
          const b = document.createElement('button'); b.textContent = c.n[ni];
          if (grpSel && grpSel[0] === gi && grpSel[1] === pi) b.className = 'sel';
          b.onclick = e => {
            e.stopPropagation();
            if (!grpSel) { grpSel = [gi, pi]; groupsBody(c); return; }
            if (grpSel[0] === gi && grpSel[1] === pi) { grpSel = null; groupsBody(c); return; }
            const l = pkClasses(), k = pkCur(l), [a, b2] = grpSel;
            [k.groups[a][b2], k.groups[gi][pi]] = [k.groups[gi][pi], k.groups[a][b2]];
            pkSaveClasses(l); grpSel = null; groupsBody(k);
          };
          box.appendChild(b);
        });
        box.onclick = () => {
          if (!grpSel || grpSel[0] === gi) return;
          const l = pkClasses(), k = pkCur(l), [a, b2] = grpSel, moved = k.groups[a].splice(b2, 1)[0];
          k.groups[gi].push(moved); k.groups = k.groups.filter(x => x.length); pkSaveClasses(l); grpSel = null; groupsBody(k);
        };
        $('gList').appendChild(box);
      });
    }
    if ($('gSave')) $('gSave').onclick = () => groupsDownload(c);
    $('gBy').textContent = c.gby === 'count' ? 'Number of groups' : 'People per group';
    $('gNum').textContent = c.gnum;
    $('gMake').textContent = ok ? 'New groups' : 'Make groups';
    const save = f => { const l = pkClasses(), k = pkCur(l); f(k); pkSaveClasses(l); grpSel = null; groupsBody(k); };
    $('gBy').onclick = () => save(k => k.gby = k.gby === 'count' ? 'size' : 'count');
    $('gLess').onclick = () => save(k => k.gnum = Math.max(2, k.gnum - 1));
    $('gMore').onclick = () => save(k => k.gnum = Math.min(10, k.gnum + 1));
    $('gMake').onclick = () => { if (ok && !confirm('Make new groups? The groups you have now will be replaced.')) return; save(k => k.groups = groupsMake(k)); };
  }
  function groupsDownload(c) {
    const cell = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const rows = [c.groups.map((_, i) => 'Group ' + (i + 1))], tall = Math.max(...c.groups.map(g => g.length));
    for (let r = 0; r < tall; r++) rows.push(c.groups.map(g => g[r] === undefined ? '' : c.n[g[r]]));
    const csv = '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = ('groups ' + TB.gradeWord() + ' ' + c.t + ' ' + dayKey(new Date())).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Groups saved to Downloads');
  }
  function seatToggle(i) {
    const l = pkClasses(), c = pkCur(l); if (!c) return;
    c.sat = c.sat.includes(i) ? c.sat.filter(x => x !== i) : c.sat.concat(i); pkSaveClasses(l);
  }
  function seatPick() {
    const list = pkClasses(), c = pkCur(list); if (!c || !c.n.length) return;
    const names = c.n, k = Math.min(pkSeats(), names.length), sat = c.sat.filter(i => i < names.length);
    const fresh = names.map((_, i) => i).filter(i => !sat.includes(i)), rest = names.map((_, i) => i).filter(i => sat.includes(i));
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const picks = shuffle(fresh).concat(shuffle(rest)).slice(0, k);
    c.seat = picks; pkSaveClasses(list);
    const els = Array.from(document.querySelectorAll('#pkBody .pkslot .pkname'));
    document.querySelectorAll('#pkBody .pkchk').forEach(b => b.style.visibility = 'hidden');
    pkSpin(els.slice(0, k), picks.map(i => names[i]), names, () => {
      seatBody(pkCur(pkClasses()));
      pkSay(picks.length > 1 ? picks.map((i, s) => 'Seat ' + (s + 1) + ', ' + names[i] + '.').join(' ') : names[picks[0]]);
    });
  }
  function listEdit(id) {
    clearInterval(pkTimer);
    const list = pkClasses(), c = id ? list.find(k => k.id === id) : null;
    const w = $('pkWrap'); w.innerHTML = '';
    const box = document.createElement('div'); box.className = 'pkedit';
    box.innerHTML = '<p id="pkHead"></p>' +
      '<input type="text" id="pkTeacher" maxlength="30" placeholder="Teacher, for example Ms. Lee" aria-label="Teacher">' +
      '<textarea id="pkText" aria-label="Students, one name per line" placeholder="Students, one name per line"></textarea>' +
      '<div class="pkrow"><button class="chip main" id="pkSaveNames">Save</button><button class="chip" id="pkCancel">Cancel</button><button class="chip" id="pkDel">Remove class</button><button class="chip" id="pkImp">From a spreadsheet</button></div>' +
      '<p id="pkWhere"></p>';
    w.appendChild(box);
    $('pkHead').textContent = c ? 'Edit this class.' : 'Add a ' + TB.gradeWord() + ' class: type the teacher, then the students (one per line, or paste a column from your Google Sheet).';
    $('pkWhere').textContent = 'Saved on this board only. Names are never put on your public site.';
    $('pkTeacher').value = c ? c.t : ''; $('pkText').value = c ? c.n.join('\n') : '';
    $('pkCancel').style.display = list.length ? '' : 'none';
    $('pkDel').style.display = c ? '' : 'none';
    $('pkSaveNames').onclick = () => {
      const t = $('pkTeacher').value.trim(), names = $('pkText').value.split(/\r?\n|\t/).map(x => x.trim()).filter(Boolean).slice(0, 200);
      if (!t) { $('pkTeacher').focus(); return; }
      if (!names.length) { $('pkText').focus(); return; }
      const l = pkClasses();
      let k = id ? l.find(x => x.id === id) : null;
      if (k) {
        const added = names.length > k.n.length && k.n.every((x, i) => names[i] === x);   // only new names at the end
        if (!added && k.n.join('\n') !== names.join('\n')) { k.used = []; k.last = ''; k.sat = []; k.seat = []; k.groups = []; }
        k.t = t; k.n = names;
      }
      else { k = { id: 'c' + Date.now(), t, n: names, used: [], last: '', sat: [], seat: [], notes: '', nd: '', pts: 0, checks: {} }; l.push(k); }
      pkSaveClasses(l); store.set('pkcls_' + TB.grade, k.id); listShow();
    };
    $('pkCancel').onclick = listShow;
    $('pkImp').onclick = pkImportDlg;
    $('pkDel').onclick = () => {
      if (!confirm('Remove the class "' + c.t + '" and its names from this board?')) return;
      pkSaveClasses(pkClasses().filter(x => x.id !== id)); store.del('pkcls_' + TB.grade); listShow();
    };
    setTimeout(() => { const t = $(c ? 'pkText' : 'pkTeacher'); if (t) t.focus(); }, 50);
  }
  // ---- add students from a spreadsheet ----
  // Paste rows copied from Google Sheets (or pick a .csv file). Columns: Grade, Teacher, Student (a header row is fine).
  // Only 2 columns: Teacher, Student for the grade that is picked. Only 1 column: students for the class that is picked.
  // Adds missing classes and students at the end of each class; nothing is removed or reordered. Saved on this board only.
  function pkGradeKey(v) {
    const w = String(v || '').trim().toLowerCase().replace(/\s+grade$/, '');
    if (/^(sp|specials?|md)$/.test(w)) return 'sp';
    const m = w.match(/^([1-4])(st|nd|rd|th)?$/) || [null, { first: '1', second: '2', third: '3', fourth: '4' }[w]];
    return m && m[1] ? m[1] : null;
  }
  function pkRows(text) {
    const rows = [];
    String(text).replace(/\r/g, '').split('\n').forEach(line => {
      if (!line.trim()) return;
      let cells;
      if (line.includes('\t')) cells = line.split('\t');
      else { cells = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch; } cells.push(cur); }
      rows.push(cells.map(c => c.trim()));
    });
    return rows;
  }
  function pkImport(text) {
    let rows = pkRows(text); if (!rows.length) return { err: 'Nothing to add. Paste rows or pick a file.' };
    let gi = -1, ti = -1, ni = -1;
    const head = rows[0].map(h => h.toLowerCase());
    const H = { g: /^grade( level)?$/, t: /^(teacher|homeroom|homeroom teacher|class)$/, n: /^(students?|names?|student names?|first names?)$/ };
    if (head.some(h => H.g.test(h) || H.t.test(h) || H.n.test(h))) {
      gi = head.findIndex(h => H.g.test(h)); ti = head.findIndex(h => H.t.test(h)); ni = head.findIndex(h => H.n.test(h));
      rows = rows.slice(1);
      if (ni < 0) return { err: 'Could not find the Student column. Name it Student.' };
    } else {
      const w = Math.max(...rows.map(r => r.length));
      if (w >= 3) { gi = 0; ti = 1; ni = 2; } else if (w === 2) { ti = 0; ni = 1; } else ni = 0;
    }
    const cur = pkCur(pkClasses()), lists = {}, get = g => lists[g] || (lists[g] = pkClasses(g));
    let added = 0, skipped = 0, newCls = 0;
    rows.forEach(r => {
      const name = (r[ni] || '').trim(); if (!name) return;
      const g = gi >= 0 ? pkGradeKey(r[gi]) : TB.grade; if (!g) { skipped++; return; }
      const t = ti >= 0 ? (r[ti] || '').trim() : (g === TB.grade && cur ? cur.t : ''); if (!t) { skipped++; return; }
      const l = get(g); let k = l.find(x => x.t.toLowerCase() === t.toLowerCase());
      if (!k) { k = { id: 'c' + Date.now() + Math.floor(Math.random() * 1000), t, n: [], used: [], last: '', sat: [], seat: [], notes: '', nd: '', pts: 0, checks: {} }; l.push(k); newCls++; }
      if (k.n.some(x => x.toLowerCase() === name.toLowerCase())) return;
      if (k.n.length >= 200) { skipped++; return; }
      k.n.push(name); added++;
    });
    Object.keys(lists).forEach(g => store.set('pkclasses_' + g, JSON.stringify(lists[g])));
    return { added, skipped, newCls };
  }
  TB.pkImport = pkImport;
  function pkImportDlg() {
    TB.openDlg('Add students from a spreadsheet', body => {
      body.innerHTML = '<p>In Google Sheets, make columns <b>Grade</b>, <b>Teacher</b>, <b>Student</b>. Select the rows, copy (Ctrl + C), and paste them below (Ctrl + V). Or download the sheet as a .csv file (File, Download) and pick it.</p>' +
        '<p>Grade can be 1, 2, 3, 4 or Specials. Teacher must match the name on the teacher button. Students already in a class are skipped; nothing is removed.</p>' +
        '<textarea id="pkImpText" rows="8" style="width:100%;font-size:17px;font-family:inherit" aria-label="Rows from the spreadsheet" placeholder="Grade&#9;Teacher&#9;Student"></textarea>' +
        '<div class="r"><button class="tool" id="pkImpGo">Add students</button><button class="tool" id="pkImpFile">Pick a .csv file</button><input type="file" id="pkImpIn" accept=".csv,.tsv,.txt,text/csv" hidden></div><p id="pkImpMsg"></p>' +
        '<p>Saved on this board only. After adding students, download a new kiosk file for the hall pass (Hall pass, Kiosk setup).</p>';
      const go = text => {
        const r = pkImport(text);
        if (r.err) { $('pkImpMsg').textContent = r.err; return; }
        $('pkImpMsg').textContent = 'Added ' + r.added + (r.added === 1 ? ' student' : ' students') + (r.newCls ? ' and ' + r.newCls + (r.newCls === 1 ? ' new class' : ' new classes') : '') + '.' + (r.skipped ? ' Skipped ' + r.skipped + ' (no grade or teacher, or class full).' : '');
        if (r.added || r.newCls) { listShow(); toast('Students added'); }
      };
      $('pkImpGo').onclick = () => go($('pkImpText').value);
      $('pkImpFile').onclick = () => $('pkImpIn').click();
      $('pkImpIn').onchange = e => { const f = e.target.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => go(String(fr.result).replace(/^\ufeff/, '')); fr.readAsText(f); };
    });
  }
  let pkPlace = () => {};
  function setPick(on) {
    document.body.classList.toggle('pickon', on); $('pickBtn').classList.toggle('on', on); store.set('pickon', on ? 1 : 0);
    pkPlace(); pkShow();
  }
  TB.setPick = setPick;
  addEventListener('resize', () => requestAnimationFrame(pkFit));
  $('pickBtn').onclick = () => setPick(!document.body.classList.contains('pickon'));
  $('pkChange').onclick = () => pkSetup();
  TB.gradeHooks.push(() => { if (document.body.classList.contains('pickon')) pkShow(); });
  pkPlace = TB.floatCard($('pickCard'), 'pickrect', { x: .56, y: .42, w: .42, h: .5 }, .26, .3, () => pkFit());
  setPick(store.get('pickon', '0') === '1');
})();
