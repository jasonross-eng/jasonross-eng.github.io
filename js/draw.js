(function () {
  const TB = window.TB;
  const { $ } = TB;

  const cv = $('ink'), cx = cv.getContext('2d');
  const COLORS = ['#e53935', '#ff8f00', '#fdd835', '#1e88e5', '#43a047', '#111111', '#ffffff'];
  let shape = 'pen', color = COLORS[0], marks = [], cur = null, erasing = false;

  const toNorm = (x, y) => [x / Math.max(1, innerWidth), y / Math.max(1, innerHeight)];
  const toPx = pt => [pt[0] * innerWidth, pt[1] * innerHeight];

  function size() {
    const r = window.devicePixelRatio || 1;
    cv.width = innerWidth * r; cv.height = innerHeight * r;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    cx.setTransform(r, 0, 0, r, 0, 0);
    redraw();
  }

  function drawMark(m) {
    cx.save();
    const isHi = m.s === 'hi';
    cx.strokeStyle = m.c;
    cx.fillStyle = m.c;
    cx.lineWidth = isHi ? 26 : 8;
    cx.lineCap = 'round';
    cx.lineJoin = 'round';
    cx.globalAlpha = isHi ? .36 : 1;
    if (!isHi) { cx.shadowColor = 'rgba(0,0,0,.35)'; cx.shadowBlur = 4; }
    const a = toPx(m.p[0]), b = toPx(m.p[m.p.length - 1]);
    cx.beginPath();
    if (m.s === 'pen' || isHi) {
      m.p.forEach((pt, i) => {
        const [x, y] = toPx(pt);
        if (i) cx.lineTo(x, y); else cx.moveTo(x, y);
      });
      cx.stroke();
    } else if (m.s === 'circle') {
      const rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
      cx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      cx.stroke();
    } else if (m.s === 'arrow') {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), len = Math.hypot(b[0] - a[0], b[1] - a[1]), h = Math.min(40, len * .45);
      const bx = b[0] - Math.cos(ang) * h * .6, by = b[1] - Math.sin(ang) * h * .6;
      cx.moveTo(a[0], a[1]); cx.lineTo(bx, by); cx.stroke();
      cx.beginPath(); cx.moveTo(b[0], b[1]);
      cx.lineTo(b[0] - h * Math.cos(ang - .45), b[1] - h * Math.sin(ang - .45));
      cx.lineTo(b[0] - h * Math.cos(ang + .45), b[1] - h * Math.sin(ang + .45));
      cx.closePath(); cx.fill();
    }
    cx.restore();
  }

  function redraw() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    marks.forEach(drawMark);
    if (cur) drawMark(cur);
  }
  function clearInk() { marks = []; cur = null; redraw(); }
  TB.clearInk = clearInk;
  TB.redraw = redraw;

  /* ---------- eraser hit-testing (touch-friendly radius) ---------- */
  function distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    if (!len2) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function hitMark(m, x, y) {
    const tol = m.s === 'hi' ? 28 : 22;
    if (m.s === 'pen' || m.s === 'hi') {
      for (let i = 1; i < m.p.length; i++) {
        const p1 = toPx(m.p[i - 1]), p2 = toPx(m.p[i]);
        if (distToSeg(x, y, p1[0], p1[1], p2[0], p2[1]) <= tol) return true;
      }
      const p0 = toPx(m.p[0]);
      return Math.hypot(x - p0[0], y - p0[1]) <= tol;
    }
    const a = toPx(m.p[0]), b = toPx(m.p[m.p.length - 1]);
    if (m.s === 'arrow') return distToSeg(x, y, a[0], a[1], b[0], b[1]) <= tol + 8;
    if (m.s === 'circle') {
      const cx0 = (a[0] + b[0]) / 2, cy0 = (a[1] + b[1]) / 2;
      const rx = Math.max(1, Math.abs(b[0] - a[0]) / 2), ry = Math.max(1, Math.abs(b[1] - a[1]) / 2);
      const nx = (x - cx0) / rx, ny = (y - cy0) / ry, rad = Math.hypot(nx, ny);
      const scale = Math.max(1, Math.min(rx, ry));
      return Math.abs(rad - 1) * scale <= tol;
    }
    return false;
  }
  function eraseAt(x, y) {
    const before = marks.length;
    marks = marks.filter(m => !hitMark(m, x, y));
    if (marks.length !== before) redraw();
  }

  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    if (shape === 'erase') { erasing = true; eraseAt(e.clientX, e.clientY); return; }
    cur = { s: shape, c: color, p: [toNorm(e.clientX, e.clientY)] };
  });
  cv.addEventListener('pointermove', e => {
    if (erasing) { eraseAt(e.clientX, e.clientY); return; }
    if (!cur) return;
    if (cur.s === 'pen' || cur.s === 'hi') cur.p.push(toNorm(e.clientX, e.clientY));
    else cur.p[1] = toNorm(e.clientX, e.clientY);
    redraw();
  });
  function endStroke() {
    erasing = false;
    if (cur && cur.p.length > 1) marks.push(cur);
    cur = null;
    redraw();
  }
  cv.addEventListener('pointerup', endStroke);
  cv.addEventListener('pointercancel', endStroke);

  COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'dot' + (i ? '' : ' on'); b.style.background = c; b.setAttribute('aria-label', 'Color ' + (i + 1));
    b.onclick = () => {
      color = c;
      document.querySelectorAll('.dot').forEach(d => d.classList.toggle('on', d === b));
      if (shape === 'erase') setShape('pen');
    };
    $('colors').appendChild(b);
  });
  function setShape(s) {
    shape = s;
    document.body.classList.toggle('erasing', s === 'erase');
    document.querySelectorAll('[data-shape]').forEach(x => x.classList.toggle('on', x.dataset.shape === s));
  }
  document.querySelectorAll('[data-shape]').forEach(b => b.onclick = () => setShape(b.dataset.shape));

  function setBlank(m) {
    document.body.classList.toggle('blankw', m === 'w');
    document.body.classList.toggle('blankb', m === 'b');
    $('blankBtn').textContent = m === 'w' ? 'White page' : m === 'b' ? 'Black page' : 'Blank page';
    $('blankBtn').classList.toggle('on', !!m);
  }
  $('blankBtn').onclick = () => { const b = document.body.classList; setBlank(b.contains('blankw') ? 'b' : b.contains('blankb') ? '' : 'w'); };

  function setDraw(on) {
    if (!on) { setBlank(''); erasing = false; document.body.classList.remove('erasing'); }
    else document.body.classList.toggle('erasing', shape === 'erase');
    document.body.classList.toggle('drawing', on);
    $('drawBtn').classList.toggle('on', on);
    $('drawBtn2').classList.toggle('on', on);
  }
  TB.setDraw = setDraw;
  $('drawBtn').onclick = () => setDraw(!document.body.classList.contains('drawing'));
  $('drawBtn2').onclick = () => setDraw(!document.body.classList.contains('drawing'));
  $('doneDraw').onclick = () => setDraw(false);
  $('undo').onclick = () => { marks.pop(); redraw(); };
  $('clear').onclick = clearInk;
  addEventListener('resize', size);
  size();

  /* ---------- keyboard shortcuts ---------- */
  const viewer = $('viewer'), frame = $('frame'), gWall = $('gWall');
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT') return;
    if (e.target.isContentEditable) { if (e.key === 'Escape') TB.clarEdit(false); return; }
    if (e.key === 'Escape' && $('attn').classList.contains('show')) { TB.attnShow(false); return; }
    if (e.key === 'Escape' && $('warn').classList.contains('show')) { TB.warnShow(false); return; }
    if (e.key === 'Escape' && TB.getMaxEl() && !document.body.classList.contains('viewing')) { TB.setMax(null); TB.maxIcons(); return; }
    if (e.key === 'Escape' && $('dlg').classList.contains('show')) { TB.closeDlg(); return; }
    if (e.key === 'Escape' && $('moreMenu').classList.contains('show')) { $('moreMenu').classList.remove('show'); $('moreBtn').classList.remove('on'); return; }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape' && e.target.closest('#pickCard')) { e.target.blur(); return; }
      if (e.key === 'Escape') { TB.cdOpen(false); if ($('todo').classList.contains('editing')) TB.todoEdit(false); }
      if (e.key === 'Enter' && e.target.closest('#todo')) { const k = e.target.closest('#tMust') ? ['must', 'tMust'] : ['may', 'tMay']; TB.todoAdd(k[0], k[1]); }
      return;
    }
    const guideOpen = $('guide').classList.contains('show');
    if (e.key === 'Escape') {
      if (document.body.classList.contains('drawing')) setDraw(false);
      else if ($('kbd').classList.contains('show')) TB.setKbd(false);
      else if (document.body.classList.contains('arranging')) TB.setArrange(false);
      else if ($('cdBox').classList.contains('show')) TB.cdOpen(false);
      else if ($('archive').classList.contains('show')) TB.archClose();
      else if (viewer.classList.contains('over')) TB.backToSteps();
      else if (viewer.classList.contains('show') || guideOpen || $('clarity').classList.contains('show') || $('todo').classList.contains('show') || $('score').classList.contains('show') || $('qrPage').classList.contains('show')) TB.closeSteps();
    }
    if ($('kbd').classList.contains('show')) return;
    if (guideOpen && gWall.classList.contains('editing')) return;
    if (guideOpen && !viewer.classList.contains('show') && ['ArrowRight', 'ArrowLeft', ' '].includes(e.key)) {
      e.preventDefault(); TB.gStep(e.key === 'ArrowLeft' ? -1 : 1); return;
    }
    if (e.key === 'd' || e.key === 'D') setDraw(!document.body.classList.contains('drawing'));
    // Scoped Ctrl+Z / Cmd+Z: only undo ink when Draw mode is active
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && document.body.classList.contains('drawing')) {
      e.preventDefault(); marks.pop(); redraw();
    }
    if (viewer.classList.contains('show') && ['ArrowRight', 'ArrowLeft', ' '].includes(e.key)) {
      e.preventDefault();
      try { frame.contentDocument.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, bubbles: true })); } catch (err) {}
    }
  });
})();
