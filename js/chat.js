/* ============================================================
   Widget de chat de JEAL' Studio 3D.
   Habla con el bot del ESTUDIO (studio-web), aislado del de LAMBDA.
   Si el endpoint no está disponible, degrada elegante a WhatsApp.
   Vanilla JS, autosuficiente (inyecta su estilo y su DOM).
   ============================================================ */
(function () {
  "use strict";
  var ENDPOINT = window.JEAL_STUDIO_BOT || null;
  var KEY = window.JEAL_LB_KEY || null;
  var WA = "https://wa.me/5491161067544?text=" + encodeURIComponent("¡Hola! Te escribo desde la web de JEAL Studio 3D 🖨️");

  // session persistente
  var SID;
  try { SID = localStorage.getItem("jeal3d_sid"); } catch (e) {}
  if (!SID) { SID = "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); try { localStorage.setItem("jeal3d_sid", SID); } catch (e) {} }

  // ---------- estilos ----------
  var css = document.createElement("style");
  css.textContent = [
    ".cw-fab{position:fixed;left:18px;bottom:18px;z-index:60;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;display:grid;place-items:center;background:linear-gradient(120deg,var(--violet,#9b5bff),var(--pink,#ff4fd8));box-shadow:0 10px 30px rgba(155,91,255,.45);transition:transform .15s}",
    ".cw-fab:hover{transform:translateY(-3px) scale(1.04)}",
    ".cw-fab svg{width:27px;height:27px;color:#fff}",
    ".cw-fab .cw-dot{position:absolute;top:2px;right:2px;width:13px;height:13px;border-radius:50%;background:#43e06a;border:2px solid #0b0a0f}",
    ".cw-panel{position:fixed;left:18px;bottom:84px;z-index:61;width:350px;max-width:calc(100vw - 36px);height:480px;max-height:calc(100vh - 120px);display:none;flex-direction:column;border-radius:18px;overflow:hidden;border:1px solid var(--line,rgba(155,91,255,.22));background:#120c1f;box-shadow:0 24px 70px rgba(0,0,0,.6)}",
    ".cw-panel.open{display:flex;animation:cwup .22s ease-out}",
    "@keyframes cwup{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}",
    ".cw-head{display:flex;align-items:center;gap:10px;padding:13px 14px;background:linear-gradient(120deg,rgba(155,91,255,.22),rgba(255,79,216,.14));border-bottom:1px solid var(--line,rgba(155,91,255,.22))}",
    ".cw-head .cw-av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:18px;background:linear-gradient(120deg,var(--violet,#9b5bff),var(--pink,#ff4fd8))}",
    ".cw-head b{font-family:var(--display,sans-serif);font-size:.95rem;color:#fff;display:block;line-height:1.1}",
    ".cw-head span{font-size:.72rem;color:#43e06a}",
    ".cw-x{margin-left:auto;background:none;border:none;color:#b4b4c6;font-size:1.3rem;cursor:pointer;line-height:1;padding:4px}",
    ".cw-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px}",
    ".cw-m{max-width:82%;padding:9px 12px;border-radius:14px;font-size:.9rem;line-height:1.35;white-space:pre-wrap;word-wrap:break-word}",
    ".cw-m.bot{align-self:flex-start;background:rgba(255,255,255,.06);border:1px solid var(--line,rgba(155,91,255,.2));color:#f3eefb;border-bottom-left-radius:4px}",
    ".cw-m.user{align-self:flex-end;background:linear-gradient(120deg,var(--violet,#9b5bff),var(--pink,#ff4fd8));color:#fff;border-bottom-right-radius:4px}",
    ".cw-m a{color:#fff;text-decoration:underline}",
    ".cw-typing{align-self:flex-start;display:flex;gap:4px;padding:11px 13px}",
    ".cw-typing i{width:7px;height:7px;border-radius:50%;background:var(--violet-soft,#c7a3ff);animation:cwbl 1s infinite}",
    ".cw-typing i:nth-child(2){animation-delay:.18s}.cw-typing i:nth-child(3){animation-delay:.36s}",
    "@keyframes cwbl{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}",
    ".cw-in{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line,rgba(155,91,255,.22))}",
    ".cw-in textarea{flex:1;resize:none;height:40px;max-height:90px;padding:9px 11px;border-radius:12px;border:1px solid var(--line,rgba(155,91,255,.22));background:rgba(255,255,255,.05);color:#f3eefb;font:inherit;font-size:.9rem;outline:none}",
    ".cw-send{width:40px;height:40px;flex:none;border:none;border-radius:12px;cursor:pointer;display:grid;place-items:center;background:linear-gradient(120deg,var(--violet,#9b5bff),var(--pink,#ff4fd8))}",
    ".cw-send svg{width:18px;height:18px;color:#fff}.cw-send:disabled{opacity:.5;cursor:default}",
    "@media (max-width:620px){.cw-fab{left:14px;bottom:14px}.cw-panel{left:12px;right:12px;bottom:78px;width:auto}}"
  ].join("");
  document.head.appendChild(css);

  // ---------- DOM ----------
  var fab = document.createElement("button");
  fab.className = "cw-fab"; fab.setAttribute("aria-label", "Chatear con JEAL Studio 3D");
  fab.innerHTML = '<span class="cw-dot"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  var panel = document.createElement("div");
  panel.className = "cw-panel";
  panel.innerHTML =
    '<div class="cw-head"><div class="cw-av">🖨️</div><div><b>JEAL&#39; Studio 3D</b><span>● En línea · te responde al toque</span></div><button class="cw-x" aria-label="Cerrar">×</button></div>' +
    '<div class="cw-msgs" id="cw-msgs"></div>' +
    '<div class="cw-in"><textarea id="cw-text" rows="1" placeholder="Escribí tu consulta…" maxlength="2000"></textarea>' +
    '<button class="cw-send" id="cw-send" aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var msgsEl = panel.querySelector("#cw-msgs");
  var textEl = panel.querySelector("#cw-text");
  var sendEl = panel.querySelector("#cw-send");
  var greeted = false, busy = false;

  function esc(s) { return (s || "").replace(/[<>&]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]; }); }
  function linkify(s) { return esc(s).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }

  function addMsg(text, who) {
    var d = document.createElement("div"); d.className = "cw-m " + who; d.innerHTML = linkify(text);
    msgsEl.appendChild(d); msgsEl.scrollTop = msgsEl.scrollHeight; return d;
  }
  function typing(on) {
    var t = msgsEl.querySelector(".cw-typing");
    if (on && !t) { var e = document.createElement("div"); e.className = "cw-typing"; e.innerHTML = "<i></i><i></i><i></i>"; msgsEl.appendChild(e); msgsEl.scrollTop = msgsEl.scrollHeight; }
    else if (!on && t) t.remove();
  }

  function open() {
    panel.classList.add("open");
    fab.style.display = "none";
    if (!greeted) { greeted = true; addMsg("¡Hola! 👋 Soy el asistente de JEAL' Studio 3D. Contame qué querés imprimir (o mandame una idea) y te ayudo a cotizarlo. 🖨️", "bot"); }
    setTimeout(function () { textEl.focus(); }, 100);
  }
  function close() { panel.classList.remove("open"); fab.style.display = "grid"; }

  fab.addEventListener("click", open);
  panel.querySelector(".cw-x").addEventListener("click", close);

  function send() {
    var txt = (textEl.value || "").trim();
    if (!txt || busy) return;
    addMsg(txt, "user"); textEl.value = ""; textEl.style.height = "40px";
    busy = true; sendEl.disabled = true; typing(true);

    if (!ENDPOINT) { degrade(); return; }
    var headers = { "Content-Type": "application/json" };
    if (KEY) { headers.apikey = KEY; headers.Authorization = "Bearer " + KEY; }
    fetch(ENDPOINT, { method: "POST", headers: headers, body: JSON.stringify({ sessionId: SID, message: txt }) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) { typing(false); addMsg((d && d.reply) || "¿Me lo repetís?", "bot"); done(); })
      .catch(function () { degrade(); });
  }
  function degrade() {
    typing(false);
    addMsg('Uy, no me pude conectar en este momento. Escribime directo por WhatsApp y te respondo: <a href="' + WA + '" target="_blank" rel="noopener">abrir WhatsApp</a> 💬', "bot");
    done();
  }
  function done() { busy = false; sendEl.disabled = false; textEl.focus(); }

  sendEl.addEventListener("click", send);
  textEl.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  textEl.addEventListener("input", function () { textEl.style.height = "40px"; textEl.style.height = Math.min(90, textEl.scrollHeight) + "px"; });
})();
