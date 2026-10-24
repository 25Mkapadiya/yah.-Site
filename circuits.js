// Animated circuit background. Traces are drawn in the logo's style (straight
// runs that branch at 45° and end in round nodes). Each circuit powers on with
// a pulse travelling out from its root, glimmers for a while, then fades out.
// One circuit runs into the logo and out of its network, and the logo lights
// up and dims with it.
(function () {
  var canvas = document.getElementById('circuits');
  var logo = document.querySelector('.logo');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var SPEED = 0.75;        // pulse speed, px per ms
  var FALL = 700;          // fade-out time, ms
  var LOGO_OFF = 0.42;     // logo opacity when its circuit is off
  var SQRT2 = Math.SQRT2;

  var W, H, dpr, G, ox, oy, cols, rows;
  var occ, diag, circuits, logoCircuit, base, glow;
  var running = false;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function key(c, r) { return c + ',' + r; }

  // ---- Grid occupancy ------------------------------------------------------

  function inBounds(c, r) { return c >= -1 && c <= cols && r >= -1 && r <= rows; }

  // A point is free if no other circuit sits on it or next to it.
  function free(c, r, id) {
    if (!inBounds(c, r) || occ.has(key(c, r))) return false;
    for (var dc = -1; dc <= 1; dc++) {
      for (var dr = -1; dr <= 1; dr++) {
        var v = occ.get(key(c + dc, r + dr));
        if (v !== undefined && v !== id) return false;
      }
    }
    return true;
  }

  function diagKey(c, r, dc, dr) { return (2 * c + dc) + ':' + (2 * r + dr); }

  function markRect(x0, y0, x1, y1, tag) {
    var c0 = Math.floor((x0 - ox) / G), c1 = Math.ceil((x1 - ox) / G);
    var r0 = Math.floor((y0 - oy) / G), r1 = Math.ceil((y1 - oy) / G);
    for (var c = c0; c <= c1; c++) for (var r = r0; r <= r1; r++) occ.set(key(c, r), tag);
  }

  function markPolyline(pts, tag) {
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(len / (G / 3)));
      for (var k = 0; k <= n; k++) {
        var x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n;
        var kk = key(Math.round((x - ox) / G), Math.round((y - oy) / G));
        if (!occ.has(kk)) occ.set(kk, tag);
      }
    }
  }

  // ---- Building circuits ---------------------------------------------------

  function px(c) { return ox + c * G; }
  function py(r) { return oy + r * G; }

  // Turn a list of {x, y} into a polyline with cumulative distances from d0.
  function polyline(pts, d0, w) {
    var out = [], d = d0;
    for (var i = 0; i < pts.length; i++) {
      if (i) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      out.push({ x: pts[i].x, y: pts[i].y, d: d });
    }
    return { pts: out, w: w };
  }

  function newCircuit() {
    return {
      lines: [], nodes: [], sparks: [], total: 0,
      state: 'off', t0: 0, next: 0, until: 0, alpha: 0, sweep: 0,
      f1: rand(0.002, 0.006), f2: rand(0.007, 0.017), p1: rand(0, 6.3), p2: rand(0, 6.3),
      dipUntil: 0
    };
  }

  function addNode(circ, x, y, d, r, hollow) {
    circ.nodes.push({ x: x, y: y, d: d, r: r, hollow: hollow });
    circ.total = Math.max(circ.total, d);
  }

  // Try to lay a branch: k diagonal steps then m steps parallel to the trunk.
  function tryBranch(circ, id, c, r, dir, side, k, m, w, dist) {
    var dd = [dir[0] - side * dir[1], dir[1] + side * dir[0]]; // dir rotated 45°
    var cells = [[c, r]], cc = c, rr = r, i;
    for (i = 0; i < k; i++) {
      if (diag.has(diagKey(cc, rr, dd[0], dd[1]))) return null;
      cc += dd[0]; rr += dd[1];
      if (!free(cc, rr, id)) return null;
      cells.push([cc, rr]);
    }
    for (i = 0; i < m; i++) {
      cc += dir[0]; rr += dir[1];
      if (!free(cc, rr, id)) return null;
      cells.push([cc, rr]);
    }
    // Commit.
    var pts = [];
    for (i = 0; i < cells.length; i++) {
      pts.push({ x: px(cells[i][0]), y: py(cells[i][1]) });
      if (i) occ.set(key(cells[i][0], cells[i][1]), id);
      if (i && i <= k) diag.add(diagKey(cells[i - 1][0], cells[i - 1][1], dd[0], dd[1]));
    }
    var pl = polyline(pts, dist, w);
    circ.lines.push(pl);
    circ.sparks.push({ x: pts[0].x, y: pts[0].y, d: dist });
    var end = pl.pts[pl.pts.length - 1];
    addNode(circ, end.x, end.y, end.d, w > 1.3 ? 3 : 2.4, Math.random() < 0.35);
    return { cells: cells, pl: pl, dd: dd };
  }

  function makeGridCircuit(id) {
    var DIRS = [[1, 0], [-1, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var attempt = 0; attempt < 6; attempt++) {
      var c0 = randInt(-1, cols), r0 = randInt(-1, rows);
      if (!free(c0, r0, id)) continue;
      var dir = DIRS[randInt(0, DIRS.length - 1)];
      var len = randInt(5, 13), cells = [[c0, r0]];
      for (var i = 1; i <= len; i++) {
        var c = c0 + dir[0] * i, r = r0 + dir[1] * i;
        if (!free(c, r, id)) break;
        cells.push([c, r]);
      }
      if (cells.length < 5) continue;

      var circ = newCircuit(), pts = [];
      for (i = 0; i < cells.length; i++) {
        occ.set(key(cells[i][0], cells[i][1]), id);
        pts.push({ x: px(cells[i][0]), y: py(cells[i][1]) });
      }
      var trunk = polyline(pts, 0, 1.8);
      circ.lines.push(trunk);
      addNode(circ, pts[0].x, pts[0].y, 0, 4, false);
      var tEnd = trunk.pts[trunk.pts.length - 1];
      addNode(circ, tEnd.x, tEnd.y, tEnd.d, 3.4, true);

      // Branches fan out from the trunk like the logo's network.
      for (i = 1; i < cells.length - 2; i++) {
        if (Math.random() > 0.6) continue;
        var side = Math.random() < 0.5 ? -1 : 1;
        var b = tryBranch(circ, id, cells[i][0], cells[i][1], dir, side,
          randInt(1, 3), randInt(2, 6), 1.4, trunk.pts[i].d);
        if (b && Math.random() < 0.5) {
          var j = b.cells.length - 1 - randInt(1, Math.max(1, b.cells.length - 3));
          if (j > 0) tryBranch(circ, id, b.cells[j][0], b.cells[j][1], dir, side,
            randInt(1, 2), randInt(1, 3), 1, b.pl.pts[j].d);
        }
      }
      return circ;
    }
    return null;
  }

  // The circuit that feeds the logo: in from the left edge, out of the logo's
  // network nodes to the right edge.
  function makeLogoCircuit() {
    if (!logo) return null;
    var g = logo.querySelector('g'), text = logo.querySelector('text');
    var m = g.getScreenCTM();
    if (!m) return null;
    var sx = window.scrollX, sy = window.scrollY;
    function P(x, y) { return { x: m.a * x + m.c * y + m.e + sx, y: m.b * x + m.d * y + m.f + sy }; }
    var s = m.a;
    function snapRow(y) { return oy + Math.round((y - oy) / G) * G; }
    function snapColAfter(x) { return ox + Math.ceil((x - ox) / G) * G; }

    var circ = newCircuit();
    circ.isLogo = true;

    // Inbound trace, ending just left of the "y".
    var bb = text.getBBox();
    var end = P(bb.x, 150);
    var xe = end.x - 12 * s, y0 = end.y;
    var y1 = snapRow(y0 + 2 * G), jog = y1 - y0;
    var inPts = xe - jog - 2 * G > 0
      ? [{ x: -20, y: y1 }, { x: xe - jog - G, y: y1 }, { x: xe - G, y: y0 }, { x: xe, y: y0 }]
      : [{ x: -20, y: y0 }, { x: xe, y: y0 }];
    var inLine = polyline(inPts, 0, 1.8);
    circ.lines.push(inLine);
    var inLen = inLine.pts[inLine.pts.length - 1].d;
    addNode(circ, xe + 3.4, y0, inLen, 3.4, true);
    circ.logoAt = inLen;

    // Outbound traces from three of the logo's end nodes.
    var outs = [
      { t: [252, 96], r: 5, off: -3, side: -1 },
      { t: [279, 162], r: 6, off: 0, side: 0 },
      { t: [285, 210], r: 4, off: 3, side: 1 }
    ];
    var dStart = inLen + 60;
    outs.forEach(function (o) {
      var a = P(o.t[0] + o.r, o.t[1]);
      var xStub = a.x + 10 * s, yt = snapRow(a.y + o.off * G), dy = Math.abs(yt - a.y);
      var xRun = xStub + dy;
      var pts = [a, { x: xStub, y: a.y }, { x: xRun, y: yt }, { x: W + 20, y: yt }];
      var pl = polyline(pts, dStart, o.side === 0 ? 1.8 : 1.5);
      circ.lines.push(pl);
      markPolyline(pts, 'L');

      // A few side branches along the run, on grid columns.
      var runD = pl.pts[2].d;
      for (var x = snapColAfter(xRun + G); x < W - 3 * G; x += G * randInt(3, 6)) {
        if (Math.random() < 0.35) continue;
        var side = o.side || (Math.random() < 0.5 ? -1 : 1);
        var k = randInt(1, 2), mm = randInt(2, 4);
        var bp = [{ x: x, y: yt }, { x: x + k * G, y: yt + side * k * G }, { x: x + (k + mm) * G, y: yt + side * k * G }];
        var bl = polyline(bp, runD + (x - xRun), 1.2);
        circ.lines.push(bl);
        circ.sparks.push({ x: x, y: yt, d: bl.pts[0].d });
        markPolyline(bp, 'L');
        var be = bl.pts[2];
        addNode(circ, be.x, be.y, be.d, 2.6, Math.random() < 0.4);
      }
      circ.total = Math.max(circ.total, pl.pts[pl.pts.length - 1].d);
    });
    markPolyline(inPts, 'L');
    return circ;
  }

  // ---- Drawing -------------------------------------------------------------

  function makeGlowSprite() {
    var c = document.createElement('canvas'), n = 64;
    c.width = c.height = n;
    var g = c.getContext('2d'), grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(200,220,245,0.55)');
    grd.addColorStop(1, 'rgba(120,170,235,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, n, n);
    return c;
  }

  function tracePath(target, pl, sweep, front) {
    var p = pl.pts;
    if (sweep <= p[0].d) return false;
    target.moveTo(p[0].x, p[0].y);
    for (var i = 1; i < p.length; i++) {
      if (sweep >= p[i].d) { target.lineTo(p[i].x, p[i].y); continue; }
      var f = (sweep - p[i - 1].d) / (p[i].d - p[i - 1].d);
      var x = p[i - 1].x + (p[i].x - p[i - 1].x) * f, y = p[i - 1].y + (p[i].y - p[i - 1].y) * f;
      target.lineTo(x, y);
      if (front) front.push(x, y);
      return true;
    }
    return true;
  }

  function drawNodeShape(target, n) {
    target.beginPath();
    target.arc(n.x, n.y, n.r, 0, Math.PI * 2);
  }

  function renderBase() {
    base = document.createElement('canvas');
    base.width = Math.round(W * dpr);
    base.height = Math.round(H * dpr);
    var b = base.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.lineCap = 'round';
    b.lineJoin = 'round';
    circuits.forEach(function (c) {
      var a = c.isLogo ? 0.1 : 0.06;
      b.strokeStyle = 'rgba(255,255,255,' + a + ')';
      c.lines.forEach(function (pl) {
        b.beginPath();
        tracePath(b, pl, Infinity);
        b.lineWidth = pl.w;
        b.stroke();
      });
      c.nodes.forEach(function (n) {
        drawNodeShape(b, n);
        if (n.hollow) { b.lineWidth = 1.4; b.stroke(); }
        else { b.fillStyle = 'rgba(255,255,255,' + (a + 0.03) + ')'; b.fill(); }
      });
    });
  }

  function drawLit(c, now) {
    var A = c.alpha, S = c.sweep, front = [];
    var core = 'rgba(255,255,255,' + (0.72 * A) + ')';
    c.lines.forEach(function (pl) {
      var path = new Path2D();
      if (!tracePath(path, pl, S, c.state === 'rise' ? front : null)) return;
      ctx.lineWidth = pl.w + 8; ctx.strokeStyle = 'rgba(110,165,235,' + (0.08 * A) + ')'; ctx.stroke(path);
      ctx.lineWidth = pl.w + 3; ctx.strokeStyle = 'rgba(185,208,238,' + (0.2 * A) + ')'; ctx.stroke(path);
      ctx.lineWidth = pl.w;     ctx.strokeStyle = core; ctx.stroke(path);
    });

    // Junction hot spots and nodes.
    c.sparks.forEach(function (s) {
      if (S < s.d) return;
      ctx.globalAlpha = 0.35 * A;
      ctx.drawImage(glow, s.x - 9, s.y - 9, 18, 18);
    });
    c.nodes.forEach(function (n) {
      if (S < n.d) return;
      var gsz = n.r * 9;
      ctx.globalAlpha = 0.45 * A;
      ctx.drawImage(glow, n.x - gsz / 2, n.y - gsz / 2, gsz, gsz);
      ctx.globalAlpha = 1;
      drawNodeShape(ctx, n);
      if (n.hollow) { ctx.lineWidth = 1.6; ctx.strokeStyle = core; ctx.stroke(); }
      else { ctx.fillStyle = core; ctx.fill(); }
    });

    // Bright spark at the front of a travelling pulse.
    ctx.globalAlpha = A;
    for (var i = 0; i < front.length; i += 2) ctx.drawImage(glow, front[i] - 12, front[i + 1] - 12, 24, 24);
    ctx.globalAlpha = 1;
  }

  // ---- Timing --------------------------------------------------------------

  function schedule(c, now, first) {
    if (c.isLogo) c.next = now + (first ? 400 : rand(1200, 2600));
    else c.next = now + (first ? rand(0, 9000) : rand(3500, 11000));
  }

  function glimmer(c, now) {
    if (now < c.dipUntil) return 0.55;
    if (Math.random() < 0.003) c.dipUntil = now + rand(40, 110);
    return 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(now * c.f1 + c.p1)) * (0.6 + 0.4 * Math.sin(now * c.f2 + c.p2));
  }

  function update(c, now) {
    if (c.state === 'off') {
      c.alpha = 0;
      if (now >= c.next) { c.state = 'rise'; c.t0 = now; }
      else return;
    }
    if (c.state === 'rise') {
      c.sweep = (now - c.t0) * SPEED;
      if (c.sweep >= c.total) {
        c.state = 'on'; c.sweep = Infinity;
        c.until = now + (c.isLogo ? rand(2800, 4500) : rand(1200, 3200));
      }
      c.alpha = glimmer(c, now);
    } else if (c.state === 'on') {
      c.alpha = glimmer(c, now);
      if (now >= c.until) { c.state = 'fall'; c.t0 = now; }
    } else if (c.state === 'fall') {
      var f = 1 - (now - c.t0) / FALL;
      if (f <= 0) { c.state = 'off'; c.alpha = 0; schedule(c, now); return; }
      c.alpha = f * f * glimmer(c, now);
    }
  }

  function updateLogo(c, now) {
    if (!logo || !c) return;
    var lit = c.state === 'on' || c.state === 'fall' || (c.state === 'rise' && c.sweep >= c.logoAt);
    logo.style.opacity = lit ? (LOGO_OFF + (1 - LOGO_OFF) * Math.min(1, c.alpha * 1.1)).toFixed(3) : LOGO_OFF;
    logo.classList.toggle('on', lit && c.state !== 'fall');
  }

  function frame(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (var i = 0; i < circuits.length; i++) {
      var c = circuits[i];
      update(c, now);
      if (c.alpha > 0.01) drawLit(c, now);
    }
    ctx.globalCompositeOperation = 'source-over';
    updateLogo(logoCircuit, now);
    if (running) requestAnimationFrame(frame);
  }

  // ---- Setup ---------------------------------------------------------------

  function build() {
    W = document.documentElement.clientWidth;
    H = Math.max(window.innerHeight, document.documentElement.scrollHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    G = W < 600 ? 22 : 28;
    ox = (W % G) / 2; oy = (H % G) / 2;
    cols = Math.floor((W - ox) / G); rows = Math.floor((H - oy) / G);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    occ = new Map(); diag = new Set(); circuits = [];
    glow = glow || makeGlowSprite();

    // Keep the tagline and form clear; leave room around the logo.
    var tag = document.querySelector('.tagline').getBoundingClientRect();
    var stat = document.getElementById('status').getBoundingClientRect();
    var form = document.getElementById('signup').getBoundingClientRect();
    var sx = window.scrollX, sy = window.scrollY;
    var left = Math.min(tag.left, form.left), right = Math.max(tag.right, form.right);
    markRect(left - G + sx, tag.top - G / 2 + sy, right + G + sx, stat.bottom + G / 2 + sy, 'ui');
    if (logo) {
      var lr = logo.getBoundingClientRect();
      markRect(lr.left + sx, lr.top + sy, lr.right + sx, lr.bottom + sy, 'logo');
    }

    logoCircuit = makeLogoCircuit();
    if (logoCircuit) circuits.push(logoCircuit);

    var target = Math.round((W * H) / (G * G * 22)), tries = 0;
    while (circuits.length < target && tries++ < target * 6) {
      var c = makeGridCircuit('c' + tries);
      if (c) circuits.push(c);
    }
    renderBase();

    var now = performance.now();
    circuits.forEach(function (c) { schedule(c, now, true); });

    if (reduceMotion) {
      // One still frame with some circuits lit.
      circuits.forEach(function (c) {
        if (c.isLogo || Math.random() < 0.35) { c.state = 'on'; c.sweep = Infinity; c.until = Infinity; }
      });
      running = false;
      frame(now);
      if (logo) { logo.style.opacity = 1; logo.classList.add('on'); }
    } else if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  var lastW = 0, lastH = 0, resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var w = document.documentElement.clientWidth, h = window.innerHeight;
      // Ignore small height changes from mobile browser toolbars.
      if (w === lastW && Math.abs(h - lastH) < 120) return;
      lastW = w; lastH = h;
      build();
    }, 200);
  }

  function start() {
    lastW = document.documentElement.clientWidth; lastH = window.innerHeight;
    build();
    window.addEventListener('resize', onResize);
  }

  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(start);
})();
