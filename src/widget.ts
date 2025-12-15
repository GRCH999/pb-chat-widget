type PBConfig = {
  webhookUrl: string;
  title?: string;
  position?: "bottom-right" | "bottom-left";
  primary?: string;
  zIndex?: number;
  greeting?: string;
};

/* ---------------- helpers ---------------- */

const waitForBody = (cb: () => void, tries = 600) => {
  if (document.body) return cb();
  if (tries <= 0) {
    console.error("[pb-chat-widget] document.body is still null");
    return;
  }
  requestAnimationFrame(() => waitForBody(cb, tries - 1));
};

const escapeHtml = (s: string) =>
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

const pickAnswer = (d: any): string => {
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

/* ---- scroll lock (fix double scroll) ---- */

const lockBodyScroll = () => {
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
};

const unlockBodyScroll = () => {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
};

/* ---------------- mount ---------------- */

const mount = () => {
  const cfg = window.PB_CHAT_WIDGET_CONFIG as PBConfig | undefined;

  if (!cfg?.webhookUrl) {
    console.error(
      "[pb-chat-widget] Missing config. Add window.PB_CHAT_WIDGET_CONFIG before loading the script."
    );
    return;
  }

  const title = cfg.title ?? "AI помощник";
  const position = cfg.position ?? "bottom-right";
  const primary = cfg.primary ?? "#1677ff";
  const zIndex = Number(cfg.zIndex ?? 2147483647);
  const greeting = cfg.greeting ?? "Привет! Чем помочь?";

  /* ---- host ---- */

  const host = document.createElement("div");
  host.id = "pb-chat-widget-host";
  host.style.position = "fixed";
  host.style.zIndex = String(zIndex);
  host.style.right = position === "bottom-right" ? "16px" : "auto";
  host.style.left = position === "bottom-left" ? "16px" : "auto";
  host.style.bottom = "16px";

  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  /* ---- styles (isolated) ---- */

  const style = document.createElement("style");
  style.textContent = `
:host, * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }

.bubble {
  width:56px;height:56px;border-radius:999px;background:${primary};
  box-shadow:0 12px 30px rgba(0,0,0,.18);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;user-select:none;
}
.bubble svg { width:26px;height:26px;fill:#fff; }

.win {
  position: fixed;
  ${position === "bottom-right" ? "right:16px" : "left:16px"};
  bottom:86px;
  width:360px;max-width:calc(100vw - 32px);
  height:520px;max-height:calc(100vh - 120px);
  background:#fff;border-radius:16px;
  box-shadow:0 18px 50px rgba(0,0,0,.22);
  overflow:hidden;display:none;
}
.win.open { display:flex;flex-direction:column; }

.header {
  height:56px;display:flex;align-items:center;justify-content:space-between;
  padding:0 14px;background:${primary};color:#fff;
}
.title { font-size:14px;font-weight:700; }
.close {
  width:34px;height:34px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;background:rgba(255,255,255,.18);
}

.body { flex:1;padding:14px;background:#f6f7fb;overflow:auto; }

.row { display:flex;margin:10px 0; }
.row.user { justify-content:flex-end; }

.msg {
  max-width:78%;padding:10px 12px;border-radius:14px;
  font-size:14px;line-height:1.35;white-space:pre-wrap;
  box-shadow:0 8px 22px rgba(0,0,0,.08);
}
.row.user .msg { background:${primary};color:#fff;border-bottom-right-radius:6px; }
.row.bot .msg { background:#fff;color:#111;border-bottom-left-radius:6px; }

.footer {
  padding:10px;background:#fff;border-top:1px solid rgba(0,0,0,.06);
  display:flex;gap:10px;align-items:center;
}
input {
  flex:1;height:42px;border-radius:999px;
  border:1px solid rgba(0,0,0,.14);
  padding:0 14px;font-size:14px;outline:none;
}
button {
  width:42px;height:42px;border-radius:999px;border:none;
  background:${primary};cursor:pointer;
  display:flex;align-items:center;justify-content:center;
}
button svg { width:20px;height:20px;fill:#fff; }

.typing { font-size:12px;color:rgba(0,0,0,.55);margin:6px 0 0 2px; }
`;
  shadow.appendChild(style);

  /* ---- markup ---- */

  const wrap = document.createElement("div");
  wrap.innerHTML = `
<div class="bubble" aria-label="Open chat">
  <svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v15.5A1.5 1.5 0 0 0 3.5 21H20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm-2 10H6v-2h12v2Zm0-4H6V6h12v2Zm-6 8H6v-2h6v2Z"/></svg>
</div>

<div class="win" role="dialog">
  <div class="header">
    <div class="title">${escapeHtml(title)}</div>
    <div class="close">✕</div>
  </div>
  <div class="body"></div>
  <div class="footer">
    <input class="inp" placeholder="Напишите сообщение…" />
    <button class="send" type="button">
      <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
    </button>
  </div>
</div>
`;
  shadow.appendChild(wrap);

  /* ---- logic ---- */

  const bubble = shadow.querySelector(".bubble") as HTMLDivElement;
  const win = shadow.querySelector(".win") as HTMLDivElement;
  const close = shadow.querySelector(".close") as HTMLDivElement;
  const bodyEl = shadow.querySelector(".body") as HTMLDivElement;
  const inputEl = shadow.querySelector(".inp") as HTMLInputElement;
  const sendBtn = shadow.querySelector(".send") as HTMLButtonElement;

  const scrollDown = () => (bodyEl.scrollTop = bodyEl.scrollHeight);

  const addMsg = (role: "user" | "bot", text: string) => {
    const row = document.createElement("div");
    row.className = `row ${role}`;
    row.innerHTML = `<div class="msg">${escapeHtml(text)}</div>`;
    bodyEl.appendChild(row);
    scrollDown();
  };

  const setTyping = (on: boolean) => {
    let el = shadow.querySelector(".typing") as HTMLDivElement | null;
    if (on && !el) {
      el = document.createElement("div");
      el.className = "typing";
      el.textContent = "Печатает…";
      bodyEl.appendChild(el);
      scrollDown();
    } else if (!on && el) {
      el.remove();
    }
  };

  const open = () => {
    win.classList.add("open");
    lockBodyScroll();
    setTimeout(() => inputEl.focus(), 0);
  };

  const closeWin = () => {
    win.classList.remove("open");
    unlockBodyScroll();
  };

  bubble.addEventListener("click", () =>
    win.classList.contains("open") ? closeWin() : open()
  );
  close.addEventListener("click", closeWin);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && win.classList.contains("open")) {
      closeWin();
    }
  });

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
        body: JSON.stringify({
          chatInput: text,
          sessionId: getSessionId(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      const answer = pickAnswer(data) || "Ок";
      setTyping(false);
      addMsg("bot", answer);
    } catch {
      setTyping(false);
      addMsg("bot", "Ошибка соединения");
    }
  };

  sendBtn.addEventListener("click", send);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  addMsg("bot", greeting);
};

waitForBody(mount);
