(function () {
  const TB = window.TB;
  const { $, store, jget, openDlg, closeDlg, toast, dayKey, clockTime, hhmm } = TB;

  /* ---------- clock ---------- */
  function tickClock() {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    $('time').textContent = h + ':' + String(d.getMinutes()).padStart(2, '0');
    $('date').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------- voice level ---------- */
  const VOICE = [['0', 'Silent'], ['1', 'Whisper'], ['2', 'Normal talking']];
  let voice = store.get('voice', '');
  function paintVoice() {
    const v = VOICE.find(x => x[0] === voice);
    $('voice').classList.toggle('set', !!v);
    $('vCap').style.display = v ? 'none' : '';
    if (v) { $('vBig').dataset.v = v[0]; $('vNum').textContent = v[0]; $('vName').textContent = v[1]; }
    document.querySelectorAll('#vPick button').forEach(b => {
      const on = b.dataset.v === voice;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
  }
  VOICE.forEach(([n, name]) => {
    const b = document.createElement('button');
    b.dataset.v = n; b.textContent = n;
    b.title = 'Level ' + n + ': ' + name;
    b.setAttribute('aria-label', 'Level ' + n + ', ' + name);
    b.onclick = () => { voice = voice === n ? '' : n; store.set('voice', voice); paintVoice(); };
    $('vPick').appendChild(b);
  });
  paintVoice();

  /* ---------- persistent countdown timer ---------- */
  const timerEl = $('timer');
  let total = 300, left = 300, endAt = 0, running = false, iv = null;
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  TB.fmt = fmt;
  TB.getLeft = () => left;

  function saveTimerState() {
    store.set('timerstate', JSON.stringify({
      total, left: Math.max(0, left), endAt, running,
      label: $('tlabel').textContent || '',
      savedAt: Date.now()
    }));
  }

  function paintTimer() {
    $('tdisplay').textContent = fmt(left);
    $('tbar').style.width = (total ? Math.max(0, left / total) * 100 : 0) + '%';
    timerEl.classList.toggle('low', running && left <= 30 && left > 0);
    $('startBtn').textContent = running ? 'Pause' : (left < total && left > 0 ? 'Go' : 'Start');
    const show = running || (left < total) || timerEl.classList.contains('done');
    const lab = $('tlabel').textContent;
    document.querySelectorAll('.tmini').forEach(m => {
      m.classList.toggle('on', show);
      m.classList.toggle('low', timerEl.classList.contains('low'));
      m.classList.toggle('done', timerEl.classList.contains('done'));
      m.querySelector('.tl').textContent = timerEl.classList.contains('done') ? 'Time is up' : lab;
      m.querySelector('b').textContent = fmt(left);
      m.querySelector('u').style.width = (total ? Math.max(0, left / total) * 100 : 0) + '%';
    });
  }
  TB.paintTimer = paintTimer;

  function stop() {
    running = false;
    clearInterval(iv);
    saveTimerState();
  }
  function setTime(sec, label) {
    stop();
    timerEl.classList.remove('done');
    total = left = Math.max(0, sec);
    $('tlabel').textContent = label || '';
    timerEl.classList.toggle('labeled', !!label);
    saveTimerState();
    paintTimer();
  }
  function start(useExistingEndAt) {
    if (left <= 0) return;
    timerEl.classList.remove('done');
    running = true;
    if (!useExistingEndAt) endAt = Date.now() + left * 1000;
    clearInterval(iv);
    saveTimerState();
    iv = setInterval(() => {
      left = (endAt - Date.now()) / 1000;
      if (left <= 0) {
        left = 0; stop();
        timerEl.classList.add('done');
        $('tdisplay').textContent = '0:00';
        TB.audio.chime();
      }
      paintTimer();
    }, 200);
    paintTimer();
  }
  TB.setTime = setTime;
  TB.start = start;
  TB.stop = stop;

  // Restore timer if the page was refreshed mid-countdown
  (function restoreTimer() {
    const s = jget('timerstate', null);
    if (!s || typeof s.total !== 'number' || s.total <= 0) return;
    // Ignore stale timer state from more than 4 hours ago
    if (s.savedAt && Date.now() - s.savedAt > 4 * 3600000) return;
    total = s.total;
    $('tlabel').textContent = s.label || '';
    timerEl.classList.toggle('labeled', !!s.label);
    if (s.running && s.endAt) {
      const rem = (s.endAt - Date.now()) / 1000;
      if (rem > 0) {
        left = rem; endAt = s.endAt;
        start(true);
        return;
      } else if (rem > -120) {
        left = 0; timerEl.classList.add('done'); paintTimer(); return;
      }
    } else if (typeof s.left === 'number' && s.left > 0 && s.left <= total) {
      left = s.left; paintTimer(); return;
    }
  })();

  [1, 2, 3, 5, 10].forEach(m => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = m + ' min';
    b.onclick = () => setTime(m * 60);
    $('presets').appendChild(b);
  });
  $('startBtn').onclick = () => running ? (stop(), paintTimer()) : start();
  $('resetBtn').onclick = () => setTime(total, $('tlabel').textContent);

  const TP_DEFAULT = [{ l: 'Clean up', m: 2 }, { l: 'Brain break', m: 3 }, { l: 'Partner work', m: 5 }];
  function tpGet() {
    try { const v = JSON.parse(store.get('tpresets', 'null')); if (Array.isArray(v)) return v.filter(x => x && x.l && x.m > 0); } catch (e) {}
    return TP_DEFAULT;
  }
  function tpPaint() {
    const row = $('lpresets'); row.innerHTML = '';
    tpGet().forEach(p => {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = p.l + ' ' + p.m;
      b.title = p.l + ', ' + p.m + ' min'; b.onclick = () => setTime(p.m * 60, p.l); row.appendChild(b);
    });
    const e = document.createElement('button'); e.className = 'chip edit'; e.textContent = 'Edit'; e.onclick = tpEdit; row.appendChild(e);
  }
  function tpEdit() {
    let list = tpGet().map(p => ({ l: p.l, m: p.m }));
    openDlg('Timer buttons', body => {
      const draw = () => {
        body.innerHTML = '<p>Labeled timer buttons shown under the timer. Each one shows its words above the countdown.</p>';
        list.forEach((p, i) => {
          const r = document.createElement('div'); r.className = 'r';
          r.innerHTML = '<input type="text" maxlength="24" aria-label="Words"><input type="number" min="1" max="99" aria-label="Minutes"><span>min</span><button class="tool">Remove</button>';
          const [t, n] = r.querySelectorAll('input'); t.value = p.l; n.value = p.m;
          t.oninput = () => p.l = t.value; n.oninput = () => p.m = Number(n.value);
          r.querySelector('button').onclick = () => { list.splice(i, 1); draw(); };
          body.appendChild(r);
        });
        const r = document.createElement('div'); r.className = 'r';
        r.innerHTML = '<button class="tool" id="tpAdd">Add one</button><button class="tool on" id="tpSave">Save</button><button class="tool" id="tpDef">Back to starting three</button>';
        body.appendChild(r);
        const sep = document.createElement('div'); sep.className = 'sepbar'; body.appendChild(sep);
        const cf = document.createElement('div'); cf.className = 'r';
        cf.innerHTML = '<p style="flex:1">Start class timer, class length, and clean-up warnings live in Class flow & clean-up.</p><button class="tool" id="tpToCf">Open Class flow</button>';
        body.appendChild(cf);
        $('tpAdd').onclick = () => { list.push({ l: '', m: 2 }); draw(); const a = body.querySelectorAll('input[type=text]'); a[a.length - 1].focus(); };
        $('tpSave').onclick = () => {
          store.set('tpresets', JSON.stringify(list.map(p => ({ l: String(p.l).trim(), m: Math.min(99, Math.round(p.m)) })).filter(p => p.l && p.m > 0)));
          tpPaint(); closeDlg();
        };
        $('tpDef').onclick = () => { list = TP_DEFAULT.map(p => Object.assign({}, p)); draw(); };
        $('tpToCf').onclick = () => { closeDlg(); cwEdit(); };
      };
      draw();
    });
  }
  tpPaint();

  function bump(sec) {
    const nl = Math.max(0, left + sec);
    if (nl === 0) { setTime(0); return; }
    timerEl.classList.remove('done');
    if (running) endAt += sec * 1000;
    total = Math.max(total + sec, nl); left = nl;
    saveTimerState();
    paintTimer();
  }
  $('plus').onclick = () => bump(60);
  $('minus').onclick = () => bump(-60);
  paintTimer();

  /* ---------- noise meter ---------- */
  let nz = null;
  function noiseStop() {
    if (!nz) return;
    clearInterval(nz.iv);
    if (nz.wake) document.removeEventListener('pointerdown', nz.wake, true);
    try { nz.stream.getTracks().forEach(t => t.stop()); nz.ctx.close(); } catch (e) {}
    nz = null;
  }
  async function noiseStart() {
    $('nzStat').textContent = 'Starting...';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (!document.body.classList.contains('noiseon')) { stream.getTracks().forEach(t => t.stop()); return; }
      const ctx = new (window.AudioContext || window.webkitAudioContext)(), an = ctx.createAnalyser(); an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      nz = { stream, ctx, iv: 0, level: 0, hist: [], quietSince: 0, alarm: false, lastSound: 0 };
      const wake = () => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
      wake(); document.addEventListener('pointerdown', wake, true); nz.wake = wake;
      $('nzStat').textContent = '';
      const tick = () => {
        if (ctx.state === 'suspended') { $('nzStat').textContent = 'Tap the board to start the meter'; return; }
        if ($('nzStat').textContent) $('nzStat').textContent = '';
        an.getFloatTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-8);
        const lvl = Math.max(0, Math.min(100, (db + 60) * 100 / 55));
        nz.level = nz.level * .6 + lvl * .4;
        const lim = Number($('nzLim').value), card = $('noiseCard'), now = performance.now();
        $('nzFill').style.width = nz.level + '%';
        nz.hist.push([now, nz.level > lim]); while (nz.hist.length && now - nz.hist[0][0] > 1500) nz.hist.shift();
        const over = nz.hist.filter(h => h[1]).length / nz.hist.length, span = now - nz.hist[0][0];
        const loud = span >= 900 && over >= .5;
        if (over < .2) { if (!nz.quietSince) nz.quietSince = now; } else nz.quietSince = 0;
        if (loud && !nz.alarm) {
          nz.alarm = true; nzBump();
          if (!nz.lastSound || now - nz.lastSound > 5000) { nz.lastSound = now; TB.audio.nzPlay(); }
        }
        if (nz.alarm && nz.quietSince && now - nz.quietSince > 1500) nz.alarm = false;
        card.classList.toggle('loud', nz.alarm);
        card.classList.toggle('warn', !nz.alarm && nz.level > lim * .8);
      };
      nz.iv = setInterval(tick, 100); tick();
    } catch (e) { $('nzStat').textContent = 'Microphone blocked or missing'; }
  }
  const nzCountPaint = () => {
    const n = Number(store.get('noisecount', '0')) || 0;
    $('nzCount').textContent = 'Too loud: ' + n;
    $('nzCount').title = 'Went off ' + n + (n === 1 ? ' time' : ' times');
  };
  function nzBump() { store.set('noisecount', (Number(store.get('noisecount', '0')) || 0) + 1); nzCountPaint(); }
  TB.resetNoiseCount = () => { store.set('noisecount', 0); nzCountPaint(); };
  $('nzSound').value = store.get('noisesound', 'chime');
  $('nzSound').onchange = () => { store.set('noisesound', $('nzSound').value); TB.audio.nzPlay(null, true); };
  $('nzTest').onclick = () => {
    if (TB.audio.isMuted()) toast('Sound is muted on the top bar');
    TB.audio.nzPlay(null, true);
  };
  $('nzReset').onclick = TB.resetNoiseCount;
  nzCountPaint();

  function setNoise(on) {
    document.body.classList.toggle('noiseon', on); store.set('noiseon', on ? 1 : 0);
    if (TB.updateNoiseBtns) TB.updateNoiseBtns();
    if (!on) $('nzSet').classList.remove('show');
    requestAnimationFrame(() => { TB.fitPlan(); TB.applyLayout(); });
    if (on) noiseStart(); else { noiseStop(); $('noiseCard').classList.remove('loud', 'warn'); }
  }
  TB.setSimpleNoise = setNoise;
  const nzMark = () => { $('nzMark').style.left = $('nzLim').value + '%'; };
  $('nzLim').value = store.get('noiselim', '60'); nzMark();
  $('nzLim').oninput = () => { store.set('noiselim', $('nzLim').value); nzMark(); };
  $('nzGear').onclick = e => {
    e.stopPropagation();
    const box = $('nzSet'), r = $('nzGear').getBoundingClientRect(), open = !box.classList.contains('show');
    box.classList.toggle('show', open);
    if (open) {
      const w = box.offsetWidth, h = box.offsetHeight;
      box.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
      box.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.bottom + 8)) + 'px';
    }
  };
  $('nzDone').onclick = () => $('nzSet').classList.remove('show');
  $('nzOff').onclick = () => setNoise(false);
  document.addEventListener('click', e => { if (!$('nzSet').contains(e.target) && !$('nzGear').contains(e.target)) $('nzSet').classList.remove('show'); });
  if (store.get('noiseon', '0') === '1' && store.get('noisemode', 'seasonal') === 'bar') setNoise(true);

  /* ---------- start class ---------- */
  const scGet = () => ({ l: store.get('startlabel', 'Typing Club'), m: Math.max(0, Math.min(99, Number(store.get('startmin', '10')) || 0)) });
  function startClass() {
    if (document.body.classList.contains('arranging')) TB.setArrange(false);
    TB.closeSteps(); TB.attnShow(false); closeDlg(); TB.setDraw(false); TB.clearInk();
    const sc = scGet();
    if (sc.m > 0) { setTime(sc.m * 60, sc.l); start(); } else setTime(300);
    store.set('classstart', Date.now()); store.del('classwarned'); store.del('warnat');
    warnShow(false); warnCheck();
    voice = '0'; store.set('voice', '0'); paintVoice();
    TB.resetNoiseCount();
    store.del('todock_' + TB.grade);
    if (TB.hpNewClass) TB.hpNewClass();
    TB.openClarity();
    toast('Ready for ' + TB.gradeWord() + (sc.m > 0 ? '. ' + (sc.l ? sc.l + ' ' : 'Timer ') + sc.m + ' min started' : ''));
  }
  TB.startClass = startClass;
  $('startClass').onclick = startClass;

  /* ---------- clean-up warning & unified Class flow dialog ---------- */
  let warnT = null, warnIv = null;
  function warnShow(on) {
    clearTimeout(warnT); clearInterval(warnIv);
    $('warn').classList.toggle('show', on);
    if (!on) return;
    const paintW = () => { $('warnTime').textContent = fmt(left); };
    paintW(); warnIv = setInterval(paintW, 250);
    warnT = setTimeout(() => warnShow(false), 12000);
  }
  TB.warnShow = warnShow;
  $('warn').onclick = () => warnShow(false);

  function cwInfo() {
    const startAt = Number(store.get('classstart', '0')) || 0;
    const len = Number(store.get('classlen', '45')) || 45;
    const wm = Number(store.get('warnmin', '5'));
    const cleanMin = wm > 0 ? wm : 5, o = String(store.get('warnat', '')).split('|');
    let at = wm > 0 && wm < len ? startAt + (len - wm) * 60000 : 0, custom = false;
    if (startAt && o[0] === String(startAt)) { at = Number(o[1]) || 0; custom = true; }
    const end = startAt + len * 60000, span = at && at < end ? end - at : cleanMin * 60000;
    return { startAt, len, wm, cleanMin, at, custom, span, warned: store.get('classwarned', '') === String(startAt), end };
  }
  function warnCheck() {
    const c = cwInfo(), now = Date.now();
    cwPaint(c, now);
    if (!c.startAt || !c.at || c.warned) return;
    if (now < c.at || now >= c.at + c.span) return;
    store.set('classwarned', String(c.startAt));
    const leftMs = c.at + c.span - now;
    setTime(Math.round(leftMs / 1000), 'Clean up'); start();
    const m = Math.max(1, Math.round(leftMs / 60000));
    $('warnBig').textContent = m + (m === 1 ? ' minute left' : ' minutes left');
    TB.audio.warnSound();
    warnShow(true);
    cwPaint(cwInfo(), now);
    TB.exitSlipLaunch();
  }
  function cwPaint(c, now) {
    const p = $('cwPill'), live = c.startAt && !c.warned && now < Math.max(c.end, c.at + c.span) && now >= c.startAt;
    p.classList.toggle('on', !!live); p.classList.toggle('off', !!live && !c.at);
    if (live) p.textContent = c.at ? 'Clean up at ' + clockTime(c.at) : 'No clean-up warning';
  }

  function cwEdit() {
    openDlg('Class flow & clean-up', body => {
      const draw = () => {
        const c = cwInfo(), now = Date.now(), live = c.startAt && !c.warned && now < c.end + 3600000 && now >= c.startAt;
        body.innerHTML = '';
        if (live) {
          body.innerHTML = '<p><b>This class</b></p><div class="cwbig" id="cwNow"></div>' +
            '<div class="r cwrow" id="cwMins"><span>Warn</span>' + [2, 3, 5, 7, 10, 15].map(m => '<button class="tool" data-m="' + m + '">' + m + '</button>').join('') + '<span>min before the end</span></div>' +
            '<div class="r cwrow"><button class="tool" data-d="-5">-5 min</button><button class="tool" data-d="-1">-1 min</button><button class="tool" data-d="1">+1 min</button><button class="tool" data-d="5">+5 min</button></div>' +
            '<div class="r cwrow"><span>Or pick a time:</span><input type="time" id="cwAt" aria-label="Warning time"><button class="tool" id="cwSet">Set</button></div>' +
            '<div class="r cwrow"><button class="tool" id="cwGo">Warn now</button><button class="tool" id="cwOff">No warning this class</button><button class="tool" id="cwBack">Back to normal</button></div>' +
            '<p id="cwMsg"></p>';
          const before = c.at && c.at < c.end ? Math.round((c.end - c.at) / 60000) : 0;
          $('cwNow').textContent = c.at ? 'Warning at ' + clockTime(c.at) + (before ? ' (' + before + ' min before the end)' : '') : 'No warning this class';
          body.querySelectorAll('[data-m]').forEach(b => {
            b.classList.toggle('on', before === Number(b.dataset.m));
            b.onclick = () => {
              const at = c.end - Number(b.dataset.m) * 60000;
              if (at <= now) { $('cwMsg').textContent = 'That time has already passed. Tap Warn now instead.'; return; }
              setAt(at);
            };
          });
          const setAt = ms => { store.set('warnat', c.startAt + '|' + ms); draw(); warnCheck(); };
          body.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
            const base = cwInfo().at || Math.max(now, c.end - c.cleanMin * 60000);
            setAt(Math.max(now + 60000, base + Number(b.dataset.d) * 60000));
          });
          const at0 = c.at || c.end - c.cleanMin * 60000, d0 = new Date(at0);
          $('cwAt').value = String(d0.getHours()).padStart(2, '0') + ':' + String(d0.getMinutes()).padStart(2, '0');
          $('cwSet').onclick = () => {
            const [h, m] = $('cwAt').value.split(':').map(Number); if (isNaN(h)) return;
            const d = new Date(); d.setHours(h, m, 0, 0);
            if (d.getTime() <= now) { $('cwMsg').textContent = 'That time has already passed. Pick a later time, or tap Warn now.'; return; }
            setAt(d.getTime());
          };
          $('cwGo').onclick = () => { store.set('warnat', c.startAt + '|' + now); closeDlg(); warnCheck(); };
          $('cwOff').onclick = () => setAt(0);
          $('cwBack').onclick = () => { store.del('warnat'); draw(); };
          $('cwBack').style.display = c.custom ? '' : 'none';
        } else {
          body.innerHTML = '<p>' + (c.startAt && c.warned ? 'This class already had its warning.' : 'No class is running.') + ' Tap Start class when a class begins; then you can adjust this class\'s warning here or from the pill under the date.</p>';
        }

        // Exit slip for this grade
        const sep1 = document.createElement('div'); sep1.className = 'sepbar'; body.appendChild(sep1);
        const es = TB.exitSlipGet(), ex = document.createElement('div');
        ex.innerHTML = '<p><b>Exit slip for ' + TB.gradeWord() + '</b></p><p id="esWhat"></p><div class="r" id="esBtns"></div>';
        body.appendChild(ex);
        if (!es) {
          $('esWhat').textContent = 'None yet. To make one: More, Poll, New poll, pick the kind, type the question, then tap Save as exit slip.';
        } else {
          $('esWhat').textContent = '"' + (es.q || 'Exit slip') + '" (' + TB.PL_TYPES[es.type].name + '). ' + (es.on === false ? 'Off: it will not show.' : 'It shows by itself at the clean-up warning.');
          [['esOn', es.on === false ? 'Turn on' : 'Turn off', () => { es.on = es.on === false; store.set('exitslip_' + TB.grade, JSON.stringify(es)); draw(); }],
           ['esNow', 'Show it now', () => { closeDlg(); TB.exitSlipLaunch(true); }],
           ['esDel', 'Remove', () => { if (confirm('Remove the ' + TB.gradeWord() + ' exit slip?')) { store.del('exitslip_' + TB.grade); draw(); } }]].forEach(([id, t, f]) => {
            const b = document.createElement('button'); b.className = 'tool'; b.id = id; b.textContent = t; b.onclick = f; $('esBtns').appendChild(b);
          });
        }

        // Unified Start class timer + Every class length/warning settings
        const sep2 = document.createElement('div'); sep2.className = 'sepbar'; body.appendChild(sep2);
        const scDiv = document.createElement('div');
        scDiv.innerHTML = '<p><b>Start class timer</b> (starts automatically when you tap Start class; 0 min turns it off)</p>' +
          '<div class="r"><input type="text" id="cfLab" maxlength="24" aria-label="Start class timer words"><input type="number" id="cfMin" min="0" max="99" aria-label="Start class timer minutes"><span>min</span></div>';
        body.appendChild(scDiv);
        $('cfLab').value = store.get('startlabel', 'Typing Club');
        $('cfMin').value = store.get('startmin', '10');
        $('cfLab').oninput = () => store.set('startlabel', $('cfLab').value.trim());
        $('cfMin').oninput = () => store.set('startmin', Math.max(0, Math.min(99, Math.round(Number($('cfMin').value) || 0))));

        const r = document.createElement('div');
        r.innerHTML = '<p><b>Every class</b></p><div class="r"><span>Class is</span><input type="number" id="cwLen" min="5" max="180" aria-label="Class length in minutes"><span>min. Warn</span><input type="number" id="cwWm" min="0" max="30" aria-label="Warning minutes before the end"><span>min before the end (0 = off).</span></div>';
        body.appendChild(r);
        $('cwLen').value = store.get('classlen', '45'); $('cwWm').value = store.get('warnmin', '5');
        $('cwLen').onchange = () => { store.set('classlen', Math.max(5, Math.min(180, Math.round(Number($('cwLen').value) || 45)))); draw(); };
        $('cwWm').onchange = () => { store.set('warnmin', Math.max(0, Math.min(30, Math.round(Number($('cwWm').value) || 0)))); draw(); };
      };
      draw();
    });
  }
  TB.cwEdit = cwEdit;
  $('cwPill').onclick = cwEdit;
  $('cwBtn').onclick = cwEdit;
  setInterval(warnCheck, 1000);

  /* ---------- schedule with "Pause today" for assemblies / delays ---------- */
  const DAYS = [['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri']];
  function schedGet() { const v = jget('sched', null); return v && typeof v === 'object' && v.days ? v : { on: false, days: {} }; }
  function schedSet(v) { store.set('sched', JSON.stringify(v)); }
  const isSchedPausedToday = () => store.get('schedpause', '') === dayKey(new Date());
  function paintSchedBtn() {
    const v = schedGet(), paused = isSchedPausedToday();
    $('schedBtn').textContent = !v.on ? 'Schedule' : paused ? 'Schedule (Paused today)' : 'Schedule: On';
  }
  TB.dayChangeHooks.push(paintSchedBtn);

  let schedApplied = '';
  function schedTick(force) {
    paintSchedBtn();
    const v = schedGet(); if (!v.on || isSchedPausedToday()) return;
    const d = new Date(), slots = (v.days[String(d.getDay())] || []).filter(x => x.t && x.g).slice().sort((a, b) => a.t.localeCompare(b.t));
    const now = hhmm(d), cur = slots.filter(x => x.t <= now).pop();
    if (!cur) return;
    const key = dayKey(d) + '|' + cur.t + '|' + cur.g + '|' + (cur.c || '');
    if (key === schedApplied && !force) return;
    schedApplied = key;
    if (!TB.GRADES.some(g => g[0] === cur.g)) return;
    if (cur.c && TB.pkClasses(cur.g).some(k => k.id === cur.c)) store.set('pkcls_' + cur.g, cur.c);
    TB.setGrade(cur.g);
    if (!force && !document.body.classList.contains('sub')) { startClass(); return; }
    const [hh, mm] = cur.t.split(':').map(Number), slotAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime();
    if ((Number(store.get('classstart', '0')) || 0) < slotAt) { store.set('classstart', slotAt); store.del('classwarned'); }
    const cls = cur.c ? TB.pkClasses(cur.g).find(k => k.id === cur.c) : null;
    const gn = TB.GRADES.find(g => g[0] === cur.g)[1];
    toast('Now: ' + (/^\d/.test(gn) ? gn + ' grade' : gn) + (cls ? ', ' + cls.t : ''));
  }
  setInterval(schedTick, 20000);

  function schedEdit() {
    let day = String(new Date().getDay()); if (!DAYS.some(x => x[0] === day)) day = '1';
    openDlg('Schedule', body => {
      const draw = () => {
        const v = schedGet(), slots = v.days[day] || (v.days[day] = []), paused = isSchedPausedToday();
        body.innerHTML = '<p>Add each class start time. When a class starts, the board switches to that grade and picker class. Saved on this board only.</p>' +
          '<div class="r"><button class="tool onoff" id="scOn"></button><button class="tool" id="scPause"></button></div>' +
          '<div class="r tabs" id="scDays"></div><div id="scRows" class="dlgbody"></div>' +
          '<div class="r"><button class="tool" id="scAdd">Add a class time</button><button class="tool" id="scCopy">Copy this day to...</button><select id="scTo" aria-label="Copy to which day"></select></div>';
        $('scOn').textContent = v.on ? 'Schedule: On' : 'Schedule: Off'; $('scOn').classList.toggle('on', v.on);
        $('scOn').onclick = () => { const w = schedGet(); w.on = !w.on; schedSet(w); schedApplied = ''; draw(); paintSchedBtn(); if (w.on) schedTick(true); };
        $('scPause').style.display = v.on ? '' : 'none';
        $('scPause').textContent = paused ? 'Resume today' : 'Pause today (assembly / delay)';
        $('scPause').classList.toggle('editon', paused);
        $('scPause').onclick = () => {
          if (isSchedPausedToday()) { store.del('schedpause'); toast('Schedule resumed for today'); }
          else { store.set('schedpause', dayKey(new Date())); toast('Schedule paused for today only. It resumes tomorrow.'); }
          paintSchedBtn(); draw();
        };
        DAYS.forEach(([k, n]) => {
          const b = document.createElement('button'); b.className = 'tool' + (k === day ? ' on' : ''); b.textContent = n + ((v.days[k] || []).length ? ' (' + v.days[k].length + ')' : '');
          b.onclick = () => { day = k; draw(); }; $('scDays').appendChild(b);
        });
        DAYS.filter(x => x[0] !== day).concat([['all', 'every other day']]).forEach(([k, n]) => { const o = document.createElement('option'); o.value = k; o.textContent = n; $('scTo').appendChild(o); });
        slots.sort((a, b) => (a.t || '99').localeCompare(b.t || '99')).forEach((x, i) => {
          const r = document.createElement('div'); r.className = 'r';
          r.innerHTML = '<input type="time" aria-label="Start time"><select aria-label="Grade"></select><select aria-label="Class"></select><button class="tool">Remove</button>';
          const [tm] = r.querySelectorAll('input'), [gs, cs] = r.querySelectorAll('select');
          tm.value = x.t || '';
          TB.GRADES.forEach(([k, n]) => { const o = document.createElement('option'); o.value = k; o.textContent = /^\d/.test(n) ? n + ' grade' : n; gs.appendChild(o); });
          gs.value = x.g || '1';
          const fillCls = () => {
            cs.innerHTML = '<option value="">Any class</option>';
            TB.pkClasses(gs.value).forEach(k => { const o = document.createElement('option'); o.value = k.id; o.textContent = k.t; cs.appendChild(o); });
            cs.value = TB.pkClasses(gs.value).some(k => k.id === x.c) ? x.c : '';
          };
          fillCls();
          const save = () => { x.t = tm.value; x.g = gs.value; x.c = cs.value; const w = schedGet(); w.days[day] = slots; schedSet(w); schedApplied = ''; };
          tm.onchange = save; gs.onchange = () => { x.c = ''; fillCls(); save(); }; cs.onchange = save;
          r.querySelector('button').onclick = () => { slots.splice(i, 1); const w = schedGet(); w.days[day] = slots; schedSet(w); draw(); };
          $('scRows').appendChild(r);
        });
        if (!slots.length) $('scRows').innerHTML = '<p>No classes on this day yet.</p>';
        $('scAdd').onclick = () => { const w = schedGet(); (w.days[day] = w.days[day] || []).push({ t: '', g: TB.grade, c: '' }); schedSet(w); draw(); };
        $('scCopy').onclick = () => {
          const w = schedGet(), src = JSON.stringify(w.days[day] || []), to = $('scTo').value;
          const targets = to === 'all' ? DAYS.map(x => x[0]).filter(k => k !== day) : [to];
          if (!confirm('Replace ' + (to === 'all' ? 'every other day' : DAYS.find(x => x[0] === to)[1]) + ' with this day\'s classes?')) return;
          targets.forEach(k => w.days[k] = JSON.parse(src)); schedSet(w); draw();
        };
      };
      draw();
    });
  }
  $('schedBtn').onclick = schedEdit;
  schedTick(true);
})();
