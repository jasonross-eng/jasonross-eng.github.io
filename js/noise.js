(function () {
  const TB = window.TB, { $, store } = TB;

  const METERS = [
    ['gobble-meter.html', 'Gobble Meter'],
    ['santa.html', 'Santa Meter'],
    ['veterans.html', 'Veterans Meter'],
    ['mlk.html', 'Dream Meter'],
    ['washington.html', 'Washington Meter'],
    ['easter.html', 'Bunny Meter'],
    ['circus.html', 'Circus Meter'],
    ['cyborg.html', 'Cyborg Meter']
  ];
  const METER_SET = new Set(METERS.map(m => m[0]));

  function defaultMeterPage() {
    const d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    if (m === 11) return day <= 14 ? 'veterans.html' : 'gobble-meter.html';
    if (m === 12) return 'santa.html';
    if (m === 1) return 'mlk.html';
    if (m === 2) return 'washington.html';
    if (m === 3 || m === 4) return 'easter.html';
    return 'gobble-meter.html';
  }

  function savedMeterPage() {
    const p = store.get('meterpage', '');
    return METER_SET.has(p) ? p : defaultMeterPage();
  }

  let curPage = savedMeterPage();
  let smOpen = false;
  let frame = null;

  const sm = TB.makeFloat('smCard', 'Sound meter', 'smrect', { x: .07, y: .13, w: .86, h: .82 }, () => setSeasonal(false));
  sm.el.classList.add('sub-ok');

  const pick = document.createElement('select');
  pick.id = 'smPick';
  pick.setAttribute('aria-label', 'Choose seasonal sound meter');
  METERS.forEach(([file, label]) => {
    const opt = document.createElement('option');
    opt.value = file;
    opt.textContent = label;
    pick.appendChild(opt);
  });
  pick.value = curPage;

  const simpleBtn = document.createElement('button');
  simpleBtn.className = 'tool sub-hide';
  simpleBtn.id = 'smSimpleBtn';
  simpleBtn.textContent = 'Simple bar';

  const tabBtn = document.createElement('button');
  tabBtn.className = 'tool sub-hide';
  tabBtn.id = 'smTabBtn';
  tabBtn.textContent = 'Open in tab';

  const maxBtn = sm.head.querySelector('.maxbtn');
  sm.head.insertBefore(pick, maxBtn);
  sm.head.insertBefore(simpleBtn, maxBtn);
  sm.head.insertBefore(tabBtn, maxBtn);

  function pushState() {
    if (!frame || !frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage({ type: 'tb-mute', muted: TB.audio.isMuted() }, '*');
      frame.contentWindow.postMessage({ type: 'tb-sub', sub: document.body.classList.contains('sub') }, '*');
    } catch (e) {}
  }

  function mountFrame() {
    sm.body.innerHTML = '';
    const f = document.createElement('iframe');
    f.id = 'smFrame';
    f.title = 'Seasonal classroom sound meter';
    f.setAttribute('allow', 'microphone; fullscreen; autoplay');
    f.allowFullscreen = true;
    f.onload = pushState;
    f.src = 'meters/' + curPage;
    sm.body.appendChild(f);
    frame = f;
  }

  function updateNoiseBtns() {
    const simpleOn = document.body.classList.contains('noiseon');
    const anyOn = smOpen || simpleOn;
    if ($('noiseBtn')) $('noiseBtn').classList.toggle('on', anyOn);
    if ($('nzOnBtn')) {
      $('nzOnBtn').classList.toggle('on', anyOn);
      $('nzOnBtn').setAttribute('aria-pressed', anyOn);
    }
    if ($('nzOnTxt')) $('nzOnTxt').textContent = anyOn ? 'Noise meter: On' : 'Noise meter';
  }
  TB.updateNoiseBtns = updateNoiseBtns;

  function setSeasonal(on) {
    smOpen = !!on;
    store.set('smon', smOpen ? 1 : 0);
    if (smOpen) {
      store.set('noisemode', 'seasonal');
      if (document.body.classList.contains('noiseon') && TB.setSimpleNoise) TB.setSimpleNoise(false);
      curPage = savedMeterPage();
      pick.value = curPage;
      sm.show(true);
      mountFrame();
    } else {
      if (TB.getMaxEl && TB.getMaxEl() === sm.el) { TB.setMax(null); TB.maxIcons(); }
      sm.show(false);
      sm.body.innerHTML = '';
      frame = null;
    }
    updateNoiseBtns();
  }
  TB.setSeasonalNoise = setSeasonal;

  pick.onchange = () => {
    if (!METER_SET.has(pick.value)) return;
    curPage = pick.value;
    store.set('meterpage', curPage);
    if (smOpen) mountFrame();
  };

  simpleBtn.onclick = () => {
    store.set('noisemode', 'bar');
    setSeasonal(false);
    if (TB.setSimpleNoise) TB.setSimpleNoise(true);
  };

  tabBtn.onclick = () => {
    window.open('meters/' + curPage, '_blank', 'noopener');
  };

  function toggleNoise() {
    if (smOpen) { setSeasonal(false); return; }
    if (document.body.classList.contains('noiseon')) {
      if (TB.setSimpleNoise) TB.setSimpleNoise(false);
      return;
    }
    if (store.get('noisemode', 'seasonal') === 'bar') {
      if (TB.setSimpleNoise) TB.setSimpleNoise(true);
    } else {
      setSeasonal(true);
    }
  }

  if ($('noiseBtn')) $('noiseBtn').onclick = () => { $('moreMenu').classList.remove('show'); toggleNoise(); };
  if ($('nzOnBtn')) $('nzOnBtn').onclick = toggleNoise;
  if ($('nzToSeasonal')) $('nzToSeasonal').onclick = () => {
    $('nzSet').classList.remove('show');
    store.set('noisemode', 'seasonal');
    if (TB.setSimpleNoise) TB.setSimpleNoise(false);
    setSeasonal(true);
  };

  TB.muteHooks.push(pushState);
  TB.subHooks.push(pushState);

  window.addEventListener('message', e => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'tb-meter-page' && METER_SET.has(d.page)) {
      curPage = d.page;
      store.set('meterpage', curPage);
      if (pick.value !== curPage) pick.value = curPage;
    }
  });

  if (store.get('smon', '0') === '1' && store.get('noisemode', 'seasonal') !== 'bar') {
    setSeasonal(true);
  } else {
    updateNoiseBtns();
  }
})();
