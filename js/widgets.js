(function () {
  const TB = window.TB;
  const { $, store, jget, imgStore, openDlg, toast, dayKey } = TB;

  /* ---------- dice ---------- */
  const PIPS = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]]
  };
  const dieSvg = v => '<svg viewBox="0 0 100 100" role="img" aria-label="' + v + '">' + (PIPS[v] || []).map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="9" fill="#1d2433"/>').join('') + '</svg>';
  const diceGet = () => { const v = jget('dice', null); return v && v.n ? v : { n: 2, vals: [] }; };
  const dice = TB.makeFloat('diceCard', 'Dice', 'dicerect', { x: .3, y: .2, w: .4, h: .5 }, () => setDice(false));
  dice.body.innerHTML = '<div class="dice" id="diceBox"></div><div class="dtotal" id="diceTot"></div>' +
    '<div class="plrow"><button class="chip" id="dLess" aria-label="Fewer dice">-</button><span class="plleft" id="dN"></span><button class="chip" id="dMore" aria-label="More dice">+</button><button class="chip main" id="dRoll">Roll</button></div>';

  function dicePaint(vals, rolling) {
    const v = diceGet(); $('diceBox').style.setProperty('--n', v.n); $('diceBox').innerHTML = '';
    for (let i = 0; i < v.n; i++) {
      const d = document.createElement('div'); d.className = 'die' + (rolling ? ' roll' : '');
      d.innerHTML = dieSvg(vals[i] || 1); $('diceBox').appendChild(d);
    }
    $('dN').textContent = v.n + (v.n === 1 ? ' die' : ' dice');
    $('diceTot').textContent = rolling || !vals.length ? '' : (v.n > 1 ? 'Total: ' + vals.slice(0, v.n).reduce((a, b) => a + b, 0) : '');
  }
  let diceT = null;
  function diceRoll() {
    const v = diceGet(), r = () => Array.from({ length: v.n }, () => 1 + Math.floor(Math.random() * 6));
    clearInterval(diceT); $('dRoll').disabled = true;
    let steps = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 10;
    const done = () => { const vals = r(); store.set('dice', JSON.stringify({ n: v.n, vals })); dicePaint(vals, false); $('dRoll').disabled = false; };
    if (!steps) { done(); return; }
    diceT = setInterval(() => { dicePaint(r(), true); TB.audio.diceTick(); if (--steps <= 0) { clearInterval(diceT); done(); } }, 80);
  }
  $('dRoll').onclick = diceRoll;
  $('dLess').onclick = () => { const v = diceGet(); v.n = Math.max(1, v.n - 1); store.set('dice', JSON.stringify(v)); dicePaint(v.vals, false); };
  $('dMore').onclick = () => { const v = diceGet(); v.n = Math.min(6, v.n + 1); store.set('dice', JSON.stringify(v)); dicePaint(v.vals, false); };
  function setDice(on) { dice.show(on); store.set('diceon', on ? 1 : 0); $('diceBtn').textContent = on ? 'Dice: On' : 'Dice'; if (on) dicePaint(diceGet().vals || [], false); }
  $('diceBtn').onclick = () => setDice(dice.el.hidden);
  setDice(store.get('diceon', '0') === '1');

  /* ---------- embed a website (1 and 2) ---------- */
  function embResolve(url) {
    url = String(url || '').trim(); if (url && !/^[a-z]+:/i.test(url)) url = 'https://' + url;
    if (!/^https:\/\/\S+\.\S+/i.test(url)) return null;
    const r = TB.EMB.yt.resolve(url) || TB.EMB.sl.resolve(url);
    return r && r.src ? r : { src: url, tab: url };
  }
  function makeEmbed(n) {
    const sfx = n === 1 ? '' : String(n), btn = n === 1 ? 'embedBtn' : 'embed' + n + 'Btn', name = n === 1 ? 'Embed a website' : 'Embed website ' + n;
    const emb = TB.makeFloat('embedCard' + sfx, n === 1 ? 'Website' : 'Website ' + n, 'embedrect' + sfx, n === 1 ? { x: .52, y: .14, w: .45, h: .62 } : { x: .04, y: .2, w: .45, h: .62 }, () => setEmbed(false));
    emb.el.classList.add('maxreal');   // Fill the screen gives the website the whole screen instead of zooming the card
    const embTab = document.createElement('button'); embTab.className = 'tool'; embTab.textContent = 'Open in tab';
    const embChg = document.createElement('button'); embChg.className = 'tool'; embChg.textContent = 'Change link';
    emb.head.insertBefore(embChg, emb.head.querySelector('.maxbtn')); emb.head.insertBefore(embTab, embChg);
    function embPaint() {
      const url = store.get('embedurl' + sfx, ''), r = embResolve(url);
      embTab.style.display = embChg.style.display = r ? '' : 'none';
      if (!r) {
        emb.body.innerHTML = '<div class="set"><p>Paste a link to show that website here. Some websites do not allow this; then use Open in tab.</p>' +
          '<input type="text" class="embIn" placeholder="https://..." aria-label="Website link"><button class="chip main embGo">Show it</button><p class="embMsg"></p></div>';
        const inp = emb.body.querySelector('.embIn'); inp.value = url;
        const go = () => { const v = inp.value.trim(); if (!embResolve(v)) { emb.body.querySelector('.embMsg').textContent = 'That does not look like a link.'; return; } store.set('embedurl' + sfx, v); embPaint(); };
        emb.body.querySelector('.embGo').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
        return;
      }
      emb.body.innerHTML = ''; const f = document.createElement('iframe'); f.title = n === 1 ? 'Website' : 'Website ' + n; f.src = r.src;
      f.setAttribute('allow', 'autoplay; encrypted-media; fullscreen'); f.allowFullscreen = true; emb.body.appendChild(f);
      embTab.onclick = () => window.open(r.tab, '_blank', 'noopener');
    }
    embChg.onclick = () => { store.del('embedurl' + sfx); embPaint(); };
    function setEmbed(on) { emb.show(on); store.set('embedon' + sfx, on ? 1 : 0); $(btn).textContent = on ? name + ': On' : name; if (on) embPaint(); else emb.body.innerHTML = ''; }
    $(btn).onclick = () => setEmbed(emb.el.hidden);
    setEmbed(store.get('embedon' + sfx, '0') === '1');
  }
  makeEmbed(1); makeEmbed(2);

  /* ---------- picture widgets (stored in IndexedDB so localStorage never fills up) ---------- */
  const imgCards = {};
  function imgList() { const v = jget('imgs', []); return Array.isArray(v) ? v.map(String) : []; }
  async function imgCard(id) {
    const data = await imgStore.get('imgdata_' + id);
    if (!data) return;
    const n = imgList().indexOf(id);
    const w = TB.makeFloat('img_' + id, 'Picture', 'imgrect_' + id, { x: .05 + (n % 5) * .06, y: .12 + (n % 5) * .06, w: .3, h: .4 }, async () => {
      if (!confirm('Remove this picture from the board?')) return;
      if (TB.getMaxEl() === w.el) TB.setMax(null);
      w.el.remove(); delete imgCards[id];
      store.set('imgs', JSON.stringify(imgList().filter(x => x !== id)));
      await imgStore.del('imgdata_' + id);
      store.del('imgrect_' + id);
    });
    w.el.querySelector('.fltx').textContent = 'Remove';
    const im = document.createElement('img'); im.src = data; im.alt = 'Picture'; w.body.appendChild(im);
    w.show(true); imgCards[id] = w;
  }
  $('imgBtn').onclick = () => $('imgFile').click();
  $('imgFile').onchange = e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    const url = URL.createObjectURL(file), im = new Image();
    im.onerror = () => { URL.revokeObjectURL(url); toast('That file did not open as a picture'); };
    im.onload = async () => {
      const png = /png|gif|webp/i.test(file.type), max = png ? 1000 : 1600, k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext('2d'); if (!png) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      const data = png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', .85), id = Date.now().toString(36);
      const ok = await imgStore.set('imgdata_' + id, data);
      if (!ok) { toast('Could not save that picture on this browser.'); return; }
      store.set('imgs', JSON.stringify(imgList().concat(id)));
      imgCard(id);
      toast('Picture added. Drag its top bar to move it or its bottom corner to resize.');
    };
    im.src = url;
  };
  imgList().forEach(imgCard);

  /* ---------- backup and restore (supports IndexedDB images + lightweight daily backup) ---------- */
  async function backupSave(includeMedia) {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('cb_') === 0) data[k] = localStorage.getItem(k);
    }
    const payload = { app: 'techboard', version: 2, saved: new Date().toISOString(), data };
    if (includeMedia) payload.media = await imgStore.getAll();
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'tech-board-backup-' + dayKey(new Date()) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return { settings: Object.keys(data).length, media: payload.media ? Object.keys(payload.media).length : 0 };
  }
  function backupRestore(file) {
    const rd = new FileReader();
    rd.onload = async () => {
      let v = null; try { v = JSON.parse(rd.result); } catch (e) {}
      if (!v || v.app !== 'techboard' || !v.data || typeof v.data !== 'object') { $('bkMsg').textContent = 'That file is not a board backup.'; return; }
      const when = v.saved ? new Date(v.saved).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'an unknown date';
      if (!confirm('Replace everything saved on this board with the backup from ' + when + '?')) return;
      try {
        Object.keys(localStorage).filter(k => k.indexOf('cb_') === 0).forEach(k => localStorage.removeItem(k));
        await imgStore.clearAll();
        for (const k of Object.keys(v.data)) {
          if (k.indexOf('cb_') !== 0) continue;
          const val = String(v.data[k]);
          // Route legacy v1 images straight into IndexedDB so restore never overflows localStorage
          if (k.indexOf('cb_bgimg') === 0 || k.indexOf('cb_imgdata_') === 0) {
            if (val) await imgStore.set(k.slice(3), val);
          } else {
            localStorage.setItem(k, val);
          }
        }
        if (v.media && typeof v.media === 'object') {
          for (const mk of Object.keys(v.media)) {
            if (v.media[mk]) await imgStore.set(mk, String(v.media[mk]));
          }
        }
      } catch (e) { $('bkMsg').textContent = 'This board ran out of room while restoring.'; return; }
      location.reload();
    };
    rd.readAsText(file);
  }
  $('backupBtn').onclick = () => openDlg('Backup and restore', body => {
    body.innerHTML = '<p>Your class lists, seats, layouts, backgrounds, links and settings are saved only on this device. Save a backup file now and then, and keep it in your Google Drive or on a flash drive.</p>' +
      '<div class="r"><label><input type="checkbox" id="bkMedia" checked> Include uploaded background and widget pictures</label></div>' +
      '<div class="r"><button class="tool on" id="bkSave">Save a backup file</button></div>' +
      '<p>To put a backup back, or copy your setup to another computer, open that computer\'s board and pick the file here.</p>' +
      '<div class="r"><button class="tool" id="bkLoad">Restore from a file</button><input type="file" id="bkFile" accept=".json,application/json" hidden></div>' +
      '<p>Back up every day: the first time you tap the board each school day, it saves a quick settings and roster backup to Downloads by itself.</p>' +
      '<div class="r"><button class="tool onoff" id="bkAuto"></button><span id="bkLast"></span></div>' +
      '<p id="bkMsg"></p><p>The file has student names in it. Keep it private, the same way you keep your class lists.</p>';
    const paintAuto = () => {
      const on = store.get('autobk', '0') === '1', last = store.get('lastbackup', '');
      $('bkAuto').textContent = on ? 'Every day: On' : 'Every day: Off'; $('bkAuto').classList.toggle('on', on);
      $('bkLast').textContent = last ? 'Last backup: ' + new Date(last + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No backup yet';
    };
    $('bkAuto').onclick = () => { store.set('autobk', store.get('autobk', '0') === '1' ? 0 : 1); paintAuto(); };
    paintAuto();
    $('bkSave').onclick = async () => {
      store.set('lastbackup', dayKey(new Date()));
      const res = await backupSave($('bkMedia').checked);
      $('bkMsg').textContent = 'Saved ' + res.settings + ' settings' + (res.media ? ' and ' + res.media + ' pictures' : '') + '. Look in your Downloads folder.';
      paintAuto();
    };
    $('bkLoad').onclick = () => $('bkFile').click();
    $('bkFile').onchange = e => { if (e.target.files[0]) backupRestore(e.target.files[0]); e.target.value = ''; };
  });

  // Daily auto-backup (lightweight settings + rosters without multi-MB images)
  document.addEventListener('pointerdown', () => {
    if (store.get('autobk', '0') !== '1' || document.body.classList.contains('sub')) return;
    const today = dayKey(new Date()), wd = new Date().getDay();
    if (wd === 0 || wd === 6 || store.get('lastbackup', '') === today) return;
    store.set('lastbackup', today);
    backupSave(false);
    toast('Daily backup saved to Downloads');
  }, true);
})();
