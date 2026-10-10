/* ============================================================
   JEAL' Studio 3D — "PATRULLA 3D"
   Juego 8-bit ultraliviano: un policía que salta y dispara.
   - Pixel-art dibujado por canvas (sin imágenes => anda OFFLINE).
   - Franja fina horizontal, movimiento estilo Metal Slug.
   - Ranking: local (siempre) + mundial (si window.JEAL_LB_URL existe).
   Todo vanilla JS, sin dependencias.
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("game");
  if (!root) return;

  var canvas = document.getElementById("game-canvas");
  var ctx = canvas.getContext("2d", { alpha: false });
  var elScore = document.getElementById("game-score");
  var elBest = document.getElementById("game-best");
  var elLives = document.getElementById("game-lives");
  var overlay = document.getElementById("game-overlay");
  var ovTitle = document.getElementById("game-ov-title");
  var ovText = document.getElementById("game-ov-text");
  var ovForm = document.getElementById("game-ov-form");
  var ovName = document.getElementById("game-name");
  var btnStart = document.getElementById("game-start");
  var btnSave = document.getElementById("game-save");
  var btnMute = document.getElementById("game-mute");
  var btnJump = document.getElementById("game-bjump");
  var btnFire = document.getElementById("game-bfire");
  var boardEl = document.getElementById("game-board");
  var boardScope = document.getElementById("game-board-scope");
  var elClaim = document.getElementById("game-claim");
  var btnWeek = document.getElementById("rank-week");
  var btnAll = document.getElementById("rank-all");

  // ---------- Resolución lógica (pixel-art) ----------
  var LH = 110;              // alto lógico (franja fina)
  var LW = 320;             // ancho lógico (se recalcula según el contenedor)
  var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  var off = document.createElement("canvas"); // buffer lógico
  var octx = off.getContext("2d", { alpha: false });

  var GROUND = LH - 18;     // y del suelo
  var scaleOut = 1;

  function resize() {
    var r = canvas.getBoundingClientRect();
    var cssW = Math.max(240, r.width), cssH = Math.max(90, r.height);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    // ancho lógico proporcional al alto fijo
    LW = Math.round(LH * (cssW / cssH));
    off.width = LW; off.height = LH;
    scaleOut = canvas.height / LH;
    ctx.imageSmoothingEnabled = false;
    octx.imageSmoothingEnabled = false;
    GROUND = LH - 18;
    if (state === "menu" || state === "over") drawFrame();
  }

  // ---------- Paleta 8-bit ----------
  var COL = {
    sky1: "#1a1030", sky2: "#2a1550", sky3: "#3a1d63",
    star: "#b98bff", moon: "#e7d7ff",
    bld: "#140a26", bld2: "#1d0f38", win: "#9b5bff",
    ground: "#0c0618", grass: "#5a2aa0", grassDk: "#3b1a6e",
    copSkin: "#f0c090", copBlue: "#2b4fd6", copBlueDk: "#1b2f9a",
    copCap: "#101a4a", copBadge: "#ffd34d", copBelt: "#0b1030",
    gun: "#2a2a35", bullet: "#ffe066", bulletHot: "#fff6c0",
    e1: "#ff4d6d", e1dk: "#b01a3a", e2: "#43e06a", e2dk: "#1f8a3c",
    eEye: "#120018", hit: "#ffffff",
    hyd: "#ff3b3b", hydDk: "#a81414", hydHi: "#ff7a7a", hydCap: "#ffd34d",
    shield: "#3fd0ff", shieldHi: "#bfefff",
    pickW: "#ff9a3c", pickWHi: "#ffc27a", pickWDk: "#a85a12",
    boss: "#b14dff", bossDk: "#5f1aa6", bossHi: "#d9a6ff", hpGood: "#43e06a",
    heart: "#ff5a7a", heartDk: "#c01e44", heartHi: "#ffb3c4",
    text: "#f3eefb", shadow: "#00000055"
  };

  // ---------- Estado ----------
  var state = "menu"; // menu | playing | over
  var player, bullets, enemies, parts, clouds, hydrants, pickups;
  var score, best, lives, dist, speed, spawnT, spawnEvery, invuln, muzzle, shakeT, hydT, hydEvery;
  var weapon, shield, pickT, pickEvery, boss, nextBossScore, bossesKilled, bannerT, bannerTxt, heartT, heartEvery;
  var keys = {};
  var last = 0, acc = 0;
  var STEP = 1 / 60;
  var MAX_LIVES = 5;

  // Armas que se juntan con power-ups (y se pierden al perder una vida).
  var WEAPONS = [
    { shots: 1, spread: 0, cool: 0.16, pierce: 0, name: "Pistola" },
    { shots: 2, spread: 3, cool: 0.14, pierce: 0, name: "Doble" },
    { shots: 3, spread: 4, cool: 0.12, pierce: 0, name: "Triple" },
    { shots: 3, spread: 4, cool: 0.10, pierce: 1, name: "Perforante" }
  ];

  best = parseInt(localStorage.getItem("jeal_best") || "0", 10) || 0;
  if (elBest) elBest.textContent = best;

  function reset() {
    player = { x: 44, y: GROUND - 18, w: 12, h: 18, vy: 0, onGround: true, face: 1, walk: 0, cool: 0 };
    bullets = []; enemies = []; parts = []; hydrants = []; pickups = [];
    clouds = [];
    score = 0; dist = 0; speed = 70; spawnT = 0; spawnEvery = 1.25;
    hydT = 0; hydEvery = 3.2;
    weapon = 0; shield = false; pickT = 0; pickEvery = 10;
    boss = null; nextBossScore = 900; bossesKilled = 0; bannerT = 0; bannerTxt = "";
    heartT = 0; heartEvery = 18;
    lives = 3; invuln = 0; muzzle = 0; shakeT = 0;
  }

  // ---------- Input ----------
  function jump() {
    if (state !== "playing") return;
    if (player.onGround) { player.vy = -168; player.onGround = false; sfx("jump"); }
  }
  function fire() {
    if (state !== "playing") return;
    if (player.cool > 0) return;
    var w = WEAPONS[weapon];
    player.cool = w.cool;
    var bx = player.x + player.w, by = player.y + 6;
    for (var s = 0; s < w.shots; s++) {
      var off2 = w.shots > 1 ? (s - (w.shots - 1) / 2) * w.spread : 0;
      bullets.push({ x: bx, y: by + off2, vx: 300, life: 1.2, pierce: w.pierce });
    }
    muzzle = 0.06; sfx("shoot");
  }
  function down(e) {
    var k = e.key;
    if (k === " " || k === "ArrowUp" || k === "w" || k === "W") { jump(); e.preventDefault(); }
    else if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = true;
    else if (k === "ArrowRight" || k === "d" || k === "D") keys.right = true;
    else if (k === "x" || k === "X" || k === "j" || k === "J" || k === "Enter") { fire(); e.preventDefault(); }
  }
  function up(e) {
    var k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = false;
    else if (k === "ArrowRight" || k === "d" || k === "D") keys.right = false;
  }
  window.addEventListener("keydown", function (e) {
    // sólo capturar teclas de juego cuando el juego está visible/activo
    if (state === "playing" || isInView()) down(e);
  });
  window.addEventListener("keyup", up);

  // botones táctiles / click
  function bind(el, fn) {
    if (!el) return;
    el.addEventListener("touchstart", function (e) { e.preventDefault(); fn(); }, { passive: false });
    el.addEventListener("mousedown", function (e) { e.preventDefault(); fn(); });
  }
  bind(btnJump, jump);
  bind(btnFire, fire);
  canvas.addEventListener("pointerdown", function () { if (state === "playing") fire(); });

  function isInView() {
    var r = root.getBoundingClientRect();
    return r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15;
  }

  // ---------- Audio 8-bit mínimo (muteable) ----------
  var AC = null, muted = localStorage.getItem("jeal_mute") === "1";
  function actx() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; }
  function sfx(type) {
    if (muted) return; var a = actx(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.connect(g); g.connect(a.destination);
    if (type === "jump") { o.type = "square"; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(680, t + 0.12); g.gain.setValueAtTime(0.05, t); }
    else if (type === "shoot") { o.type = "square"; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.09); g.gain.setValueAtTime(0.04, t); }
    else if (type === "kill") { o.type = "square"; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(500, t + 0.1); g.gain.setValueAtTime(0.05, t); }
    else if (type === "hurt") { o.type = "sawtooth"; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25); g.gain.setValueAtTime(0.07, t); }
    else if (type === "power") { o.type = "square"; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(1040, t + 0.14); g.gain.setValueAtTime(0.05, t); }
    else if (type === "boss") { o.type = "sawtooth"; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.22); g.gain.setValueAtTime(0.07, t); }
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.start(t); o.stop(t + 0.28);
  }
  function setMute(m) {
    muted = m; localStorage.setItem("jeal_mute", m ? "1" : "0");
    if (btnMute) btnMute.textContent = m ? "🔇" : "🔊";
  }
  if (btnMute) { btnMute.textContent = muted ? "🔇" : "🔊"; btnMute.addEventListener("click", function () { setMute(!muted); }); }

  // ---------- Lógica ----------
  function spawnEnemy() {
    var flyer = Math.random() < Math.min(0.35, 0.1 + score / 4000);
    if (flyer) {
      enemies.push({ x: LW + 10, y: GROUND - 46 - Math.random() * 10, w: 12, h: 10, vx: -(speed + 30), type: 2, t: Math.random() * 6, dead: 0, hit: 0, base: 0 });
      enemies[enemies.length - 1].base = enemies[enemies.length - 1].y;
    } else {
      enemies.push({ x: LW + 10, y: GROUND - 12, w: 12, h: 12, vx: -(speed + 10), type: 1, t: 0, dead: 0, hit: 0 });
    }
  }

  // ¿hay lugar libre cerca del borde derecho? (para no spawnear obstáculos imposibles encimados)
  function rightClear(margin) {
    for (var i = 0; i < hydrants.length; i++) if (hydrants[i].x > LW - margin) return false;
    for (var j = 0; j < enemies.length; j++) if (!enemies[j].dead && enemies[j].type === 1 && enemies[j].x > LW - margin) return false;
    return true;
  }

  // Hidrante rojo: obstáculo en el piso. BLOQUEA las balas (no se puede pasar disparando) => hay que SALTAR.
  function spawnHydrant() {
    if (!rightClear(70)) return;      // dejá aire entre obstáculos para que sea saltable
    hydrants.push({ x: LW + 12, y: GROUND - 16, w: 12, h: 16 });
  }

  // Power-up flotante: mejora de arma o escudo. Se juntan tocándolos.
  function spawnPickup() {
    var opts = [];
    if (weapon < WEAPONS.length - 1) { opts.push("weapon"); opts.push("weapon"); }
    if (!shield) opts.push("shield");
    if (!opts.length) return;         // ya tenés todo al máximo
    var type = opts[(Math.random() * opts.length) | 0];
    pickups.push({ x: LW + 12, y: GROUND - 30, w: 11, h: 11, type: type, t: Math.random() * 6 });
  }

  // Jefe: aparece cada cierto puntaje, aguanta varios tiros y suelta un premio al caer.
  function spawnBoss() {
    var hp = 12 + bossesKilled * 5;
    boss = { x: LW + 24, y: GROUND - 30, by: GROUND - 30, w: 26, h: 28, hp: hp, maxhp: hp, t: 0, hit: 0, phase: "enter" };
    bannerT = 1.6; bannerTxt = "¡¡  JEFE  !!"; sfx("boss");
  }

  // Corazón: cada tanto, para recuperar una vida (solo si te falta alguna).
  function spawnHeart() {
    if (lives >= MAX_LIVES) return;
    pickups.push({ x: LW + 12, y: GROUND - 32, w: 11, h: 11, type: "heart", t: Math.random() * 6 });
  }

  function burst(x, y, c, n) {
    for (var i = 0; i < n; i++) parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.7) * 120, life: 0.4 + Math.random() * 0.3, c: c });
  }

  function hurt() {
    if (invuln > 0) return;
    if (shield) { shield = false; invuln = 1.0; shakeT = 0.2; sfx("hurt"); burst(player.x + 6, player.y + 8, COL.shield, 14); bannerT = 0.9; bannerTxt = "ESCUDO ROTO"; return; }
    lives--; invuln = 1.2; shakeT = 0.35; sfx("hurt");
    weapon = 0;                                   // se pierde la mejora de arma al perder una vida
    burst(player.x + 6, player.y + 8, COL.e1, 10);
    if (lives <= 0) gameOver();
  }

  function update(dt) {
    dist += speed * dt;
    score += dt * (6 + speed * 0.05);
    speed = 70 + Math.min(150, dist * 0.02);
    spawnEvery = Math.max(0.45, 1.25 - dist * 0.00008);
    hydEvery = Math.max(1.8, 3.2 - dist * 0.00012);
    if (bannerT > 0) bannerT -= dt;

    // jugador
    var mv = 0; if (keys.left) mv -= 1; if (keys.right) mv += 1;
    player.x += mv * 78 * dt; if (mv) player.face = mv;
    player.x = Math.max(8, Math.min(LW * 0.55, player.x));
    player.vy += 560 * dt; player.y += player.vy * dt;
    if (player.y >= GROUND - player.h) { player.y = GROUND - player.h; player.vy = 0; player.onGround = true; }
    if (player.cool > 0) player.cool -= dt;
    if (invuln > 0) invuln -= dt;
    if (muzzle > 0) muzzle -= dt;
    if (shakeT > 0) shakeT -= dt;
    if (player.onGround && mv) player.walk += dt * 10; else player.walk = 0;

    // balas
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i]; b.x += b.vx * dt; b.life -= dt;
      if (b.x > LW + 6 || b.life <= 0) bullets.splice(i, 1);
    }

    // HIDRANTES (obstáculos rojos que BLOQUEAN las balas => obligan a saltar)
    hydT += dt;
    if (hydT >= hydEvery && !boss) { hydT = 0; spawnHydrant(); }
    for (var hh = hydrants.length - 1; hh >= 0; hh--) {
      var hy = hydrants[hh];
      hy.x -= speed * dt;
      if (hy.x < -20) { hydrants.splice(hh, 1); continue; }
      // las balas NO lo atraviesan: se absorben (no se puede ganar solo disparando)
      for (var hb = bullets.length - 1; hb >= 0; hb--) {
        var bh = bullets[hb];
        if (bh.x + 4 > hy.x && bh.x < hy.x + hy.w && bh.y > hy.y - 2 && bh.y < hy.y + hy.h) {
          bullets.splice(hb, 1);
          parts.push({ x: hy.x, y: bh.y, vx: -(50 + Math.random() * 50), vy: -(20 + Math.random() * 40), life: 0.22, c: COL.bulletHot });
        }
      }
      // si lo tocás (no saltaste) perdés una vida
      if (hy.x < player.x + player.w - 2 && hy.x + hy.w > player.x + 2 &&
          hy.y < player.y + player.h - 1 && hy.y + hy.h > player.y + 1) {
        hurt();
      }
    }

    // enemigos
    spawnT += dt;
    if (spawnT >= spawnEvery && !boss) { spawnT = 0; spawnEnemy(); if (Math.random() < 0.18 && dist > 400) spawnEnemy(); }
    for (var j = enemies.length - 1; j >= 0; j--) {
      var e = enemies[j];
      if (e.hit > 0) e.hit -= dt;
      if (e.dead) { e.deadT += dt; if (e.deadT > 0.25) enemies.splice(j, 1); continue; }
      e.x += e.vx * dt;
      if (e.type === 2) { e.t += dt * 4; e.y = e.base + Math.sin(e.t) * 7; }
      if (e.x < -16) { enemies.splice(j, 1); continue; }
      // colisión bala-enemigo
      for (var k = bullets.length - 1; k >= 0; k--) {
        var bu = bullets[k];
        if (bu.x > e.x && bu.x < e.x + e.w && bu.y > e.y - 2 && bu.y < e.y + e.h + 2) {
          if (!bu.pierce) bullets.splice(k, 1);
          e.dead = 1; e.deadT = 0; e.vx *= 0.3;
          score += 25; sfx("kill");
          burst(e.x + e.w / 2, e.y + e.h / 2, e.type === 2 ? COL.e2 : COL.e1, 8);
          break;
        }
      }
      if (e.dead) continue;
      // colisión enemigo-jugador
      if (e.x < player.x + player.w - 2 && e.x + e.w > player.x + 2 &&
          e.y < player.y + player.h - 1 && e.y + e.h > player.y + 1) {
        hurt(); e.dead = 1; e.deadT = 0;
        burst(e.x + e.w / 2, e.y + e.h / 2, COL.e1, 6);
      }
    }

    // POWER-UPS (escudo y mejoras de arma; se juntan tocándolos)
    pickT += dt;
    if (pickT >= pickEvery) { pickT = 0; spawnPickup(); }
    heartT += dt;
    if (heartT >= heartEvery) { heartT = 0; spawnHeart(); }
    for (var pk = pickups.length - 1; pk >= 0; pk--) {
      var it = pickups[pk]; it.t += dt * 3; it.x -= speed * dt;
      var iy = it.y + Math.sin(it.t) * 3;
      if (it.x < -16) { pickups.splice(pk, 1); continue; }
      if (it.x < player.x + player.w && it.x + it.w > player.x && iy < player.y + player.h && iy + it.h > player.y) {
        pickups.splice(pk, 1); sfx("power");
        if (it.type === "weapon") { weapon = Math.min(WEAPONS.length - 1, weapon + 1); bannerT = 1.2; bannerTxt = "ARMA: " + WEAPONS[weapon].name.toUpperCase(); burst(it.x + 5, iy + 5, COL.pickW, 10); }
        else if (it.type === "heart") { lives = Math.min(MAX_LIVES, lives + 1); bannerT = 1.2; bannerTxt = "¡+1 VIDA!"; burst(it.x + 5, iy + 5, COL.heart, 12); }
        else { shield = true; bannerT = 1.2; bannerTxt = "¡ESCUDO!"; burst(it.x + 5, iy + 5, COL.shield, 10); }
      }
    }

    // JEFE (aparece cada cierto puntaje)
    if (!boss && score >= nextBossScore) spawnBoss();
    if (boss) {
      boss.t += dt; if (boss.hit > 0) boss.hit -= dt;
      if (boss.phase === "enter") {
        boss.x -= 52 * dt;
        if (boss.x <= LW * 0.6) { boss.x = LW * 0.6; boss.phase = "fight"; }
      } else {
        boss.y = boss.by + Math.sin(boss.t * 1.6) * 6;
        boss.x += Math.sin(boss.t * 0.8) * 22 * dt;
        if (boss.x > LW * 0.66) boss.x = LW * 0.66;
        if (boss.x < LW * 0.5) boss.x = LW * 0.5;
      }
      for (var bk = bullets.length - 1; bk >= 0; bk--) {
        var bo = bullets[bk];
        if (bo.x > boss.x && bo.x < boss.x + boss.w && bo.y > boss.y && bo.y < boss.y + boss.h) {
          if (!bo.pierce) bullets.splice(bk, 1);
          boss.hp--; boss.hit = 0.07; score += 5;
          burst(bo.x, bo.y, COL.boss, 3);
          if (boss.hp <= 0) {
            bossesKilled++; score += 300; sfx("kill");
            burst(boss.x + boss.w / 2, boss.y + boss.h / 2, COL.boss, 26);
            pickups.push({ x: boss.x, y: GROUND - 30, w: 11, h: 11, type: (weapon < WEAPONS.length - 1 ? "weapon" : "shield"), t: 0 });
            nextBossScore += 1100 + bossesKilled * 500;
            bannerT = 1.8; bannerTxt = "¡JEFE DERROTADO!";
            boss = null; break;
          }
        }
      }
      if (boss && invuln <= 0 && boss.x < player.x + player.w - 2 && boss.x + boss.w > player.x + 2 &&
          boss.y < player.y + player.h - 1 && boss.y + boss.h > player.y + 1) {
        hurt();
      }
    }

    // partículas
    for (var p = parts.length - 1; p >= 0; p--) {
      var pa = parts[p]; pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.vy += 300 * dt; pa.life -= dt;
      if (pa.life <= 0) parts.splice(p, 1);
    }

    if (elScore) elScore.textContent = Math.floor(score);
    if (elLives) renderLives();
  }

  // ---------- Dibujo pixel-art ----------
  function px(x, y, w, h, c) { octx.fillStyle = c; octx.fillRect(x | 0, y | 0, w | 0, h | 0); }

  function drawBG() {
    // cielo degradé en bandas
    var g = octx.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, COL.sky1); g.addColorStop(0.6, COL.sky2); g.addColorStop(1, COL.sky3);
    octx.fillStyle = g; octx.fillRect(0, 0, LW, LH);
    // luna
    px(LW - 42, 14, 12, 12, COL.moon); px(LW - 38, 12, 8, 2, COL.sky1); px(LW - 36, 24, 6, 2, COL.sky1);
    // estrellas (deterministas)
    for (var s = 0; s < 18; s++) {
      var sx = (s * 97 + 13) % LW, sy = (s * 53 + 7) % (GROUND - 40);
      if ((s + Math.floor(dist / 40)) % 5 !== 0) px(sx, sy, 1, 1, COL.star);
    }
    // skyline parallax (2 capas)
    var o2 = (dist * 0.25) % 48;
    for (var b2 = -1; b2 < LW / 48 + 1; b2++) {
      var bx = b2 * 48 - o2; var bh = 22 + ((b2 * 7) % 3) * 6;
      px(bx, GROUND - bh, 30, bh, COL.bld2);
      for (var wy = GROUND - bh + 4; wy < GROUND - 4; wy += 7)
        for (var wx = bx + 4; wx < bx + 26; wx += 7) if ((wx + wy) % 3 === 0) px(wx, wy, 3, 3, COL.win);
    }
    var o1 = (dist * 0.5) % 40;
    for (var b1 = -1; b1 < LW / 40 + 1; b1++) {
      var cx = b1 * 40 - o1; var ch = 30 + ((b1 * 13) % 3) * 8;
      px(cx, GROUND - ch, 26, ch, COL.bld);
      for (var vy = GROUND - ch + 4; vy < GROUND - 3; vy += 6)
        for (var vx = cx + 3; vx < cx + 22; vx += 6) if ((vx * vy) % 4 === 0) px(vx, vy, 2, 2, COL.win);
    }
    // suelo
    px(0, GROUND, LW, LH - GROUND, COL.ground);
    px(0, GROUND, LW, 3, COL.grassDk); px(0, GROUND, LW, 1, COL.grass);
    var o0 = (dist) % 8;
    for (var gx = -o0; gx < LW; gx += 8) px(gx, GROUND + 5, 4, 1, COL.grassDk);
  }

  function drawCop(x, y, f, walk, flash) {
    x = x | 0; y = y | 0;
    var skin = flash ? COL.hit : COL.copSkin;
    var blue = flash ? COL.hit : COL.copBlue;
    var blueDk = flash ? COL.hit : COL.copBlueDk;
    // piernas (animación)
    var step = Math.floor(walk) % 2;
    if (player.onGround) {
      if (step === 0) { px(x + 2, y + 15, 3, 3, COL.copBelt); px(x + 7, y + 15, 3, 3, COL.copBelt); }
      else { px(x + 1, y + 15, 3, 3, COL.copBelt); px(x + 8, y + 15, 3, 3, COL.copBelt); }
    } else { px(x + 2, y + 15, 3, 2, COL.copBelt); px(x + 7, y + 15, 3, 2, COL.copBelt); }
    // cuerpo
    px(x + 1, y + 7, 10, 8, blue);
    px(x + 1, y + 13, 10, 2, COL.copBelt);        // cinturón
    px(x + 1, y + 7, 10, 1, blueDk);
    px(x + 5, y + 8, 1, 5, COL.copBadge);         // botones
    // cabeza
    px(x + 3, y + 2, 6, 5, skin);
    // gorra
    px(x + 2, y, 8, 3, COL.copCap);
    px(x + (f > 0 ? 8 : 1), y + 2, 3, 1, COL.copCap); // visera
    px(x + 4, y + 1, 3, 1, COL.copBadge);             // chapa gorra
    // brazo + pistola (apunta a la derecha)
    px(x + 8, y + 9, 4, 2, skin);
    px(x + 11, y + 9, 3, 2, COL.gun);
  }

  function drawEnemy(e) {
    var x = e.x | 0, y = e.y | 0, flash = e.hit > 0;
    if (e.dead) {
      // "explota" encogiéndose
      var s2 = Math.max(0, 1 - e.deadT / 0.25);
      px(x + e.w / 2 - 3 * s2, y + e.h / 2 - 3 * s2, 6 * s2, 6 * s2, flash ? COL.hit : (e.type === 2 ? COL.e2 : COL.e1));
      return;
    }
    if (e.type === 1) { // caminante terrestre
      var body = flash ? COL.hit : COL.e1, dk = flash ? COL.hit : COL.e1dk;
      px(x + 1, y + 2, 10, 9, body); px(x + 1, y + 9, 10, 2, dk);
      px(x, y + 4, 1, 5, dk); px(x + 11, y + 4, 1, 5, dk);
      px(x + 2, y + 4, 2, 2, COL.eEye); px(x + 7, y + 4, 2, 2, COL.eEye); // ojos
      px(x + 3, y + 7, 6, 1, COL.eEye);
      var s = Math.floor((dist / 4)) % 2;
      px(x + 2, y + 11, 2, 1, dk); px(x + (s ? 7 : 8), y + 11, 2, 1, dk);
    } else { // volador
      var body2 = flash ? COL.hit : COL.e2, dk2 = flash ? COL.hit : COL.e2dk;
      px(x + 2, y + 2, 8, 6, body2); px(x + 2, y + 6, 8, 2, dk2);
      // alas
      var fl = Math.floor(e.t * 2) % 2;
      if (fl) { px(x - 1, y + 1, 3, 2, dk2); px(x + 10, y + 1, 3, 2, dk2); }
      else { px(x - 1, y + 3, 3, 2, dk2); px(x + 10, y + 3, 3, 2, dk2); }
      px(x + 3, y + 3, 2, 2, COL.eEye); px(x + 7, y + 3, 2, 2, COL.eEye);
    }
  }

  function drawHydrant(hy) {
    var x = hy.x | 0, y = hy.y | 0;
    px(x + 1, y + 13, 10, 3, COL.hydDk);     // base
    px(x + 3, y + 4, 6, 10, COL.hyd);        // cuerpo
    px(x + 3, y + 4, 1, 10, COL.hydHi);      // brillo izquierdo
    px(x + 8, y + 4, 1, 10, COL.hydDk);      // sombra derecha
    px(x + 3, y + 1, 6, 3, COL.hyd);         // domo
    px(x + 4, y, 4, 1, COL.hyd);
    px(x + 5, y - 1, 2, 1, COL.hydCap);      // tapita dorada
    px(x, y + 7, 3, 3, COL.hyd); px(x, y + 7, 1, 3, COL.hydHi);        // nozzle izq
    px(x + 9, y + 7, 3, 3, COL.hyd); px(x + 11, y + 7, 1, 3, COL.hydDk); // nozzle der
    px(x + 5, y + 8, 2, 2, COL.hydDk);       // tuerca central
  }

  function drawPickup(it) {
    var x = it.x | 0, y = (it.y + Math.sin(it.t) * 3) | 0;
    if (it.type === "weapon") {
      px(x, y, 11, 11, COL.pickWDk); px(x + 1, y + 1, 9, 9, COL.pickW);
      px(x + 1, y + 1, 9, 1, COL.pickWHi); px(x + 1, y + 1, 1, 9, COL.pickWHi);
      px(x + 5, y + 3, 1, 6, "#2a1200"); px(x + 4, y + 4, 3, 1, "#2a1200"); px(x + 3, y + 5, 5, 1, "#2a1200"); // flecha ↑
    } else if (it.type === "shield") {
      px(x + 3, y, 5, 1, COL.shield); px(x + 1, y + 1, 9, 2, COL.shield); px(x, y + 3, 11, 4, COL.shield);
      px(x + 1, y + 7, 9, 2, COL.shield); px(x + 3, y + 9, 5, 1, COL.shield);
      px(x + 2, y + 2, 2, 2, COL.shieldHi); px(x + 4, y + 3, 3, 4, "#0a2a44"); // orbe-escudo
    } else {
      // corazón (recupera vida)
      px(x + 2, y + 1, 2, 2, COL.heart); px(x + 6, y + 1, 2, 2, COL.heart);
      px(x + 1, y + 3, 9, 3, COL.heart); px(x + 2, y + 6, 7, 1, COL.heart);
      px(x + 3, y + 7, 5, 1, COL.heart); px(x + 4, y + 8, 3, 1, COL.heart); px(x + 5, y + 9, 1, 1, COL.heartDk);
      px(x + 2, y + 2, 2, 1, COL.heartHi); px(x + 6, y + 2, 1, 1, COL.heartHi);
    }
  }

  function drawBoss() {
    var x = boss.x | 0, y = boss.y | 0, fl = boss.hit > 0;
    var c = fl ? COL.hit : COL.boss, dk = fl ? COL.hit : COL.bossDk, hi = fl ? COL.hit : COL.bossHi;
    px(x + 2, y, 3, 4, dk); px(x + 21, y, 3, 4, dk);                 // cuernos
    px(x + 2, y + 3, 22, 22, c); px(x + 2, y + 19, 22, 6, dk); px(x + 2, y + 3, 22, 1, hi);
    px(x, y + 8, 2, 12, dk); px(x + 24, y + 8, 2, 12, dk);
    px(x + 6, y + 9, 5, 4, COL.eEye); px(x + 15, y + 9, 5, 4, COL.eEye);       // ojos
    px(x + 7, y + 10, 2, 2, "#ff3b3b"); px(x + 16, y + 10, 2, 2, "#ff3b3b");   // pupilas
    px(x + 7, y + 18, 12, 2, COL.eEye);                                        // boca
    px(x + 9, y + 18, 1, 2, c); px(x + 12, y + 18, 1, 2, c); px(x + 15, y + 18, 1, 2, c); // dientes
    // barra de vida sobre el jefe
    var bw = boss.w, bb = y - 5;
    px(x, bb, bw, 3, COL.bossDk);
    px(x, bb, Math.max(0, Math.round(bw * boss.hp / boss.maxhp)), 3, COL.hpGood);
  }

  function drawFrame() {
    drawBG();
    // hidrantes (obstáculos en el piso)
    for (var hd = 0; hd < hydrants.length; hd++) drawHydrant(hydrants[hd]);
    // power-ups
    for (var pd = 0; pd < pickups.length; pd++) drawPickup(pickups[pd]);
    // balas
    for (var i = 0; i < bullets.length; i++) { var b = bullets[i]; var bc = b.pierce ? COL.pickW : COL.bullet; px(b.x, b.y, 4, 2, bc); px(b.x - 2, b.y, 2, 1, COL.bulletHot); }
    // enemigos
    for (var j = 0; j < enemies.length; j++) drawEnemy(enemies[j]);
    if (boss) drawBoss();
    // muzzle flash
    if (muzzle > 0) px(player.x + player.w + 2, player.y + 5, 3, 3, COL.bulletHot);
    // jugador (parpadea si invulnerable)
    if (player && !(invuln > 0 && Math.floor(invuln * 20) % 2)) drawCop(player.x, player.y, player.face, player.walk, invuln > 0 && Math.floor(invuln * 12) % 2 === 0 && invuln > 1);
    // burbuja de escudo alrededor del policía
    if (shield && player) {
      octx.globalAlpha = 0.5 + Math.sin(dist * 0.4) * 0.18;
      octx.strokeStyle = COL.shield;
      octx.strokeRect(player.x - 2.5, player.y - 2.5, player.w + 5, player.h + 5);
      octx.globalAlpha = 1;
    }
    // partículas
    for (var p = 0; p < parts.length; p++) { var pa = parts[p]; octx.globalAlpha = Math.max(0, pa.life * 2.2); px(pa.x, pa.y, 2, 2, pa.c); }
    octx.globalAlpha = 1;

    // indicador de arma (pips) + escudo, abajo-centro
    if (state === "playing") {
      var ip = weapon + 1, ix0 = (LW / 2 - (ip * 4) / 2) | 0;
      for (var wp = 0; wp < ip; wp++) px(ix0 + wp * 4, LH - 5, 3, 2, COL.bullet);
      if (shield) px((LW / 2 + (ip * 4) / 2 + 3) | 0, LH - 6, 3, 3, COL.shield);
    }
    // banner (jefe / power-up)
    if (bannerT > 0 && bannerTxt) {
      octx.globalAlpha = Math.min(1, bannerT * 2);
      octx.font = "bold 9px 'Space Grotesk', system-ui, sans-serif"; octx.textAlign = "center";
      var tw = octx.measureText(bannerTxt).width;
      octx.fillStyle = "rgba(10,8,20,0.72)"; octx.fillRect((LW / 2 - tw / 2 - 5) | 0, 28, (tw + 10) | 0, 13);
      octx.fillStyle = COL.text; octx.fillText(bannerTxt, LW / 2, 38);
      octx.textAlign = "left"; octx.globalAlpha = 1;
    }

    // blit al canvas real (con shake)
    var sx = 0, sy = 0;
    if (shakeT > 0) { sx = (Math.random() - 0.5) * 4 * dpr; sy = (Math.random() - 0.5) * 4 * dpr; }
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, sx, sy, canvas.width, canvas.height);
  }

  function renderLives() {
    if (!elLives) return;
    var total = Math.max(3, lives), s = "";
    for (var i = 0; i < total; i++) s += i < lives ? "▮" : "▯";
    elLives.textContent = s;
  }

  // ---------- Bucle ----------
  function loop(ts) {
    requestAnimationFrame(loop);
    if (state !== "playing") return;
    if (!last) last = ts;
    var dt = Math.min(0.05, (ts - last) / 1000); last = ts; acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    drawFrame();
  }

  // ---------- Flujo de partidas ----------
  function startGame() {
    reset(); state = "playing"; last = 0; acc = 0;
    overlay.classList.remove("show");
    if (elClaim) elClaim.hidden = true;
    renderLives();
    if (actx() && AC.state === "suspended") AC.resume();
  }

  function gameOver() {
    state = "over";
    var fs = Math.floor(score);
    if (fs > best) { best = fs; localStorage.setItem("jeal_best", String(best)); if (elBest) elBest.textContent = best; }
    ovTitle.textContent = "GAME OVER";
    ovText.innerHTML = "Puntaje: <b>" + fs + "</b> &nbsp;·&nbsp; Récord: <b>" + best + "</b>";
    ovForm.style.display = "flex";
    if (btnSave) { btnSave.disabled = false; btnSave.textContent = "Guardar"; }
    btnStart.textContent = "↻ Jugar de nuevo";
    ovName.value = localStorage.getItem("jeal_name") || "";
    overlay.classList.add("show");
    pendingScore = fs;
    // Sin cartel de "ganaste" en el momento: el #1 es SEMANAL (se define a fin de semana).
    if (elClaim) elClaim.hidden = true;
    drawFrame();
  }

  btnStart.addEventListener("click", startGame);

  // ---------- Ranking ----------
  var pendingScore = 0;
  var topScore = 0;   // mejor puntaje del ranking mostrado
  var boardMode = "week"; // "week" (de la semana, el que da el premio) | "all" (histórico)
  // Récord "de la casa": objetivo difícil (display, no va a la DB). Así no todos salen #1.
  // Tuneable: subí/bajá el score si queda muy fácil o muy difícil de superar.
  var HOUSE = { name: "🤖 Comisario 3D", score: 5000, house: true };
  var LB_URL = window.JEAL_LB_URL || null;
  var LB_KEY = window.JEAL_LB_KEY || null;

  function localBoard() { try { return JSON.parse(localStorage.getItem("jeal_lb") || "[]"); } catch (e) { return []; } }
  function saveLocal(name, sc) {
    var a = localBoard(); a.push({ name: name, score: sc }); a.sort(function (x, y) { return y.score - x.score; });
    a = a.slice(0, 10); localStorage.setItem("jeal_lb", JSON.stringify(a)); return a;
  }

  function renderBoard(list, scopeLabel) {
    if (!boardEl) return;
    if (boardScope) boardScope.textContent = scopeLabel;
    // Merge con el récord "de la casa" (siempre presente como objetivo).
    var merged = (list || []).slice();
    merged.push(HOUSE);
    merged.sort(function (a, b) { return (b.score | 0) - (a.score | 0); });
    merged = merged.slice(0, 10);
    topScore = merged.length ? (merged[0].score | 0) : 0;
    var html = "";
    for (var i = 0; i < merged.length; i++) {
      var it = merged[i];
      var nm = (it.name || "???").toString().slice(0, 16).replace(/[<>&]/g, "");
      html += '<li' + (it.house ? ' class="house"' : '') + '><span class="pos">' + (i + 1) + '</span><span class="nm">' + nm + '</span><span class="sc">' + (it.score | 0) + '</span></li>';
    }
    boardEl.innerHTML = html;
  }

  // Inicio de la semana (lunes 00:00) en ISO, para el ranking "de la semana".
  function weekStartISO() {
    var d = new Date(); var back = (d.getDay() + 6) % 7; // días desde el lunes
    d.setDate(d.getDate() - back); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  function fetchBoard() {
    if (LB_URL) {
      var h = { "Content-Type": "application/json" }; if (LB_KEY) { h.apikey = LB_KEY; h.Authorization = "Bearer " + LB_KEY; }
      var q = "?select=name,score&order=score.desc&limit=10";
      if (boardMode === "week") q += "&created_at=gte." + encodeURIComponent(weekStartISO());
      var label = boardMode === "week" ? "mundial · semana 🌎" : "mundial · histórico 🌎";
      fetch(LB_URL + q, { headers: h })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (d) { renderBoard(d, label); })
        .catch(function () { renderBoard(localBoard(), "local"); });
    } else {
      renderBoard(localBoard(), "local");
    }
  }

  function setBoardMode(m) {
    boardMode = m;
    if (btnWeek) btnWeek.classList.toggle("active", m === "week");
    if (btnAll) btnAll.classList.toggle("active", m === "all");
    fetchBoard();
  }
  if (btnWeek) btnWeek.addEventListener("click", function () { setBoardMode("week"); });
  if (btnAll) btnAll.addEventListener("click", function () { setBoardMode("all"); });

  function submitScore(name, sc) {
    saveLocal(name, sc);
    if (LB_URL) {
      var h = { "Content-Type": "application/json" }; if (LB_KEY) { h.apikey = LB_KEY; h.Authorization = "Bearer " + LB_KEY; h.Prefer = "return=minimal"; }
      fetch(LB_URL, { method: "POST", headers: h, body: JSON.stringify({ name: name.slice(0, 12), score: sc | 0 }) })
        .then(function () { setTimeout(fetchBoard, 400); })
        .catch(function () { fetchBoard(); });
    } else { fetchBoard(); }
  }

  if (ovForm) ovForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var nm = (ovName.value || "Anónimo").trim().slice(0, 12) || "Anónimo";
    localStorage.setItem("jeal_name", nm);
    btnSave.disabled = true; btnSave.textContent = "¡Guardado!";
    submitScore(nm, pendingScore);
    ovForm.style.display = "none";
  });

  // ---------- Init ----------
  window.addEventListener("resize", resize);
  reset();          // crear estado antes de cualquier dibujo
  resize();
  fetchBoard();
  requestAnimationFrame(loop);
  drawFrame();      // menú inicial dibujado
})();
