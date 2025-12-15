(() => {
  // ---- Read config from <script data-*> ----
  const currentScript = document.currentScript;
  const cfg = {
    webhookUrl: currentScript?.dataset?.webhookUrl || "",
    title: currentScript?.dataset?.title || "AI помощник",
    position: currentScript?.dataset?.position || "bottom-right",
    primary: currentScript?.dataset?.primary || "#1677ff",
    zIndex: Number(currentScript?.dataset?.zIndex || 99999),
  };

  if (!cfg.webhookUrl) {
    console.error("[pb-chat-widget] Missing data-webhook-url on script tag");
    return;
  }

  // ---- Helpers ----
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

  const posStyles = (() => {
    const isBR = cfg.position === "bottom-right";
    return {
      bubble: isBR ? "right:16px;bottom:16px;" : "left:16px;bottom:16px;",
      window: isBR ? "right:16px;bottom:86px;" : "left:16px;bottom:86px;",
    };
  })();

  // ---- Styles ----
  const style = document.createElement("style");
  style.textContent = `
    .pbw-reset, .pbw-reset * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .pbw-bubble {
      position: fixed; ${posStyles.bubble}
      width: 56px; height: 56px; border-radius: 999px;
      background: ${cfg.primary};
      box-shadow: 0 12px 30px rgba(0,0,0,.18);
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; user-select:none;
      z-index: ${cfg.zIndex};
    }
    .pbw-bubble svg { width: 26px; height: 26px; fill: #fff; }
    .pbw-window {
      position: fixed; ${posStyles.window}
      width: 360px; max-width: calc(100vw - 32px);
      height: 520px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 16px;
      box-shadow: 0 18px 50px rgba(0,0,0,.22);
      overflow: hidden;
      display: none;
      z-index: ${cfg.zIndex};
    }
    .pbw-window.pbw-open { display: flex; flex-direction: column; }
    .pbw-header {
      height: 56px; display:flex; align-items:center; justify-content:space-between;
      padding: 0 14px;
      background: ${cfg.primary}; color:#fff;
    }
    .pbw-title { font-size: 14px; font-weight: 700; }
    .pbw-close {
      width: 34px; height: 34px; border-radius: 10px;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; user-select:none;
      background: rgba(255,255,255,.18);
    }
    .pbw-body {
      flex: 1;
      padding: 14px;
      background: #f6f7fb;
      overflow-y: auto;
    }
    .pbw-msg { display:flex; margin: 10px 0; }
    .pbw-msg.pbw-user { justify-content: flex-end; }
    .pbw-bubblemsg {
      max-width: 78%;
      padding: 10px 12px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.35;
      white-space: pre-wrap;
      word-wrap: break-word;
      box-shadow: 0 8px 22px rgba(0,0,0,.08);
    }
    .pbw-user .pbw-bubblemsg {
      background: ${cfg.primary}; color: #fff;
      border-bottom-right-radius: 6px;
    }
    .pbw-bot .pbw-bubblemsg {
      background: #fff; color: #111;
      border-bottom-left-radius: 6px;
    }
    .pbw-footer {
      padding: 10px;
      background:#fff;
      border-top: 1px solid rgba(0,0,0,.06);
      display:flex; gap: 10px;
      align-items: center;
    }
    .pbw-input {
      flex:1;
      height: 42px;
      border-radius: 999px;
      border: 1px solid rgba(0,0,0,.14);
      padding: 0 14px;
      outline: none;
      font-size: 14px;
      background: #fff;
    }
    .pbw-send {
      width: 42px; height: 42px;
      border-radius: 999px;
      border: none;
      cursor: pointer;
      background: ${cfg.primary};
      box-shadow: 0 10px 24px rgba(0,0,0,.16);
      display:flex; align-items:center; justify-content:center;
    }
    .pbw-send:disabled { opacity: .6; cursor: not-allowed; }
    .pbw-send svg { width: 20px; height: 20px; fill: #fff; }
    .pbw-typing {
      font-size: 12px;
      color: rgba(0,0,0,.55);
      margin: 6px 0 0 2px;
    }
  `;
  document.head.appendChild(style);

  // ---- Markup ----
  const root = document.createElement("div");
  root.className = "pbw-reset";

  const bubble = document.createElement("div");
  bubble.className = "pbw-bubble";
  bubble.setAttribute("aria-label", "Open chat");
  bubble.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 2H4a2 2 0 0 0-2 2v15.5A1.5 1.5 0 0 0 3.5 21H20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm-2 10H6v-2h12v2Zm0-4H6V6h12v2Zm-6 8H6v-2h6v2Z"/>
    </svg>
  `;

  const win = document.createElement("div");
  win.className = "pbw-window";
  win.innerHTML = `
    <div class="pbw-header">
      <div class="pbw-title">${escapeHtml(cfg.title)}</div>
      <div class="pbw-close" title="Закрыть">✕</div>
    </div>
    <div class="pbw-body"></div>
    <div class="pbw-footer">
      <input class="pbw-input" placeholder="Напишите сообщение…" />
      <button class="pbw-send" type="button" aria-label="Send">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
        </svg>
      </button>
    </div>
  `;

  root.appendChild(bubble);
  root.appendChild(win);
  document.body.appendChild(root);

  const bodyEl = win.querySelector(".pbw-body");
  const inputEl = win.querySelector(".pbw-input");
  const sendBtn = win.querySelector(".pbw-send");
  const closeBtn = win.querySelector(".pbw-close");

  const scrollToBottom = () => {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  };

  const addMsg = (role, text) => {
    const row = document.createElement("div");
    row.className = `pbw-msg ${role === "user" ? "pbw-user" : "pbw-bot"}`;
    row.innerHTML = `<div class="pbw-bubblemsg">${escapeHtml(text)}</div>`;
    bodyEl.appendChild(row);
    scrollToBottom();
  };

  const setTyping = (on) => {
    let el = bodyEl.querySelector(".pbw-typing");
    if (on) {
      if (!el) {
        el = document.createElement("div");
        el.className = "pbw-typing";
        el.textContent = "Печатает…";
        bodyEl.appendChild(el);
        scrollToBottom();
      }
    } else {
      if (el) el.remove();
    }
  };

  const open = () => {
    win.classList.add("pbw-open");
    setTimeout(() => inputEl.focus(), 50);
  };
  const close = () => win.classList.remove("pbw-open");
  const toggle = () =>
    win.classList.contains("pbw-open") ? close() : open();

  bubble.addEventListener("click", toggle);
  closeBtn.addEventListener("click", close);

  const send = async () => {
    const text = inputEl.value.trim();
    if (!text) return;

    addMsg("user", text);
    inputEl.value = "";
    sendBtn.disabled = true;
    setTyping(true);

    try {
      const payload = {
        chatInput: text,
        sessionId: getSessionId(),
      };

      const res = await fetch(cfg.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      // Поддержка разных форматов ответа:
      // 1) { output: "..." }
      // 2) { text: "..." }
      // 3) [{ output: "..." }] или [{ text: "..." }]
      // 4) n8n chat trigger иногда возвращает { response: "..." }
      const pickText = (d) => {
        if (!d) return "";
        if (typeof d === "string") return d;
        if (Array.isArray(d)) return pickText(d[0]);
        return (
          d.output ||
          d.text ||
          d.response ||
          d.answer ||
          (d.data && (d.data.output || d.data.text)) ||
          ""
        );
      };

      const botText = pickText(data) || "Ок. (Пустой ответ от сервера)";
      setTyping(false);
      addMsg("bot", botText);
    } catch (e) {
      setTyping(false);
      addMsg("bot", "Ошибка соединения. Попробуйте ещё раз.");
      console.error("[pb-chat-widget] send error:", e);
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  };

  sendBtn.addEventListener("click", send);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  // Optional greeting (можешь убрать)
  addMsg("bot", "Привет! Чем помочь?");
})();
