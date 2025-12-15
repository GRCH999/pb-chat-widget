// v1.02 test
(() => {
  // --- robust config (Tilda-safe) ---
  const getConfig = () => {
    // 1) Prefer global config (works everywhere, incl. Tilda)
    const g = window.PB_CHAT_WIDGET_CONFIG;
    if (g && (g.webhookUrl || g.webhookURL)) {
      return {
        webhookUrl: g.webhookUrl || g.webhookURL,
        title: g.title || "AI помощник",
        position: g.position || "bottom-right",
        primary: g.primary || "#1677ff",
        zIndex: Number(g.zIndex || 99999),
      };
    }

    // 2) Fallback: try data-* on the script tag (non-Tilda friendly sometimes)
    const scripts = Array.from(document.getElementsByTagName("script"));
    const scriptEl =
      document.currentScript ||
      scripts.find((s) => (s.getAttribute("src") || "").includes("pb-chat-widget.js")) ||
      scripts.find((s) => s.dataset && s.dataset.webhookUrl);

    return {
      webhookUrl: scriptEl?.dataset?.webhookUrl || "",
      title: scriptEl?.dataset?.title || "AI помощник",
      position: scriptEl?.dataset?.position || "bottom-right",
      primary: scriptEl?.dataset?.primary || "#1677ff",
      zIndex: Number(scriptEl?.dataset?.zIndex || 99999),
    };
  };

  // Wait until body exists (Tilda can run scripts super-early)
  const waitForBody = (cb, tries = 600) => {
    if (document.body) return cb();
    if (tries <= 0) return console.error("[pb-chat-widget] document.body is still null");
    requestAnimationFrame(() => waitForBody(cb, tries - 1));
  };

  const mount = () => {
    const cfg = getConfig();

    if (!cfg.webhookUrl) {
      console.error(
        "[pb-chat-widget] Missing webhookUrl. Use:\n" +
        "window.PB_CHAT_WIDGET_CONFIG = { webhookUrl: 'https://...' } BEFORE loading pb-chat-widget.js"
      );
      return;
    }

    const escapeHtml = (s) =>
      String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const storageKey = "pb_chat_session_id";
    const getSessionId = () => {
      let id = localStorage.getItem(storageKey);
      if (!id) {
        id =
          (crypto?.randomUUID && crypto.randomUUID()) ||
          `sid_${Math.random().toString(16).slice(2)}_${Date.now()}`;
        localStorage.setItem(storageKey, id);
      }
      return id;
    };

    const isBR = cfg.position === "bottom-right";

    const style = document.createElement("style");
    style.textContent = `
.pbw-reset, .pbw-reset * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
.pbw-bubble { position: fixed; ${isBR ? "right:16px" : "left:16px"}; bottom:16px; width:56px;height:56px;border-radius:999px; background:${cfg.primary}; box-shadow:0 12px 30px rgba(0,0,0,.18); display:flex;align-items:center;justify-content:center; cursor:pointer; z-index:${cfg.zIndex}; }
.pbw-bubble svg { width:26px;height:26px;fill:#fff; }
.pbw-window { position: fixed; ${isBR ? "right:16px" : "left:16px"}; bottom:86px; width:360px; max-width:calc(100vw - 32px); height:520px; max-height:calc(100vh - 120px); background:#fff; border-radius:16px; box-shadow:0 18px 50px rgba(0,0,0,.22); overflow:hidden; display:none; z-index:${cfg.zIndex}; }
.pbw-window.pbw-open { display:flex; flex-direction:column; }
.pbw-header { height:56px; display:flex; align-items:center; justify-content:space-between; padding:0 14px; background:${cfg.primary}; color:#fff; }
.pbw-title { font-size:14px; font-weight:700; }
.pbw-close { width:34px;height:34px;border-radius:10px; display:flex;align-items:center;justify-content:center; cursor:pointer; background:rgba(255,255,255,.18); }
.pbw-body { flex:1; padding:14px; background:#f6f7fb; overflow-y:auto; }
.pbw-msg { display:flex; margin:10px 0; }
.pbw-msg.pbw-user { justify-content:flex-end; }
.pbw-bubblemsg { max-width:78%; padding:10px 12px; border-radius:14px; font-size:14px; line-height:1.35; white-space:pre-wrap; box-shadow:0 8px 22px rgba(0,0,0,.08); }
.pbw-user .pbw-bubblemsg { background:${cfg.primary}; color:#fff; border-bottom-right-radius:6px; }
.pbw-bot .pbw-bubblemsg { background:#fff; color:#111; border-bottom-left-radius:6px; }
.pbw-footer { padding:10px; background:#fff; border-top:1px solid rgba(0,0,0,.06); display:flex; gap:10px; align-items:center; }
.pbw-input { flex:1; height:42px; border-radius:999px; border:1px solid rgba(0,0,0,.14); padding:0 14px; font-size:14px; outline:none; }
.pbw-send { width:42px; height:42px; border-radius:999px; border:none; background:${cfg.primary}; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.pbw-send svg { width:20px; height:20px; fill:#fff; }
.pbw-typing { font-size:12px; color:rgba(0,0,0,.55); margin:6px 0 0 2px; }
.pbw-window,
.pbw-window * {
  pointer-events: auto !important;
}

.pbw-window {
  z-index: 2147483647 !important;
}

.pbw-bubble {
  z-index: 2147483647 !important;
}

.pbw-input {
  pointer-events: auto !important;
  user-select: text !important;
  -webkit-user-select: text !important;
  touch-action: manipulation !important;
}
`;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.className = "pbw-reset";
    root.innerHTML = `
<div class="pbw-bubble">
  <svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v15.5A1.5 1.5 0 0 0 3.5 21H20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm-2 10H6v-2h12v2Zm0-4H6V6h12v2Zm-6 8H6v-2h6v2Z"/></svg>
</div>
<div class="pbw-window">
  <div class="pbw-header">
    <div class="pbw-title">${escapeHtml(cfg.title)}</div>
    <div class="pbw-close">✕</div>
  </div>
  <div class="pbw-body"></div>
  <div class="pbw-footer">
    <input class="pbw-input" placeholder="Напишите сообщение…" />
    <button class="pbw-send" type="button" aria-label="Send">
      <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
    </button>
  </div>
</div>
`;
    document.body.appendChild(root);

    const bubble = root.querySelector(".pbw-bubble");
    const win = root.querySelector(".pbw-window");
    const bodyEl = root.querySelector(".pbw-body");
    const inputEl = root.querySelector(".pbw-input");
    const sendBtn = root.querySelector(".pbw-send");
    const closeBtn = root.querySelector(".pbw-close");

    const addMsg = (role, text) => {
      const row = document.createElement("div");
      row.className = `pbw-msg ${role === "user" ? "pbw-user" : "pbw-bot"}`;
      row.innerHTML = `<div class="pbw-bubblemsg">${escapeHtml(text)}</div>`;
      bodyEl.appendChild(row);
      bodyEl.scrollTop = bodyEl.scrollHeight;
    };

    const setTyping = (on) => {
      let el = bodyEl.querySelector(".pbw-typing");
      if (on && !el) {
        el = document.createElement("div");
        el.className = "pbw-typing";
        el.textContent = "Печатает…";
        bodyEl.appendChild(el);
        bodyEl.scrollTop = bodyEl.scrollHeight;
      }
      if (!on && el) el.remove();
    };

    const pickAnswer = (d) => {
      if (!d) return "";
      if (typeof d === "string") return d;
      if (Array.isArray(d)) return pickAnswer(d[0]);
      return (
        d.output ||
        d.text ||
        d.response ||
        d.answer ||
        (d.data && (d.data.output || d.data.text)) ||
        ""
      );
    };

    bubble.onclick = () => win.classList.toggle("pbw-open");
    closeBtn.onclick = () => win.classList.remove("pbw-open");

    const send = async () => {
      const text = inputEl.value.trim();
      if (!text) return;

      addMsg("user", text);
      inputEl.value = "";
      setTyping(true);

      try {
        const res = await fetch(cfg.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatInput: text, sessionId: getSessionId() }),
        });

        const data = await res.json().catch(() => ({}));
        const answer = pickAnswer(data) || "Ок";
        setTyping(false);
        addMsg("bot", answer);
      } catch (e) {
        setTyping(false);
        addMsg("bot", "Ошибка соединения");
      }
    };

    sendBtn.onclick = send;
    inputEl.onkeydown = (e) => e.key === "Enter" && send();

    addMsg("bot", "Привет! Чем помочь?");
  };

  waitForBody(mount);
})();
