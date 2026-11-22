/* Shared Classroom Sound Meter Core Engine (meter-core.js)
   Provides speech-band Web Audio filtering, hysteresis + adjustable grace window,
   rolling 30-second noise sparkline, auto-calibration, demo mode, reward goals,
   saved class history & weekly stats, particle FX, chimes, shortcuts, and
   Classroom Board integration (global mute, sub mode, and saved holiday sync). */

(() => {
  const $ = id => document.getElementById(id);

  function fmt(ms){
    const t = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
  }

  function createCore(cfg){
    const storagePrefix = cfg.storagePrefix || "meter";
    const MAX_ITEMS = cfg.maxItems || 10;
    const ITEM_LABEL = cfg.itemLabel || "tail feathers";
    const LINES = cfg.lines || {
      calm: ["Nice and quiet!"],
      warn: ["Getting louder…"],
      loud: ["Too loud!"]
    };
    const GIFT_LINES = cfg.giftLines || ["Great job, class!"];
    const MSG_EVERY = {calm: 6500, warn: 3500, loud: 2000};
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const key = name => `${storagePrefix}-${name}`;
    const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch(e){ return def; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch(e){} };

    // ---------- Classroom Board Integration (when embedded in index.html) ----------
    const inBoard = window.parent && window.parent !== window;
    let boardMuted = lsGet("cb_muted", "0") === "1";
    if (inBoard) {
      document.body.classList.add("in-board");
      document.body.classList.toggle("sub-mode", lsGet("cb_sub", "0") === "1");
      // Tell parent dashboard which holiday meter is currently open so it remembers
      const page = location.pathname.split("/").pop();
      if (page) {
        lsSet("cb_meterpage", page);
        try { window.parent.postMessage({ type: "tb-meter-page", page }, "*"); } catch(e){}
      }
    }

    // ---------- Settings State ----------
    let limit = parseInt(lsGet(key("limit"), "60"), 10);
    if (!(limit >= 25 && limit <= 90)) limit = 60;

    let graceMs = parseInt(lsGet(key("grace"), "2000"), 10);
    if (![1000, 2000, 4000].includes(graceMs)) graceMs = 2000;

    let voiceFilterOn = lsGet(key("voicefilter"), "on") !== "off";
    let soundOn = lsGet(key("sound"), "on") !== "off";
    let rewardGoal = lsGet(key("goal"), "").trim();

    const effectiveSoundOn = () => soundOn && !boardMuted;

    // ---------- Audio & Loop State ----------
    let audioCtx = null, micSrc = null, hpFilter = null, lpFilter = null, analyser = null, buf = null, stream = null;
    let outCtx = null, deafUntil = 0, nextLoudSound = 0;
    let demoMode = false, demoLevel = 25;
    let level = 0, peakLevel = 0, peakHoldUntil = 0;
    let endTime = 0, pausedLeft = null, running = false, micOff = false;
    let heard = false, warned = false, startedAt = 0;
    let earned = 0, quietMs = 0, loudMs = 0, loudSpikeMs = 0, interval = 60000, lastFrame = 0;
    let totalActiveMs = 0, totalQuietMs = 0, currentStreakMs = 0, bestStreakMs = 0, totalPlucks = 0;
    let sessionLogged = false;

    // Mood + hysteresis state
    let mood = "calm", lastMood = "", angryUntil = 0, lastMsgAt = 0, stickyUntil = 0;
    let inLoudZone = false, inWarnZone = false;

    // Rolling 30-second sparkline (300 samples @ 100ms = 30s)
    const SPARK_MAX = 300;
    let sparkData = new Array(SPARK_MAX).fill(0);
    let sparkAcc = 0;

    // Particle FX
    const appEl = $("app");
    const fxCv = $("fxCanvas"), fxCtx = fxCv ? fxCv.getContext("2d") : null;
    let particles = [];

    // ---------- Timer Chips ----------
    const chipsEl = $("chips"), minsInput = $("minsInput");
    if (chipsEl && minsInput) {
      [5, 10, 15, 20, 30, 45, 60].forEach(m => {
        const b = document.createElement("button");
        b.className = "chip"; b.type = "button"; b.textContent = m + " min";
        b.setAttribute("aria-pressed", m === 20 ? "true" : "false");
        b.onclick = () => { minsInput.value = m; syncChips(); };
        chipsEl.appendChild(b);
      });
      minsInput.addEventListener("input", syncChips);
    }
    function syncChips(){
      if (!chipsEl || !minsInput) return;
      [...chipsEl.children].forEach(b => b.setAttribute("aria-pressed", String(parseInt(b.textContent, 10) === +minsInput.value)));
    }

    // ---------- Loudness Limit & Presets ----------
    const l1 = $("limit1"), l2 = $("limit2");
    const allPresetBtns = [...document.querySelectorAll("[data-limit]")];
    function setLimit(v){
      limit = Math.max(25, Math.min(90, Math.round(+v)));
      if (l1) l1.value = limit;
      if (l2) l2.value = limit;
      if ($("limitMark")) $("limitMark").style.left = limit + "%";
      if ($("calLimit")) $("calLimit").style.left = limit + "%";
      if ($("limitVal")) $("limitVal").textContent = limit + "%";
      if ($("limit1Label")) $("limit1Label").textContent = limit + "%";
      allPresetBtns.forEach(b => b.setAttribute("aria-pressed", String(Math.abs(+b.dataset.limit - limit) <= 4)));
      lsSet(key("limit"), limit);
    }
    if (l1) l1.oninput = e => setLimit(e.target.value);
    if (l2) l2.oninput = e => setLimit(e.target.value);
    allPresetBtns.forEach(b => b.onclick = () => setLimit(b.dataset.limit));
    setLimit(limit);

    // ---------- Adjustable Grace Window (1s / 2s / 4s) ----------
    const graceBtns = [...document.querySelectorAll("[data-grace]")];
    function setGrace(ms){
      graceMs = [1000, 2000, 4000].includes(+ms) ? +ms : 2000;
      graceBtns.forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.grace === graceMs)));
      if ($("graceHint")) {
        $("graceHint").textContent =
          graceMs === 1000 ? "Strict: 1s over limit plucks" :
          graceMs === 4000 ? "Forgiving: ignores coughs & drops (4s)" :
          "Standard: 2s over limit plucks";
      }
      lsSet(key("grace"), graceMs);
    }
    graceBtns.forEach(b => b.onclick = () => setGrace(b.dataset.grace));
    setGrace(graceMs);

    // ---------- Speech-Band Voice Filter (300–3400 Hz) ----------
    function wireAudioGraph(ctx, src, targetAnalyser, useFilter){
      try { src.disconnect(); } catch(e){}
      if (hpFilter) { try { hpFilter.disconnect(); } catch(e){} }
      if (lpFilter) { try { lpFilter.disconnect(); } catch(e){} }
      if (useFilter) {
        hpFilter = ctx.createBiquadFilter();
        hpFilter.type = "highpass";
        hpFilter.frequency.value = 300;
        hpFilter.Q.value = 0.707;
        lpFilter = ctx.createBiquadFilter();
        lpFilter.type = "lowpass";
        lpFilter.frequency.value = 3400;
        lpFilter.Q.value = 0.707;
        src.connect(hpFilter);
        hpFilter.connect(lpFilter);
        lpFilter.connect(targetAnalyser);
      } else {
        src.connect(targetAnalyser);
      }
    }

    function setVoiceFilter(on){
      voiceFilterOn = !!on;
      lsSet(key("voicefilter"), voiceFilterOn ? "on" : "off");
      if ($("voiceFilterSetup")) {
        $("voiceFilterSetup").setAttribute("aria-pressed", String(voiceFilterOn));
        $("voiceFilterSetup").textContent = voiceFilterOn ? "ON · 300–3400 Hz" : "OFF · Full range";
      }
      if ($("voiceFilterBtn")) {
        $("voiceFilterBtn").setAttribute("aria-pressed", "false");
        $("voiceFilterBtn").classList.toggle("active-filter", voiceFilterOn);
        $("voiceFilterBtn").textContent = voiceFilterOn ? "Voice filter ✓" : "Full mic";
      }
      if ($("filterTag")) {
        $("filterTag").textContent = voiceFilterOn ? "Voice filter 300–3400 Hz" : "Full-range mic";
      }
      if (audioCtx && micSrc && analyser) {
        wireAudioGraph(audioCtx, micSrc, analyser, voiceFilterOn);
      }
    }
    if ($("voiceFilterSetup")) $("voiceFilterSetup").onclick = () => setVoiceFilter(!voiceFilterOn);
    if ($("voiceFilterBtn")) $("voiceFilterBtn").onclick = () => setVoiceFilter(!voiceFilterOn);
    setVoiceFilter(voiceFilterOn);

    // ---------- Custom Class Reward Goal ----------
    const goalInput = $("goalInput"), goalPill = $("goalPill"), goalPillText = $("goalPillText");
    function setGoal(text){
      rewardGoal = (text || "").trim().slice(0, 64);
      lsSet(key("goal"), rewardGoal);
      if (goalInput && goalInput.value !== rewardGoal) goalInput.value = rewardGoal;
      syncGoalPill();
    }
    function syncGoalPill(){
      if (!goalPill || !goalPillText) return;
      if (!rewardGoal) { goalPill.hidden = true; return; }
      goalPill.hidden = false;
      const unlocked = earned >= MAX_ITEMS;
      goalPill.classList.toggle("unlocked", unlocked);
      goalPillText.textContent = unlocked ? `Unlocked: ${rewardGoal}!` : `Goal: ${rewardGoal}`;
    }
    if (goalInput) {
      goalInput.value = rewardGoal;
      goalInput.addEventListener("input", e => setGoal(e.target.value));
    }
    document.querySelectorAll("[data-goal]").forEach(b => {
      b.onclick = () => setGoal(b.dataset.goal);
    });
    if ($("clearGoal")) $("clearGoal").onclick = () => setGoal("");
    syncGoalPill();

    // ---------- Saved Session History & Weekly Stats ----------
    function loadHistory(){
      try {
        const raw = localStorage.getItem(key("history"));
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch(e){ return []; }
    }
    function saveSessionRecord(){
      if (sessionLogged || totalActiveMs < 10000) return;
      sessionLogged = true;
      const qPct = totalActiveMs > 0 ? Math.round((totalQuietMs / totalActiveMs) * 100) : 100;
      const list = loadHistory();
      list.unshift({
        ts: Date.now(),
        earned,
        max: MAX_ITEMS,
        quietPct: qPct,
        bestStreakMs: Math.round(bestStreakMs),
        plucks: totalPlucks,
        goal: rewardGoal,
        demo: demoMode
      });
      if (list.length > 30) list.length = 30;
      lsSet(key("history"), JSON.stringify(list));
    }
    function renderHistory(){
      const list = loadHistory();
      const weekAgo = Date.now() - 7 * 86400000;
      const week = list.filter(r => r.ts >= weekAgo);
      const src = week.length ? week : list;
      if ($("histSessions")) $("histSessions").textContent = String(week.length);
      if ($("histAvgFeathers")) {
        const avg = src.length ? (src.reduce((a, r) => a + r.earned, 0) / src.length).toFixed(1) : "—";
        $("histAvgFeathers").textContent = src.length ? `${avg}/${MAX_ITEMS}` : "—";
      }
      if ($("histAvgQuiet")) {
        const avgQ = src.length ? Math.round(src.reduce((a, r) => a + r.quietPct, 0) / src.length) : null;
        $("histAvgQuiet").textContent = avgQ !== null ? `${avgQ}%` : "—";
      }
      if ($("histBestStreak")) {
        const best = list.length ? Math.max(...list.map(r => r.bestStreakMs || 0)) : 0;
        $("histBestStreak").textContent = list.length ? fmt(best) : "—";
      }
      const rowsEl = $("histRows");
      if (!rowsEl) return;
      if (!list.length) {
        rowsEl.innerHTML = `<div class="hist-empty">No sessions saved yet. Complete a class session (at least 10 seconds) to track your weekly progress!</div>`;
        return;
      }
      const dtf = new Intl.DateTimeFormat(undefined, {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"});
      rowsEl.innerHTML =
        `<div class="hist-row hdr"><span>Date</span><span>Score</span><span>Quiet</span><span>Best Streak</span></div>` +
        list.slice(0, 12).map(r => {
          const badge = r.earned >= r.max ? " ★" : "";
          const demoTag = r.demo ? " (Demo)" : "";
          return `<div class="hist-row">
            <span>${dtf.format(new Date(r.ts))}${demoTag}</span>
            <strong>${r.earned} / ${r.max}${badge}</strong>
            <span>${r.quietPct}%</span>
            <span>${fmt(r.bestStreakMs || 0)}</span>
          </div>`;
        }).join("");
    }
    function openHistory(){
      renderHistory();
      if ($("historyModal")) $("historyModal").hidden = false;
    }
    function closeHistory(){
      if ($("historyModal")) $("historyModal").hidden = true;
    }
    if ($("histBtnTop")) $("histBtnTop").onclick = openHistory;
    if ($("histBtnSetup")) $("histBtnSetup").onclick = openHistory;
    if ($("histClose")) $("histClose").onclick = closeHistory;
    if ($("histClear")) {
      $("histClear").onclick = () => {
        lsSet(key("history"), "[]");
        renderHistory();
      };
    }

    // ---------- Room Auto-Calibration in Setup ----------
    let calStream = null, calCtx = null, calAnalyser = null, calBuf = null, calRaf = 0, calSamples = [], calEnd = 0;
    function stopCal(){
      if (calRaf) cancelAnimationFrame(calRaf);
      calRaf = 0;
      try { calStream && calStream.getTracks().forEach(t => t.stop()); } catch(e){}
      try { calCtx && calCtx.close(); } catch(e){}
      calStream = calCtx = calAnalyser = null;
      if ($("calBtn")) $("calBtn").textContent = "Test / Calibrate Room";
    }
    if ($("calBtn")) {
      $("calBtn").onclick = async () => {
        if (calRaf) { stopCal(); return; }
        if ($("err")) $("err").textContent = "";
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if ($("calHint")) $("calHint").textContent = "Mic unavailable here. Try Demo mode to test everything!";
          return;
        }
        try {
          calStream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
          calCtx = new (window.AudioContext || window.webkitAudioContext)();
          await calCtx.resume();
          calAnalyser = calCtx.createAnalyser();
          calAnalyser.fftSize = 2048;
          calBuf = new Float32Array(calAnalyser.fftSize);
          const calSrc = calCtx.createMediaStreamSource(calStream);
          if (voiceFilterOn) {
            const hp = calCtx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 300; hp.Q.value = 0.707;
            const lp = calCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3400; lp.Q.value = 0.707;
            calSrc.connect(hp); hp.connect(lp); lp.connect(calAnalyser);
          } else {
            calSrc.connect(calAnalyser);
          }
        } catch (e) {
          if ($("calHint")) $("calHint").textContent = "Could not access microphone (" + e.name + "). You can still try Demo mode!";
          stopCal(); return;
        }
        calSamples = [];
        calEnd = performance.now() + 2200;
        $("calBtn").textContent = "Measuring quiet room…";
        if ($("calHint")) $("calHint").textContent = "Stay quiet for 2 seconds while we measure your room’s baseline…";
        const tick = now => {
          if (!calAnalyser) return;
          calAnalyser.getFloatTimeDomainData(calBuf);
          let s = 0; for (let i = 0; i < calBuf.length; i++) s += calBuf[i] * calBuf[i];
          const db = 20 * Math.log10(Math.sqrt(s / calBuf.length) + 1e-8);
          const v = Math.max(0, Math.min(100, (db + 70) / 60 * 100));
          if ($("calFill")) {
            $("calFill").style.width = v.toFixed(1) + "%";
            $("calFill").style.background = v > limit ? "var(--cranberry)" : v > limit * .78 ? "var(--gold)" : "var(--sage)";
          }
          if (now < calEnd) {
            calSamples.push(v);
          } else if (calSamples.length) {
            const avg = calSamples.reduce((a, b) => a + b, 0) / calSamples.length;
            const suggested = Math.max(35, Math.min(82, Math.round(avg + 22)));
            setLimit(suggested);
            if ($("calHint")) $("calHint").textContent = `Baseline ~${Math.round(avg)}%, limit auto-set to ${suggested}%. Talk to test, or click Start!`;
            $("calBtn").textContent = "Stop Test";
            calSamples = [];
          }
          calRaf = requestAnimationFrame(tick);
        };
        calRaf = requestAnimationFrame(tick);
      };
    }

    // ---------- Sound Effects ----------
    function unlockSound(){
      try {
        if (!outCtx) outCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (outCtx.state === "suspended") outCtx.resume();
      } catch(e){}
    }
    function setDeaf(ms){
      deafUntil = Math.max(deafUntil, performance.now() + ms);
    }
    function playChime(){
      if (!effectiveSoundOn()) return;
      unlockSound();
      if (!outCtx) return;
      const t0 = outCtx.currentTime + 0.02;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = outCtx.createOscillator(), g = outCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t0 + i * 0.07);
        g.gain.setValueAtTime(0.001, t0 + i * 0.07);
        g.gain.linearRampToValueAtTime(0.18, t0 + i * 0.07 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.07 + 0.38);
        osc.connect(g); g.connect(outCtx.destination);
        osc.start(t0 + i * 0.07); osc.stop(t0 + i * 0.07 + 0.42);
      });
      setDeaf(900);
    }
    function playFanfare(){
      if (!effectiveSoundOn()) return;
      unlockSound();
      if (!outCtx) return;
      const t0 = outCtx.currentTime + 0.02;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = outCtx.createOscillator(), g = outCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t0 + i * 0.11);
        g.gain.setValueAtTime(0.001, t0 + i * 0.11);
        g.gain.linearRampToValueAtTime(0.24, t0 + i * 0.11 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.11 + 0.65);
        osc.connect(g); g.connect(outCtx.destination);
        osc.start(t0 + i * 0.11); osc.stop(t0 + i * 0.11 + 0.7);
      });
      setDeaf(1600);
    }
    function triggerLoudSound(){
      if (!effectiveSoundOn() || !cfg.onLoudSound) return;
      const now = performance.now();
      if (now < nextLoudSound) return;
      nextLoudSound = now + 6000;
      unlockSound();
      const dur = cfg.onLoudSound(outCtx) || 900;
      setDeaf(dur + 600);
    }
    function paintSoundBtn(){
      const b = $("sound");
      if (!b) return;
      if (boardMuted) {
        b.textContent = "Board muted";
        b.setAttribute("aria-pressed", "true");
      } else {
        b.textContent = soundOn ? "Sound on" : "Sound off";
        b.setAttribute("aria-pressed", String(!soundOn));
      }
    }
    function setSound(on){
      soundOn = !!on;
      lsSet(key("sound"), soundOn ? "on" : "off");
      paintSoundBtn();
    }
    paintSoundBtn();
    if ($("sound")) $("sound").onclick = () => { unlockSound(); setSound(!soundOn); };

    // Listen for parent Classroom Board mute / sub-mode messages
    window.addEventListener("message", e => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "tb-mute") { boardMuted = !!d.muted; paintSoundBtn(); }
      if (d.type === "tb-sub") { document.body.classList.toggle("sub-mode", !!d.sub); }
    });

    // ---------- Particle FX ----------
    function spawnBurst(x, y, count = 18, palette = ["#FFD15C","#FF8E3C","#FFF9EB","#B8253A","#7FA24C"]){
      if (reduceMotion.matches || !fxCtx) return;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i / count) + (Math.random() - .5) * .4;
        const spd = 90 + Math.random() * 210;
        particles.push({
          x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 90,
          g: 360, size: 4 + Math.random() * 5, rot: Math.random() * 6.28,
          vrot: (Math.random() - .5) * 9, life: 0, max: .8 + Math.random() * .65,
          color: palette[Math.floor(Math.random() * palette.length)],
          shape: Math.random() < .45 ? "star" : "rect"
        });
      }
    }
    function burstHero(count = 20){
      if (!cfg.getBurstOrigin) return;
      const pt = cfg.getBurstOrigin();
      if (pt) spawnBurst(pt.x, pt.y, count);
    }
    function tickFx(dt){
      if (!fxCv || !fxCtx || !appEl) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = appEl.clientWidth, h = appEl.clientHeight;
      if (fxCv.width !== Math.round(w * dpr) || fxCv.height !== Math.round(h * dpr)) {
        fxCv.width = Math.round(w * dpr); fxCv.height = Math.round(h * dpr);
      }
      fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fxCtx.clearRect(0, 0, w, h);
      if (!particles.length) return;
      particles = particles.filter(p => {
        p.life += dt; if (p.life >= p.max) return false;
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vrot * dt;
        const a = Math.max(0, 1 - p.life / p.max);
        fxCtx.save();
        fxCtx.globalAlpha = a;
        fxCtx.translate(p.x, p.y); fxCtx.rotate(p.rot);
        fxCtx.fillStyle = p.color;
        if (p.shape === "star") {
          fxCtx.beginPath();
          for (let k = 0; k < 5; k++) {
            const r1 = p.size, r2 = p.size * .45;
            const a1 = k * Math.PI * .4 - Math.PI / 2, a2 = a1 + Math.PI * .2;
            fxCtx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
            fxCtx.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2);
          }
          fxCtx.closePath(); fxCtx.fill();
        } else {
          fxCtx.fillRect(-p.size * .7, -p.size * .45, p.size * 1.4, p.size * .9);
        }
        fxCtx.restore();
        return true;
      });
    }

    // ---------- Rolling 30-Second Sparkline Renderer ----------
    const sparkCv = $("sparkline"), sparkCtx = sparkCv ? sparkCv.getContext("2d") : null;
    function drawSparkline(){
      if (!sparkCv || !sparkCtx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = sparkCv.clientWidth, h = sparkCv.clientHeight;
      if (!w || !h) return;
      if (sparkCv.width !== Math.round(w * dpr) || sparkCv.height !== Math.round(h * dpr)) {
        sparkCv.width = Math.round(w * dpr); sparkCv.height = Math.round(h * dpr);
      }
      sparkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sparkCtx.clearRect(0, 0, w, h);

      const limY = h - (limit / 100) * (h - 4) - 2;
      sparkCtx.save();
      sparkCtx.strokeStyle = "rgba(255,249,235,.55)";
      sparkCtx.lineWidth = 1.2;
      sparkCtx.setLineDash([4, 4]);
      sparkCtx.beginPath();
      sparkCtx.moveTo(0, limY);
      sparkCtx.lineTo(w, limY);
      sparkCtx.stroke();
      sparkCtx.restore();

      const step = w / (SPARK_MAX - 1);
      const grad = sparkCtx.createLinearGradient(0, 0, 0, h);
      const limStop = Math.max(0.05, Math.min(0.95, 1 - limit / 100));
      grad.addColorStop(0, "rgba(220,56,74,.65)");
      grad.addColorStop(limStop, "rgba(232,173,48,.48)");
      grad.addColorStop(1, "rgba(127,162,76,.35)");

      sparkCtx.beginPath();
      sparkCtx.moveTo(0, h);
      for (let i = 0; i < SPARK_MAX; i++) {
        const x = i * step;
        const y = h - (sparkData[i] / 100) * (h - 4) - 2;
        sparkCtx.lineTo(x, y);
      }
      sparkCtx.lineTo(w, h);
      sparkCtx.closePath();
      sparkCtx.fillStyle = grad;
      sparkCtx.fill();

      sparkCtx.beginPath();
      for (let i = 0; i < SPARK_MAX; i++) {
        const x = i * step;
        const y = h - (sparkData[i] / 100) * (h - 4) - 2;
        if (i === 0) sparkCtx.moveTo(x, y);
        else sparkCtx.lineTo(x, y);
      }
      sparkCtx.strokeStyle = mood === "loud" ? "#FF7C8B" : mood === "warn" ? "#FFD269" : "#C9E88D";
      sparkCtx.lineWidth = 1.8;
      sparkCtx.stroke();
    }

    // ---------- Bubble & Mood ----------
    function setBubbleText(text, isLoud = false){
      const b = $("bubble");
      if (!b) return;
      if (b.textContent !== text) {
        b.textContent = text;
        b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
      }
      b.classList.toggle("loud-bubble", isLoud);
    }
    function say(text, isLoud = false, duration = 2600){
      if (!warned) {
        setBubbleText(text, isLoud);
        lastMsgAt = performance.now();
        stickyUntil = lastMsgAt + duration;
      }
    }
    function setMood(m){
      if (m === lastMood) return;
      if (m === "loud" && running) triggerLoudSound();
      lastMood = m; mood = m;
      const meter = $("meter"), dot = $("statusDot"), badge = $("zoneBadge");
      if (meter) { meter.classList.remove("warn","loud"); if (m !== "calm") meter.classList.add(m); }
      if (dot) dot.className = "pill-dot" + (micOff ? " off" : m !== "calm" ? " " + m : "");
      if (badge) {
        badge.className = "zone-badge" + (m !== "calm" ? " " + m : "");
        badge.textContent = micOff ? "Listening Paused" : m === "loud" ? "Too Loud: Shhh!" : m === "warn" ? "Caution: Lower Voices" : "Safe & Quiet";
      }
      if ($("statusText")) {
        $("statusText").textContent = micOff ? "Mic Paused" : m === "loud" ? "Too Loud!" : m === "warn" ? "Getting Louder" : "Quiet & Calm";
      }
      if (cfg.onMoodChange) cfg.onMoodChange(m);
      if (!warned && !micOff && performance.now() > stickyUntil) {
        setBubbleText(LINES[m][0], m === "loud");
        lastMsgAt = performance.now();
      }
    }
    function maybeRotateBubble(now){
      if (!warned && !micOff && now > stickyUntil && now - lastMsgAt > MSG_EVERY[mood]) {
        const list = LINES[mood];
        const cur = $("bubble") ? $("bubble").textContent : "";
        let next = list[Math.floor(Math.random() * list.length)];
        if (next === cur) next = list[(list.indexOf(next) + 1) % list.length];
        setBubbleText(next, mood === "loud");
        lastMsgAt = now;
      }
    }

    // ---------- Score / Gain / Loss ----------
    function updateScoreUI(){
      if ($("count")) $("count").textContent = earned;
      if ($("give")) $("give").disabled = earned >= MAX_ITEMS;
      if ($("take")) $("take").disabled = earned <= 0;
      syncGoalPill();
      if (cfg.onCountUpdate) cfg.onCountUpdate(earned, MAX_ITEMS);
    }

    function gain(isGift = false){
      if (earned >= MAX_ITEMS) return;
      const idx = earned;
      earned++;
      if (cfg.onGain) cfg.onGain(idx, earned);
      updateScoreUI();
      const sc = $("scoreCard");
      if (sc) { sc.classList.remove("bump"); void sc.offsetWidth; sc.classList.add("bump"); }
      burstHero(16);
      if (earned === MAX_ITEMS) {
        playFanfare();
        burstHero(42);
        if (cfg.onFull) cfg.onFull(rewardGoal);
      } else {
        playChime();
        if (isGift && !warned && !micOff) {
          setBubbleText(GIFT_LINES[Math.floor(Math.random() * GIFT_LINES.length)]);
          lastMsgAt = performance.now();
        }
      }
    }

    function commitLoss(){
      if (earned <= 0) return -1;
      earned--;
      totalPlucks++;
      updateScoreUI();
      return earned;
    }

    // ---------- Read Audio Level ----------
    function readLevel(){
      if (demoMode) {
        const jitter = (Math.random() - 0.5) * 4.2;
        const target = Math.max(0, Math.min(100, demoLevel + jitter));
        level = level * 0.72 + target * 0.28;
        return level;
      }
      analyser.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      if (s > 1e-9) heard = true;
      const db = 20 * Math.log10(Math.sqrt(s / buf.length) + 1e-8);
      const offset = voiceFilterOn ? 74 : 70;
      const v = Math.max(0, Math.min(100, (db + offset) / 60 * 100));
      level = v > level ? level * 0.55 + v * 0.45 : level * 0.88 + v * 0.12;
      return level;
    }

    // ---------- Session Lifecycle ----------
    async function start(isDemo = false){
      stopCal();
      demoMode = isDemo;
      const mins = Math.max(1, Math.min(180, parseInt(minsInput ? minsInput.value : 20, 10) || 20));
      if ($("err")) $("err").textContent = "";

      if (!demoMode) {
        try { if (audioCtx) audioCtx.close(); } catch(e){}
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtx.resume();
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if ($("err")) $("err").textContent = "This page can’t reach the microphone from here. Open it directly in Chrome, or try Demo mode.";
          return;
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
        } catch (e) {
          const msgs = {
            NotAllowedError: "Microphone was blocked. Allow mic access in your browser address bar, or try Demo mode.",
            SecurityError: "Microphone blocked by page frame. Open directly in Chrome, or try Demo mode.",
            NotFoundError: "No microphone found. Plug one in or try Demo mode.",
            NotReadableError: "Another app is using the microphone. Close Zoom/Meet or try Demo mode.",
            OverconstrainedError: "Microphone rejected settings. Try another mic or Demo mode."
          };
          if ($("err")) $("err").textContent = (msgs[e.name] || "Microphone didn’t start.") + " (" + e.name + ")";
          return;
        }
        if (audioCtx.state === "suspended") { try { await audioCtx.resume(); } catch(e){} }
        micSrc = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        buf = new Float32Array(analyser.fftSize);
        wireAudioGraph(audioCtx, micSrc, analyser, voiceFilterOn);
      }

      if ($("demoPad")) $("demoPad").hidden = !demoMode;
      const total = mins * 60000;
      endTime = Date.now() + total;
      pausedLeft = null;
      interval = Math.max(5000, total * 0.85 / MAX_ITEMS);
      earned = 0; quietMs = 0; loudMs = 0; loudSpikeMs = 0;
      totalActiveMs = 0; totalQuietMs = 0; currentStreakMs = 0; bestStreakMs = 0; totalPlucks = 0;
      sessionLogged = false;
      peakLevel = 0; inLoudZone = false; inWarnZone = false;
      sparkData.fill(0); sparkAcc = 0;
      drawSparkline();

      if (cfg.onReset) cfg.onReset();
      updateScoreUI();
      if ($("pause")) $("pause").textContent = "Pause";
      if ($("timeSub")) $("timeSub").textContent = "left in class";
      if ($("setup")) $("setup").hidden = true;
      if ($("done")) $("done").hidden = true;
      heard = demoMode; warned = false; startedAt = Date.now(); lastMood = ""; setMic(false);
      running = true; lastFrame = performance.now();
      requestAnimationFrame(loop);
    }

    function stopAudio(logIfEligible = false){
      if (logIfEligible) saveSessionRecord();
      running = false;
      warned = false; inLoudZone = false; inWarnZone = false;
      setMood("calm");
      if ($("dangerWrap")) $("dangerWrap").classList.remove("show");
      try { stream && stream.getTracks().forEach(t => t.stop()); } catch(e){}
      try { audioCtx && audioCtx.close(); } catch(e){}
      micSrc = hpFilter = lpFilter = analyser = audioCtx = stream = null;
    }

    function loop(now){
      if (!running) return;
      const dt = Math.min(250, now - lastFrame); lastFrame = now;
      if (!demoMode && audioCtx && audioCtx.state === "suspended") audioCtx.resume();
      const lv = micOff ? (level = 0) : readLevel();

      if (lv >= peakLevel) { peakLevel = lv; peakHoldUntil = now + 900; }
      else if (now > peakHoldUntil) { peakLevel = Math.max(lv, peakLevel - dt * 0.032); }
      const pkEl = $("peakMark");
      if (pkEl) {
        pkEl.style.left = Math.min(99, peakLevel).toFixed(1) + "%";
        pkEl.classList.toggle("vis", !micOff && peakLevel > 4);
      }

      sparkAcc += dt;
      if (sparkAcc >= 100) {
        sparkAcc %= 100;
        sparkData.shift();
        sparkData.push(micOff ? 0 : lv);
        drawSparkline();
      }

      const track = stream && stream.getAudioTracks()[0];
      const silent = !demoMode && !micOff && (!heard || (track && track.muted));
      if (silent && !warned && Date.now() - startedAt > 4000) {
        warned = true;
        setBubbleText("I can’t hear anything! Check the mic.");
      } else if (!silent && warned) {
        warned = false; lastMood = "";
        if (micOff) setBubbleText("Mic is paused. Break time!");
      }

      if ($("fill")) $("fill").style.width = lv.toFixed(1) + "%";
      if ($("meter")) $("meter").setAttribute("aria-valuenow", Math.round(lv));

      const deaf = performance.now() < deafUntil;
      if (micOff || deaf) {
        inLoudZone = false;
        inWarnZone = false;
      } else {
        if (!inLoudZone && lv > limit) inLoudZone = true;
        else if (inLoudZone && lv < limit - 4) inLoudZone = false;

        if (!inWarnZone && lv > limit * 0.78) inWarnZone = true;
        else if (inWarnZone && lv < limit * 0.72) inWarnZone = false;
      }

      const loud = inLoudZone;
      const warn = inWarnZone;
      if (loud) angryUntil = now + 1400;
      setMood(loud || now < angryUntil ? "loud" : warn ? "warn" : "calm");

      const left = pausedLeft !== null ? pausedLeft : endTime - Date.now();
      if ($("time")) $("time").textContent = fmt(left);
      if ($("clock")) $("clock").classList.toggle("urgent", left <= 60000);

      if (pausedLeft === null) {
        if (!micOff) {
          totalActiveMs += dt;
          if (loud || (deaf && mood === "loud")) {
            loudSpikeMs += dt;
            if (loudSpikeMs > 220) {
              currentStreakMs = 0;
              loudMs += dt;
              if (loudMs >= graceMs) {
                if (cfg.onRequestTake) cfg.onRequestTake();
                else commitLoss();
                loudMs = 0;
              }
            }
          } else {
            loudSpikeMs = Math.max(0, loudSpikeMs - dt * 2);
            totalQuietMs += dt;
            currentStreakMs += dt;
            if (currentStreakMs > bestStreakMs) bestStreakMs = currentStreakMs;
            loudMs = Math.max(0, loudMs - dt * 0.55);
            if (earned < MAX_ITEMS) {
              quietMs += dt;
              if (quietMs >= interval) { quietMs = 0; gain(false); }
            }
          }
        }
        const dangerPct = Math.min(100, (loudMs / graceMs) * 100);
        if ($("dangerWrap")) $("dangerWrap").classList.toggle("show", !micOff && dangerPct > 5 && earned > 0);
        if ($("dangerFill")) $("dangerFill").style.width = dangerPct.toFixed(1) + "%";

        const nextPct = earned >= MAX_ITEMS ? 100 : Math.min(100, (quietMs / interval) * 100);
        if ($("nextBar")) $("nextBar").style.width = nextPct.toFixed(1) + "%";
        if ($("nextPct")) $("nextPct").textContent = earned >= MAX_ITEMS ? "MAX" : Math.floor(nextPct) + "%";
        if ($("streakVal")) $("streakVal").textContent = fmt(currentStreakMs);

        if (left <= 0) { finish(); return; }
      }
      requestAnimationFrame(loop);
    }

    function finish(){
      saveSessionRecord();
      stopAudio(false);
      if ($("time")) $("time").textContent = "0:00";
      if ($("finalCount")) $("finalCount").textContent = earned;
      if ($("finalMsg")) {
        $("finalMsg").textContent =
          earned >= MAX_ITEMS ? `${ITEM_LABEL}. A perfect score!` :
          earned >= Math.ceil(MAX_ITEMS * 0.7) ? `${ITEM_LABEL}. Great job keeping it calm!` :
          earned >= Math.ceil(MAX_ITEMS * 0.4) ? `${ITEM_LABEL}. Let’s grow even more next time.` :
          `${ITEM_LABEL}. Let’s try for more next time.`;
      }
      const qPct = totalActiveMs > 0 ? Math.round((totalQuietMs / totalActiveMs) * 100) : 100;
      if ($("statQuiet")) $("statQuiet").textContent = qPct + "%";
      if ($("statStreak")) $("statStreak").textContent = fmt(bestStreakMs);
      if ($("statPlucks")) $("statPlucks").textContent = String(totalPlucks);

      const gr = $("goalResult");
      if (gr) {
        if (rewardGoal) {
          gr.hidden = false;
          const ok = earned >= MAX_ITEMS;
          gr.className = "goal-result" + (ok ? " done" : "");
          gr.textContent = ok ? `Goal Unlocked: ${rewardGoal}!` : `Goal: ${rewardGoal} (${earned}/${MAX_ITEMS})`;
        } else {
          gr.hidden = true;
        }
      }
      if (earned >= 7) burstHero(36);
      if (cfg.onFinish) cfg.onFinish(earned);
      if ($("done")) $("done").hidden = false;
      if ($("again")) $("again").focus();
    }

    // ---------- Controls & Shortcuts ----------
    function setMic(off){
      micOff = !!off;
      const track = stream && stream.getAudioTracks()[0];
      if (track) track.enabled = !micOff;
      const b = $("mic");
      if (b) {
        b.textContent = micOff ? "Mic muted" : (demoMode ? "Demo on" : "Mic on");
        b.setAttribute("aria-pressed", String(micOff));
      }
      if ($("meter")) $("meter").classList.toggle("off", micOff);
      if ($("fill")) $("fill").style.width = "0%";
      if ($("dangerWrap")) $("dangerWrap").classList.remove("show");
      if (micOff) {
        angryUntil = 0; warned = false; lastMood = ""; inLoudZone = false; inWarnZone = false;
        setMood("calm");
        setBubbleText("Mic is paused. Break time!");
      } else {
        heard = demoMode; startedAt = Date.now(); lastMood = ""; lastMsgAt = 0;
      }
    }
    if ($("mic")) $("mic").onclick = () => setMic(!micOff);

    function togglePause(){
      if (pausedLeft === null) {
        pausedLeft = Math.max(0, endTime - Date.now());
        if ($("pause")) $("pause").textContent = "Resume";
        if ($("timeSub")) $("timeSub").textContent = "paused";
      } else {
        endTime = Date.now() + pausedLeft;
        pausedLeft = null;
        if ($("pause")) $("pause").textContent = "Pause";
        if ($("timeSub")) $("timeSub").textContent = "left in class";
      }
    }
    if ($("pause")) $("pause").onclick = togglePause;

    function adjust(ms){
      if (pausedLeft !== null) pausedLeft = Math.max(1000, pausedLeft + ms);
      else endTime = Math.max(Date.now() + 1000, endTime + ms);
    }
    if ($("plus")) $("plus").onclick = () => adjust(60000);
    if ($("minus")) $("minus").onclick = () => adjust(-60000);
    if ($("full")) {
      $("full").onclick = () => {
        try {
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
        } catch(e){}
      };
    }

    if ($("demoSlider")) {
      $("demoSlider").oninput = e => {
        demoLevel = +e.target.value;
        if ($("demoVal")) $("demoVal").textContent = demoLevel + "%";
      };
    }
    document.querySelectorAll("[data-demo]").forEach(b => {
      b.onclick = () => {
        demoLevel = +b.dataset.demo;
        if ($("demoSlider")) $("demoSlider").value = demoLevel;
        if ($("demoVal")) $("demoVal").textContent = demoLevel + "%";
      };
    });

    if ($("start")) $("start").onclick = () => { unlockSound(); start(false); };
    if ($("startDemo")) $("startDemo").onclick = () => { unlockSound(); start(true); };
    if (minsInput) minsInput.addEventListener("keydown", e => { if (e.key === "Enter") { unlockSound(); start(false); } });
    if ($("again")) $("again").onclick = () => { if ($("done")) $("done").hidden = true; if ($("setup")) $("setup").hidden = false; if (minsInput) minsInput.focus(); };
    if ($("stop")) $("stop").onclick = () => { stopAudio(true); if ($("demoPad")) $("demoPad").hidden = true; if ($("setup")) $("setup").hidden = false; };
    if ($("give")) $("give").onclick = () => gain(true);
    if ($("take")) $("take").onclick = () => { if (cfg.onRequestTake) cfg.onRequestTake(); else commitLoss(); };

    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && $("historyModal") && !$("historyModal").hidden) { closeHistory(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (($("setup") && !$("setup").hidden) || ($("done") && !$("done").hidden) || ($("historyModal") && !$("historyModal").hidden)) return;
      if (e.key === "f" || e.key === "F") gain(true);
      else if (e.key === "t" || e.key === "T") { if (cfg.onRequestTake) cfg.onRequestTake(); else commitLoss(); }
      else if (e.key === "m" || e.key === "M") setMic(!micOff);
      else if (e.key === " ") { e.preventDefault(); togglePause(); }
    });

    drawSparkline();

    return {
      get earned(){ return earned; },
      get maxItems(){ return MAX_ITEMS; },
      get mood(){ return mood; },
      get running(){ return running; },
      get soundOn(){ return effectiveSoundOn(); },
      get outCtx(){ unlockSound(); return outCtx; },
      get reduceMotion(){ return reduceMotion; },
      gain,
      commitLoss,
      say,
      setBubbleText,
      maybeRotateBubble,
      setDeaf,
      unlockSound,
      burstHero,
      spawnBurst,
      tickFx,
      fmt
    };
  }

  window.MeterCore = { init: createCore, fmt };
})();
